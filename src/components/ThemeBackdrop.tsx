import { useSettings } from '../hooks/useSettings';
import type { Backdrop } from '../lib/settings';

/**
 * Faint background art behind the dashboard and other non-playing screens,
 * drawn in the chosen accent. Never on the scoring screens: nothing should
 * compete with the table.
 *
 * Pure SVG, painted once, no animation — it costs nothing on battery.
 */

const RACK_ROWS = [1, 2, 3, 4, 5];

function Rack({ r = 22 }: { r?: number }) {
  const step = r * 2 + 4;
  const balls: { x: number; y: number }[] = [];
  RACK_ROWS.forEach((count, row) => {
    for (let i = 0; i < count; i += 1) {
      balls.push({ x: row * step * 0.87, y: (i - (count - 1) / 2) * step });
    }
  });
  return (
    <g>
      {balls.map((b, i) => (
        <circle key={i} cx={b.x} cy={b.y} r={r} />
      ))}
    </g>
  );
}

function Art({ kind }: { kind: Backdrop }) {
  switch (kind) {
    case 'rack':
      return (
        <>
          <svg className="tb-corner tb-corner--tr" viewBox="-40 -150 300 300" aria-hidden="true">
            <g className="tb-fill"><Rack /></g>
          </svg>
          <svg className="tb-corner tb-corner--bl tb-small" viewBox="-40 -40 80 80" aria-hidden="true">
            <circle className="tb-ring" cx="0" cy="0" r="22" />
          </svg>
        </>
      );
    case 'baize':
      return (
        <svg className="tb-full" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <defs>
            <pattern id="tb-weave" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
              <line x1="0" y1="0" x2="0" y2="6" className="tb-weave" />
            </pattern>
          </defs>
          <rect width="1000" height="600" fill="url(#tb-weave)" />
          <line x1="230" y1="-10" x2="230" y2="610" className="tb-line" />
          <path d="M230 210 A90 90 0 0 0 230 390" className="tb-line" />
          <circle cx="230" cy="300" r="4" className="tb-dot" />
          <circle cx="840" cy="300" r="4" className="tb-dot" />
        </svg>
      );
    case 'breakoff':
      return (
        <svg className="tb-full" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <line x1="150" y1="470" x2="735" y2="185" className="tb-aim" />
          <circle cx="150" cy="470" r="24" className="tb-ring" />
          <g className="tb-fill" transform="translate(760 172) scale(0.8)"><Rack /></g>
        </svg>
      );
    case 'pocket':
      return (
        <>
          <svg className="tb-corner tb-corner--tl" viewBox="0 0 320 320" aria-hidden="true">
            <path d="M0 260 A260 260 0 0 1 260 0" className="tb-cushion" />
            <path d="M0 200 A200 200 0 0 1 200 0" className="tb-line" />
            <circle cx="34" cy="34" r="46" className="tb-pocket" />
          </svg>
          <svg className="tb-edge-dots" viewBox="0 0 1000 20" preserveAspectRatio="none" aria-hidden="true">
            {[125, 250, 375, 625, 750, 875].map((x) => (
              <circle key={x} cx={x} cy="10" r="4" className="tb-dot" />
            ))}
          </svg>
        </>
      );
    default:
      return null;
  }
}

export default function ThemeBackdrop({ kind }: { kind?: Backdrop }) {
  const { settings } = useSettings();
  const active = kind ?? settings.backdrop;
  if (active === 'plain') return null;
  return (
    <div className="theme-backdrop" data-kind={active}>
      <Art kind={active} />
    </div>
  );
}

export { Art as BackdropArt };
