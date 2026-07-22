// ============================================================================
// tokens.ts — TypeScript mirror of the design tokens in tokens.css.
// For JS/TS consumers that can't read CSS custom properties directly
// (canvas rendering, share-card generation, deterministic avatar tints).
// Keep values in sync with tokens.css.
// ============================================================================

export type BallColor =
  | 'red' | 'yellow' | 'green' | 'brown' | 'blue' | 'pink' | 'black';

/** Point value of each ball (reused from the engine domain). */
export const BALL_POINTS: Record<BallColor, number> = {
  red: 1,
  yellow: 2,
  green: 3,
  brown: 4,
  blue: 5,
  pink: 6,
  black: 7,
};

/** Ball fill colours — light mode. Dark values live in CSS via media query. */
export const BALL_FILL: Record<BallColor, string> = {
  red: '#D6252B',
  yellow: '#F5B301',
  green: '#1E8E4E',
  brown: '#8A5A2B',
  blue: '#0B63C5',
  pink: '#E8628C',
  black: '#1A1A1A',
};

/** Contrast-safe label colour to place on top of each ball. */
export const BALL_LABEL: Record<BallColor, string> = {
  red: '#FFFFFF',
  yellow: '#1A1A1A',
  green: '#FFFFFF',
  brown: '#FFFFFF',
  blue: '#FFFFFF',
  pink: '#1A1A1A',
  black: '#FFFFFF',
};

export const SPACE = {
  1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32, 7: 40, 8: 48, 9: 64,
} as const;

export const RADIUS = {
  sm: 8, md: 12, lg: 16, xl: 20, '2xl': 28, pill: 999,
} as const;

export const DURATION = {
  fast: 150, base: 250, slow: 400,
} as const;

/**
 * Read a CSS custom property from the document root at runtime.
 * Prefer this when a component needs the *theme-resolved* value
 * (e.g. reads the dark-mode ball colour). Returns '' during SSR.
 */
export function cssVar(name: string): string {
  if (typeof window === 'undefined') return '';
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Deterministic neutral tint for an avatar, derived from a stable id/seed. */
export function avatarTint(seed: string): { bg: string; fg: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  // Low-saturation, high-lightness so it stays calm and on-brand.
  return {
    bg: `hsl(${hue} 32% 90%)`,
    fg: `hsl(${hue} 45% 32%)`,
  };
}
