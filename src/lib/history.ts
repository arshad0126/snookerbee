/**
 * history — one normalised list of everything the user has played, from
 * guest storage or Supabase, plus "who am I" for personal stats.
 */

import type { ActionLogEntry } from '../engine/types';
import type { MatchDetailsData } from '../components/MatchDetailsModal';
import {
  getAllMatches,
  getCenturyHistory,
  getFrameWinners,
  getLocalCenturyHistory,
  getLocalMatchHistory,
} from './database';
import { fromDbCentury, fromLocalCentury, formatHistoryDate, type CenturyDetailsData } from './centuryHistory';
import { isEmptyRecord, savedWinner } from './results';

export interface HistoryPlayer {
  name: string;
  teamName?: string;
  totalScore: number;
  highestBreak: number;
  framesWon: number;
  foulsCommitted: number;
  timeSpentMs: number;
  centuries?: number;
  halfCenturies?: number;
}

export interface HistoryMatch {
  id: string;
  at: number;
  mode: string;
  bestOf: number;
  redsCount: number;
  durationMs: number;
  /** Null for a draw. */
  winner: string | null;
  players: HistoryPlayer[];
  /** Present for guest matches; signed-in frames load on demand. */
  frames?: { frameNumber: number; durationMs: number; actionLog: ActionLogEntry[]; winnerName?: string | null }[];
  /**
   * Winner (player or team) of each saved frame, in play order; null for a
   * frame with no stored winner. Saved since 2.0.
   */
  frameWinners?: (string | null)[];
}

export interface History {
  matches: HistoryMatch[];
  centuries: CenturyDetailsData[];
}

export async function loadHistory(isGuest: boolean): Promise<History> {
  if (isGuest) {
    const matches = getLocalMatchHistory()
      .map((m): HistoryMatch => ({
        id: m.id,
        at: Date.parse(m.createdAt) || 0,
        mode: m.mode,
        bestOf: m.bestOf,
        redsCount: m.redsCount,
        durationMs: m.durationMs,
        winner: savedWinner(m.winnerName, m.players),
        players: m.players,
        frames: m.frames as HistoryMatch['frames'],
        frameWinners: m.frames?.length ? m.frames.map((f) => f.winnerName ?? null) : undefined,
      }))
      .filter((m) => !isEmptyRecord(m.players));
    return { matches, centuries: getLocalCenturyHistory().map(fromLocalCentury) };
  }

  const [rows, centuries] = await Promise.all([getAllMatches(), getCenturyHistory()]);
  const winners = await getFrameWinners(rows.map((m) => m.id || '').filter(Boolean));
  const matches = rows
    .map((m): HistoryMatch => {
      const players = m.players.map((p) => ({
        name: p.player_name,
        teamName: p.team_name ?? undefined,
        totalScore: p.total_score,
        highestBreak: p.highest_break,
        framesWon: p.frames_won,
        foulsCommitted: p.fouls_committed,
        timeSpentMs: p.time_spent_ms,
        centuries: p.centuries ?? 0,
        halfCenturies: p.half_centuries ?? 0,
      }));
      return {
        id: m.id || '',
        at: m.created_at ? Date.parse(m.created_at) : 0,
        mode: m.mode,
        bestOf: m.best_of,
        redsCount: m.reds_count,
        durationMs: m.duration_ms,
        winner: savedWinner(m.winner_name, players),
        players,
        frameWinners: winners.get(m.id || ''),
      };
    })
    .filter((m) => !isEmptyRecord(m.players))
    .sort((a, b) => b.at - a.at);
  return { matches, centuries: centuries.map(fromDbCentury) };
}

/** The shape the match details sheet takes. */
export function toDetails(m: HistoryMatch): MatchDetailsData {
  return {
    id: m.id,
    date: formatHistoryDate(new Date(m.at).toISOString()),
    mode: m.mode,
    bestOf: m.bestOf,
    redsCount: m.redsCount,
    durationMs: m.durationMs,
    winnerName: m.winner ?? 'Draw',
    players: m.players,
    frames: m.frames,
  };
}

const PLACEHOLDER = /^Player \d+$/;

/**
 * The name the user plays under: their saved choice, else the name that
 * appears in the most matches (the phone's owner plays every game).
 */
export function guessMyName(matches: HistoryMatch[], centuries: CenturyDetailsData[] = []): string | null {
  const counts = new Map<string, number>();
  const bump = (n: string) => {
    if (!PLACEHOLDER.test(n)) counts.set(n, (counts.get(n) ?? 0) + 1);
  };
  matches.forEach((m) => new Set(m.players.map((p) => p.name)).forEach(bump));
  centuries.forEach((c) => new Set(c.players.map((p) => p.name)).forEach(bump));
  let best: string | null = null;
  let bestN = 0;
  counts.forEach((n, name) => {
    if (n > bestN) { best = name; bestN = n; }
  });
  return best;
}

/** Every distinct player name, most-played first. */
export function knownNames(matches: HistoryMatch[]): string[] {
  const counts = new Map<string, number>();
  matches.forEach((m) => m.players.forEach((p) => {
    if (!PLACEHOLDER.test(p.name)) counts.set(p.name, (counts.get(p.name) ?? 0) + 1);
  }));
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([n]) => n);
}

/** Did `me` win this match (directly or through their team)? */
export function didWin(m: HistoryMatch, me: string): boolean {
  if (!m.winner) return false;
  const p = m.players.find((x) => x.name === me);
  if (!p) return false;
  return m.winner === me || (!!p.teamName && m.winner === p.teamName);
}
