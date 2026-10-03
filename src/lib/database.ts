import { supabase } from './supabase';
import type { ActionLogEntry } from '../engine/types';
import { totalsFromFrames, savedWinner, isEmptyRecord } from './results';
import type { CenturyLogEntry } from '../engine/century';

export interface MatchRecord {
  id?: string;
  user_id?: string;
  mode: string;
  reds_count: number;
  best_of: number;
  created_at?: string;
  duration_ms: number;
  winner_name: string;
}

export interface MatchPlayerRecord {
  id?: string;
  match_id?: string;
  player_name: string;
  team_name?: string;
  total_score: number;
  highest_break: number;
  frames_won: number;
  fouls_committed: number;
  time_spent_ms: number;
  /** Breaks of 100+. Requires the milestone migration; see docs/schema.sql. */
  centuries?: number;
  /** Breaks of 50-99. Requires the milestone migration. */
  half_centuries?: number;
}

/** Columns added after launch, which an un-migrated database will not have. */
const OPTIONAL_PLAYER_COLUMNS = ['centuries', 'half_centuries'] as const;

/** PostgREST reports an unknown column rather than ignoring it. */
function isUnknownColumnError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === 'PGRST204') return true;
  const message = e.message ?? '';
  return [...OPTIONAL_PLAYER_COLUMNS, ...OPTIONAL_FRAME_COLUMNS].some(
    (c) => message.includes(c) && /column|schema/i.test(message)
  );
}

function withoutOptionalColumns(
  rows: (MatchPlayerRecord & { match_id: string })[]
) {
  return rows.map((row) => {
    const copy: Record<string, unknown> = { ...row };
    for (const column of OPTIONAL_PLAYER_COLUMNS) delete copy[column];
    return copy;
  });
}

export interface MatchFrameRecord {
  id?: string;
  match_id?: string;
  frame_number: number;
  duration_ms: number;
  action_log: unknown[];
  /** Who won the frame (player or team); null if unfinished or level. Added in 2.0. */
  winner_name?: string | null;
  /** Frame points by player or team name. Added in 2.0. */
  scores?: Record<string, number> | null;
}

/** Frame columns added in 2.0, which an un-migrated database will not have. */
const OPTIONAL_FRAME_COLUMNS = ['winner_name', 'scores'] as const;

/**
 * Save a completed match to Supabase
 */
export async function saveMatch(
  match: MatchRecord,
  players: MatchPlayerRecord[],
  frames: MatchFrameRecord[]
): Promise<{ success: boolean; matchId?: string; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'No authenticated user session found.' };

    // Insert match
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .insert({ ...match, user_id: user.id })
      .select('id')
      .single();

    if (matchError) throw matchError;
    const matchId = matchData.id;

    // Insert players. Century and half-century counts were added after the
    // original schema, so a database that has not run the migration rejects
    // them. Losing the whole match over two optional stats would be worse than
    // losing the stats, so fall back and save the rest.
    const playersWithMatchId = players.map(p => ({ ...p, match_id: matchId }));
    let { error: playersError } = await supabase
      .from('match_players')
      .insert(playersWithMatchId);

    if (playersError && isUnknownColumnError(playersError)) {
      console.warn(
        'match_players is missing the milestone columns — saving without them. ' +
        'Run the migration in docs/schema.sql to record centuries.'
      );
      ({ error: playersError } = await supabase
        .from('match_players')
        .insert(withoutOptionalColumns(playersWithMatchId)));
    }

    if (playersError) throw playersError;

    // Insert frames. Winner and scores per frame came in 2.0; without the
    // migration, save the frames without them rather than lose the match.
    const framesWithMatchId = frames.map(f => ({ ...f, match_id: matchId }));
    let { error: framesError } = await supabase
      .from('match_frames')
      .insert(framesWithMatchId);

    if (framesError && isUnknownColumnError(framesError)) {
      console.warn('match_frames is missing winner_name/scores — saving without them.');
      ({ error: framesError } = await supabase
        .from('match_frames')
        .insert(framesWithMatchId.map((f) => {
          const copy: Record<string, unknown> = { ...f };
          for (const column of OPTIONAL_FRAME_COLUMNS) delete copy[column];
          return copy;
        })));
    }

    if (framesError) throw framesError;

    return { success: true, matchId };
  } catch (error: any) {
    console.error('Error saving match:', error);
    return { success: false, error: error?.message || String(error) };
  }
}

/**
 * Get match history for the current user
 */
export async function getMatchHistory(): Promise<(MatchRecord & { players: MatchPlayerRecord[] })[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('matches')
      .select(`
        *,
        players:match_players(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching match history:', error);
    return [];
  }
}

/**
 * Every match for the signed-in user, newest first (paged past PostgREST's
 * row cap). History and stats need all of them, not the latest 50.
 */
export async function getAllMatches(): Promise<(MatchRecord & { players: MatchPlayerRecord[] })[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    const out: (MatchRecord & { players: MatchPlayerRecord[] })[] = [];
    const page = 200;
    for (let from = 0; from < 5000; from += page) {
      const { data, error } = await supabase
        .from('matches')
        .select('*, players:match_players(*)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, from + page - 1);
      if (error) throw error;
      out.push(...(data || []));
      if (!data || data.length < page) break;
    }
    return out;
  } catch (error) {
    console.error('Error fetching all matches:', error);
    return [];
  }
}

/**
 * Each match's frame winners in play order, by match id — light enough for
 * the dashboard (no action logs). Frames saved before 2.0 have no winner.
 */
export async function getFrameWinners(matchIds: string[]): Promise<Map<string, (string | null)[]>> {
  const out = new Map<string, (string | null)[]>();
  try {
    for (let i = 0; i < matchIds.length; i += 100) {
      const { data, error } = await supabase
        .from('match_frames')
        .select('match_id, frame_number, winner_name')
        .in('match_id', matchIds.slice(i, i + 100))
        .order('frame_number', { ascending: true });
      if (error) throw error;
      for (const r of (data || []) as { match_id: string; winner_name: string | null }[]) {
        const list = out.get(r.match_id) ?? [];
        list.push(r.winner_name ?? null);
        out.set(r.match_id, list);
      }
    }
  } catch (error) {
    // Before the migration the column doesn't exist; stats fall back to logs.
    console.warn('Frame winners unavailable:', error);
  }
  return out;
}

/** Frame logs for many matches at once (for stats). */
export async function getFramesForMatches(
  matchIds: string[]
): Promise<Pick<MatchFrameRecord, 'match_id' | 'frame_number' | 'action_log'>[]> {
  const out: Pick<MatchFrameRecord, 'match_id' | 'frame_number' | 'action_log'>[] = [];
  try {
    for (let i = 0; i < matchIds.length; i += 100) {
      const { data, error } = await supabase
        .from('match_frames')
        .select('match_id, frame_number, action_log')
        .in('match_id', matchIds.slice(i, i + 100));
      if (error) throw error;
      out.push(...(data || []));
    }
  } catch (error) {
    console.error('Error fetching frames:', error);
  }
  return out;
}

/**
 * Delete a match
 */
export async function deleteMatch(matchId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    // Scope delete to the current user as defense-in-depth alongside RLS
    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', matchId)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting match:', error);
    return false;
  }
}

/**
 * Fetch frames for a specific match from Supabase
 */
export async function getMatchFrames(matchId: string): Promise<MatchFrameRecord[]> {
  try {
    const { data, error } = await supabase
      .from('match_frames')
      .select('*')
      .eq('match_id', matchId)
      .order('frame_number', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('Error fetching match frames:', error);
    return [];
  }
}

export async function getUserStats() {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // 1. Efficient COUNT query for total games
    const { count, error: countError } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (countError) throw countError;
    const totalGames = count || 0;

    // 2. Fetch the top highest_break directly from matching user matches via inner join
    const { data: topBreakRecord, error: breakError } = await supabase
      .from('match_players')
      .select('highest_break, matches!inner(user_id)')
      .eq('matches.user_id', user.id)
      .order('highest_break', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (breakError) throw breakError;
    const highestBreak = topBreakRecord?.highest_break || 0;

    return { totalGames, highestBreak };
  } catch (error) {
    console.error('Error fetching user stats:', error);
    return { totalGames: 0, highestBreak: 0 };
  }
}

// --- Local Storage Fallback for Guest Sessions ---

const LOCAL_HISTORY_KEY = 'snookerbee-history';

export interface LocalMatchRecord {
  id: string;
  mode: string;
  redsCount: number;
  bestOf: number;
  createdAt: string;
  durationMs: number;
  winnerName: string;
  players: {
    name: string;
    teamName?: string;
    totalScore: number;
    highestBreak: number;
    framesWon: number;
    foulsCommitted: number;
    timeSpentMs: number;
    centuries?: number;
    halfCenturies?: number;
  }[];
  frames: {
    frameNumber: number;
    durationMs: number;
    actionLog: any[];
    /** Added in 2.0; older records lack it. */
    winnerName?: string | null;
    scores?: Record<string, number>;
  }[];
}

/**
 * Store a match on the device.
 *
 * Every record embeds the full action log of every frame, so a long best-of-7
 * can be tens of KB and 100 of them can pass the ~5MB origin quota. setItem
 * then throws, and Safari private mode can throw on the very first write. A
 * guest losing every future save — with no explanation — is a worse outcome
 * than losing the oldest matches, so on quota we shed history and retry.
 *
 * Returns false when the match could not be stored at all.
 */
export function saveMatchLocally(match: LocalMatchRecord): boolean {
  const existing = getLocalMatchHistory();
  existing.unshift(match);

  // Halve the retained history on each attempt rather than guessing a size.
  for (const keep of [100, 50, 20, 5, 1]) {
    try {
      localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(existing.slice(0, keep)));
      return true;
    } catch {
      /* quota — try again with less */
    }
  }

  console.error('Could not save match locally: storage is full.');
  return false;
}

export function getLocalMatchHistory(): LocalMatchRecord[] {
  try {
    const data = localStorage.getItem(LOCAL_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

const REPAIR_FLAG = 'snookerbee:history-repaired-v1';

/**
 * One-time fix for guest history saved before match totals spanned every
 * frame: rebuild points and fouls from the frame logs, fill in winners that
 * were saved as "Unknown", and drop matches where nothing was scored.
 * Team matches keep their stored points (foul points went to a team, not a
 * player), but still get a winner.
 */
export function repairLocalHistory(): void {
  try {
    if (localStorage.getItem(REPAIR_FLAG)) return;
    const history = getLocalMatchHistory();
    const repaired = history
      .map((m) => {
        const isTeam = m.mode === 'team';
        const frames = (m.frames ?? []) as { actionLog: ActionLogEntry[] }[];
        const players = isTeam || frames.length === 0
          ? m.players
          : (() => {
              const t = totalsFromFrames(frames, m.players);
              return m.players.map((p) => ({
                ...p,
                totalScore: t.points[p.name] ?? p.totalScore,
                foulsCommitted: t.fouls[p.name] ?? p.foulsCommitted,
              }));
            })();
        const winner = savedWinner(m.winnerName, players);
        return { ...m, players, winnerName: winner ?? 'Draw' };
      })
      .filter((m) => !isEmptyRecord(m.players));
    localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(repaired));
    localStorage.setItem(REPAIR_FLAG, new Date().toISOString());
  } catch {
    /* best effort: the old rows still display */
  }
}

export function deleteLocalMatch(matchId: string): void {
  try {
    const existing = getLocalMatchHistory();
    localStorage.setItem(
      LOCAL_HISTORY_KEY,
      JSON.stringify(existing.filter(m => m.id !== matchId))
    );
  } catch {
    /* a delete that cannot be written is not worth crashing over */
  }
}


/* ==========================================================================
   Century games
   --------------------------------------------------------------------------
   A different game from snooker with a different shape of result — players
   finish in an order and one is left short — so it gets its own tables rather
   than being bent into `matches`.
   ======================================================================== */

export interface CenturyGameRecord {
  id?: string;
  user_id?: string;
  target: number;
  created_at?: string;
  duration_ms: number;
  loser_name: string | null;
  /** Points for a red in this game. Added later; see docs/schema.sql. */
  red_value?: number;
  /** Play-by-play. Added later; see docs/schema.sql. */
  action_log?: CenturyLogEntry[];
}

/** century_games columns an un-migrated database will not have. */
const OPTIONAL_CENTURY_COLUMNS = ['red_value', 'action_log'] as const;

function isUnknownCenturyColumn(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  if (e.code === 'PGRST204') return true;
  const message = e.message ?? '';
  return OPTIONAL_CENTURY_COLUMNS.some(
    (c) => message.includes(c) && /column|schema/i.test(message)
  );
}

export interface CenturyPlayerRecord {
  id?: string;
  game_id?: string;
  player_name: string;
  final_score: number;
  /** Finishing position; null means they never reached the target. */
  finished_at: number | null;
  balls_potted: number;
  reds_potted: number;
  reds_missed: number;
  fouls: number;
}

export async function saveCenturyGame(
  game: CenturyGameRecord,
  players: CenturyPlayerRecord[]
): Promise<{ success: boolean; gameId?: string; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'No authenticated user session found.' };

    const insertGame = (row: Record<string, unknown>) =>
      supabase.from('century_games').insert(row).select('id').single();

    let { data, error } = await insertGame({ ...game, user_id: user.id });

    // Losing the game over the red value or the log would be worse than
    // losing those two fields, so a database without them still saves.
    if (error && isUnknownCenturyColumn(error)) {
      console.warn(
        'century_games is missing red_value/action_log — saving without them. ' +
        'Run the migration in docs/schema.sql.'
      );
      const slim: Record<string, unknown> = { ...game, user_id: user.id };
      for (const c of OPTIONAL_CENTURY_COLUMNS) delete slim[c];
      ({ data, error } = await insertGame(slim));
    }

    if (error) throw error;
    if (!data) throw new Error('Century game was not saved.');
    const gameId = data.id;

    const { error: playersError } = await supabase
      .from('century_players')
      .insert(players.map((p) => ({ ...p, game_id: gameId })));

    if (playersError) throw playersError;

    return { success: true, gameId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error saving century game:', message);
    return { success: false, error: message };
  }
}

/* --------------------------------------------------- local century history */

const LOCAL_CENTURY_KEY = 'snookerbee_century_history';

export interface LocalCenturyRecord {
  id: string;
  target: number;
  createdAt: string;
  durationMs: number;
  loserName: string | null;
  /** Missing on games saved before the red value option (they were 10). */
  redValue?: number;
  /** Missing on games saved before the play-by-play was kept. */
  actionLog?: CenturyLogEntry[];
  players: {
    name: string;
    score: number;
    finishedAt: number | null;
    potted: number;
    redsPotted: number;
    redsMissed: number;
    fouls: number;
  }[];
}

export function saveCenturyGameLocally(game: LocalCenturyRecord): boolean {
  try {
    const existing = getLocalCenturyHistory();
    existing.unshift(game);
    localStorage.setItem(LOCAL_CENTURY_KEY, JSON.stringify(existing.slice(0, 50)));
    return true;
  } catch {
    return false;
  }
}

export function getLocalCenturyHistory(): LocalCenturyRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_CENTURY_KEY);
    return raw ? (JSON.parse(raw) as LocalCenturyRecord[]) : [];
  } catch {
    return [];
  }
}

export function deleteLocalCenturyGame(id: string): void {
  try {
    localStorage.setItem(
      LOCAL_CENTURY_KEY,
      JSON.stringify(getLocalCenturyHistory().filter((g) => g.id !== id))
    );
  } catch {
    /* a delete that cannot be written is not worth crashing over */
  }
}

export type CenturyGameWithPlayers = CenturyGameRecord & {
  players: CenturyPlayerRecord[];
};

export async function getCenturyHistory(): Promise<CenturyGameWithPlayers[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('century_games')
      .select('*, players:century_players(*)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return (data as CenturyGameWithPlayers[]) || [];
  } catch (error) {
    console.error('Error fetching century history:', error);
    return [];
  }
}

export async function deleteCenturyGame(id: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;

    const { error } = await supabase
      .from('century_games')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting century game:', error);
    return false;
  }
}
