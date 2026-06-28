// ============================================================================
// types.ts — Core type definitions for the Snooker Counter game engine
// ============================================================================

// ---------------------------------------------------------------------------
// Ball & Game Enumerations
// ---------------------------------------------------------------------------

/** The seven ball types in snooker, ordered by value (1–7). */
export type BallType =
  | 'red'
  | 'yellow'
  | 'green'
  | 'brown'
  | 'blue'
  | 'pink'
  | 'black';

/**
 * Game modes:
 * - '1v1'        — Standard two-player match
 * - 'team'       — Team play (2v2 or 3v3), players rotate within teams
 * - 'freeForAll' — 2–8 players, round-robin turns, foul points go to ALL opponents
 */
export type GameMode = '1v1' | 'team' | 'freeForAll';

/**
 * Phases of a snooker frame:
 * - 'reds'           — Alternating red/color pots while reds remain on the table
 * - 'finalColor'     — The one color pot allowed after the last red is potted
 * - 'colorsInOrder'  — Colors potted in ascending order (yellow→black), NOT re-spotted
 * - 'respottedBlack' — Scores tied after final black; next legal pot or foul ends the frame
 * - 'finished'       — Frame is over
 */
export type GamePhase =
  | 'reds'
  | 'finalColor'
  | 'colorsInOrder'
  | 'respottedBlack'
  | 'finished';

/**
 * Within the 'reds' phase, tracks whether the player should pot a red or a color next.
 * - 'red'   — A red ball must be potted
 * - 'color' — A color ball must be potted (after a red was just potted)
 */
export type ExpectedBall = 'red' | 'color';

// ---------------------------------------------------------------------------
// Player & Team Models
// ---------------------------------------------------------------------------

export interface Player {
  /** Unique identifier for the player. */
  readonly id: string;
  /** Display name. */
  name: string;
  /** Current frame score. */
  score: number;
  /** Points scored in the current unbroken sequence of pots. */
  currentBreak: number;
  /** Highest break achieved in this frame. */
  highestBreak: number;
  /** Total fouls committed in this frame. */
  foulsCommitted: number;
  /** Cumulative time spent at the table (milliseconds). */
  timeSpentMs: number;
}

export interface Team {
  /** Unique identifier for the team. */
  readonly id: string;
  /** Display name for the team. */
  name: string;
  /** IDs of players belonging to this team, in turn order. */
  playerIds: string[];
  /** Aggregate score across all team members for the current frame. */
  totalScore: number;
}

// ---------------------------------------------------------------------------
// Action Log
// ---------------------------------------------------------------------------

/** Types of events that can appear in the action log. */
export type ActionLogType =
  | 'pot'
  | 'foul'
  | 'inOff'
  | 'miss'
  | 'freeBall'
  | 'concede'
  | 'frameEnd'
  | 'frameStart'
  | 'undo';

export interface ActionLogEntry {
  /** ISO-8601 timestamp of when the action occurred. */
  timestamp: string;
  /** Category of the action. */
  type: ActionLogType;
  /** Name of the player who performed the action. */
  playerName: string;
  /** Ball involved in the action, if any. */
  ball?: BallType;
  /** Points scored or penalised. */
  points?: number;
  /** Name(s) of player(s) who received penalty points (foul recipients). */
  penaltyTo?: string[];
  /** Human-readable description of what happened. */
  description: string;
}

export interface CompletedFrame {
  frameNumber: number;
  durationMs: number;
  actionLog: ActionLogEntry[];
}

// ---------------------------------------------------------------------------
// Game State
// ---------------------------------------------------------------------------

export interface GameState {
  // --- Mode & Phase ---
  /** The game mode for this match. */
  mode: GameMode;
  /** Current phase of the frame. */
  phase: GamePhase;

  // --- Reds ---
  /** Total number of reds at frame start (10 or 15). */
  redsTotal: number;
  /** How many reds remain on the table. */
  redsRemaining: number;

  // --- Turn Management ---
  /**
   * Index into `turnOrder` indicating whose turn it is.
   * The actual player is `players[turnOrder[currentPlayerIndex]]` (by lookup).
   */
  currentPlayerIndex: number;
  /** All players in the match. */
  players: Player[];
  /** Teams, if mode is 'team'. Empty array otherwise. */
  teams: Team[];
  /**
   * Indices into the `players` array defining the round-robin turn order.
   * For team mode this interleaves players from each team.
   */
  turnOrder: number[];

  // --- Ball Expectation ---
  /**
   * In the 'reds' phase: whether a 'red' or 'color' is expected next.
   * Undefined in other phases.
   */
  expectedBall: ExpectedBall | null;
  /**
   * In the 'colorsInOrder' phase: the specific color that must be potted next.
   * Undefined in other phases.
   */
  currentColorTarget: BallType | null;

  // --- Match / Frame Tracking ---
  /** Current frame number (1-indexed). */
  frameNumber: number;
  /** Best-of format (e.g. 5 means first to 3 frame wins). */
  bestOf: number;
  /**
   * Frame wins per player, keyed by player ID.
   * In team mode, keyed by team ID.
   */
  frameScores: Record<string, number>;

  // --- History ---
  /** Chronological log of actions taken in this frame. */
  actionLog: ActionLogEntry[];
  /**
   * Stack of previous states for undo.
   * Most recent state is at the end. Capped at MAX_UNDO_STACK entries.
   */
  undoStack: GameState[];

  // --- Timers ---
  /** ISO-8601 timestamp of when the match started. */
  matchStartTime: string;
  /** ISO-8601 timestamp of when the current frame started. */
  frameStartTime: string;
  /** Total elapsed match time in milliseconds (updated via UPDATE_TIMER). */
  matchTimerMs: number;
  /** Duration of the current frame in milliseconds. */
  currentFrameDurationMs: number;
  /** List of completed frames in this match. */
  completedFrames: CompletedFrame[];

  // --- Special States ---
  /**
   * When true, the next pot is treated as a free-ball:
   * - If a red is expected, the potted color scores 1 point.
   * - If a color is expected, the potted ball scores its own value.
   * The free ball is then re-spotted, and play continues as if the
   * expected ball was potted.
   */
  isFreeBall: boolean;

  // --- Result ---
  /**
   * ID of the winning player or team once the match is over.
   * Null while the match is in progress.
   */
  winner: string | null;
}

// ---------------------------------------------------------------------------
// Game Actions — Discriminated Union
// ---------------------------------------------------------------------------

/** Pot a ball during normal play. */
export interface PotBallAction {
  readonly type: 'POT_BALL';
  /** Which ball was potted. */
  ball: BallType;
}

/** Declare a foul (other than in-off). */
export interface FoulAction {
  readonly type: 'FOUL';
  /** The ball involved in the foul (determines penalty if > 4). */
  ballInvolved: BallType;
  customPenalty?: number;
  redPottedOnFoul?: boolean;
}

/**
 * Cue ball potted (in-off). Same penalty logic as FOUL,
 * but semantically distinct for logging.
 */
export interface InOffAction {
  readonly type: 'IN_OFF';
  /** The ball that was "on" or involved when the cue ball went in. */
  ballInvolved: BallType;
  customPenalty?: number;
  redPottedOnFoul?: boolean;
}

/** Player missed — no ball potted, turn passes. */
export interface MissAction {
  readonly type: 'MISS';
}

/** Undo the last action by popping the undo stack. */
export interface UndoAction {
  readonly type: 'UNDO';
}

/** Toggle free ball on/off. */
export interface FreeBallAction {
  readonly type: 'FREE_BALL';
}

/** Current player concedes the frame. */
export interface ConcedeFrameAction {
  readonly type: 'CONCEDE_FRAME';
}

/** End the current frame (all balls potted or manually triggered). */
export interface EndFrameAction {
  readonly type: 'END_FRAME';
}

/** Start the next frame in a best-of match. */
export interface StartNextFrameAction {
  readonly type: 'START_NEXT_FRAME';
}

/** Tick the match timer. */
export interface UpdateTimerAction {
  readonly type: 'UPDATE_TIMER';
}

/** Replace the entire state (for hydration / debugging). */
export interface SetStateAction {
  readonly type: 'SET_STATE';
  state: GameState;
}

/** Union of all possible game actions. */
export type GameAction =
  | PotBallAction
  | FoulAction
  | InOffAction
  | MissAction
  | UndoAction
  | FreeBallAction
  | ConcedeFrameAction
  | EndFrameAction
  | StartNextFrameAction
  | UpdateTimerAction
  | SetStateAction;

// ---------------------------------------------------------------------------
// Game Setup Configuration
// ---------------------------------------------------------------------------

export interface PlayerSetup {
  /** Display name for the player. */
  name: string;
}

export interface GameSetupConfig {
  /** Game mode selection. */
  mode: GameMode;
  /** Number of reds: 10 (short frame) or 15 (standard). */
  redsCount: 10 | 15;
  /** Best-of format (odd number, e.g. 1, 3, 5, 7…). */
  bestOf: number;
  /** Players in the match (2–8 depending on mode). */
  players: PlayerSetup[];
  /**
   * Team assignments for 'team' mode.
   * Maps team index (0 or 1) to an array of player indices.
   * E.g. { 0: [0, 2], 1: [1, 3] } for a 2v2.
   */
  teamAssignments?: Record<number, number[]>;
  /** Index into `players` for who breaks first (default 0). */
  breakingPlayerIndex?: number;
}
