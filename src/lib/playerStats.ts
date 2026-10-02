/**
 * playerStats — everything the dashboard and My Stats show about one player,
 * computed from saved history. No extra tables: matches, their frame logs,
 * and Century games are enough.
 */

import type { ActionLogEntry, BallType } from '../engine/types';
import type { CenturyDetailsData } from './centuryHistory';
import { didWin, type HistoryMatch } from './history';

export type Range = 'week' | 'month' | 'all';

const DAY = 86_400_000;

export function inRange<T extends { at: number }>(items: T[], range: Range, now = Date.now()): T[] {
  if (range === 'all') return items;
  const from = now - (range === 'week' ? 7 : 30) * DAY;
  return items.filter((x) => x.at >= from);
}

export interface Summary {
  matches: number;
  wins: number;
  winRate: number;
  framesWon: number;
  avgPoints: number;
  tableMs: number;
  avgMatchMs: number;
  bestBreak: number;
  bestBreakAt: number | null;
  avgBestBreak: number;
  thisWeek: number;
  /** Oldest first. */
  form: ('W' | 'L')[];
  firstAt: number | null;
}

export function summarize(all: HistoryMatch[], me: string, formLength = 10, now = Date.now()): Summary {
  const mine = all.filter((m) => m.players.some((p) => p.name === me));
  const rows = mine.map((m) => ({ m, p: m.players.find((p) => p.name === me)! }));
  const wins = mine.filter((m) => didWin(m, me)).length;
  let bestBreak = 0;
  let bestBreakAt: number | null = null;
  // Newest first, so the first time the best is reached is the latest one.
  rows.forEach(({ m, p }) => {
    if (p.highestBreak > bestBreak) { bestBreak = p.highestBreak; bestBreakAt = m.at; }
  });
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  return {
    matches: mine.length,
    wins,
    winRate: mine.length ? Math.round((wins / mine.length) * 100) : 0,
    framesWon: sum((r) => r.p.framesWon),
    avgPoints: rows.length ? Math.round(sum((r) => r.p.totalScore) / rows.length) : 0,
    tableMs: sum((r) => r.p.timeSpentMs),
    avgMatchMs: rows.length ? sum((r) => r.m.durationMs) / rows.length : 0,
    bestBreak,
    bestBreakAt,
    avgBestBreak: rows.length ? Math.round((sum((r) => r.p.highestBreak) / rows.length) * 10) / 10 : 0,
    thisWeek: mine.filter((m) => m.at >= now - 7 * DAY).length,
    form: mine.slice(0, formLength).map((m) => (didWin(m, me) ? 'W' : 'L') as 'W' | 'L').reverse(),
    firstAt: mine.length ? mine[mine.length - 1].at : null,
  };
}

export interface MonthBar { key: string; label: string; games: number; wins: number }

/** The last `count` months, oldest first, including months with no games. */
export function byMonth(all: HistoryMatch[], me: string, count = 6, now = new Date()): MonthBar[] {
  const bars: MonthBar[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    bars.push({
      key: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString(undefined, { month: 'short' }),
      games: 0,
      wins: 0,
    });
  }
  all.forEach((m) => {
    if (!m.players.some((p) => p.name === me)) return;
    const d = new Date(m.at);
    const bar = bars.find((b) => b.key === `${d.getFullYear()}-${d.getMonth()}`);
    if (!bar) return;
    bar.games += 1;
    if (didWin(m, me)) bar.wins += 1;
  });
  // Drop leading empty months so a new player's chart starts where they did.
  while (bars.length > 1 && bars[0].games === 0) bars.shift();
  return bars;
}

export interface Bucket { label: string; count: number }

export function breakBuckets(all: HistoryMatch[], me: string): Bucket[] {
  const edges = [
    { label: '0–4', max: 4 }, { label: '5–9', max: 9 }, { label: '10–14', max: 14 },
    { label: '15–19', max: 19 }, { label: '20–29', max: 29 }, { label: '30–49', max: 49 },
    { label: '50+', max: Infinity },
  ];
  const counts = edges.map((e) => ({ label: e.label, count: 0 }));
  all.forEach((m) => {
    const p = m.players.find((x) => x.name === me);
    if (!p) return;
    const i = edges.findIndex((e) => p.highestBreak <= e.max);
    counts[i].count += 1;
  });
  // Keep up to the highest bucket reached, and at least four.
  let last = counts.length - 1;
  while (last > 3 && counts[last].count === 0) last -= 1;
  return counts.slice(0, last + 1);
}

export interface HeadToHead { name: string; n: number; w: number; l: number; myAvg: number; theirAvg: number }

/** Who finished higher (frames, then points) in every non-team match together. */
export function headToHead(all: HistoryMatch[], me: string, min = 2): HeadToHead[] {
  const map = new Map<string, { n: number; w: number; l: number; mine: number; theirs: number }>();
  all.forEach((m) => {
    if (m.mode === 'team') return;
    const ranked = [...m.players].sort((a, b) => b.framesWon - a.framesWon || b.totalScore - a.totalScore);
    const myIdx = ranked.findIndex((p) => p.name === me);
    if (myIdx < 0) return;
    const myP = ranked[myIdx];
    ranked.forEach((o, i) => {
      if (o.name === me || /^Player \d+$/.test(o.name)) return;
      const e = map.get(o.name) ?? { n: 0, w: 0, l: 0, mine: 0, theirs: 0 };
      e.n += 1;
      const level = o.framesWon === myP.framesWon && o.totalScore === myP.totalScore;
      if (!level) { if (myIdx < i) e.w += 1; else e.l += 1; }
      e.mine += myP.totalScore;
      e.theirs += o.totalScore;
      map.set(o.name, e);
    });
  });
  return [...map.entries()]
    .filter(([, e]) => e.n >= min)
    .sort((a, b) => b[1].n - a[1].n)
    .map(([name, e]) => ({
      name, n: e.n, w: e.w, l: e.l,
      myAvg: Math.round(e.mine / e.n), theirAvg: Math.round(e.theirs / e.n),
    }));
}

export interface DayBar { label: string; games: number }

export function byWeekday(all: HistoryMatch[], me: string): DayBar[] {
  const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const games = [0, 0, 0, 0, 0, 0, 0];
  all.forEach((m) => {
    if (!m.players.some((p) => p.name === me)) return;
    const d = new Date(m.at).getDay(); // 0 = Sunday
    games[(d + 6) % 7] += 1;
  });
  return labels.map((label, i) => ({ label, games: games[i] }));
}

export interface PotStats {
  reds: number;
  colours: number;
  byColour: { ball: BallType; count: number }[];
  fouls: number;
  foulPoints: number;
  foulsByBall: { ball: BallType; count: number }[];
}

const COLOURS: BallType[] = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'];
const ALL_BALLS: BallType[] = ['red', ...COLOURS];

/** From frame logs. Null when no logs are available. */
export function potStats(logs: ActionLogEntry[][], me: string): PotStats | null {
  if (logs.length === 0) return null;
  const pots: Record<string, number> = {};
  const fouls: Record<string, number> = {};
  let foulCount = 0;
  let foulPoints = 0;
  logs.forEach((log) => log.forEach((e) => {
    if (e.playerName !== me) return;
    if (e.type === 'pot' && e.ball) pots[e.ball] = (pots[e.ball] ?? 0) + 1;
    if (e.type === 'foul' || e.type === 'inOff') {
      foulCount += 1;
      foulPoints += e.points ?? 0;
      if (e.ball) fouls[e.ball] = (fouls[e.ball] ?? 0) + 1;
    }
  }));
  const reds = pots.red ?? 0;
  const colours = COLOURS.reduce((a, b) => a + (pots[b] ?? 0), 0);
  if (reds + colours + foulCount === 0) return null;
  return {
    reds,
    colours,
    byColour: COLOURS.map((ball) => ({ ball, count: pots[ball] ?? 0 })).sort((a, b) => b.count - a.count),
    fouls: foulCount,
    foulPoints,
    foulsByBall: ALL_BALLS.map((ball) => ({ ball, count: fouls[ball] ?? 0 }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count),
  };
}

export interface CenturyStats {
  games: number;
  firstOut: number;
  leftShort: number;
  redsMissed: number;
  redsPotted: number;
  byRedValue: { value: number; games: number; firstOut: number }[];
}

export function centuryStats(games: CenturyDetailsData[], me: string): CenturyStats | null {
  const mine = games.filter((g) => g.players.some((p) => p.name === me));
  if (mine.length === 0) return null;
  const s: CenturyStats = { games: mine.length, firstOut: 0, leftShort: 0, redsMissed: 0, redsPotted: 0, byRedValue: [] };
  const byVal = new Map<number, { games: number; firstOut: number }>();
  mine.forEach((g) => {
    const p = g.players.find((x) => x.name === me)!;
    if (p.finishedAt === 1) s.firstOut += 1;
    if (p.finishedAt === null) s.leftShort += 1;
    s.redsMissed += p.redsMissed;
    s.redsPotted += p.redsPotted;
    const v = byVal.get(g.redValue) ?? { games: 0, firstOut: 0 };
    v.games += 1;
    if (p.finishedAt === 1) v.firstOut += 1;
    byVal.set(g.redValue, v);
  });
  s.byRedValue = [...byVal.entries()].sort((a, b) => a[0] - b[0]).map(([value, v]) => ({ value, ...v }));
  return s;
}

export function hours(ms: number): string {
  const h = ms / 3_600_000;
  return h >= 10 ? `${Math.round(h)}h` : `${Math.round(h * 10) / 10}h`;
}
