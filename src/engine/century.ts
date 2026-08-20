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
//   - Red is worth 10; colours keep their snooker values.
//   - No sequence: any ball, any time. Red is never compulsory.
//   - Red is a gamble — potting it scores 10, missing it costs 10 and the visit.
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

import type { BallType } from './types';

export const CENTURY_TARGETS = [50, 100] as const;
export type CenturyTarget = (typeof CENTURY_TARGETS)[number];

/** Red is 10 here, not 1. Colours are unchanged. */
export const CENTURY_VALUES: Readonly<Record<BallType, number>> = {
  red: 10,
  yellow: 2,
  green: 3,
  brown: 4,
  blue: 5,
  pink: 6,
  black: 7,
} as const;

/** Cost of missing an attempted red — the same 10 it would have scored. */
export const RED_MISS_PENALTY = 10;

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
  | 'pot' | 'redMiss' | 'colourMiss' | 'foul' | 'bust' | 'finish' | 'blocked';

export interface CenturyLogEntry {
  kind: CenturyLogKind;
  playerName: string;
  ball?: BallType;
  points?: number;
  description: string;
  timestamp: string;
}

export interface CenturyState {
  target: number;
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
  | { type: 'SET_STATE'; state: CenturyState };

const MAX_UNDO = 12;

export interface CenturySetup {
  target: number;
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
  return p.score + CENTURY_VALUES[ball] > state.target;
}

/** Exactly finishes the player — the checkout. */
export function isCheckout(state: CenturyState, ball: BallType): boolean {
  const p = currentPlayer(state);
  if (!p) return false;
  return p.score + CENTURY_VALUES[ball] === state.target;
}

export function foulValue(ball: BallType): number {
  return Math.max(MIN_FOUL, CENTURY_VALUES[ball] === 10 ? MIN_FOUL : CENTURY_VALUES[ball]);
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
  const snapshot: CenturyState = { ...state, undoStack: [] };
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
    if (state.undoStack.length === 0) return state;
    const previous = state.undoStack[state.undoStack.length - 1];
    return { ...previous, undoStack: state.undoStack.slice(0, -1) };
  }

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

      const value = CENTURY_VALUES[ball];
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
      const players = updatePlayer(state, playerIndex, {
        score: player.score - RED_MISS_PENALTY,
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
          points: -RED_MISS_PENALTY,
          description: `${player.name} missed the red (−${RED_MISS_PENALTY}) — ${
            player.score - RED_MISS_PENALTY
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
