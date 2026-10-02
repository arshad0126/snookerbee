/**
 * results — match totals, winners and the small formatting rules every
 * history view shares.
 *
 * Why this exists: the engine resets each player's score and foul count at
 * the start of every frame, and matches used to be saved with whatever was
 * left — the LAST frame only. A three-frame match read "66 – 26 – 23" when
 * the real totals were 128 – 115 – 99. Matches that ended before anyone
 * reached the frames-to-win mark were also saved with winner "Unknown".
 * Totals now come from every frame, and the winner from frames won, then
 * points.
 */

import type { ActionLogEntry, GameState } from '../engine/types';

/* ------------------------------------------------------------ live match */

export interface MatchTotals {
  /** Points across every frame, by player id. */
  points: Record<string, number>;
  /** Fouls across every frame, by player id. */
  fouls: Record<string, number>;
}

/** Totals for a match in progress or just finished, from the engine state. */
export function matchTotals(state: GameState): MatchTotals {
  const points: Record<string, number> = {};
  const fouls: Record<string, number> = {};
  for (const p of state.players) {
    points[p.id] = p.score;
    fouls[p.id] = p.foulsCommitted;
  }
  for (const frame of state.completedFrames ?? []) {
    for (const s of frame.playerStats) {
      points[s.playerId] = (points[s.playerId] ?? 0) + s.score;
      fouls[s.playerId] = (fouls[s.playerId] ?? 0) + s.foulsCommitted;
    }
  }
  return { points, fouls };
}

export interface Contender {
  name: string;
  framesWon: number;
  points: number;
}

/**
 * Most frames wins; level on frames, most points wins; level on both is a
 * draw (null). A match with no points at all has no winner.
 */
export function pickWinner(contenders: Contender[]): string | null {
  if (contenders.length === 0) return null;
  const sorted = [...contenders].sort(
    (a, b) => b.framesWon - a.framesWon || b.points - a.points
  );
  const [top, next] = sorted;
  if (top.framesWon === 0 && top.points === 0) return null;
  if (next && next.framesWon === top.framesWon && next.points === top.points) return null;
  return top.name;
}

/** The match winner's name for a finished game state, or 'Draw'. */
export function matchWinnerName(state: GameState): string {
  const { points } = matchTotals(state);

  if (state.mode === 'team') {
    if (state.winner) {
      const t = state.teams.find((x) => x.id === state.winner);
      if (t) return t.name;
    }
    const picked = pickWinner(
      state.teams.map((t) => ({
        name: t.name,
        framesWon: state.frameScores[t.id] || 0,
        points: t.playerIds.reduce((sum, id) => sum + (points[id] ?? 0), 0),
      }))
    );
    return picked ?? 'Draw';
  }

  if (state.winner) {
    const p = state.players.find((x) => x.id === state.winner);
    if (p) return p.name;
  }
  const picked = pickWinner(
    state.players.map((p) => ({
      name: p.name,
      framesWon: state.frameScores[p.id] || 0,
      points: points[p.id] ?? 0,
    }))
  );
  return picked ?? 'Draw';
}

/** Nothing was scored and no frame was won: not worth keeping. */
export function isEmptyGame(state: GameState): boolean {
  const { points } = matchTotals(state);
  const anyPoints = Object.values(points).some((v) => v !== 0);
  const anyFrames = Object.values(state.frameScores ?? {}).some((v) => v > 0);
  const anyShots = (state.completedFrames ?? []).some((f) => f.actionLog.length > 0)
    || state.actionLog.some((e) => !e.undone && (e.type === 'pot' || e.type === 'foul' || e.type === 'inOff'));
  return !anyPoints && !anyFrames && !anyShots;
}

/* ------------------------------------------------------- saved matches */

export interface SavedPlayerLike {
  name: string;
  teamName?: string;
  totalScore: number;
  framesWon: number;
}

/** Saved matches with no points and no frames — the empty 0-0-0 rows. */
export function isEmptyRecord(players: SavedPlayerLike[]): boolean {
  return players.every((p) => p.totalScore === 0 && p.framesWon === 0);
}

/**
 * Winner of a saved match. Prefers the stored name; for older rows saved as
 * "Unknown" it falls back to frames won, then points.
 */
export function savedWinner(stored: string | null | undefined, players: SavedPlayerLike[]): string | null {
  if (stored && stored !== 'Unknown' && stored !== 'Draw') return stored;
  const byEntity = new Map<string, Contender>();
  for (const p of players) {
    const key = p.teamName || p.name;
    const c = byEntity.get(key) ?? { name: key, framesWon: 0, points: 0 };
    c.framesWon = p.teamName ? Math.max(c.framesWon, p.framesWon) : p.framesWon;
    c.points += p.totalScore;
    byEntity.set(key, c);
  }
  return pickWinner([...byEntity.values()]);
}

/** Totals rebuilt from saved frame logs (for local guest records). */
export function totalsFromFrames(
  frames: { actionLog: ActionLogEntry[] }[],
  players: { name: string; teamName?: string }[]
): { points: Record<string, number>; fouls: Record<string, number> } {
  const points: Record<string, number> = {};
  const fouls: Record<string, number> = {};
  for (const p of players) { points[p.name] = 0; fouls[p.name] = 0; }
  for (const f of frames) {
    for (const e of f.actionLog ?? []) {
      if (e.undone) continue;
      if (e.type === 'pot' && e.points && e.playerName in points) points[e.playerName] += e.points;
      if ((e.type === 'foul' || e.type === 'inOff') && e.playerName in fouls) fouls[e.playerName] += 1;
      if ((e.type === 'foul' || e.type === 'inOff') && e.points) {
        for (const r of e.penaltyTo ?? []) {
          if (r in points) points[r] += e.points;
        }
      }
    }
  }
  return { points, fouls };
}

/* ------------------------------------------------------------ formatting */

const MODE_LABELS: Record<string, string> = {
  '1v1': '1 v 1',
  freeForAll: 'Free for all',
  team: 'Teams',
  century: 'Century',
};

export function modeLabel(mode: string): string {
  return MODE_LABELS[mode] ?? mode;
}

/** "Today", "Yesterday", "Tue 30 Sep", or "30 Sep 2025" for other years. */
export function relativeDay(when: string | number | Date, now: Date = new Date()): string {
  const d = new Date(when);
  if (Number.isNaN(d.getTime())) return '';
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) {
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** "1h 47m", "39m". */
export function shortDuration(ms: number): string {
  const mins = Math.round(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`;
}
