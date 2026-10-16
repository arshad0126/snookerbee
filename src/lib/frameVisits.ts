/**
 * frameVisits — turns the shot-by-shot action log into a scoresheet: one row
 * per visit (a player's turn at the table), with the running score after it.
 *
 * Display only. Nothing here changes a score; it re-adds the log so the
 * frame log can show how the score was reached. Tests check that the totals
 * it arrives at match the engine's own scores.
 *
 * Rules:
 *  - Undone entries are left out of the scores and balls: the sheet shows
 *    what counts. Each Undo / Redo is kept as a note on the visit it
 *    happened in, so the history stays visible.
 *  - A new visit starts when the player changes, or after a miss, foul,
 *    in-off, frame end or concession.
 *  - A pot adds its points to the player who potted. A foul with
 *    `penaltyTo` adds its points to each of those (players or teams); a foul
 *    without it (Century) adds its signed points to the player who fouled.
 */

import type { ActionLogEntry, BallType, GameState } from '../engine/types';

/**
 * The scoring sides of a snooker game: its teams in team mode, otherwise each
 * player, in turn order.
 */
export function sidesForGame(
  state: Pick<GameState, 'mode' | 'players' | 'teams' | 'turnOrder'>,
): FrameSide[] {
  if (state.mode === 'team' && state.teams.length > 0) {
    return state.teams.map((t) => ({
      name: t.name,
      members: t.playerIds
        .map((id) => state.players.find((p) => p.id === id)?.name)
        .filter((n): n is string => Boolean(n)),
    }));
  }
  const order = state.turnOrder.length ? state.turnOrder : state.players.map((_, i) => i);
  return order
    .map((i) => state.players[i])
    .filter(Boolean)
    .map((p) => ({ name: p.name, members: [p.name] }));
}

/** A scoring side: a player, or a team in team mode. */
export interface FrameSide {
  name: string;
  /** Player names on this side. A one-player side lists its own name. */
  members: string[];
}

export interface VisitBall {
  ball: BallType;
  freeBall: boolean;
}

export interface VisitFoul {
  ball?: BallType;
  /** Points the foul moved (always positive). */
  penalty: number;
  /** Who received them. Empty when the fouler lost them (Century). */
  to: string[];
  inOff: boolean;
}

export type VisitKind = 'visit' | 'end';

export interface VisitMark {
  kind: 'undo' | 'redo';
  /** What was taken back or put back: "Awais potted red (+1)". */
  text: string;
}

export interface FrameVisit {
  kind: VisitKind;
  /** 1-based visit number. End rows carry the number they follow. */
  number: number;
  player: string;
  side: string;
  balls: VisitBall[];
  /** Points this visit put on the player's own side (signed). */
  points: number;
  foul?: VisitFoul;
  /** Undos and redos during this visit, in order. */
  marks: VisitMark[];
  /** Short text for the second line: "Missed", "Frame 1 ended", … */
  note?: string;
  /** Visit ended by a miss with nothing potted. */
  missed: boolean;
  /** Still in progress: the player at the table now. */
  live: boolean;
  /** The frame's highest-scoring visit. */
  highest: boolean;
  /** Running totals by side name, after this visit. */
  totals: Record<string, number>;
  /** Side names whose total moved in this visit. */
  changed: string[];
}

export interface FrameVisitsInput {
  actionLog: readonly ActionLogEntry[];
  sides: readonly FrameSide[];
  /** Player at the table now, for the live row. Omit when nobody is. */
  currentPlayerName?: string | null;
  /** The frame is over: no live row. */
  isOver?: boolean;
}

export interface FrameVisits {
  visits: FrameVisit[];
  /** Totals by side name after the last entry. */
  totals: Record<string, number>;
  /** Real visits (no end rows, no empty live row). */
  visitCount: number;
}

const SKIPPED = new Set(['freeBall', 'frameStart']);
const MARKS = new Set(['undo', 'redo']);
const ENDS_VISIT = new Set(['miss', 'foul', 'inOff']);
const ENDS_FRAME = new Set(['frameEnd', 'concede']);

export function buildFrameVisits({
  actionLog,
  sides,
  currentPlayerName,
  isOver = false,
}: FrameVisitsInput): FrameVisits {
  const sideOf = (name: string): string => {
    const hit =
      sides.find((s) => s.name === name) ??
      sides.find((s) => s.members.includes(name));
    return hit ? hit.name : name;
  };

  const totals: Record<string, number> = {};
  for (const s of sides) totals[s.name] = 0;
  const add = (side: string, pts: number) => {
    totals[side] = (totals[side] ?? 0) + pts;
  };

  const visits: FrameVisit[] = [];
  let open: FrameVisit | null = null;
  let number = 0;
  let before: Record<string, number> = { ...totals };

  const close = () => {
    if (!open) return;
    open.totals = { ...totals };
    open.changed = Object.keys(totals).filter((k) => totals[k] !== (before[k] ?? 0));
    open = null;
  };

  const start = (player: string): FrameVisit => {
    number += 1;
    before = { ...totals };
    const v: FrameVisit = {
      kind: 'visit',
      number,
      player,
      side: sideOf(player),
      balls: [],
      points: 0,
      marks: [],
      missed: false,
      live: false,
      highest: false,
      totals: {},
      changed: [],
    };
    visits.push(v);
    return v;
  };

  for (const e of actionLog) {
    if (e.undone || SKIPPED.has(e.type)) continue;

    // Undo / Redo: a note on the visit in progress (or the one it reopened).
    if (MARKS.has(e.type)) {
      if (!open) open = start(e.playerName);
      open.marks.push({
        kind: e.type === 'undo' ? 'undo' : 'redo',
        text: e.description.replace(/^(Undid|Redid):\s*/i, ''),
      });
      continue;
    }

    if (ENDS_FRAME.has(e.type)) {
      close();
      visits.push({
        kind: 'end',
        number,
        player: e.playerName,
        side: sideOf(e.playerName),
        balls: [],
        points: 0,
        marks: [],
        note: e.description,
        missed: false,
        live: false,
        highest: false,
        totals: { ...totals },
        changed: [],
      });
      continue;
    }

    if (!open || open.player !== e.playerName) {
      close();
      open = start(e.playerName);
    }
    const v: FrameVisit = open;

    if (e.type === 'pot') {
      const pts = e.points ?? 0;
      add(v.side, pts);
      v.points += pts;
      if (e.ball) {
        v.balls.push({ ball: e.ball, freeBall: /free ball/i.test(e.description) });
      }
    } else if (e.type === 'foul' || e.type === 'inOff') {
      const pts = e.points ?? 0;
      const to = e.penaltyTo ?? [];
      if (to.length) {
        for (const name of to) add(sideOf(name), pts);
      } else {
        add(v.side, pts);
        v.points += pts;
      }
      v.foul = { ball: e.ball, penalty: Math.abs(pts), to, inOff: e.type === 'inOff' };
      if (!to.length && /missed the red/i.test(e.description)) v.note = 'Missed the red';
    } else if (e.type === 'miss') {
      if (e.ball && /went past/i.test(e.description)) {
        v.note = `Went past the target on ${e.ball}`;
      } else if (v.balls.length === 0) {
        v.missed = true;
      }
    }

    if (ENDS_VISIT.has(e.type)) close();
  }

  // The live row: the open visit if it belongs to the player at the table,
  // otherwise an empty one for them.
  const stillOpen = open as FrameVisit | null;
  if (!isOver && currentPlayerName) {
    if (stillOpen && stillOpen.player === currentPlayerName) {
      stillOpen.live = true;
    } else {
      close();
      open = start(currentPlayerName);
      open.live = true;
    }
  }
  close();

  // Highest break: the first visit with the most points, once there are two
  // scoring visits to compare.
  const scoring = visits.filter((v) => v.kind === 'visit' && v.points > 0);
  if (scoring.length >= 2) {
    const best = scoring.reduce((a, b) => (b.points > a.points ? b : a));
    best.highest = true;
  }

  const visitCount = visits.filter(
    (v) => v.kind === 'visit' && !(v.live && v.balls.length === 0 && !v.foul && v.marks.length === 0),
  ).length;

  return { visits, totals: { ...totals }, visitCount };
}
