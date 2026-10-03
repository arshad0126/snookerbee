/**
 * shareSheet — open the share screen from anywhere.
 *
 * Callers describe the card (`CardSpec`); the screen draws it in whatever
 * look and shape the player picks, and handles Share / Save. Mounted once
 * in App as <ShareSheet />.
 */

import type { CardSpec } from './shareCard';

export interface ShareRequest {
  spec: CardSpec;
  /** Screen title, e.g. "Share match". */
  title: string;
  /** File name without the shape, e.g. "snookerbee-awais-vs-suraj-2026-10-04". */
  filename: string;
}

let listener: ((req: ShareRequest) => void) | null = null;

export function openShareSheet(req: ShareRequest): void {
  listener?.(req);
}

export function onShareSheet(fn: (req: ShareRequest) => void): () => void {
  listener = fn;
  return () => { if (listener === fn) listener = null; };
}

/** `Arshad`, `Rahul jr.` → `snookerbee-arshad-vs-rahul-jr-2026-08-20` */
export function cardFilename(parts: string[], suffix?: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = parts
    .map((p) => p.toLowerCase().normalize('NFKD').replace(/[^\p{Letter}\p{Number}]+/gu, '-').replace(/^-+|-+$/g, ''))
    .filter(Boolean)
    .join('-vs-');
  return `snookerbee-${slug || 'match'}${suffix ? `-${suffix}` : ''}-${date}`;
}
