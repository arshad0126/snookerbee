/**
 * groupStats — stats for one exact group of players: only the games where
 * exactly these people played, nobody else and nobody missing.
 *
 * Pick Arshad, Awais and Suraj and you get their three-way games only — not
 * Awais v Suraj, not Arshad v Awais, not a game where a fourth person joined.
 * Pick two and you get just their 1 v 1s.
 *
 * Built from the same saved history as Player Stats; no extra tables.
 */

import type { ActionLogEntry } from '../engine/types';
import type { CenturyDetailsData } from './centuryHistory';
import { computeFrameResult } from './frameResult';
import { didWin, type HistoryMatch } from './history';
import { frameWinners, framesPlayed } from './playerStats';

/** "  Suraj " and "suraj" are the same person. */
export function normName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** True when the people in a game are exactly the selected group. */
export function isExactGroup(names: string[], group: string[]): boolean {
  const have = new Set(names.map(normName));
  const want = new Set(group.map(normName));
  if (have.size !== want.size) return false;
  for (const n of want) if (!have.has(n)) return false;
  return true;
}

export interface GroupPlayer {
  name: string;
  /** Matches where this player won the most frames. Kept for reference; stats lead with frames. */
  matchesWon: number;
  framesWon: number;
  /** Frames won ÷ frames played by the group. Null with no frames. */
  frameWinRate: number | null;
  totalPoints: number;
  avgPointsPerFrame: number | null;
  highestBreak: number;
  fiftyPlus: number;
  fouls: number;
  tableMs: number;
  /** From frame logs; null when no frame has a log. */
  pots: { reds: number; colours: number; foulPoints: number } | null;
  /** Frame finishing places from frame logs: [1st, 2nd, 3rd…]. Ties share a place. */
  places: number[] | null;
  century: { games: number; firstOut: number; leftShort: number; bestScore: number } | null;
}

export interface GroupStats {
  group: string[];
  matches: HistoryMatch[];
  centuries: CenturyDetailsData[];
  /** Team games with exactly this group — left out, but counted so we can say so. */
  teamGamesSkipped: number;
  frames: number;
  framesWithLogs: number;
  draws: number;
  tableMs: number;
  firstAt: number | null;
  lastAt: number | null;
  players: GroupPlayer[];
  /** Winner of each of the last 10 frames, oldest first. */
  form: (string | null)[];
  /** Who has won the most recent frames in a row, e.g. { name: 'Awais', n: 3 }. */
  streak: { name: string; n: number } | null;
}

const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);
const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Everything the Played Together page shows. `matches` newest first, as
 * loadHistory returns them. `logsById` is optional — without it the
 * shot-by-shot numbers (pots, places) are null.
 */
export function computeGroupStats(
  selected: string[],
  allMatches: HistoryMatch[],
  allCenturies: CenturyDetailsData[],
  logsById: Map<string, ActionLogEntry[][]> | null,
): GroupStats {
  const exact = allMatches.filter((m) => isExactGroup(m.players.map((p) => p.name), selected));
  const matches = exact.filter((m) => m.mode !== 'team');
  const centuries = allCenturies.filter((c) => isExactGroup(c.players.map((p) => p.name), selected));

  // Use the spelling saved in the games, so "suraj" picks up "Suraj".
  const nameIn = (m: HistoryMatch, wanted: string) =>
    m.players.find((p) => normName(p.name) === normName(wanted));

  let frames = 0;
  let framesWithLogs = 0;
  let tableMs = 0;
  let draws = 0;
  matches.forEach((m) => {
    frames += framesPlayed(m);
    tableMs += m.durationMs;
    if (!m.winner) draws += 1;
    framesWithLogs += (logsById?.get(m.id) ?? []).filter((l) => l.length > 0).length;
  });

  const players: GroupPlayer[] = selected.map((name) => {
    let matchesWon = 0, framesWon = 0, totalPoints = 0, highestBreak = 0, fiftyPlus = 0, fouls = 0, ms = 0;
    let reds = 0, colours = 0, foulPoints = 0, logged = 0;
    const places = selected.map(() => 0);

    matches.forEach((m) => {
      const p = nameIn(m, name);
      if (!p) return;
      if (didWin(m, p.name)) matchesWon += 1;
      framesWon += p.framesWon;
      totalPoints += p.totalScore;
      highestBreak = Math.max(highestBreak, p.highestBreak);
      fiftyPlus += (p.halfCenturies ?? 0) + (p.centuries ?? 0);
      fouls += p.foulsCommitted;
      ms += p.timeSpentMs;

      (logsById?.get(m.id) ?? []).forEach((log) => {
        if (log.length === 0) return;
        logged += 1;
        log.forEach((e) => {
          if (e.undone || e.playerName !== p.name) return;
          if (e.type === 'pot') { if (e.ball === 'red') reds += 1; else if (e.ball) colours += 1; }
          if (e.type === 'foul' || e.type === 'inOff') foulPoints += e.points ?? 0;
        });
        const r = computeFrameResult(log, m.players.map((x) => ({ name: x.name })));
        const mine = r.scores.find((s) => s.name === p.name);
        if (!mine) return;
        // Ties share a place: two on 40 and one on 20 → 1st, 1st, 3rd.
        const place = r.scores.filter((s) => s.score > mine.score).length;
        if (place < places.length) places[place] += 1;
      });
    });

    const mineC = centuries
      .map((c) => c.players.find((x) => normName(x.name) === normName(name)))
      .filter((x): x is NonNullable<typeof x> => !!x);

    return {
      name,
      matchesWon,
      framesWon,
      frameWinRate: pct(framesWon, frames),
      totalPoints,
      avgPointsPerFrame: frames ? round1(totalPoints / frames) : null,
      highestBreak,
      fiftyPlus,
      fouls,
      tableMs: ms,
      pots: logged ? { reds, colours, foulPoints } : null,
      places: logged ? places : null,
      century: mineC.length
        ? {
            games: mineC.length,
            firstOut: mineC.filter((x) => x.finishedAt === 1).length,
            leftShort: mineC.filter((x) => x.finishedAt === null).length,
            bestScore: Math.max(...mineC.map((x) => x.score)),
          }
        : null,
    };
  });

  // Winner of every frame, newest first, in the selected spelling. From the
  // frame logs when they line up with the saved counts; otherwise each
  // player's frames are listed together (order inside the match unknown).
  const toSelected = (playerName: string) =>
    selected.find((n) => normName(n) === normName(playerName)) ?? null;
  const winners: (string | null)[] = matches.flatMap((m) => {
    const ordered = frameWinners(m, logsById);
    const inOrder = ordered
      ? ordered.map((w) => toSelected(w))
      : m.players.flatMap((p) => Array<string | null>(p.framesWon).fill(toSelected(p.name)));
    return inOrder.reverse();
  });
  let streak: GroupStats['streak'] = null;
  if (winners.length && winners[0]) {
    let n = 0;
    while (n < winners.length && winners[n] === winners[0]) n += 1;
    streak = { name: winners[0], n };
  }

  return {
    group: selected,
    matches,
    centuries,
    teamGamesSkipped: exact.length - matches.length,
    frames,
    framesWithLogs,
    draws,
    tableMs,
    firstAt: matches.length ? matches[matches.length - 1].at : null,
    lastAt: matches.length ? matches[0].at : null,
    players,
    form: winners.slice(0, 10).reverse(),
    streak,
  };
}
