/**
 * frameAnalysis — everything the match page shows about one frame, read from
 * its saved shot log: per-player numbers, the play grouped into visits, and
 * how the points built up shot by shot.
 *
 * Undone steps stay in saved logs (marked), and never count here.
 */

import type { ActionLogEntry, BallType } from '../engine/types';

export interface FramePlayer {
  name: string;
  teamName?: string;
}

/* ------------------------------------------------------------ is it real? */

const SCORING = new Set(['pot', 'foul', 'inOff']);

/** A frame with no pots or fouls — e.g. started, then the match was ended. */
export function isEmptyFrame(log: ActionLogEntry[]): boolean {
  return !log.some((e) => !e.undone && SCORING.has(e.type));
}

/* -------------------------------------------------------- per-player stats */

export interface PlayerFrameStats {
  reds: number;
  colours: number;
  highestBreak: number;
  fouls: number;
  points: number;
}

export function frameStats(log: ActionLogEntry[], players: FramePlayer[]): Record<string, PlayerFrameStats> {
  const out: Record<string, PlayerFrameStats> = {};
  for (const p of players) out[p.name] = { reds: 0, colours: 0, highestBreak: 0, fouls: 0, points: 0 };
  const at = (name: string) => (out[name] ??= { reds: 0, colours: 0, highestBreak: 0, fouls: 0, points: 0 });

  let breakOf = '';
  let run = 0;
  for (const e of log) {
    if (e.undone || e.type === 'undo' || e.type === 'redo') continue;
    if (e.type === 'pot' && e.ball) {
      const s = at(e.playerName);
      if (e.ball === 'red') s.reds += 1; else s.colours += 1;
      s.points += e.points ?? 0;
      run = breakOf === e.playerName ? run + (e.points ?? 0) : (e.points ?? 0);
      breakOf = e.playerName;
      s.highestBreak = Math.max(s.highestBreak, run);
    } else if (e.type === 'foul' || e.type === 'inOff') {
      at(e.playerName).fouls += 1;
      for (const r of e.penaltyTo ?? []) at(r).points += e.points ?? 0;
      breakOf = ''; run = 0;
    } else if (e.type === 'miss' || e.type === 'concede' || e.type === 'frameEnd') {
      breakOf = ''; run = 0;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ visits */

export type Visit =
  | { kind: 'break'; player: string; balls: BallType[]; points: number; freeBall: boolean }
  | { kind: 'miss'; player: string }
  | { kind: 'foul'; player: string; ball?: BallType; points: number; to: string[]; inOff: boolean }
  | { kind: 'note'; player: string; text: string };

/**
 * The frame as visits to the table: a run of pots by one player is one
 * break; a miss with nothing potted is a miss; fouls and concessions stand
 * on their own.
 */
export function frameVisits(log: ActionLogEntry[]): Visit[] {
  const out: Visit[] = [];
  let open: Extract<Visit, { kind: 'break' }> | null = null;
  const close = () => { if (open) { out.push(open); open = null; } };

  for (const e of log) {
    if (e.undone || e.type === 'undo' || e.type === 'redo' || e.type === 'frameStart') continue;
    if (e.type === 'pot' && e.ball) {
      if (!open || open.player !== e.playerName) {
        close();
        open = { kind: 'break', player: e.playerName, balls: [], points: 0, freeBall: false };
      }
      open.balls.push(e.ball);
      open.points += e.points ?? 0;
      if (/free ball/i.test(e.description)) open.freeBall = true;
    } else if (e.type === 'miss') {
      if (open && open.player === e.playerName) close();
      else { close(); out.push({ kind: 'miss', player: e.playerName }); }
    } else if (e.type === 'foul' || e.type === 'inOff') {
      close();
      out.push({ kind: 'foul', player: e.playerName, ball: e.ball, points: e.points ?? 0, to: e.penaltyTo ?? [], inOff: e.type === 'inOff' });
    } else if (e.type === 'concede') {
      close();
      out.push({ kind: 'note', player: e.playerName, text: `${e.playerName} conceded the frame` });
    } else if (e.type === 'freeBall') {
      close();
      out.push({ kind: 'note', player: e.playerName, text: e.description });
    }
  }
  close();
  return out;
}

/* ------------------------------------------------------- points over time */

export interface ProgressPoint {
  /** 0 = start of frame; then one step per scoring shot. */
  step: number;
  /** Running total per side (player, or team in team mode). */
  totals: Record<string, number>;
  /** What happened at this step, for the tooltip. */
  label: string;
}

/** The sides that score: teams in team mode, otherwise players. */
export function sidesOf(players: FramePlayer[]): string[] {
  const isTeams = players.some((p) => !!p.teamName);
  const names: string[] = [];
  for (const p of players) {
    const n = isTeams && p.teamName ? p.teamName : p.name;
    if (!names.includes(n)) names.push(n);
  }
  return names;
}

export function frameProgress(log: ActionLogEntry[], players: FramePlayer[]): ProgressPoint[] {
  const sides = sidesOf(players);
  const sideOf = (name: string): string | undefined => {
    if (sides.includes(name)) return name;
    const p = players.find((x) => x.name === name);
    return p?.teamName && sides.includes(p.teamName) ? p.teamName : undefined;
  };
  const totals: Record<string, number> = Object.fromEntries(sides.map((s) => [s, 0]));
  const points: ProgressPoint[] = [{ step: 0, totals: { ...totals }, label: 'Frame start' }];

  for (const e of log) {
    if (e.undone) continue;
    const pts = e.points ?? 0;
    if (!pts) continue;
    if (e.type === 'pot') {
      const s = sideOf(e.playerName);
      if (!s) continue;
      totals[s] += pts;
    } else if (e.type === 'foul' || e.type === 'inOff') {
      for (const r of e.penaltyTo ?? []) { const s = sideOf(r); if (s) totals[s] += pts; }
    } else continue;
    points.push({ step: points.length, totals: { ...totals }, label: e.description });
  }
  return points;
}
