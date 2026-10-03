import { useEffect, useRef, useState, type PointerEvent } from 'react';
import type { ProgressPoint } from '../lib/frameAnalysis';

/**
 * How a frame went: each side's running total, one step per scoring shot.
 *
 * Step lines (points arrive in jumps, never in between), one y-axis, a
 * recessive grid, end labels on each line when there are four sides or
 * fewer, and a legend above. Hovering or dragging shows a crosshair with
 * what happened on that shot and the score at that moment.
 *
 * Series colours come from --mp-s1…--mp-s8 (validated categorical steps for
 * the dark and light surfaces) and follow the side, never its rank.
 */

interface Props {
  points: ProgressPoint[];
  sides: string[];
}

const PAD = { top: 12, right: 12, bottom: 26, left: 34 };
const LABEL_W = 92;

function niceMax(v: number): number {
  if (v <= 10) return 10;
  const step = v <= 40 ? 10 : v <= 100 ? 20 : 50;
  return Math.ceil(v / step) * step;
}

export default function FrameChart({ points, sides }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(560);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(260, entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const height = 220;
  const endLabels = sides.length <= 4;
  const right = PAD.right + (endLabels ? LABEL_W : 0);
  const plotW = width - PAD.left - right;
  const plotH = height - PAD.top - PAD.bottom;
  const steps = Math.max(1, points.length - 1);
  const top = niceMax(Math.max(1, ...points.flatMap((p) => sides.map((s) => p.totals[s] ?? 0))));
  const x = (step: number) => PAD.left + (step / steps) * plotW;
  const y = (v: number) => PAD.top + plotH - (v / top) * plotH;
  const ticks = [0, top / 2, top];

  const path = (side: string) =>
    points.reduce((d, p, i) => {
      const v = y(p.totals[side] ?? 0);
      if (i === 0) return `M${x(0)} ${v}`;
      return `${d} H${x(p.step)} V${v}`;
    }, '');

  // End labels, nudged apart so they never overlap.
  const last = points[points.length - 1];
  const labels = sides
    .map((side, i) => ({ side, i, value: last?.totals[side] ?? 0, y: y(last?.totals[side] ?? 0) }))
    .sort((a, b) => a.y - b.y);
  for (let k = 1; k < labels.length; k += 1) {
    if (labels[k].y - labels[k - 1].y < 14) labels[k].y = labels[k - 1].y + 14;
  }

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    const step = Math.round(((px - PAD.left) / plotW) * steps);
    setHover(Math.min(points.length - 1, Math.max(0, step)));
  };

  const h = hover !== null ? points[hover] : null;
  // Beside the crosshair, on whichever side has room, so it never hides the lines it describes.
  const tipOnRight = h ? x(h.step) < width / 2 : true;
  const tipStyle = h
    ? tipOnRight
      ? { left: x(h.step) + 12 }
      : { left: x(h.step) - 12, transform: 'translateX(-100%)' }
    : {};

  return (
    <div className="mp-chart" ref={wrapRef}>
      {sides.length > 1 && (
        <div className="mp-legend" aria-hidden="true">
          {sides.map((s, i) => (
            <span key={s}><i style={{ background: `var(--mp-s${(i % 8) + 1})` }} />{s}</span>
          ))}
        </div>
      )}
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Points through the frame: ${sides.map((s) => `${s} ${last?.totals[s] ?? 0}`).join(', ')}`}
        onPointerMove={onMove}
        onPointerDown={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line className="mp-grid" x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} />
            <text className="mp-tick" x={PAD.left - 8} y={y(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        <text className="mp-tick" x={PAD.left} y={height - 6}>Start</text>
        <text className="mp-tick" x={PAD.left + plotW} y={height - 6} textAnchor="end">{steps} scoring shots</text>

        {sides.map((s, i) => (
          <path key={s} d={path(s)} className="mp-line" style={{ stroke: `var(--mp-s${(i % 8) + 1})` }} />
        ))}

        {endLabels && labels.map((l) => (
          <text key={l.side} className="mp-endlabel" x={PAD.left + plotW + 8} y={l.y + 4}>
            <tspan className="mp-endlabel-v">{l.value}</tspan> {l.side.length > 9 ? `${l.side.slice(0, 8)}…` : l.side}
          </text>
        ))}

        {h && (
          <g>
            <line className="mp-cross" x1={x(h.step)} x2={x(h.step)} y1={PAD.top} y2={PAD.top + plotH} />
            {sides.map((s, i) => (
              <circle
                key={s}
                cx={x(h.step)}
                cy={y(h.totals[s] ?? 0)}
                r={4.5}
                className="mp-dot"
                style={{ fill: `var(--mp-s${(i % 8) + 1})` }}
              />
            ))}
          </g>
        )}
        {/* Full-height hit area, wider than any mark. */}
        <rect x={PAD.left} y={0} width={plotW} height={height} fill="transparent" />
      </svg>

      {h && (
        <div className="mp-tip" style={tipStyle} role="status">
          <b>{h.step === 0 ? 'Start' : `Shot ${h.step}`}</b>
          <span className="mp-tip-what">{h.label}</span>
          {[...sides]
            .map((s, i) => ({ s, i, v: h.totals[s] ?? 0 }))
            .sort((a, b) => b.v - a.v)
            .map(({ s, i, v }) => (
              <span key={s} className="mp-tip-row">
                <i style={{ background: `var(--mp-s${(i % 8) + 1})` }} />{s}<b>{v}</b>
              </span>
            ))}
        </div>
      )}
    </div>
  );
}
