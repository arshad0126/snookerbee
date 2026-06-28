// ============================================================================
// GameContext.tsx — React context for the Snooker Counter game engine
// ============================================================================
//
// This module provides:
// 1. GameContext — React context holding game state + dispatch
// 2. GameProvider — Wraps the app, initialises the reducer
// 3. useGame() — Custom hook for consuming the context
// 4. setupGame() — Helper to create an initial state from a config
// ============================================================================

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  type ReactNode,
  type Dispatch,
} from 'react';

import type { GameState, GameAction, GameSetupConfig } from './types';
import { gameReducer, createInitialState } from './reducer';

// ---------------------------------------------------------------------------
// Context Type
// ---------------------------------------------------------------------------

interface GameContextValue {
  /** Current game state. */
  state: GameState;
  /** Dispatch a game action to the reducer. */
  dispatch: Dispatch<GameAction>;
  /** Re-initialise the game with a new setup config. */
  setupGame: (config: GameSetupConfig) => void;
}

// ---------------------------------------------------------------------------
// Default / placeholder state
// ---------------------------------------------------------------------------

/**
 * A minimal placeholder state used before the game is initialised.
 * The UI should check `state.players.length === 0` or `state.phase`
 * to determine if a game has been set up.
 */
const PLACEHOLDER_STATE: GameState = {
  mode: '1v1',
  phase: 'finished',
  redsTotal: 15,
  redsRemaining: 0,
  currentPlayerIndex: 0,
  players: [],
  teams: [],
  turnOrder: [],
  expectedBall: null,
  currentColorTarget: null,
  frameNumber: 0,
  bestOf: 1,
  frameScores: {},
  actionLog: [],
  undoStack: [],
  matchStartTime: '',
  frameStartTime: '',
  matchTimerMs: 0,
  currentFrameDurationMs: 0,
  completedFrames: [],
  isFreeBall: false,
  winner: null,
};

// ---------------------------------------------------------------------------
// Create Context
// ---------------------------------------------------------------------------

const GameContext = createContext<GameContextValue | undefined>(undefined);

// Give the context a display name for React DevTools
GameContext.displayName = 'GameContext';

// ---------------------------------------------------------------------------
// GameProvider Component
// ---------------------------------------------------------------------------

interface GameProviderProps {
  /** Child components that will have access to the game context. */
  children: ReactNode;
  /** Optional initial config to start a game immediately. */
  initialConfig?: GameSetupConfig;
}

/**
 * GameProvider wraps the application (or a subtree) and provides
 * the game state and dispatch function to all descendants.
 *
 * @example
 * ```tsx
 * <GameProvider>
 *   <App />
 * </GameProvider>
 * ```
 *
 * @example
 * ```tsx
 * // Start a game immediately on mount
 * <GameProvider initialConfig={{ mode: '1v1', redsCount: 15, bestOf: 3, players: [{ name: 'Alice' }, { name: 'Bob' }] }}>
 *   <GameScreen />
 * </GameProvider>
 * ```
 */
export function GameProvider({
  children,
  initialConfig,
}: GameProviderProps): React.JSX.Element {
  // Build the initial state: either from a provided config or a placeholder
  const initialState = initialConfig
    ? createInitialState(initialConfig)
    : PLACEHOLDER_STATE;

  const [state, dispatch] = useReducer(gameReducer, initialState);

  /**
   * setupGame — Dispatches a SET_STATE action with a freshly created
   * initial state from the given config. This effectively resets the
   * entire game.
   */
  const setupGame = useCallback(
    (config: GameSetupConfig) => {
      const newState = createInitialState(config);
      dispatch({ type: 'SET_STATE', state: newState });
    },
    [dispatch],
  );

  // Memoisation note: We intentionally do NOT useMemo on the context value
  // because `state` changes on every dispatch, which is the primary render
  // trigger. Wrapping in useMemo would add overhead without benefit here.
  const contextValue: GameContextValue = {
    state,
    dispatch,
    setupGame,
  };

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// useGame Hook
// ---------------------------------------------------------------------------

/**
 * Custom hook to access the game state and dispatch function.
 *
 * Must be called from within a `<GameProvider>` tree.
 *
 * @throws Error if called outside of a GameProvider.
 *
 * @example
 * ```tsx
 * function ScoreBoard() {
 *   const { state, dispatch } = useGame();
 *
 *   return (
 *     <div>
 *       <p>Score: {state.players[0]?.score}</p>
 *       <button onClick={() => dispatch({ type: 'POT_BALL', ball: 'red' })}>
 *         Pot Red
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useGame(): GameContextValue {
  const context = useContext(GameContext);

  if (context === undefined) {
    throw new Error(
      'useGame() must be used within a <GameProvider>. ' +
      'Wrap your component tree with <GameProvider> to provide game state.',
    );
  }

  return context;
}

// ---------------------------------------------------------------------------
// Re-exports for convenience
// ---------------------------------------------------------------------------

export { GameContext };
export type { GameContextValue };
