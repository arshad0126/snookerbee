/**
 * shareCard — the SnookerBee share cards (2.2, "option A").
 *
 * One quiet layout for every card: the result as a big headline, one line
 * per player (frames as dots, then points), one standout line, and a footer.
 * Optional stats strip for people who want the detail.
 *
 * Every card comes in the app's two looks (light / dark, in the player's
 * accent colour) and two shapes (wide 4:3, and a tall 9:16 story).
 * Canvas can't read CSS variables, so the palettes live here and mirror
 * index.css / accents.css.
 */

/* ------------------------------------------------------------------ style */

export type CardTheme = 'light' | 'dark';
export type CardShape = 'wide' | 'story';

export interface CardStyle {
  theme: CardTheme;
  shape: CardShape;
  /** Add the small stats strip under the players. */
  stats: boolean;
  /** Accent id from settings (blue, green, claret…). */
  accent: string;
}

/** Accent colours per look — keep in step with accents.css. */
const ACCENTS: Record<string, { dark: string; light: string }> = {
  blue:   { dark: '#A4D8FF', light: '#2F6E9E' },
  green:  { dark: '#93D9AE', light: '#2E7550' },
  claret: { dark: '#F2A6B4', light: '#9E2F45' },
  gold:   { dark: '#F2CF78', light: '#86620F' },
  pink:   { dark: '#F6A9C9', light: '#AD3A6C' },
  slate:  { dark: '#C3CDD8', light: '#4A5868' },
  clay:   { dark: '#EDB792', light: '#975430' },
};

interface Palette {
  bg: string; ink: string; soft: string; faint: string; rule: string; acc: string; art: number;
}

function palette(style: CardStyle): Palette {
  const acc = (ACCENTS[style.accent] ?? ACCENTS.blue)[style.theme];
  return style.theme === 'dark'
    ? { bg: '#272727', ink: '#F1F5F8', soft: '#A7B1B9', faint: 'rgba(241,245,248,0.36)', rule: 'rgba(241,245,248,0.12)', acc, art: 0.1 }
    : { bg: '#FFFFFF', ink: '#1A1D23', soft: '#4B5563', faint: 'rgba(26,29,35,0.40)', rule: 'rgba(15,23,42,0.10)', acc, art: 0.07 };
}

/** The look the app is in right now, for the share screen's defaults. */
export function currentCardLook(): { theme: CardTheme; accent: string } {
  const body = typeof document !== 'undefined' ? document.body : null;
  return {
    theme: body?.classList.contains('light-theme') ? 'light' : 'dark',
    accent: body?.dataset.accent || 'blue',
  };
}

/* ------------------------------------------------------------------- data */

export interface MatchCardPlayer {
  name: string;
  teamName?: string;
  score: number;
  framesWon: number;
  highestBreak: number;
  fouls: number;
}

export interface MatchCardData {
  /** Null for a draw. A player or team name. */
  winnerName: string | null;
  mode: string;
  bestOf: number;
  dateLabel: string;
  durationLabel: string;
  players: MatchCardPlayer[];
}

export interface FrameCardPlayer {
  name: string;
  teamName?: string;
  /** Points this frame (for teams, the player's own share). */
  score: number;
  reds: number;
  colours: number;
  highestBreak: number;
  fouls: number;
}

export interface FrameCardData {
  frameNumber: number;
  /** Null when the frame wasn't finished or was level. */
  winnerName: string | null;
  mode: string;
  dateLabel: string;
  durationLabel: string;
  /** Frame points per side (player, or team), any order. */
  sides: { name: string; score: number }[];
  players: FrameCardPlayer[];
}

export interface CenturyCardPlayer {
  name: string;
  score: number;
  /** Finishing position; null for the player left short. */
  finishedAt: number | null;
  potted: number;
  redsPotted: number;
  fouls: number;
}

export interface CenturyCardData {
  target: number;
  redValue: number;
  dateLabel: string;
  durationLabel: string;
  /** In finishing order, the player left short last. */
  players: CenturyCardPlayer[];
}

export type CardSpec =
  | { kind: 'match'; data: MatchCardData }
  | { kind: 'frame'; data: FrameCardData }
  | { kind: 'century'; data: CenturyCardData };

const MODE: Record<string, string> = { '1v1': '1 v 1', freeForAll: 'Free for all', team: 'Teams', century: 'Century' };
const modeName = (m: string) => MODE[m] ?? m;

/* --------------------------------------------------------------- geometry */

const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const SITE = 'snookerbee.vercel.app';

interface Geo {
  W: number; H: number; M: number;
  headerY: number; eyebrowY: number; heroY: number; heroPx: number; hero2Y: number | null;
  listTop: number; rowStep: number; rowPx: number; standoutY: number; ruleY: number; footY: number;
}

function geo(shape: CardShape): Geo {
  return shape === 'wide'
    ? { W: 800, H: 600, M: 64, headerY: 66, eyebrowY: 146, heroY: 204, heroPx: 62, hero2Y: null,
        listTop: 236, rowStep: 46, rowPx: 26, standoutY: 520, ruleY: 540, footY: 568 }
    : { W: 540, H: 960, M: 52, headerY: 86, eyebrowY: 238, heroY: 316, heroPx: 74, hero2Y: 396,
        listTop: 450, rowStep: 62, rowPx: 30, standoutY: 836, ruleY: 862, footY: 896 };
}

/* ---------------------------------------------------------------- drawing */

type Run = { text: string; color: string };

class Painter {
  readonly ctx: CanvasRenderingContext2D;
  readonly g: Geo;
  readonly p: Palette;

  constructor(canvas: HTMLCanvasElement, style: CardStyle) {
    this.g = geo(style.shape);
    this.p = palette(style);
    canvas.width = this.g.W * 2;
    canvas.height = this.g.H * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    this.ctx = ctx;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = this.p.bg;
    ctx.fillRect(0, 0, this.g.W, this.g.H);
    this.art();
  }

  font(weight: number, px: number) { this.ctx.font = `${weight} ${px}px ${SANS}`; }

  /** The rack backdrop, faint, in the accent — the same art as the app. */
  private art() {
    const { ctx, g, p } = this;
    const r = g.W > 600 ? 24 : 26;
    const step = r * 2 + 4;
    const ox = g.W - (g.W > 600 ? 150 : 120);
    const oy = g.W > 600 ? 40 : 70;
    ctx.save();
    ctx.globalAlpha = p.art;
    ctx.fillStyle = p.acc;
    [1, 2, 3, 4, 5].forEach((count, row) => {
      for (let i = 0; i < count; i += 1) {
        ctx.beginPath();
        ctx.arc(ox + row * step * 0.87, oy + (i - (count - 1) / 2) * step, r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    ctx.restore();
  }

  tracked(text: string, x: number, y: number, spacing: number) {
    let cx = x;
    for (const ch of text) { this.ctx.fillText(ch, cx, y); cx += this.ctx.measureText(ch).width + spacing; }
  }

  ellipsize(text: string, max: number): string {
    if (this.ctx.measureText(text).width <= max) return text;
    let t = text;
    while (t.length > 1 && this.ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
    return `${t}…`;
  }

  header(context: string) {
    const { ctx, g, p } = this;
    ctx.fillStyle = p.acc;
    ctx.beginPath(); ctx.roundRect(g.M, g.headerY - 11, 11, 11, 3); ctx.fill();
    ctx.fillStyle = p.ink;
    this.font(700, 13); ctx.textAlign = 'left';
    this.tracked('SNOOKERBEE', g.M + 22, g.headerY, 2.8);
    if (g.W > 600 && context) {
      ctx.fillStyle = p.soft; this.font(500, 14); ctx.textAlign = 'right';
      ctx.fillText(context, g.W - g.M, g.headerY);
    }
  }

  eyebrow(text: string) {
    const { ctx, g, p } = this;
    ctx.fillStyle = p.soft; this.font(600, g.W > 600 ? 16 : 17); ctx.textAlign = 'left';
    ctx.fillText(text, g.M, g.eyebrowY);
  }

  /** Big headline from coloured runs; shrinks to fit. */
  hero(line1: Run[], line2?: Run[]) {
    const { ctx, g } = this;
    const max = g.W - g.M * 2;
    const draw = (runs: Run[], y: number) => {
      let px = g.heroPx;
      const width = () => runs.reduce((w, r) => w + ctx.measureText(r.text).width, 0);
      this.font(800, px);
      while (px > 30 && width() > max) { px -= 2; this.font(800, px); }
      let x = g.M;
      ctx.textAlign = 'left';
      for (const r of runs) { ctx.fillStyle = r.color; ctx.fillText(r.text, x, y); x += ctx.measureText(r.text).width; }
    };
    if (g.hero2Y !== null && line2) {
      // On its own line, the second part loses its joining space or " · ".
      const trimmed = line2.map((r, i) => (i === 0 ? { ...r, text: r.text.replace(/^\s*(·\s*)?/, '') } : r));
      draw(line1, g.heroY); draw(trimmed, g.hero2Y);
    }
    else draw(line2 ? [...line1, ...line2] : line1, g.heroY);
  }

  standout(label: string, value: string, who: string) {
    const { ctx, g, p } = this;
    ctx.textAlign = 'left';
    let x = g.M;
    this.font(500, 18); ctx.fillStyle = p.soft; ctx.fillText(label, x, g.standoutY); x += ctx.measureText(label).width + 10;
    this.font(800, 22); ctx.fillStyle = p.ink; ctx.fillText(value, x, g.standoutY); x += ctx.measureText(value).width + 10;
    this.font(500, 18); ctx.fillStyle = p.soft; ctx.fillText(who, x, g.standoutY);
  }

  footer(left: string, right: string) {
    const { ctx, g, p } = this;
    ctx.fillStyle = p.rule; ctx.fillRect(g.M, g.ruleY, g.W - g.M * 2, 1);
    ctx.fillStyle = p.soft; this.font(500, 15);
    ctx.textAlign = 'left'; ctx.fillText(left, g.M, g.footY);
    ctx.textAlign = 'right'; ctx.fillText(right, g.W - g.M, g.footY);
  }

  /** Rows fit between `top` and `bottom`; returns step and font size. */
  rows(count: number, top: number, bottom: number): { step: number; px: number } {
    const { g } = this;
    const step = Math.min(g.rowStep, (bottom - top) / Math.max(1, count));
    const px = Math.min(g.rowPx, Math.max(16, Math.round(step * 0.58)));
    return { step, px };
  }

  dots(xRight: number, y: number, won: number, total: number, color: string) {
    const { ctx, p } = this;
    const r = 7, gap = 7;
    const n = Math.max(total, won);
    let x = xRight - n * (r * 2) - (n - 1) * gap + r;
    for (let i = 0; i < n; i += 1) {
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
      if (i < won) { ctx.fillStyle = color; ctx.fill(); }
      else { ctx.strokeStyle = p.faint; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r - 1, 0, Math.PI * 2); ctx.stroke(); }
      x += r * 2 + gap;
    }
    return n * (r * 2) + (n - 1) * gap;
  }

  /** The optional stats strip: a label column, then one column per name. */
  strip(top: number, names: string[], rows: { label: string; values: number[] }[]) {
    const { ctx, g, p } = this;
    const labelW = g.W > 600 ? 150 : 120;
    const colW = (g.W - g.M * 2 - labelW) / Math.max(1, names.length);
    const xOf = (i: number) => g.M + labelW + colW * (i + 1);
    ctx.textAlign = 'right'; ctx.fillStyle = p.faint; this.font(700, 11);
    names.forEach((n, i) => {
      const t = this.ellipsize(n.toUpperCase(), colW - 6);
      ctx.fillText(t, xOf(i), top);
    });
    rows.forEach((r, k) => {
      const y = top + 26 + k * 26;
      ctx.textAlign = 'left'; ctx.fillStyle = p.soft; this.font(500, 16); ctx.fillText(r.label, g.M, y);
      ctx.textAlign = 'right'; ctx.fillStyle = p.ink; this.font(700, 16);
      r.values.forEach((v, i) => ctx.fillText(String(v), xOf(i), y));
    });
    return 26 + rows.length * 26;
  }
}

/** Players grouped into sides: teams in team mode, otherwise players. */
function sidesOf<T extends { name: string; teamName?: string }>(players: T[]) {
  const map = new Map<string, T[]>();
  for (const p of players) {
    const key = p.teamName || p.name;
    map.set(key, [...(map.get(key) ?? []), p]);
  }
  return [...map.entries()].map(([key, members]) => ({
    key,
    // "Team 1" says nothing on a card — name the players instead.
    label: members.length > 1 && /^team\s*\d+$/i.test(key) ? members.map((m) => m.name).join(' & ') : key,
    members,
  }));
}

/* ------------------------------------------------------------------ cards */

function drawMatch(c: HTMLCanvasElement, d: MatchCardData, style: CardStyle) {
  const P = new Painter(c, style);
  const { g, p } = P;
  const sides = sidesOf(d.players).map((s) => ({
    ...s,
    frames: Math.max(...s.members.map((m) => m.framesWon)),
    points: s.members.reduce((a, m) => a + m.score, 0),
  })).sort((a, b) => b.frames - a.frames || b.points - a.points);
  const played = sides.reduce((a, s) => a + s.frames, 0);
  const line = sides.map((s) => s.frames).join('–');
  const winner = d.winnerName ? sides.find((s) => s.key === d.winnerName) : undefined;

  P.header(`${modeName(d.mode)} · Best of ${d.bestOf}`);
  P.eyebrow(g.W > 600 ? (winner ? 'Winner' : 'Result') : `${modeName(d.mode)} · Best of ${d.bestOf}`);
  if (winner) P.hero([{ text: winner.label, color: p.acc }], [{ text: g.hero2Y ? line : ` · ${line}`, color: p.soft }]);
  else P.hero([{ text: 'Draw', color: p.ink }], [{ text: g.hero2Y ? line : ` · ${line}`, color: p.soft }]);

  const best = [...d.players].sort((a, b) => b.highestBreak - a.highestBreak)[0];
  const statsH = style.stats ? 30 + 2 * 26 : 0;
  const bottom = g.standoutY - 40 - statsH;
  const { step, px } = P.rows(sides.length, g.listTop, bottom);
  const numW = 90;
  sides.forEach((s, i) => {
    const y = g.listTop + step * i + step * 0.62;
    const isWin = winner?.key === s.key;
    const color = isWin ? p.acc : p.ink;
    P.ctx.textAlign = 'right'; P.font(700, px); P.ctx.fillStyle = color;
    P.ctx.fillText(String(s.points), g.W - g.M, y);
    const dotsW = P.dots(g.W - g.M - numW, y - px * 0.34, s.frames, played, isWin ? p.acc : p.acc);
    P.ctx.textAlign = 'left'; P.font(600, px); P.ctx.fillStyle = color;
    P.ctx.fillText(P.ellipsize(s.label, g.W - g.M * 2 - numW - dotsW - 24), g.M, y);
  });

  if (style.stats) {
    // Same order as the list above.
    const ordered = sides.flatMap((s) => s.members);
    P.strip(bottom + 26, ordered.map((x) => x.name), [
      { label: 'Best break', values: ordered.map((x) => x.highestBreak) },
      { label: 'Fouls', values: ordered.map((x) => x.fouls) },
    ]);
  }
  if (best && best.highestBreak > 0) P.standout('Best break', String(best.highestBreak), best.name);
  P.footer(`${d.dateLabel} · ${d.durationLabel}`, '● frame won');
}

function drawFrame(c: HTMLCanvasElement, d: FrameCardData, style: CardStyle) {
  const P = new Painter(c, style);
  const { g, p } = P;
  const sides = [...d.sides].sort((a, b) => b.score - a.score);
  const winner = d.winnerName;
  const label = (key: string) => sidesOf(d.players).find((s) => s.key === key)?.label ?? key;

  P.header(`${modeName(d.mode)} · Frame ${d.frameNumber}`);
  P.eyebrow(g.W > 600 ? `Frame ${d.frameNumber}` : `${modeName(d.mode)} · Frame ${d.frameNumber}`);
  if (winner) P.hero([{ text: label(winner), color: p.acc }], [{ text: ' wins', color: p.ink }]);
  else P.hero([{ text: `Frame ${d.frameNumber}`, color: p.ink }], [{ text: ' · level', color: p.soft }]);

  const statsH = style.stats ? 30 + 3 * 26 : 0;
  const bottom = g.standoutY - 40 - statsH;
  const { ctx } = P;
  if (g.W > 600 && sides.length <= 4) {
    // Wide: scores side by side, name above a big number.
    const colW = Math.min(200, (g.W - g.M * 2) / sides.length);
    const big = Math.min(72, Math.max(40, bottom - g.listTop - 40));
    sides.forEach((s, i) => {
      const x = g.M + colW * i;
      const color = s.name === winner ? p.acc : p.ink;
      ctx.textAlign = 'left';
      P.font(600, 20); ctx.fillStyle = s.name === winner ? p.acc : p.soft;
      ctx.fillText(P.ellipsize(label(s.name), colW - 16), x, g.listTop + 38);
      P.font(800, big); ctx.fillStyle = color;
      ctx.fillText(String(s.score), x, g.listTop + 38 + big);
    });
  } else {
    const { step, px } = P.rows(sides.length, g.listTop, bottom);
    sides.forEach((s, i) => {
      const y = g.listTop + step * i + step * 0.66;
      const color = s.name === winner ? p.acc : p.ink;
      ctx.textAlign = 'right'; P.font(800, Math.round(px * 1.5)); ctx.fillStyle = color;
      ctx.fillText(String(s.score), g.W - g.M, y);
      ctx.textAlign = 'left'; P.font(600, px); ctx.fillStyle = s.name === winner ? p.acc : p.soft;
      ctx.fillText(P.ellipsize(label(s.name), g.W - g.M * 2 - 110), g.M, y);
    });
  }

  if (style.stats) {
    const rank = (n: string) => sides.findIndex((s) => s.name === n || s.name === d.players.find((x) => x.name === n)?.teamName);
    const ordered = [...d.players].sort((a, b) => rank(a.name) - rank(b.name) || b.score - a.score);
    P.strip(bottom + 26, ordered.map((x) => x.name), [
      { label: 'Reds', values: ordered.map((x) => x.reds) },
      { label: 'Best break', values: ordered.map((x) => x.highestBreak) },
      { label: 'Fouls', values: ordered.map((x) => x.fouls) },
    ]);
  }
  const best = [...d.players].sort((a, b) => b.highestBreak - a.highestBreak)[0];
  if (best && best.highestBreak > 0) P.standout('Best break', String(best.highestBreak), best.name);
  P.footer(`${d.dateLabel} · ${d.durationLabel}`, SITE);
}

function drawCentury(c: HTMLCanvasElement, d: CenturyCardData, style: CardStyle) {
  const P = new Painter(c, style);
  const { g, p, ctx } = P;
  const first = d.players.find((x) => x.finishedAt === 1);
  const ctxLine = `Century · ${d.target} · Red ${d.redValue}`;

  P.header(ctxLine);
  P.eyebrow(g.W > 600 ? 'First out' : `${ctxLine} · First out`);
  P.hero([{ text: first?.name ?? 'Century', color: first ? p.acc : p.ink }]);

  const statsH = style.stats ? 30 + 3 * 26 : 0;
  const bottom = g.ruleY - 30 - statsH;
  const { step, px } = P.rows(d.players.length, g.listTop, bottom);
  const ord = (n: number) => `${n}${n % 10 === 1 && n !== 11 ? 'st' : n % 10 === 2 && n !== 12 ? 'nd' : n % 10 === 3 && n !== 13 ? 'rd' : 'th'}`;
  d.players.forEach((pl, i) => {
    const y = g.listTop + step * i + step * 0.62;
    const isFirst = pl.finishedAt === 1;
    const short = pl.finishedAt === null;
    const color = isFirst ? p.acc : short ? p.faint : p.ink;
    ctx.textAlign = 'left'; P.font(700, Math.round(px * 0.7)); ctx.fillStyle = p.soft;
    ctx.fillText(short ? 'Short' : ord(pl.finishedAt!), g.M, y);
    P.font(600, px); ctx.fillStyle = color;
    ctx.fillText(P.ellipsize(pl.name, g.W - g.M * 2 - 190), g.M + 76, y);
    ctx.textAlign = 'right'; P.font(700, px);
    ctx.fillText(String(pl.score), g.W - g.M, y);
  });

  if (style.stats) {
    P.strip(bottom + 26, d.players.map((x) => x.name), [
      { label: 'Balls potted', values: d.players.map((x) => x.potted) },
      { label: 'Reds', values: d.players.map((x) => x.redsPotted) },
      { label: 'Fouls', values: d.players.map((x) => x.fouls) },
    ]);
  }
  P.footer(`${d.dateLabel} · ${d.durationLabel}`, SITE);
}

/** Draw any card onto `canvas` (resized to the shape at 2x). */
export function drawCard(canvas: HTMLCanvasElement, spec: CardSpec, style: CardStyle): void {
  if (spec.kind === 'match') drawMatch(canvas, spec.data, style);
  else if (spec.kind === 'frame') drawFrame(canvas, spec.data, style);
  else drawCentury(canvas, spec.data, style);
}
