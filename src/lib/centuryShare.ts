/**
 * centuryShare — draw the Century result card and hand it to the share flow.
 * Used by the end-of-game sheet and by Century games in Match History.
 */

import { drawCenturyCard } from './shareCard';
import { presentShareCard, cardFilename } from './shareImage';
import { byFinish, formatCenturyDuration, type CenturyDetailsPlayer } from './centuryHistory';

export interface CenturyShareInput {
  target: number;
  redValue: number;
  durationMs: number;
  /** ISO timestamp or epoch ms of the game. */
  playedAt: string | number;
  players: CenturyDetailsPlayer[];
}

export async function shareCenturyCard(canvas: HTMLCanvasElement, g: CenturyShareInput): Promise<void> {
  const ordered = byFinish(g.players);
  drawCenturyCard(canvas, {
    target: g.target,
    redValue: g.redValue,
    durationLabel: formatCenturyDuration(g.durationMs),
    dateLabel: new Date(g.playedAt).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    players: ordered,
  });
  await presentShareCard(
    canvas,
    cardFilename(ordered.slice(0, 2).map((p) => p.name), 'century'),
    'SnookerBee century result'
  );
}
