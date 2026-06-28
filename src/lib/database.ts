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

    // Insert players
    const playersWithMatchId = players.map(p => ({ ...p, match_id: matchId }));
    const { error: playersError } = await supabase
      .from('match_players')
      .insert(playersWithMatchId);

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
    const { error } = await supabase
      .from('matches')
      .delete()
      .eq('id', matchId);

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
  }[];
  frames: {
    frameNumber: number;
    durationMs: number;
    actionLog: any[];
  }[];
}

export function saveMatchLocally(match: LocalMatchRecord): void {
  const existing = getLocalMatchHistory();
  existing.unshift(match);
  // Keep last 100 matches
  const trimmed = existing.slice(0, 100);
  localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(trimmed));
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
  const existing = getLocalMatchHistory();
  const filtered = existing.filter(m => m.id !== matchId);
  localStorage.setItem(LOCAL_HISTORY_KEY, JSON.stringify(filtered));
}
