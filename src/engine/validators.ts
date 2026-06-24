// ============================================================================
// validators.ts — Snooker rule validation functions
// ============================================================================

import type { BallType, GameState } from './types';
import { BALL_VALUES, COLORS_IN_ORDER, FOUL_MINIMUM } from './constants';

// ---------------------------------------------------------------------------
// Legal Pot Validation
// ---------------------------------------------------------------------------

/**
 * Determines whether potting `ball` is legal given the current game state.
 *
 * Rules by phase:
 * - **reds**: If expectedBall is 'red', only a red is legal.
 *             If expectedBall is 'color', any color (not red) is legal.
 * - **finalColor**: Any color (not red) is legal — this is the one color
 *                   allowed after the last red was potted.
 * - **colorsInOrder**: Only the specific `currentColorTarget` is legal.
 * - **respottedBlack**: Only black is legal.
 * - **finished**: Nothing is legal.
 *
 * Free ball: When isFreeBall is true, any ball is legal regardless of the
 * above rules (the referee has nominated it as a free ball).
 */
export function isLegalPot(state: GameState, ball: BallType): boolean {
  // Free ball overrides normal rules — any ball may be potted
  if (state.isFreeBall) {
    return true;
  }

  switch (state.phase) {
    case 'reds': {
      if (state.expectedBall === 'red') {
        return ball === 'red';
      }
      // expectedBall === 'color': any non-red ball is legal
      return ball !== 'red';
    }

    case 'finalColor': {
      // After the last red, one color may be potted (any color)
      return ball !== 'red';
    }

    case 'colorsInOrder': {
      // Only the specific color target is legal
      return ball === state.currentColorTarget;
    }

    case 'respottedBlack': {
      // Only black can be potted (or fouled) to decide the frame
      return ball === 'black';
    }

    case 'finished':
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Foul Penalty Calculation
// ---------------------------------------------------------------------------

/**
 * Calculates the foul penalty points.
 *
 * Per World Snooker rules, the penalty is the highest of:
 * 1. The minimum foul value (4 points)
 * 2. The value of the ball "on" (the ball the player should have hit)
 * 3. The value of the ball actually involved in the foul
 *
 * @param state — Current game state (used to determine ball on).
 * @param ballInvolved — The ball that caused or was involved in the foul.
 * @returns The foul penalty in points.
 */
export function calculateFoulPenalty(
  state: GameState,
  ballInvolved: BallType,
): number {
  const ballInvolvedValue = BALL_VALUES[ballInvolved];
  const ballOnValue = getBallOnValue(state);

  return Math.max(FOUL_MINIMUM, ballOnValue, ballInvolvedValue);
}

/**
 * Gets the point value of the "ball on" — i.e. the ball the player
 * is supposed to pot in the current state.
 */
function getBallOnValue(state: GameState): number {
  switch (state.phase) {
    case 'reds': {
      if (state.expectedBall === 'red') {
        return BALL_VALUES.red; // 1, but foul min is 4 anyway
      }
      // When a color is expected, there is no single "ball on" color;
      // the foul minimum of 4 applies unless the ball involved is higher.
      return FOUL_MINIMUM;
    }

    case 'finalColor': {
      // Any color is valid; ball-on value defaults to foul minimum
      return FOUL_MINIMUM;
    }

    case 'colorsInOrder': {
      // The specific color target is the ball on
      return state.currentColorTarget
        ? BALL_VALUES[state.currentColorTarget]
        : FOUL_MINIMUM;
    }

    case 'respottedBlack': {
      return BALL_VALUES.black; // 7
    }

    case 'finished':
    default:
      return FOUL_MINIMUM;
  }
}

// ---------------------------------------------------------------------------
// Points Remaining Calculation
// ---------------------------------------------------------------------------

/**
 * Calculates the total remaining points available on the table.
 *
 * This is used for:
 * - Determining whether a player can still catch up (snookers required)
 * - UI display of "points remaining"
 *
 * Calculation:
 * - Each remaining red can be followed by black (max color) = 8 pts per red
 * - Plus the colors remaining in order (depends on phase)
 */
export function getPointsRemaining(state: GameState): number {
  switch (state.phase) {
    case 'reds': {
      // Each red (1) + potential black (7) = 8 per red
      const redPoints = state.redsRemaining * 8;

      // If a color is expected (just potted a red), add max color value (7)
      // because the player still gets to pot a color this turn
      const pendingColor = state.expectedBall === 'color' ? 7 : 0;

      // Plus all six colors at the end: 2+3+4+5+6+7 = 27
      const endColors = 27;

      return redPoints + pendingColor + endColors;
    }

    case 'finalColor': {
      // One color (up to 7) + remaining colors in order (27)
      // The final color choice is free, so max is black (7) + 27 = 34
      // But more precisely, the remaining colors are all 6 colors.
      // After this color (which will be re-spotted), we go to colorsInOrder.
      // Actually the finalColor is the last re-spotted color. After it,
      // all 6 colors (27 pts) are potted in order.
      return 7 + 27; // max color + all colors in order
    }

    case 'colorsInOrder': {
      // Sum the values of remaining colors from currentColorTarget onward
      if (!state.currentColorTarget) return 0;
      const targetIndex = COLORS_IN_ORDER.indexOf(state.currentColorTarget);
      if (targetIndex === -1) return 0;

      let total = 0;
      for (let i = targetIndex; i < COLORS_IN_ORDER.length; i++) {
        total += BALL_VALUES[COLORS_IN_ORDER[i]];
      }
      return total;
    }

    case 'respottedBlack': {
      return BALL_VALUES.black; // 7
    }

    case 'finished':
    default:
      return 0;
  }
}

// ---------------------------------------------------------------------------
// Frame & Match End Conditions
// ---------------------------------------------------------------------------

/**
 * Checks if the current frame is over.
 *
 * A frame ends when:
 * 1. The phase is 'finished'.
 * 2. In 'colorsInOrder' with no more colors to pot (all potted).
 * 3. Only one ball remains in 'respottedBlack' and it's been potted/fouled.
 */
export function isFrameOver(state: GameState): boolean {
  return state.phase === 'finished';
}

/**
 * Checks if the match is over based on frame wins vs best-of format.
 *
 * @param state — Current game state.
 * @returns true if any player/team has won enough frames.
 */
export function isMatchOver(state: GameState): boolean {
  const framesToWin = Math.ceil(state.bestOf / 2);

  // Check each entity's frame wins
  for (const entityId of Object.keys(state.frameScores)) {
    if (state.frameScores[entityId] >= framesToWin) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Next Color in Order
// ---------------------------------------------------------------------------

/**
 * Returns the next color to be potted in the 'colorsInOrder' phase.
 *
 * If the current target is already the last color (black) or is not set,
 * returns null — indicating there are no more colors.
 *
 * @param state — Current game state.
 * @returns The next BallType in the ascending color sequence, or null.
 */
export function getNextColorInOrder(state: GameState): BallType | null {
  if (!state.currentColorTarget) {
    // Starting the colors phase — first color is yellow
    return COLORS_IN_ORDER[0]; // 'yellow'
  }

  const currentIndex = COLORS_IN_ORDER.indexOf(state.currentColorTarget);

  if (currentIndex === -1 || currentIndex >= COLORS_IN_ORDER.length - 1) {
    // Current target is black (last) or invalid — no more colors
    return null;
  }

  return COLORS_IN_ORDER[currentIndex + 1];
}
