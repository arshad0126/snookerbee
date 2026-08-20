/**
 * shareCard — the SnookerBee share-card design.
 *
 * One renderer, three cards (match summary, frame breakdown). The three
 * share handlers used to carry ~80 lines of near-identical canvas drawing
 * each; the layout now lives here so the design has a single source.
 *
 * Design: Icy Blue on Gunmetal. Editorial and left-aligned rather than
 * centred, hairline rules instead of boxes, tabular figures so the number
 * columns line up, and a lot of deliberate whitespace.
 */

/** Card palette. Canvas can't read CSS variables, so it lives here. */
export const CARD = {
  bg:       '#35393C',                      /* Gunmetal */
  ink:      '#EEF3F7',
  inkSoft:  'rgba(238, 243, 247, 0.62)',
  inkFaint: 'rgba(238, 243, 247, 0.38)',
  accent:   '#A4D8FF',                      /* Icy Blue — 7.7:1 on Gunmetal */
  rule:     'rgba(238, 243, 247, 0.14)',
  ruleFaint:'rgba(238, 243, 247, 0.07)',
} as const;

/* Logical coordinate space; rendered at 2x for Retina. */
const W = 800;
const H = 600;
const M = 64;          // left margin
const R = W - M;       // right content edge

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

export interface MatchCardPlayer {
  name: string;
  teamName?: string;
  score: number;
  framesWon: number;
  highestBreak: number;
  fouls: number;
  isWinner: boolean;
}

export interface MatchCardData {
  winnerName: string;
  mode: string;
  bestOf: number;
  dateLabel: string;
  durationLabel: string;
  redsCount: number;
  players: MatchCardPlayer[];
}

export interface FrameCardRow {
  label: string;
  values: number[];
  /** Leader in this stat is tinted; false for stats where low is good. */
  higherIsBetter: boolean;
}

export interface FrameCardData {
  frameNumber: number;
  mode: string;
  dateLabel: string;
  durationLabel: string;
  playerNames: string[];
  rows: FrameCardRow[];
}

/* ---------------------------------------------------------------- helpers */

function prepare(canvas: HTMLCanvasElement): CanvasRenderingContext2D | null {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // Setting width/height also clears the surface and resets ctx state.
  canvas.width = W * 2;
  canvas.height = H * 2;
  ctx.setTransform(2, 0, 0, 2, 0, 0);
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = CARD.bg;
  ctx.fillRect(0, 0, W, H);
  return ctx;
}

/** Width of `text` once per-character tracking is added. */
function trackedWidth(ctx: CanvasRenderingContext2D, text: string, spacing: number): number {
  return ctx.measureText(text).width + spacing * Math.max(0, text.length - 1);
}

/** Letter-spaced text. ctx.letterSpacing isn't universal yet, so draw per glyph. */
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number
): void {
  ctx.textAlign = 'left';
  let cx = x;
  for (const ch of text) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
}

/** Shrink the font until `text` fits, down to a floor. Leaves ctx.font set. */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  minPx: number
): void {
  let size = startPx;
  ctx.font = `700 ${size}px ${SANS}`;
  while (size > minPx && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = `700 ${size}px ${SANS}`;
  }
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t}…`;
}

/** Hairlines via fillRect — always crisp at 2x, unlike a stroked path. */
function rule(ctx: CanvasRenderingContext2D, y: number, color: string): void {
  ctx.fillStyle = color;
  ctx.fillRect(M, y, R - M, 1);
}

function drawHeader(ctx: CanvasRenderingContext2D, rightLabel: string): void {
  ctx.fillStyle = CARD.accent;
  ctx.fillRect(M, 56, 9, 9);

  ctx.fillStyle = CARD.ink;
  ctx.font = `600 13px ${SANS}`;
  drawTracked(ctx, 'SNOOKERBEE', M + 21, 65, 2.4);

  ctx.fillStyle = CARD.inkSoft;
  ctx.font = `500 12px ${SANS}`;
  drawTracked(ctx, rightLabel, R - trackedWidth(ctx, rightLabel, 1.6), 65, 1.6);
}

/** Small tinted label above a hero line. */
function drawEyebrow(ctx: CanvasRenderingContext2D, text: string, y: number): void {
  ctx.fillStyle = CARD.accent;
  ctx.font = `700 11px ${SANS}`;
  drawTracked(ctx, text, M, y, 3.2);
}

function drawHero(ctx: CanvasRenderingContext2D, text: string): void {
  fitFont(ctx, text, R - M, 54, 28);
  ctx.fillStyle = CARD.ink;
  ctx.textAlign = 'left';
  ctx.fillText(ellipsize(ctx, text, R - M), M, 190);

  ctx.fillStyle = CARD.accent;
  ctx.fillRect(M, 208, 72, 3);
}

function drawFooter(ctx: CanvasRenderingContext2D, left: string, right: string): void {
  rule(ctx, 528, CARD.rule);
  ctx.fillStyle = CARD.inkSoft;
  ctx.font = `500 13px ${SANS}`;
  ctx.textAlign = 'left';
  ctx.fillText(left, M, 556);
  ctx.textAlign = 'right';
  ctx.fillText(right, R, 556);
}

/**
 * Row geometry. Rows grow to fill the body band so a two-player card doesn't
 * leave a dead area above the footer, and shrink so six still fit.
 */
function rowMetrics(count: number): { step: number; fontPx: number; top: number } {
  const bandTop = 284;
  const bandBottom = 514;
  const n = Math.max(1, count);
  const step = Math.min(88, (bandBottom - bandTop) / n);
  const fontPx = step >= 68 ? 22 : step >= 42 ? 19 : step >= 34 ? 17 : 15;
  const top = bandTop + Math.max(0, (bandBottom - bandTop - step * n) / 2);
  return { step, fontPx, top };
}

/* ------------------------------------------------------------------ cards */

export function drawMatchCard(canvas: HTMLCanvasElement, d: MatchCardData): void {
  const ctx = prepare(canvas);
  if (!ctx) return;

  drawHeader(ctx, `${d.mode.toUpperCase()} · BEST OF ${d.bestOf}`);
  drawEyebrow(ctx, 'WINNER', 138);
  drawHero(ctx, d.winnerName);

  const cols = [448, 544, 640, R];
  const heads = ['SCORE', 'FRAMES', 'BREAK', 'FOULS'];

  ctx.fillStyle = CARD.inkFaint;
  ctx.font = `600 10px ${SANS}`;
  drawTracked(ctx, 'PLAYER', M, 272, 2.4);
  heads.forEach((h, i) => {
    drawTracked(ctx, h, cols[i] - trackedWidth(ctx, h, 2.4), 272, 2.4);
  });
  rule(ctx, 284, CARD.rule);

  const { step, fontPx, top } = rowMetrics(d.players.length);
  const nameMax = 400 - M;

  d.players.forEach((p, i) => {
    const y = top + step * i + step / 2 + fontPx * 0.34;
    const tint = p.isWinner ? CARD.accent : CARD.ink;

    ctx.textAlign = 'left';
    ctx.fillStyle = tint;
    ctx.font = `${p.isWinner ? 700 : 500} ${fontPx}px ${SANS}`;
    const name = ellipsize(ctx, p.name, nameMax);
    ctx.fillText(name, M, y);

    if (p.teamName) {
      const nameW = ctx.measureText(name).width;
      ctx.fillStyle = CARD.inkFaint;
      ctx.font = `600 11px ${SANS}`;
      drawTracked(ctx, p.teamName.toUpperCase(), M + nameW + 12, y, 1.4);
    }

    ctx.textAlign = 'right';
    ctx.fillStyle = tint;
    ctx.font = `${p.isWinner ? 600 : 400} ${fontPx}px ${MONO}`;
    [p.score, p.framesWon, p.highestBreak, p.fouls].forEach((v, c) => {
      ctx.fillText(String(v), cols[c], y);
    });

    if (i < d.players.length - 1) rule(ctx, top + step * (i + 1), CARD.ruleFaint);
  });

  drawFooter(ctx, `${d.durationLabel}  ·  ${d.redsCount} reds`, d.dateLabel);
}

export function drawFrameCard(canvas: HTMLCanvasElement, d: FrameCardData): void {
  const ctx = prepare(canvas);
  if (!ctx) return;

  drawHeader(ctx, `${d.mode.toUpperCase()} · FRAME ${d.frameNumber}`);
  drawEyebrow(ctx, 'FRAME BREAKDOWN', 138);
  drawHero(ctx, `Frame ${d.frameNumber}`);

  // Spread one right-aligned column per player across the right-hand band.
  const first = 430;
  const n = d.playerNames.length;
  const cols =
    n <= 1
      ? [R]
      : Array.from({ length: n }, (_, i) => first + ((R - first) * i) / (n - 1));

  ctx.fillStyle = CARD.inkFaint;
  ctx.font = `600 10px ${SANS}`;
  drawTracked(ctx, 'STATISTIC', M, 272, 2.4);
  d.playerNames.forEach((name, i) => {
    const label = ellipsize(ctx, name.toUpperCase(), 96);
    drawTracked(ctx, label, cols[i] - trackedWidth(ctx, label, 2.4), 272, 2.4);
  });
  rule(ctx, 284, CARD.rule);

  const { step, fontPx, top } = rowMetrics(d.rows.length);

  d.rows.forEach((row, i) => {
    const y = top + step * i + step / 2 + fontPx * 0.34;

    ctx.textAlign = 'left';
    ctx.fillStyle = CARD.ink;
    ctx.font = `500 ${fontPx}px ${SANS}`;
    ctx.fillText(row.label, M, y);

    // Tint the leader, but only when the row has a clear single winner.
    const best = row.higherIsBetter ? Math.max(...row.values) : Math.min(...row.values);
    const unique = row.values.filter((v) => v === best).length === 1;

    ctx.textAlign = 'right';
    row.values.forEach((v, c) => {
      const lead = unique && v === best;
      ctx.fillStyle = lead ? CARD.accent : CARD.ink;
      ctx.font = `${lead ? 600 : 400} ${fontPx}px ${MONO}`;
      ctx.fillText(String(v), cols[c], y);
    });

    if (i < d.rows.length - 1) rule(ctx, top + step * (i + 1), CARD.ruleFaint);
  });

  drawFooter(ctx, `Frame duration  ·  ${d.durationLabel}`, d.dateLabel);
}
