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
  RespotTossAction,
  RespotSwapAction,
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
  isMatchClinched,
  framesDecided,
  getNextColorInOrder,
  respotContenders,
  needsRespotToss,
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
