/**
 * centuryHistory — one shape for a saved Century game, whether it came from
 * guest local storage or Supabase, plus the bits of formatting both views use.
 */

import type { CenturyLogEntry } from '../engine/century';
import { DEFAULT_RED_VALUE } from '../engine/century';
import type { CenturyGameWithPlayers, LocalCenturyRecord } from './database';

export interface CenturyDetailsPlayer {
  name: string;
  score: number;
  /** Finishing position; null means they were left short. */
  finishedAt: number | null;
  potted: number;
  redsPotted: number;
  redsMissed: number;
  fouls: number;
}

export interface CenturyDetailsData {
  id: string;
  /** Epoch ms, for sorting alongside matches. */
  at: number;
  date: string;
  target: number;
  redValue: number;
  durationMs: number;
  loserName: string | null;
  players: CenturyDetailsPlayer[];
  /** Absent for games saved before the play-by-play was kept. */
  actionLog?: CenturyLogEntry[];
}

export function formatHistoryDate(iso: string | undefined): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fromLocalCentury(g: LocalCenturyRecord): CenturyDetailsData {
  return {
    id: g.id,
    at: Date.parse(g.createdAt) || 0,
    date: formatHistoryDate(g.createdAt),
    target: g.target,
    redValue: g.redValue ?? DEFAULT_RED_VALUE,
    durationMs: g.durationMs,
    loserName: g.loserName,
    players: g.players,
    actionLog: g.actionLog,
  };
}

export function fromDbCentury(g: CenturyGameWithPlayers): CenturyDetailsData {
  return {
    id: g.id ?? '',
    at: g.created_at ? Date.parse(g.created_at) : 0,
    date: formatHistoryDate(g.created_at),
    target: g.target,
    redValue: g.red_value ?? DEFAULT_RED_VALUE,
    durationMs: g.duration_ms,
    loserName: g.loser_name,
    players: (g.players ?? []).map((p) => ({
      name: p.player_name,
      score: p.final_score,
      finishedAt: p.finished_at,
      potted: p.balls_potted,
      redsPotted: p.reds_potted,
      redsMissed: p.reds_missed,
      fouls: p.fouls,
    })),
    actionLog: g.action_log ?? undefined,
  };
}

/** Finishing order: 1, 2, 3 … then whoever was left short. */
export function byFinish(players: CenturyDetailsPlayer[]): CenturyDetailsPlayer[] {
  return [...players].sort(
    (a, b) => (a.finishedAt ?? 99) - (b.finishedAt ?? 99) || b.score - a.score
  );
}

export function formatCenturyDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s}s`;
}
