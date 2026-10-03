/**
 * centuryShare — open the share screen with a Century result card.
 * Used by the end-of-game sheet and by Century games in Match History.
 */

import { openShareSheet, cardFilename } from './shareSheet';
import { byFinish, formatCenturyDuration, type CenturyDetailsPlayer } from './centuryHistory';

export interface CenturyShareInput {
  target: number;
  redValue: number;
  durationMs: number;
  /** ISO timestamp or epoch ms of the game. */
  playedAt: string | number;
  players: CenturyDetailsPlayer[];
}

export function shareCenturyCard(g: CenturyShareInput): void {
  const ordered = byFinish(g.players);
  openShareSheet({
    title: 'Share Century game',
    filename: cardFilename(ordered.slice(0, 2).map((p) => p.name), 'century'),
    spec: {
      kind: 'century',
      data: {
        target: g.target,
        redValue: g.redValue,
        durationLabel: formatCenturyDuration(g.durationMs),
        dateLabel: new Date(g.playedAt).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }),
        players: ordered,
      },
    },
  });
}
