// ============================================================================
// century.ts — the Century club game
// ============================================================================
//
// A different game from snooker, so it gets its own reducer rather than a set
// of `if (century)` branches threaded through rules that took real work to get
// right. Only the ball types are shared.
//
// Rules
//   - 2-8 players race to land EXACTLY on the target (50 or 100).
//   - Red is worth 10 or 20 (chosen at setup); colours keep snooker values.
//   - No sequence: any ball, any time. Red is never compulsory.
//   - Red is a gamble — potting it scores the red value, missing it costs the
//     same and the visit.
//   - Missing a colour just ends the visit, with no penalty. That asymmetry is
//     what makes going for a red an actual decision.
//   - Other fouls deduct from the fouler; nobody gains.
//   - The same ball may be potted at most twice in a row. The third is blocked
//     until another ball goes down or the visit ends.
//   - Overshooting does not score: the ball re-spots and the visit ends, but
//     anything scored earlier in that visit stands.
//   - Landing exactly on the target puts a player out, safe. The last player
//     still short is the loser.
//   - Scores may go negative.
// ============================================================================

import type { ActionLogEntry, ActionLogType, BallType } from './types';

export const CENTURY_TARGETS = [50, 100] as const;
export type CenturyTarget = (typeof CENTURY_TARGETS)[number];

/** Default values. Red is overridden by the game's chosen red value. */
export const CENTURY_VALUES: Readonly<Record<BallType, number>> = {
  red: 10,
  yellow: 2,
  green: 3,
  brown: 4,
  blue: 5,
  pink: 6,
  black: 7,
} as const;

/** Red can be played at 10 or 20. A missed red costs the same. */
export const CENTURY_RED_VALUES = [10, 20] as const;
export const DEFAULT_RED_VALUE = 10;

/** Snooker's minimum foul value. */
const MIN_FOUL = 4;

/** How many times in a row one ball may be potted. */
export const MAX_SAME_BALL_RUN = 2;

export interface CenturyPlayer {
  readonly id: string;
  name: string;
  score: number;
  /** Finishing position (1 = first out), or null while still playing. */
  finishedAt: number | null;
  potted: number;
  redsPotted: number;
  redsMissed: number;
  fouls: number;
}

export type CenturyLogKind =
  | 'pot' | 'redMiss' | 'colourMiss' | 'foul' | 'bust' | 'finish' | 'blocked'
  | 'undo' | 'redo';

export interface CenturyLogEntry {
  kind: CenturyLogKind;
  playerName: string;
  ball?: BallType;
  points?: number;
  description: string;
  timestamp: string;
  /** Taken back with Undo; kept in the timeline, marked. */
  undone?: boolean;
}

/** What one Undo took back, so Redo can restore it. */
export interface CenturyRedoEntry {
  state: CenturyState;
  indices: number[];
  label: string;
}

export interface CenturyState {
  target: number;
  /** Points for a red, and the cost of missing one. Older saves lack it. */
  redValue?: number;
  players: CenturyPlayer[];
  /** Indices into `players`, in playing order. */
  turnOrder: number[];
  /** Index into `turnOrder`. */
  currentTurn: number;
  /** Ball potted last in the current visit, for the same-ball rule. */
  lastBall: BallType | null;
  sameBallRun: number;
  visitPots: number;
  startedAt: string;
  actionLog: CenturyLogEntry[];
  undoStack: CenturyState[];
  /** Undos that can be redone, newest last. Cleared by any new move. */
  redoStack?: CenturyRedoEntry[];
  finished: boolean;
  /** The player left short once everyone else is safe. */
  loserId: string | null;
}

export type CenturyAction =
  | { type: 'POT'; ball: BallType }
  | { type: 'MISS_RED' }
  | { type: 'MISS_COLOUR' }
  | { type: 'FOUL'; ball: BallType }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_STATE'; state: CenturyState };

const MAX_UNDO = 12;

export interface CenturySetup {
  target: number;
  redValue?: number;
  players: { name: string }[];
}

export function createCenturyState(setup: CenturySetup): CenturyState {
  const players: CenturyPlayer[] = setup.players.map((p, i) => ({
    id: `cp_${i}_${Math.random().toString(36).slice(2, 8)}`,
    name: p.name.trim() || `Player ${i + 1}`,
    score: 0,
    finishedAt: null,
    potted: 0,
    redsPotted: 0,
    redsMissed: 0,
    fouls: 0,
  }));

  return {
    target: setup.target,
    redValue: setup.redValue ?? DEFAULT_RED_VALUE,
    players,
    turnOrder: players.map((_, i) => i),
    currentTurn: 0,
    lastBall: null,
    sameBallRun: 0,
    visitPots: 0,
    startedAt: new Date().toISOString(),
    actionLog: [],
    undoStack: [],
    finished: false,
    loserId: null,
  };
}

/* ------------------------------------------------------------------ helpers */

/** Red value for this game (10 for games saved before the option existed). */
export function redValueOf(state: Pick<CenturyState, 'redValue'>): number {
  return state.redValue ?? DEFAULT_RED_VALUE;
}

/** What a ball scores in this game. */
export function ballValue(state: Pick<CenturyState, 'redValue'>, ball: BallType): number {
  return ball === 'red' ? redValueOf(state) : CENTURY_VALUES[ball];
}

export function currentPlayer(state: CenturyState): CenturyPlayer | undefined {
  return state.players[state.turnOrder[state.currentTurn]];
}

/** Players still short of the target, in playing order. */
function stillPlaying(state: CenturyState): number[] {
  return state.turnOrder.filter((i) => state.players[i].finishedAt === null);
}

/** Blocked because it has already gone down twice in a row this visit. */
export function isBallBlocked(state: CenturyState, ball: BallType): boolean {
  return state.lastBall === ball && state.sameBallRun >= MAX_SAME_BALL_RUN;
}

/** Potting this would take the player past the target, so it cannot score. */
export function wouldBust(state: CenturyState, ball: BallType): boolean {
  const p = currentPlayer(state);
  if (!p) return false;
  return p.score + ballValue(state, ball) > state.target;
}

/** Exactly finishes the player — the checkout. */
export function isCheckout(state: CenturyState, ball: BallType): boolean {
  const p = currentPlayer(state);
  if (!p) return false;
  return p.score + ballValue(state, ball) === state.target;
}

/** Foul cost: a foul on the red is 4 whatever the red is worth. */
export function foulValue(ball: BallType): number {
  return ball === 'red' ? MIN_FOUL : Math.max(MIN_FOUL, CENTURY_VALUES[ball]);
}

function log(
  state: CenturyState,
  entry: Omit<CenturyLogEntry, 'timestamp'>
): CenturyLogEntry[] {
  return [
    ...state.actionLog,
    { ...entry, timestamp: new Date().toISOString() },
  ];
}

function pushUndo(state: CenturyState): CenturyState[] {
  const snapshot: CenturyState = { ...state, undoStack: [], redoStack: [] };
  const next = [...state.undoStack, snapshot];
  return next.length > MAX_UNDO ? next.slice(next.length - MAX_UNDO) : next;
}

/**
 * Pass the visit to the next player who is still short, and end the game once
 * only one of them is left.
 */
function passTurn(state: CenturyState): CenturyState {
  const remaining = stillPlaying(state);

  if (remaining.length <= 1) {
    return {
      ...state,
      finished: true,
      loserId: remaining.length === 1 ? state.players[remaining[0]].id : null,
      lastBall: null,
      sameBallRun: 0,
      visitPots: 0,
    };
  }

  let next = state.currentTurn;
  for (let step = 0; step < state.turnOrder.length; step += 1) {
    next = (next + 1) % state.turnOrder.length;
    if (state.players[state.turnOrder[next]].finishedAt === null) break;
  }

  return {
    ...state,
    currentTurn: next,
    lastBall: null,
    sameBallRun: 0,
    visitPots: 0,
  };
}

function updatePlayer(
  state: CenturyState,
  index: number,
  patch: Partial<CenturyPlayer>
): CenturyPlayer[] {
  return state.players.map((p, i) => (i === index ? { ...p, ...patch } : p));
}

/* ------------------------------------------------------------------ reducer */

export function centuryReducer(
  state: CenturyState,
  action: CenturyAction
): CenturyState {
  if (action.type === 'SET_STATE') return action.state;

  if (action.type === 'UNDO') {
    const pending = pendingCenturyUndo(state);
    if (!pending) return state;
    // Restore the game, keep the timeline: undone steps stay, marked.
    const previous = state.undoStack[state.undoStack.length - 1];
    const marked = state.actionLog.map((e, i) =>
      pending.indices.includes(i) ? { ...e, undone: true } : e
    );
    const who = currentPlayer(state)?.name ?? '';
    return {
      ...previous,
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [
        ...(state.redoStack ?? []),
        { state: { ...state, redoStack: [] }, indices: pending.indices, label: pending.label },
      ],
      actionLog: [
        ...marked,
        { kind: 'undo', playerName: who, description: `Undid: ${pending.label}`, timestamp: new Date().toISOString() },
      ],
    };
  }

  if (action.type === 'REDO') {
    const stack = state.redoStack ?? [];
    if (stack.length === 0) return state;
    const item = stack[stack.length - 1];
    const restored = state.actionLog.map((e, i) =>
      item.indices.includes(i) ? { ...e, undone: false } : e
    );
    return {
      ...item.state,
      redoStack: stack.slice(0, -1),
      actionLog: [
        ...restored,
        {
          kind: 'redo',
          playerName: currentPlayer(item.state)?.name ?? '',
          description: `Redid: ${item.label}`,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  // Any new move after an undo ends the chance to redo it.
  if (state.redoStack?.length) state = { ...state, redoStack: [] };

  if (state.finished) return state;

  const playerIndex = state.turnOrder[state.currentTurn];
  const player = state.players[playerIndex];
  if (!player) return state;

  const undoStack = pushUndo(state);

  switch (action.type) {
    case 'POT': {
      const { ball } = action;

      // The rule is enforced by hiding the ball, so this is belt and braces.
      if (isBallBlocked(state, ball)) return state;

      const value = ballValue(state, ball);
      const next = player.score + value;

      // Past the target: no score, ball re-spots, visit ends. Anything already
      // scored this visit stands.
      if (next > state.target) {
        return passTurn({
          ...state,
          undoStack,
          actionLog: log(state, {
            kind: 'bust',
            playerName: player.name,
            ball,
            description: `${player.name} went past ${state.target} on the ${ball} — no score`,
          }),
        });
      }

      const isRed = ball === 'red';
      const players = updatePlayer(state, playerIndex, {
        score: next,
        potted: player.potted + 1,
        redsPotted: player.redsPotted + (isRed ? 1 : 0),
      });

      const withPot: CenturyState = {
        ...state,
        players,
        undoStack,
        lastBall: ball,
        sameBallRun: state.lastBall === ball ? state.sameBallRun + 1 : 1,
        visitPots: state.visitPots + 1,
        actionLog: log(state, {
          kind: 'pot',
          playerName: player.name,
          ball,
          points: value,
          description: `${player.name} potted ${ball} (+${value}) — ${next}`,
        }),
      };

      // Exactly on target: safe, and out of the rotation.
      if (next === state.target) {
        const position =
          withPot.players.filter((p) => p.finishedAt !== null).length + 1;
        const finished = updatePlayer(withPot, playerIndex, {
          finishedAt: position,
        });
        return passTurn({
          ...withPot,
          players: finished,
          actionLog: log(withPot, {
            kind: 'finish',
            playerName: player.name,
            description: `${player.name} finished on ${state.target} (#${position})`,
          }),
        });
      }

      return withPot;
    }

    case 'MISS_RED': {
      const penalty = redValueOf(state);
      const players = updatePlayer(state, playerIndex, {
        score: player.score - penalty,
        redsMissed: player.redsMissed + 1,
      });
      return passTurn({
        ...state,
        players,
        undoStack,
        actionLog: log(state, {
          kind: 'redMiss',
          playerName: player.name,
          ball: 'red',
          points: -penalty,
          description: `${player.name} missed the red (−${penalty}) — ${
            player.score - penalty
          }`,
        }),
      });
    }

    case 'MISS_COLOUR': {
      return passTurn({
        ...state,
        undoStack,
        actionLog: log(state, {
          kind: 'colourMiss',
          playerName: player.name,
          description: `${player.name} missed — visit ends`,
        }),
      });
    }

    case 'FOUL': {
      const penalty = foulValue(action.ball);
      const players = updatePlayer(state, playerIndex, {
        score: player.score - penalty,
        fouls: player.fouls + 1,
      });
      return passTurn({
        ...state,
        players,
        undoStack,
        actionLog: log(state, {
          kind: 'foul',
          playerName: player.name,
          ball: action.ball,
          points: -penalty,
          description: `${player.name} fouled on ${action.ball} (−${penalty}) — ${
            player.score - penalty
          }`,
        }),
      });
    }

    default:
      return state;
  }
}

/* ------------------------------------------------------------ undo / redo */

function pendingCenturyUndo(state: CenturyState): { indices: number[]; label: string } | null {
  if (state.undoStack.length === 0) return null;
  const from = state.undoStack[state.undoStack.length - 1].actionLog.length;
  const indices: number[] = [];
  let last: CenturyLogEntry | undefined;
  state.actionLog.forEach((e, i) => {
    if (i >= from && !e.undone && e.kind !== 'undo' && e.kind !== 'redo') {
      indices.push(i);
      last = e;
    }
  });
  return { indices, label: last ? last.description : 'the last action' };
}

/** What Undo would take back right now, or null. */
export function describeCenturyUndo(state: CenturyState): string | null {
  return pendingCenturyUndo(state)?.label ?? null;
}

/* --------------------------------------------------------------- log views */

const LOG_TYPE: Record<CenturyLogKind, ActionLogType> = {
  pot: 'pot',
  redMiss: 'foul',
  foul: 'foul',
  colourMiss: 'miss',
  bust: 'miss',
  blocked: 'miss',
  finish: 'frameEnd',
  undo: 'undo',
  redo: 'redo',
};

/**
 * Century entries in the snooker log's shape, so the same timeline drawer
 * and timeline list render both games.
 */
export function toActionLog(entries: readonly CenturyLogEntry[]): ActionLogEntry[] {
  return entries.map((e) => ({
    timestamp: e.timestamp,
    type: LOG_TYPE[e.kind] ?? 'miss',
    playerName: e.playerName,
    ball: e.ball,
    points: e.points,
    description: e.description,
    undone: e.undone,
  }));
}
