// ============================================================================
// engine/index.ts — Barrel export for the Snooker Counter game engine
// ============================================================================

// --- Types ---
export type {
  BallType,
  GameMode,
  GamePhase,
  ExpectedBall,
  Player,
  Team,
  ActionLogType,
  ActionLogEntry,
  CompletedFrame,
  CompletedFramePlayerStats,
  GameState,
  GameAction,
  PotBallAction,
  FoulAction,
  InOffAction,
  MissAction,
  UndoAction,
  FreeBallAction,
  ConcedeFrameAction,
  EndFrameAction,
  StartNextFrameAction,
  UpdateTimerAction,
  SetStateAction,
  PlayerSetup,
  GameSetupConfig,
} from './types';

// --- Constants ---
export {
  BALL_VALUES,
  COLORS_IN_ORDER,
  FOUL_MINIMUM,
  BALL_COLORS,
  MAX_UNDO_STACK,
  maxBreak,
} from './constants';

// --- Validators ---
export {
  isLegalPot,
  calculateFoulPenalty,
  getPointsRemaining,
  isFrameOver,
  isMatchOver,
  getNextColorInOrder,
} from './validators';

// --- Reducer ---
export {
  createInitialState,
  gameReducer,
} from './reducer';

// --- React Context ---
export {
  GameContext,
  GameProvider,
  useGame,
} from './GameContext';

export type { GameContextValue } from './GameContext';
