// ============================================================================
// reducer.ts — Pure game reducer for the Snooker Counter engine
// ============================================================================
//
// This reducer is the heart of the game engine. It is pure and deterministic:
// given the same state + action, it always produces the same new state.
//
// Key snooker rules implemented:
// 1. Red-color alternation during the 'reds' phase
// 2. Colors re-spotted while reds remain; NOT re-spotted in final phase
// 3. After last red + final color → colorsInOrder (yellow→black ascending)
// 4. Foul penalty = max(4, ball-on value, ball-involved value)
// 5. Foul points awarded to ALL opponents in freeForAll mode
// 6. Re-spotted black when tied after final black
// 7. Free ball: next pot scores as if it were the expected ball
// 8. Break tracking (current + highest per player)
// 9. Undo stack capped at 10 entries
// ============================================================================

import type {
  BallType,
  GameAction,
  GameSetupConfig,
  GameState,
  Player,
  Team,
  ActionLogEntry,
} from './types';

import {
  BALL_VALUES,
  COLORS_IN_ORDER,
  MAX_UNDO_STACK,
} from './constants';

import {
  isLegalPot,
  calculateFoulPenalty,
  getNextColorInOrder,
} from './validators';

// ---------------------------------------------------------------------------
// Helper: Generate unique IDs
// ---------------------------------------------------------------------------

let idCounter = 0;

function generateId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now()}_${idCounter}`;
}

// ---------------------------------------------------------------------------
// Helper: Deep clone state (for undo stack)
// ---------------------------------------------------------------------------

/**
 * Creates a deep clone of the game state, excluding the undoStack
 * to prevent nested stacks from consuming excessive memory.
 */
function cloneStateForUndo(state: GameState): GameState {
  // We strip the undoStack from the clone to avoid deeply nested copies.
  // When we restore from undo, we reconstruct the undo stack.
  const { undoStack: _, ...rest } = state;
  return JSON.parse(JSON.stringify({ ...rest, undoStack: [] })) as GameState;
}

// ---------------------------------------------------------------------------
// Helper: Push to undo stack (capped at MAX_UNDO_STACK)
// ---------------------------------------------------------------------------

function pushUndo(currentState: GameState): GameState[] {
  const snapshot = cloneStateForUndo(currentState);
  const newStack = [...currentState.undoStack, snapshot];

  // Keep only the last MAX_UNDO_STACK entries
  if (newStack.length > MAX_UNDO_STACK) {
    return newStack.slice(newStack.length - MAX_UNDO_STACK);
  }
  return newStack;
}

// ---------------------------------------------------------------------------
// Helper: Advance to next player in turn order
// ---------------------------------------------------------------------------

function advanceTurn(state: GameState): number {
  return (state.currentPlayerIndex + 1) % state.turnOrder.length;
}

// ---------------------------------------------------------------------------
// Helper: Create a log entry
// ---------------------------------------------------------------------------

function createLogEntry(
  partial: Omit<ActionLogEntry, 'timestamp'>,
): ActionLogEntry {
  return {
    ...partial,
    timestamp: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Helper: Get current player
// ---------------------------------------------------------------------------

function getCurrentPlayer(state: GameState): Player {
  const playerIndex = state.turnOrder[state.currentPlayerIndex];
  return state.players[playerIndex];
}

// ---------------------------------------------------------------------------
// Helper: Find team for a player
// ---------------------------------------------------------------------------

function findTeamForPlayer(
  teams: Team[],
  playerId: string,
): Team | undefined {
  return teams.find((t) => t.playerIds.includes(playerId));
}

// ---------------------------------------------------------------------------
// Helper: Get opponent entity IDs (for foul point distribution)
// ---------------------------------------------------------------------------

/**
 * Returns the IDs of entities (players or teams) that should receive
 * foul penalty points, based on game mode.
 *
 * - 1v1: The other player
 * - team: The other team
 * - freeForAll: ALL other players
 */
function getOpponentIds(state: GameState): string[] {
  const currentPlayer = getCurrentPlayer(state);

  switch (state.mode) {
    case '1v1': {
      return state.players
        .filter((p) => p.id !== currentPlayer.id)
        .map((p) => p.id);
    }

    case 'team': {
      const currentTeam = findTeamForPlayer(state.teams, currentPlayer.id);
      if (!currentTeam) return [];
      return state.teams
        .filter((t) => t.id !== currentTeam.id)
        .map((t) => t.id);
    }

    case 'freeForAll': {
      // Foul points go to ALL other players
      return state.players
        .filter((p) => p.id !== currentPlayer.id)
        .map((p) => p.id);
    }
  }
}

// ---------------------------------------------------------------------------
// Helper: Update team scores from player scores
// ---------------------------------------------------------------------------

function recalcTeamScores(players: Player[], teams: Team[]): Team[] {
  return teams.map((team) => ({
    ...team,
    totalScore: team.playerIds.reduce((sum, pid) => {
      const player = players.find((p) => p.id === pid);
      return sum + (player?.score ?? 0);
    }, 0),
  }));
}

// ---------------------------------------------------------------------------
// Helper: Determine frame winner
// ---------------------------------------------------------------------------

/**
 * Determines the winner of the current frame based on scores.
 * In team mode, compares team totalScores.
 * Otherwise, compares individual player scores.
 *
 * Returns the winning entity's ID, or null if tied (shouldn't happen
 * after re-spotted black).
 */
function determineFrameWinner(state: GameState): string | null {
  if (state.mode === 'team') {
    const sorted = [...state.teams].sort(
      (a, b) => b.totalScore - a.totalScore,
    );
    if (sorted.length >= 2 && sorted[0].totalScore === sorted[1].totalScore) {
      return null; // Tie
    }
    return sorted[0]?.id ?? null;
  }

  // 1v1 or freeForAll: compare player scores
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  if (sorted.length >= 2 && sorted[0].score === sorted[1].score) {
    return null; // Tie
  }
  return sorted[0]?.id ?? null;
}

/**
 * Checks if scores are tied (for re-spotted black determination).
 * In team mode, compares team scores. Otherwise, compares the top two players.
 */
function areScoresTied(state: GameState): boolean {
  if (state.mode === 'team') {
    if (state.teams.length < 2) return false;
    const sorted = [...state.teams].sort(
      (a, b) => b.totalScore - a.totalScore,
    );
    return sorted[0].totalScore === sorted[1].totalScore;
  }

  if (state.players.length < 2) return false;
  const sorted = [...state.players].sort((a, b) => b.score - a.score);
  return sorted[0].score === sorted[1].score;
}

// ============================================================================
// createInitialState — Build the starting game state from a config
// ============================================================================

export function createInitialState(config: GameSetupConfig): GameState {
  const now = new Date().toISOString();

  // --- Create players ---
  const players: Player[] = config.players.map((p, i) => ({
    id: generateId('player'),
    name: p.name || `Player ${i + 1}`,
    score: 0,
    currentBreak: 0,
    highestBreak: 0,
    foulsCommitted: 0,
    timeSpentMs: 0,
  }));

  // --- Create teams (if team mode) ---
  let teams: Team[] = [];
  if (config.mode === 'team' && config.teamAssignments) {
    teams = Object.entries(config.teamAssignments).map(
      ([teamIndex, playerIndices]) => ({
        id: generateId('team'),
        name: `Team ${Number(teamIndex) + 1}`,
        playerIds: playerIndices.map((pi) => players[pi].id),
        totalScore: 0,
      }),
    );
  }

  // --- Build turn order ---
  let turnOrder: number[];
  if (config.mode === 'team' && teams.length === 2) {
    // Interleave players from each team: T1P1, T2P1, T1P2, T2P2, ...
    const team0Indices = config.teamAssignments?.[0] ?? [];
    const team1Indices = config.teamAssignments?.[1] ?? [];
    turnOrder = [];
    const maxLen = Math.max(team0Indices.length, team1Indices.length);
    for (let i = 0; i < maxLen; i++) {
      if (i < team0Indices.length) turnOrder.push(team0Indices[i]);
      if (i < team1Indices.length) turnOrder.push(team1Indices[i]);
    }
  } else {
    // Simple round-robin: 0, 1, 2, ...
    turnOrder = players.map((_, i) => i);
  }

  // --- Initialize frame scores ---
  const frameScores: Record<string, number> = {};
  if (config.mode === 'team') {
    for (const team of teams) {
      frameScores[team.id] = 0;
    }
  } else {
    for (const player of players) {
      frameScores[player.id] = 0;
    }
  }

  // --- Determine starting player index ---
  const breakingIndex = config.breakingPlayerIndex ?? 0;
  // Find position in turnOrder
  const startingTurnIndex = turnOrder.indexOf(breakingIndex);

  return {
    mode: config.mode,
    phase: 'reds',
    redsTotal: config.redsCount,
    redsRemaining: config.redsCount,
    currentPlayerIndex: startingTurnIndex >= 0 ? startingTurnIndex : 0,
    players,
    teams,
    turnOrder,
    expectedBall: 'red',
    currentColorTarget: null,
    frameNumber: 1,
    bestOf: config.bestOf,
    frameScores,
    actionLog: [],
    undoStack: [],
    matchStartTime: now,
    frameStartTime: now,
    matchTimerMs: 0,
    isFreeBall: false,
    winner: null,
  };
}

// ============================================================================
// gameReducer — The main pure reducer
// ============================================================================

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    // -----------------------------------------------------------------------
    // POT_BALL — Player pots a ball
    // -----------------------------------------------------------------------
    case 'POT_BALL': {
      const { ball } = action;

      // Validate the pot is legal
      if (!isLegalPot(state, ball)) {
        // Illegal pot — treat as a no-op (UI should prevent this)
        console.warn(`Illegal pot: ${ball} in phase ${state.phase}`);
        return state;
      }

      // Save state for undo BEFORE making changes
      const undoStack = pushUndo(state);
      const currentPlayer = getCurrentPlayer(state);
      const playerIndex = state.turnOrder[state.currentPlayerIndex];

      // --- Calculate points ---
      let pointsScored: number;

      if (state.isFreeBall) {
        // Free ball scoring:
        // - If a red was expected, the free ball scores 1 (as if it were a red)
        // - If a color was expected, the free ball scores the value of the
        //   ball actually potted
        if (state.phase === 'reds' && state.expectedBall === 'red') {
          pointsScored = 1; // Treated as a red
        } else {
          pointsScored = BALL_VALUES[ball];
        }
      } else {
        pointsScored = BALL_VALUES[ball];
      }

      // --- Update player score and break ---
      const newBreak = currentPlayer.currentBreak + pointsScored;
      const newHighestBreak = Math.max(currentPlayer.highestBreak, newBreak);

      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? {
              ...p,
              score: p.score + pointsScored,
              currentBreak: newBreak,
              highestBreak: newHighestBreak,
            }
          : p,
      );

      // --- Update team scores if applicable ---
      const updatedTeams = state.mode === 'team'
        ? recalcTeamScores(updatedPlayers, state.teams)
        : state.teams;

      // --- Phase transitions ---
      let newPhase = state.phase;
      let newExpectedBall = state.expectedBall;
      let newRedsRemaining = state.redsRemaining;
      let newColorTarget = state.currentColorTarget;

      switch (state.phase) {
        case 'reds': {
          if (state.isFreeBall) {
            // Free ball in reds phase:
            // - If red was expected: treat as if a red was potted → expect color next
            // - If color was expected: treat as if a color was potted → expect red next
            //   (The free ball is re-spotted, and reds remain on the table)
            if (state.expectedBall === 'red') {
              // Treated as potting a red: do NOT decrement redsRemaining
              // (the actual red is still on the table; the nominated ball is re-spotted)
              newExpectedBall = 'color';
            } else {
              // Treated as potting a color after a red
              // The free ball is re-spotted; continue with reds
              newExpectedBall = 'red';
            }
          } else if (ball === 'red') {
            // Normal red pot: decrement reds, expect a color next
            newRedsRemaining = state.redsRemaining - 1;
            newExpectedBall = 'color';
          } else {
            // Normal color pot (after a red): color is re-spotted
            // If reds remain → continue alternating
            // If no reds remain → this was the last red's color → move to finalColor?
            // Wait — we already decremented reds when the red was potted.
            // So if redsRemaining === 0 here, all reds are gone and this is
            // the color after the last red, which means we should transition
            // to colorsInOrder.

            if (state.redsRemaining === 0) {
              // This was the final color after the last red
              // Transition to colorsInOrder
              newPhase = 'colorsInOrder';
              newExpectedBall = null;
              newColorTarget = COLORS_IN_ORDER[0]; // yellow
            } else {
              // More reds remain — color is re-spotted, expect red next
              newExpectedBall = 'red';
            }
          }
          break;
        }

        case 'finalColor': {
          // The one allowed color after the last red.
          // Now transition to colorsInOrder.
          newPhase = 'colorsInOrder';
          newExpectedBall = null;
          newColorTarget = COLORS_IN_ORDER[0]; // yellow
          break;
        }

        case 'colorsInOrder': {
          // A color was potted in sequence. Advance to the next color.
          // Colors are NOT re-spotted in this phase.
          const nextColor = getNextColorInOrder(state);

          if (nextColor === null) {
            // We just potted black (the last color)
            // Check if scores are tied → re-spotted black
            const stateWithScores: GameState = {
              ...state,
              players: updatedPlayers,
              teams: updatedTeams,
            };

            if (areScoresTied(stateWithScores)) {
              newPhase = 'respottedBlack';
              newColorTarget = 'black';
            } else {
              // Frame is over
              newPhase = 'finished';
              newColorTarget = null;
            }
          } else {
            // More colors to pot
            newColorTarget = nextColor;
          }
          break;
        }

        case 'respottedBlack': {
          // Potting black during re-spotted black ends the frame
          newPhase = 'finished';
          newColorTarget = null;
          break;
        }

        default:
          break;
      }

      // --- Create log entry ---
      const logEntry = createLogEntry({
        type: 'pot',
        playerName: currentPlayer.name,
        ball,
        points: pointsScored,
        description: state.isFreeBall
          ? `${currentPlayer.name} potted ${ball} as free ball (+${pointsScored})`
          : `${currentPlayer.name} potted ${ball} (+${pointsScored})`,
      });

      const newState: GameState = {
        ...state,
        phase: newPhase,
        redsRemaining: newRedsRemaining,
        players: updatedPlayers,
        teams: updatedTeams,
        expectedBall: newExpectedBall,
        currentColorTarget: newColorTarget,
        actionLog: [...state.actionLog, logEntry],
        undoStack,
        isFreeBall: false, // Free ball is always consumed after one pot
      };

      // If frame just ended, handle frame scoring
      if (newPhase === 'finished') {
        return handleFrameEnd(newState);
      }

      return newState;
    }

    // -----------------------------------------------------------------------
    // FOUL — A foul is committed (not in-off)
    // -----------------------------------------------------------------------
    case 'FOUL': {
      return handleFoul(
        state,
        action.ballInvolved,
        'foul',
        action.customPenalty,
        action.redPottedOnFoul
      );
    }

    // -----------------------------------------------------------------------
    // IN_OFF — Cue ball potted
    // -----------------------------------------------------------------------
    case 'IN_OFF': {
      return handleFoul(
        state,
        action.ballInvolved,
        'inOff',
        action.customPenalty,
        action.redPottedOnFoul
      );
    }

    // -----------------------------------------------------------------------
    // MISS — Player misses, no pot, turn passes
    // -----------------------------------------------------------------------
    case 'MISS': {
      const undoStack = pushUndo(state);
      const currentPlayer = getCurrentPlayer(state);
      const playerIndex = state.turnOrder[state.currentPlayerIndex];

      // Finalise the current break (reset to 0)
      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex
          ? { ...p, currentBreak: 0 }
          : p,
      );

      // If we were in 'reds' phase and expecting a color (just potted a red),
      // a miss means the next player still needs to pot a color? No —
      // Actually in snooker, a miss doesn't change what's expected.
      // If a red was just potted and the player misses the color, the
      // incoming player must pot a red (the color expectation resets on miss).
      // Wait: actually after potting a red, the same player tries for a color.
      // If they miss, the turn passes. But the sequence resets: the incoming
      // player must pot a red. The "expected color after red" is personal to
      // the break. On a new turn, it always starts with red expected.
      let newExpectedBall = state.expectedBall;
      if (state.phase === 'reds') {
        // On miss, reset to expecting red (incoming player starts fresh)
        newExpectedBall = 'red';
      }

      const logEntry = createLogEntry({
        type: 'miss',
        playerName: currentPlayer.name,
        description: `${currentPlayer.name} missed — turn passes`,
      });

      return {
        ...state,
        currentPlayerIndex: advanceTurn(state),
        players: updatedPlayers,
        expectedBall: newExpectedBall,
        actionLog: [...state.actionLog, logEntry],
        undoStack,
        isFreeBall: false,
      };
    }

    // -----------------------------------------------------------------------
    // UNDO — Revert to the previous state
    // -----------------------------------------------------------------------
    case 'UNDO': {
      if (state.undoStack.length === 0) {
        console.warn('Undo stack is empty — nothing to undo');
        return state;
      }

      // Pop the most recent state from the undo stack
      const previousState = state.undoStack[state.undoStack.length - 1];

      // Restore the undo stack from the current state minus the popped entry
      const restoredUndoStack = state.undoStack.slice(0, -1);

      const logEntry = createLogEntry({
        type: 'undo',
        playerName: getCurrentPlayer(state).name,
        description: 'Action undone',
      });

      return {
        ...previousState,
        undoStack: restoredUndoStack,
        actionLog: [...previousState.actionLog, logEntry],
      };
    }

    // -----------------------------------------------------------------------
    // FREE_BALL — Toggle free ball mode
    // -----------------------------------------------------------------------
    case 'FREE_BALL': {
      const currentPlayer = getCurrentPlayer(state);

      const logEntry = createLogEntry({
        type: 'freeBall',
        playerName: currentPlayer.name,
        description: state.isFreeBall
          ? `Free ball cancelled for ${currentPlayer.name}`
          : `Free ball awarded to ${currentPlayer.name}`,
      });

      return {
        ...state,
        isFreeBall: !state.isFreeBall,
        actionLog: [...state.actionLog, logEntry],
      };
    }

    // -----------------------------------------------------------------------
    // CONCEDE_FRAME — Current player concedes the frame
    // -----------------------------------------------------------------------
    case 'CONCEDE_FRAME': {
      const undoStack = pushUndo(state);
      const currentPlayer = getCurrentPlayer(state);
      const playerIndex = state.turnOrder[state.currentPlayerIndex];

      // Reset current player's break
      const updatedPlayers = state.players.map((p, i) =>
        i === playerIndex ? { ...p, currentBreak: 0 } : p,
      );

      const logEntry = createLogEntry({
        type: 'concede',
        playerName: currentPlayer.name,
        description: `${currentPlayer.name} conceded the frame`,
      });

      const concededState: GameState = {
        ...state,
        phase: 'finished',
        players: updatedPlayers,
        actionLog: [...state.actionLog, logEntry],
        undoStack,
        isFreeBall: false,
      };

      return handleFrameEnd(concededState);
    }

    // -----------------------------------------------------------------------
    // END_FRAME — Manually end the frame
    // -----------------------------------------------------------------------
    case 'END_FRAME': {
      const logEntry = createLogEntry({
        type: 'frameEnd',
        playerName: getCurrentPlayer(state).name,
        description: `Frame ${state.frameNumber} ended`,
      });

      const endedState: GameState = {
        ...state,
        phase: 'finished',
        actionLog: [...state.actionLog, logEntry],
        isFreeBall: false,
      };

      return handleFrameEnd(endedState);
    }

    // -----------------------------------------------------------------------
    // START_NEXT_FRAME — Reset for a new frame
    // -----------------------------------------------------------------------
    case 'START_NEXT_FRAME': {
      const now = new Date().toISOString();

      // Reset all player scores and breaks for the new frame
      const resetPlayers = state.players.map((p) => ({
        ...p,
        score: 0,
        currentBreak: 0,
        highestBreak: 0,
        foulsCommitted: 0,
      }));

      // Reset team scores
      const resetTeams = state.teams.map((t) => ({
        ...t,
        totalScore: 0,
      }));

      // Rotate who breaks: advance starting player each frame
      const newStartIndex =
        (state.frameNumber) % state.turnOrder.length;

      const logEntry = createLogEntry({
        type: 'frameStart',
        playerName: resetPlayers[state.turnOrder[newStartIndex]].name,
        description: `Frame ${state.frameNumber + 1} started`,
      });

      return {
        ...state,
        phase: 'reds',
        redsRemaining: state.redsTotal,
        currentPlayerIndex: newStartIndex,
        players: resetPlayers,
        teams: resetTeams,
        expectedBall: 'red',
        currentColorTarget: null,
        frameNumber: state.frameNumber + 1,
        actionLog: [logEntry],
        undoStack: [],
        frameStartTime: now,
        isFreeBall: false,
        winner: null,
      };
    }

    // -----------------------------------------------------------------------
    // UPDATE_TIMER — Tick the match timer
    // -----------------------------------------------------------------------
    case 'UPDATE_TIMER': {
      return {
        ...state,
        matchTimerMs: action.matchTimerMs,
      };
    }

    // -----------------------------------------------------------------------
    // SET_STATE — Replace entire state (hydration / debug)
    // -----------------------------------------------------------------------
    case 'SET_STATE': {
      return action.state;
    }

    default: {
      // Exhaustive check: TypeScript will error if we miss an action type
      const _exhaustive: never = action;
      console.warn('Unknown action:', _exhaustive);
      return state;
    }
  }
}

// ============================================================================
// Internal: Handle foul (shared between FOUL and IN_OFF)
// ============================================================================

function handleFoul(
  state: GameState,
  ballInvolved: BallType,
  foulType: 'foul' | 'inOff',
  customPenalty?: number,
  redPottedOnFoul?: boolean,
): GameState {
  const undoStack = pushUndo(state);
  const currentPlayer = getCurrentPlayer(state);
  const playerIndex = state.turnOrder[state.currentPlayerIndex];

  // --- Calculate penalty ---
  const penalty = customPenalty !== undefined ? customPenalty : calculateFoulPenalty(state, ballInvolved);

  // --- Award penalty points to opponents ---
  const opponentIds = getOpponentIds(state);
  const opponentNames: string[] = [];

  let updatedPlayers = state.players.map((p, i) => {
    const isCurrentPlayer = i === playerIndex;

    if (isCurrentPlayer) {
      // Foul-committing player: reset break, increment foul count
      // NO points scored for any balls potted during a foul
      return {
        ...p,
        currentBreak: 0,
        foulsCommitted: p.foulsCommitted + 1,
      };
    }

    // In freeForAll or 1v1: award penalty to each opponent player
    if (
      (state.mode === 'freeForAll' || state.mode === '1v1') &&
      opponentIds.includes(p.id)
    ) {
      opponentNames.push(p.name);
      return {
        ...p,
        score: p.score + penalty,
      };
    }

    return p;
  });

  // In team mode: award penalty to a designated player on the opposing team
  // (conventionally the first player on the opponent team)
  let updatedTeams = state.teams;
  if (state.mode === 'team') {
    const currentTeam = findTeamForPlayer(state.teams, currentPlayer.id);
    const opponentTeam = state.teams.find(
      (t) => currentTeam && t.id !== currentTeam.id,
    );

    if (opponentTeam && opponentTeam.playerIds.length > 0) {
      // Award penalty to the first player of the opponent team
      const recipientId = opponentTeam.playerIds[0];
      opponentNames.push(opponentTeam.name);

      updatedPlayers = updatedPlayers.map((p) =>
        p.id === recipientId
          ? { ...p, score: p.score + penalty }
          : p,
      );
    }

    updatedTeams = recalcTeamScores(updatedPlayers, state.teams);
  }

  // --- Handle re-spotted black phase: foul ends the frame ---
  let newPhase = state.phase;
  if (state.phase === 'respottedBlack') {
    newPhase = 'finished';
  }

  // --- Reset expected ball on foul in reds phase ---
  let newRedsRemaining = state.redsRemaining;
  let newExpectedBall = state.expectedBall;
  if (redPottedOnFoul && state.phase === 'reds' && state.redsRemaining > 0) {
    newRedsRemaining = state.redsRemaining - 1;
  }
  if (state.phase === 'reds') {
    newExpectedBall = newRedsRemaining === 0 ? 'color' : 'red';
  }

  // --- Create log entry ---
  const logEntry = createLogEntry({
    type: foulType === 'inOff' ? 'inOff' : 'foul',
    playerName: currentPlayer.name,
    ball: ballInvolved,
    points: penalty,
    penaltyTo: opponentNames,
    description:
      foulType === 'inOff'
        ? `${currentPlayer.name} potted the cue ball (in-off on ${ballInvolved}). ${penalty} pts to ${opponentNames.join(', ')}`
        : `${currentPlayer.name} fouled on ${ballInvolved}. ${penalty} pts to ${opponentNames.join(', ')}`,
  });

  const newState: GameState = {
    ...state,
    phase: newPhase,
    currentPlayerIndex: advanceTurn(state),
    players: updatedPlayers,
    teams: updatedTeams,
    redsRemaining: newRedsRemaining,
    expectedBall: newExpectedBall,
    actionLog: [...state.actionLog, logEntry],
    undoStack,
    isFreeBall: false,
  };

  // If frame just ended (re-spotted black foul), handle frame end
  if (newPhase === 'finished') {
    return handleFrameEnd(newState);
  }

  return newState;
}

// ============================================================================
// Internal: Handle frame end — update frame scores, check match over
// ============================================================================

function handleFrameEnd(state: GameState): GameState {
  const winnerId = determineFrameWinner(state);

  if (winnerId === null) {
    // Scores are still tied — shouldn't happen after re-spotted black,
    // but handle gracefully
    return state;
  }

  // Increment frame wins for the winner
  const updatedFrameScores = {
    ...state.frameScores,
    [winnerId]: (state.frameScores[winnerId] ?? 0) + 1,
  };

  // Check if match is over
  const framesToWin = Math.ceil(state.bestOf / 2);
  const matchWinner =
    updatedFrameScores[winnerId] >= framesToWin ? winnerId : null;

  return {
    ...state,
    frameScores: updatedFrameScores,
    winner: matchWinner,
  };
}
