/**
 * Icon — the app's single icon set.
 *
 * Replaces the ~45 emoji that were used as UI icons. Emoji render differently
 * on every platform, can't inherit colour, ignore the theme, and can't be
 * animated — so they never felt like part of the interface. These are inline
 * SVG on a 24px grid, stroked in `currentColor`, so they take the colour of
 * whatever they sit in and work in both themes for free.
 *
 * Icons are decorative by default (`aria-hidden`), so an icon-only button must
 * carry its own `aria-label`. Pass a `title` to make one meaningful on its own.
 */

import type { SVGProps } from 'react';

export type IconName =
  | 'share' | 'trophy' | 'ball' | 'clock' | 'close' | 'trash'
  | 'arrow-left' | 'arrow-right' | 'chevron-up' | 'chevron-down'
  | 'minus' | 'plus' | 'check' | 'alert' | 'save' | 'star'
  | 'flag' | 'exit' | 'users' | 'duo' | 'target' | 'rotate'
  | 'bee' | 'pass' | 'dot' | 'sun' | 'moon' | 'chart';

/** Stroked paths on a 24px grid. `dot` is the only filled glyph. */
const PATHS: Record<IconName, string[]> = {
  'share':        ['M12 15V3', 'm8 7 4-4 4 4', 'M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7'],
  'trophy':       ['M8 21h8', 'M12 17v4', 'M7 4h10v5a5 5 0 0 1-10 0V4z', 'M17 5.5h2a2 2 0 0 1 0 4h-2', 'M7 5.5H5a2 2 0 0 0 0 4h2'],
  'ball':         ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 0 0 0-6.4z'],
  'clock':        ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7.2V12l3.2 2'],
  'close':        ['M18 6 6 18', 'm6 6 12 12'],
  'trash':        ['M3.5 6h17', 'M8.5 6V4.2a1.2 1.2 0 0 1 1.2-1.2h4.6a1.2 1.2 0 0 1 1.2 1.2V6', 'M18.5 6l-.9 13.2a2 2 0 0 1-2 1.8H8.4a2 2 0 0 1-2-1.8L5.5 6', 'M10 11v6', 'M14 11v6'],
  'arrow-left':   ['M19 12H5', 'm12 19-7-7 7-7'],
  'arrow-right':  ['M5 12h14', 'm12 5 7 7-7 7'],
  'chevron-up':   ['m6 15 6-6 6 6'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'minus':        ['M5 12h14'],
  'plus':         ['M12 5v14', 'M5 12h14'],
  'check':        ['M20 6.5 9.2 17.3 4 12.1'],
  'alert':        ['M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z', 'M12 9.5v4.2', 'M12 17.3h.01'],
  'save':         ['M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z', 'M17 21v-8H7v8', 'M7 3v5h7'],
  'star':         ['m12 3.2 2.85 5.8 6.4.93-4.63 4.5 1.1 6.37L12 17.8l-5.72 3-1.1-6.37L.55 9.93l6.4-.93z'],
  'flag':         ['M4.5 15s1-.9 3.9-.9 4.9 1.9 7.8 1.9 3.9-.9 3.9-.9V4.3s-1 .9-3.9.9S11.3 3.3 8.4 3.3s-3.9.9-3.9.9z', 'M4.5 21.5v-6.6'],
  'exit':         ['M9.5 21H5.5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 16.5 4.5-4.5L16 7.5', 'M20.5 12H9.5'],
  'users':        ['M15.5 21v-1.8a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V21', 'M8.75 4a3.6 3.6 0 1 0 0 7.2 3.6 3.6 0 0 0 0-7.2z', 'M22 21v-1.8a4 4 0 0 0-3-3.86', 'M16.5 4.13a4 4 0 0 1 0 7.75'],
  'duo':          ['M6.5 5.4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M1.6 19.4v-.9a4 4 0 0 1 4-4h1.8', 'M17.5 5.4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z', 'M22.4 19.4v-.9a4 4 0 0 0-4-4h-1.8', 'M12 8v9'],
  'target':       ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7.2a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6z', 'M12 10.6a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z'],
  'rotate':       ['M8 3.5h8a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2z', 'M12 17.5h.01'],
  'bee':          ['M12 7.5c-2.8 0-4.9 2.7-4.9 6S9.2 20.5 12 20.5s4.9-2.7 4.9-7-2.1-6-4.9-6z', 'M7.4 12.4h9.2', 'M7.6 16.1h8.8', 'M9.6 7.2C7.6 4.6 4 4.4 3.4 6.6c-.5 2 2 3.7 4.6 3', 'M14.4 7.2c2-2.6 5.6-2.8 6.2-.6.5 2-2 3.7-4.6 3', 'M10.6 6 9.8 3.2', 'M13.4 6l.8-2.8'],
  'pass':         ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M8 12h8', 'm12.8 8.8 3.2 3.2-3.2 3.2'],
  'dot':          ['M12 5.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z'],
  'sun':          ['M12 7.6a4.4 4.4 0 1 0 0 8.8 4.4 4.4 0 0 0 0-8.8z', 'M12 1.8v2.4', 'M12 19.8v2.4', 'm4.8 4.8 1.7 1.7', 'm17.5 17.5 1.7 1.7', 'M1.8 12h2.4', 'M19.8 12h2.4', 'm4.8 19.2 1.7-1.7', 'm17.5 6.5 1.7-1.7'],
  'moon':         ['M20.5 14.3A8.7 8.7 0 0 1 9.7 3.5a8.7 8.7 0 1 0 10.8 10.8z'],
  'chart':        ['M3.5 20.5h17', 'M7 20.5v-6.8', 'M12 20.5V7.2', 'M17 20.5v-9.6'],
};

/** Glyphs drawn as fills rather than strokes. */
const FILLED = new Set<IconName>(['dot', 'star']);

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
  name: IconName;
  /** Pixel size; also the stroke reference. Defaults to 1em so it tracks font-size. */
  size?: number | string;
  /** Accessible name. Omit for decorative icons (the default). */
  title?: string;
}

export function Icon({ name, size = '1em', title, className, ...rest }: IconProps) {
  const paths = PATHS[name];
  const filled = FILLED.has(name);

  return (
    <svg
      className={['sb-icon', className].filter(Boolean).join(' ')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      {paths.map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
