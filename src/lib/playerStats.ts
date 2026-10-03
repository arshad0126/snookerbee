/**
 * playerStats — everything the dashboard and My Stats show about one player,
 * computed from saved history. No extra tables: matches, their frame logs,
 * and Century games are enough.
 *
 * Results are counted FRAME BY FRAME, never by match. Awais wins frame 1,
 * Suraj wins frame 2, frame 3 never played: Awais is 1 won / 1 lost, Suraj
 * is 1 won / 1 lost, and nobody "won the match". Win rate, form, streaks,
 * the monthly chart, by-format and head-to-head all work this way.
 */

import type { ActionLogEntry, BallType } from '../engine/types';
import type { CenturyDetailsData } from './centuryHistory';
import { computeFrameResult } from './frameResult';
import type { HistoryMatch } from './history';

export type Range = 'week' | 'month' | 'all';

const DAY = 86_400_000;

export function inRange<T extends { at: number }>(items: T[], range: Range, now = Date.now()): T[] {
  if (range === 'all') return items;
  const from = now - (range === 'week' ? 7 : 30) * DAY;
  return items.filter((x) => x.at >= from);
}

/** Frame logs by match id, each match's frames in play order. */
export type LogsById = Map<string, ActionLogEntry[][]> | null | undefined;

/** The side a player scores for: their team in team mode, else themselves. */
const sideOf = (m: HistoryMatch, name: string): string | null => {
  const p = m.players.find((x) => x.name === name);
  return p ? p.teamName || p.name : null;
};

/**
 * Winner (team or player name) of every finished frame in a match, in the
 * order played. Read from the frame logs when they agree with the saved
 * frame counts; otherwise null (the order can't be known).
 */
export function frameWinners(m: HistoryMatch, logs?: LogsById): string[] | null {
  const frames = logs?.get(m.id) ?? m.frames?.map((f) => f.actionLog ?? []) ?? [];
  if (frames.length === 0) return null;
  const players = m.players.map((p) => ({ name: p.name, teamName: p.teamName }));
  const winners = frames
    .map((log) => computeFrameResult(log, players).winnerName)
    .filter((w): w is string => w !== null);
  if (winners.length !== framesPlayed(m)) return null;
  // Every side's count must match what was saved, or the logs are suspect.
  const ok = m.players.every((p) => {
    const side = p.teamName || p.name;
    return winners.filter((w) => w === side).length === p.framesWon;
  });
  return ok ? winners : null;
}

/**
 * One player's frames in one match, in the order played: true = won.
 * Without usable logs the order inside the match is unknown, so losses are
 * listed before wins (totals are still exact).
 */
export function frameRecord(m: HistoryMatch, name: string, logs?: LogsById): boolean[] {
  const side = sideOf(m, name);
  const p = m.players.find((x) => x.name === name);
  if (!side || !p) return [];
  const winners = frameWinners(m, logs);
  if (winners) return winners.map((w) => w === side);
  const played = framesPlayed(m);
  const won = Math.min(p.framesWon, played);
  return [...Array<boolean>(played - won).fill(false), ...Array<boolean>(won).fill(true)];
}

/** Frames won and played by one player in one match. */
export function frameCount(m: HistoryMatch, name: string): { won: number; played: number } {
  const p = m.players.find((x) => x.name === name);
  if (!p) return { won: 0, played: 0 };
  const played = framesPlayed(m);
  return { won: Math.min(p.framesWon, played), played };
}

/** Every frame result for a player, NEWEST FIRST (matches newest first). */
export function frameTimeline(matches: HistoryMatch[], name: string, logs?: LogsById): boolean[] {
  return matches.flatMap((m) => frameRecord(m, name, logs).reverse());
}

export interface Summary {
  matches: number;
  /** Frames won. */
  wins: number;
  /** Frames won ÷ frames played, as a percentage. */
  winRate: number;
  framesWon: number;
  framesPlayed: number;
  avgPoints: number;
  tableMs: number;
  avgMatchMs: number;
  bestBreak: number;
  bestBreakAt: number | null;
  avgBestBreak: number;
  thisWeek: number;
  /** Last frames, oldest first. */
  form: ('W' | 'L')[];
  firstAt: number | null;
}

export function summarize(all: HistoryMatch[], me: string, formLength = 10, now = Date.now(), logs?: LogsById): Summary {
  const mine = all.filter((m) => m.players.some((p) => p.name === me));
  const rows = mine.map((m) => ({ m, p: m.players.find((p) => p.name === me)! }));
  let framesWon = 0;
  let framesPlayedTotal = 0;
  mine.forEach((m) => { const c = frameCount(m, me); framesWon += c.won; framesPlayedTotal += c.played; });
  let bestBreak = 0;
  let bestBreakAt: number | null = null;
  // Newest first, so the first time the best is reached is the latest one.
  rows.forEach(({ m, p }) => {
    if (p.highestBreak > bestBreak) { bestBreak = p.highestBreak; bestBreakAt = m.at; }
  });
  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  return {
    matches: mine.length,
    wins: framesWon,
    winRate: framesPlayedTotal ? Math.round((framesWon / framesPlayedTotal) * 100) : 0,
    framesWon,
    framesPlayed: framesPlayedTotal,
    avgPoints: rows.length ? Math.round(sum((r) => r.p.totalScore) / rows.length) : 0,
    tableMs: sum((r) => r.p.timeSpentMs),
    avgMatchMs: rows.length ? sum((r) => r.m.durationMs) / rows.length : 0,
    bestBreak,
    bestBreakAt,
    avgBestBreak: rows.length ? Math.round((sum((r) => r.p.highestBreak) / rows.length) * 10) / 10 : 0,
    thisWeek: mine.filter((m) => m.at >= now - 7 * DAY).length,
    form: frameTimeline(mine, me, logs).slice(0, formLength).map((w) => (w ? 'W' : 'L') as 'W' | 'L').reverse(),
    firstAt: mine.length ? mine[mine.length - 1].at : null,
  };
}

/** `games` = frames played that month, `wins` = frames won. */
export interface MonthBar { key: string; label: string; games: number; wins: number }

/** The last `count` months, oldest first, counted in frames. */
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
    const c = frameCount(m, me);
    bar.games += c.played;
    bar.wins += c.won;
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

/** `n` = matches together, `w` = frames I won, `l` = frames they won. */
export interface HeadToHead { name: string; n: number; w: number; l: number; myAvg: number; theirAvg: number }

/** Frames each of us won, in every non-team match we both played. */
export function headToHead(all: HistoryMatch[], me: string, min = 2): HeadToHead[] {
  const map = new Map<string, { n: number; w: number; l: number; mine: number; theirs: number }>();
  all.forEach((m) => {
    if (m.mode === 'team') return;
    const myP = m.players.find((p) => p.name === me);
    if (!myP) return;
    m.players.forEach((o) => {
      if (o.name === me || /^Player \d+$/.test(o.name)) return;
      const e = map.get(o.name) ?? { n: 0, w: 0, l: 0, mine: 0, theirs: 0 };
      e.n += 1;
      e.w += myP.framesWon;
      e.l += o.framesWon;
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
    if (e.undone || e.playerName !== me) return;
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
  bestScore: number;
  fouls: number;
  byRedValue: { value: number; games: number; firstOut: number }[];
}

export function centuryStats(games: CenturyDetailsData[], me: string): CenturyStats | null {
  const mine = games.filter((g) => g.players.some((p) => p.name === me));
  if (mine.length === 0) return null;
  const s: CenturyStats = { games: mine.length, firstOut: 0, leftShort: 0, redsMissed: 0, redsPotted: 0, bestScore: -Infinity, fouls: 0, byRedValue: [] };
  const byVal = new Map<number, { games: number; firstOut: number }>();
  mine.forEach((g) => {
    const p = g.players.find((x) => x.name === me)!;
    if (p.finishedAt === 1) s.firstOut += 1;
    if (p.finishedAt === null) s.leftShort += 1;
    s.redsMissed += p.redsMissed;
    s.redsPotted += p.redsPotted;
    s.fouls += p.fouls;
    s.bestScore = Math.max(s.bestScore, p.score);
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

/* ======================================================= any player, deeper */

/** Unnamed setup slots save as "Player 1", "Player 2"… — never real players. */
export function isPlaceholderName(name: string): boolean {
  return /^player\s*\d+$/i.test(name.trim());
}

/** Players with fewer games than this go under "Fewer games" in the picker. */
export const MIN_GAMES_FOR_LIST = 3;

export interface ListedPlayer { name: string; games: number }

/** Every real player in the account's history, most games first, then A–Z. */
export function listPlayers(matches: HistoryMatch[], centuries: CenturyDetailsData[] = []): ListedPlayer[] {
  const counts = new Map<string, number>();
  const add = (n: string) => {
    if (!isPlaceholderName(n)) counts.set(n, (counts.get(n) ?? 0) + 1);
  };
  matches.forEach((m) => new Set(m.players.map((p) => p.name)).forEach(add));
  centuries.forEach((c) => new Set(c.players.map((p) => p.name)).forEach(add));
  return [...counts.entries()]
    .map(([name, games]) => ({ name, games }))
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));
}

/**
 * Frames played in a match. In team mode every member carries the team's
 * frame count (see MatchSummary), so each team is counted once.
 */
export function framesPlayed(m: HistoryMatch): number {
  if (m.mode === 'team') {
    const seen = new Map<string, number>();
    m.players.forEach((p) => {
      const key = p.teamName || p.name;
      seen.set(key, Math.max(seen.get(key) ?? 0, p.framesWon));
    });
    return [...seen.values()].reduce((a, b) => a + b, 0);
  }
  return m.players.reduce((a, p) => a + p.framesWon, 0);
}

const sameSide = (m: HistoryMatch, a: string, b: string): boolean => {
  if (m.mode !== 'team') return false;
  const pa = m.players.find((p) => p.name === a);
  const pb = m.players.find((p) => p.name === b);
  return !!pa?.teamName && pa.teamName === pb?.teamName;
};

/** In frames: `games` = frames played in this format, `wins` = frames won. */
export interface FormatLine { mode: string; games: number; wins: number; winRate: number }

/** All counts are frames, except `matches` and `together`. */
export interface VsMe {
  matches: number;
  myWins: number;
  theirWins: number;
  othersWins: number;
  /** Always 0 — every frame has a winner. Kept for older callers. */
  draws: number;
  myFrames: number;
  theirFrames: number;
  myBestBreak: number;
  theirBestBreak: number;
  /** Team matches where we were on the same side. */
  together: number;
  /** Frames our team won in those matches. */
  togetherWins: number;
  togetherFrames: number;
}

/** `wins`, `losses`, `winRate`, form and streaks are all counted in frames. */
export interface PlayerProfile {
  name: string;
  games: number;
  wins: number;
  losses: number;
  winRate: number | null;
  framesWon: number;
  framesPlayed: number;
  frameWinRate: number | null;
  /** Last frames, newest first. */
  form: ('W' | 'L')[];
  /** e.g. "W3", "L2" in frames; null with no frames. */
  streak: string | null;
  bestWinStreak: number;
  highestBreak: number;
  centuries: number;
  halfCenturies: number;
  totalPoints: number;
  avgPointsPerMatch: number | null;
  avgPointsPerFrame: number | null;
  fouls: number;
  avgFoulsPerMatch: number | null;
  tableMs: number;
  avgTableMs: number | null;
  firstAt: number | null;
  lastAt: number | null;
  byFormat: FormatLine[];
  vsMe: VsMe | null;
  recent: HistoryMatch[];
}

const round1 = (x: number) => Math.round(x * 10) / 10;
const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : null);

/**
 * Everything the Player Stats page shows for one player. Matches are newest
 * first (as loadHistory returns them). Pass `me` to get head-to-head numbers
 * when `name` is someone else.
 */
export function computePlayerStats(name: string, all: HistoryMatch[], me: string | null, logs?: LogsById): PlayerProfile {
  const mine = all.filter((m) => m.players.some((p) => p.name === name));
  const rows = mine.map((m) => ({ m, p: m.players.find((p) => p.name === name)! }));

  let framesWonTotal = 0;
  let framesPlayedTotal = 0;
  mine.forEach((m) => { const c = frameCount(m, name); framesWonTotal += c.won; framesPlayedTotal += c.played; });

  // Frame results, newest first.
  const results = frameTimeline(mine, name, logs);

  let streak: string | null = null;
  if (results.length) {
    const first = results[0];
    let n = 0;
    while (n < results.length && results[n] === first) n += 1;
    streak = `${first ? 'W' : 'L'}${n}`;
  }
  let best = 0;
  let run = 0;
  [...results].reverse().forEach((w) => { run = w ? run + 1 : 0; best = Math.max(best, run); });

  const sum = (f: (r: (typeof rows)[number]) => number) => rows.reduce((a, r) => a + f(r), 0);
  const totalPoints = sum((r) => r.p.totalScore);
  const fouls = sum((r) => r.p.foulsCommitted);
  const tableMs = sum((r) => r.p.timeSpentMs);

  const formats = new Map<string, { games: number; wins: number }>();
  mine.forEach((m) => {
    const c = frameCount(m, name);
    if (c.played === 0) return;
    const f = formats.get(m.mode) ?? { games: 0, wins: 0 };
    f.games += c.played;
    f.wins += c.won;
    formats.set(m.mode, f);
  });
  const ORDER = ['1v1', 'freeForAll', 'team'];
  const byFormat = [...formats.entries()]
    .sort((a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]))
    .map(([mode, f]) => ({ mode, games: f.games, wins: f.wins, winRate: Math.round((f.wins / f.games) * 100) }));

  let vsMe: VsMe | null = null;
  if (me && me !== name) {
    const v: VsMe = {
      matches: 0, myWins: 0, theirWins: 0, othersWins: 0, draws: 0,
      myFrames: 0, theirFrames: 0, myBestBreak: 0, theirBestBreak: 0,
      together: 0, togetherWins: 0, togetherFrames: 0,
    };
    mine.forEach((m) => {
      const meP = m.players.find((p) => p.name === me);
      if (!meP) return;
      const mc = frameCount(m, me);
      if (sameSide(m, me, name)) {
        v.together += 1;
        v.togetherWins += mc.won;
        v.togetherFrames += mc.played;
        return;
      }
      const them = m.players.find((p) => p.name === name)!;
      const tc = frameCount(m, name);
      v.matches += 1;
      v.myWins += mc.won;
      v.theirWins += tc.won;
      v.othersWins += Math.max(0, mc.played - mc.won - tc.won);
      v.myFrames += meP.framesWon;
      v.theirFrames += them.framesWon;
      v.myBestBreak = Math.max(v.myBestBreak, meP.highestBreak);
      v.theirBestBreak = Math.max(v.theirBestBreak, them.highestBreak);
    });
    vsMe = v;
  }

  return {
    name,
    games: mine.length,
    wins: framesWonTotal,
    losses: framesPlayedTotal - framesWonTotal,
    winRate: pct(framesWonTotal, framesPlayedTotal),
    framesWon: framesWonTotal,
    framesPlayed: framesPlayedTotal,
    frameWinRate: pct(framesWonTotal, framesPlayedTotal),
    form: results.slice(0, 5).map((w) => (w ? 'W' : 'L')),
    streak,
    bestWinStreak: best,
    highestBreak: rows.reduce((a, r) => Math.max(a, r.p.highestBreak), 0),
    centuries: sum((r) => r.p.centuries ?? 0),
    halfCenturies: sum((r) => r.p.halfCenturies ?? 0),
    totalPoints,
    avgPointsPerMatch: rows.length ? round1(totalPoints / rows.length) : null,
    avgPointsPerFrame: framesPlayedTotal ? round1(totalPoints / framesPlayedTotal) : null,
    fouls,
    avgFoulsPerMatch: rows.length ? round1(fouls / rows.length) : null,
    tableMs,
    avgTableMs: rows.length ? tableMs / rows.length : null,
    firstAt: mine.length ? mine[mine.length - 1].at : null,
    lastAt: mine.length ? mine[0].at : null,
    byFormat,
    vsMe,
    recent: mine.slice(0, 10),
  };
}
