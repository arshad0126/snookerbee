/**
 * frameResult — who won a frame, and by what score, rebuilt from its log.
 *
 * Saved frames only keep their action log (no winner, no scores), so the
 * result is derived from it. That works for every match already saved.
 *
 * Undo is safe: UNDO restores the earlier state's log and appends a marker
 * with no points, so undone pots and fouls are already gone from the log.
 *
 * Team mode: pots count for the potter's team; foul points are logged
 * against the opposing team's name, so they're credited to that team.
 */

import type { ActionLogEntry } from '../engine/types';

export interface FrameResultPlayer {
  name: string;
  teamName?: string;
}

export interface FrameScore {
  name: string;
  score: number;
}

export interface FrameResult {
  /** Scores in the original player/team order. */
  scores: FrameScore[];
  /** Highest first. Ties keep the original order. */
  ranked: FrameScore[];
  /** Null when the top score is shared, or nobody scored. */
  winnerName: string | null;
}

export function computeFrameResult(
  actionLog: ActionLogEntry[],
  players: FrameResultPlayer[]
): FrameResult {
  const isTeams = players.some((p) => !!p.teamName);

  // The entities that score: teams in team mode, otherwise players.
  const names: string[] = [];
  for (const p of players) {
    const n = isTeams && p.teamName ? p.teamName : p.name;
    if (!names.includes(n)) names.push(n);
  }

  const totals = new Map<string, number>(names.map((n) => [n, 0]));
  const entityFor = (name: string): string | undefined => {
    if (totals.has(name)) return name;
    const player = players.find((p) => p.name === name);
    const mapped = player && isTeams ? player.teamName : undefined;
    return mapped && totals.has(mapped) ? mapped : undefined;
  };
  const add = (name: string, pts: number) => {
    const key = entityFor(name);
    if (key) totals.set(key, (totals.get(key) ?? 0) + pts);
  };

  for (const e of actionLog) {
    const pts = e.points ?? 0;
    if (!pts) continue;
    if (e.type === 'pot') add(e.playerName, pts);
    else if (e.type === 'foul' || e.type === 'inOff') {
      for (const r of e.penaltyTo ?? []) add(r, pts);
    }
  }

  const scores = names.map((name) => ({ name, score: totals.get(name) ?? 0 }));
  const ranked = [...scores].sort((a, b) => b.score - a.score);

  const top = ranked[0];
  const shared = ranked.length > 1 && ranked[1].score === top?.score;
  const winnerName = top && top.score > 0 && !shared ? top.name : null;

  return { scores, ranked, winnerName };
}
