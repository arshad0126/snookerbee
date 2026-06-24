// ============================================================================
// constants.ts — Game constants and utility values
// ============================================================================

import type { BallType } from './types';

// ---------------------------------------------------------------------------
// Ball Point Values (official snooker scoring)
// ---------------------------------------------------------------------------

/** Point value for each ball type. */
export const BALL_VALUES: Readonly<Record<BallType, number>> = {
  red: 1,
  yellow: 2,
  green: 3,
  brown: 4,
  blue: 5,
  pink: 6,
  black: 7,
} as const;

// ---------------------------------------------------------------------------
// Color Potting Order (after all reds are cleared)
// ---------------------------------------------------------------------------

/**
 * The fixed order in which colors must be potted once all reds (and the
 * subsequent final color) have been cleared. Ascending by value.
 */
export const COLORS_IN_ORDER: readonly BallType[] = [
  'yellow', // 2
  'green',  // 3
  'brown',  // 4
  'blue',   // 5
  'pink',   // 6
  'black',  // 7
] as const;

// ---------------------------------------------------------------------------
// Foul Constants
// ---------------------------------------------------------------------------

/**
 * Minimum foul penalty in snooker.
 * The actual penalty is max(FOUL_MINIMUM, ball-on value, ball-involved value).
 */
export const FOUL_MINIMUM = 4;

// ---------------------------------------------------------------------------
// Undo Stack
// ---------------------------------------------------------------------------

/** Maximum number of states retained in the undo stack. */
export const MAX_UNDO_STACK = 10;

// ---------------------------------------------------------------------------
// Ball CSS Colors (for UI rendering)
// ---------------------------------------------------------------------------

/**
 * CSS color strings for rendering each ball type.
 * These follow the standard snooker ball colors.
 */
export const BALL_COLORS: Readonly<Record<BallType, string>> = {
  red: '#D32F2F',     // deep red
  yellow: '#FDD835',  // bright yellow
  green: '#388E3C',   // forest green
  brown: '#6D4C41',   // rich brown
  blue: '#1976D2',    // royal blue
  pink: '#F06292',    // soft pink
  black: '#212121',   // near-black
} as const;

// ---------------------------------------------------------------------------
// Max Break Calculator
// ---------------------------------------------------------------------------

/**
 * Calculate the maximum possible break for a given number of reds.
 *
 * Formula: (reds × 8) + 27
 *
 * Explanation:
 * - Each red (1 pt) can be followed by a black (7 pt) = 8 pts per red.
 * - After all reds are cleared, the six colors are potted in order:
 *   yellow(2) + green(3) + brown(4) + blue(5) + pink(6) + black(7) = 27.
 *
 * @param redsCount — Number of reds in the frame (10 or 15).
 * @returns The maximum possible break score.
 *
 * @example
 * maxBreak(15) // => 147 (the famous maximum)
 * maxBreak(10) // => 107
 */
export function maxBreak(redsCount: number): number {
  return redsCount * 8 + 27;
}
