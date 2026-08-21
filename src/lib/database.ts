import { supabase } from './supabase';

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
  return OPTIONAL_PLAYER_COLUMNS.some(
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
}

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

    // Insert frames
    const framesWithMatchId = frames.map(f => ({ ...f, match_id: matchId }));
    const { error: framesError } = await supabase
      .from('match_frames')
      .insert(framesWithMatchId);

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

    const { data, error } = await supabase
      .from('century_games')
      .insert({ ...game, user_id: user.id })
      .select('id')
      .single();

    if (error) throw error;
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
