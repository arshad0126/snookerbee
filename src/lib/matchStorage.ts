/**
 * matchStorage — keeps a match alive across reloads.
 *
 * The engine state is a plain serialisable object, but it only ever lived in
 * a useReducer. That meant a pull-to-refresh, an accidental swipe back, or —
 * most often — iOS evicting a backgrounded tab took the whole match with it.
 * On a phone, over a 45-minute session, that is the difference between a
 * scoring app and a toy.
 *
 * Two things are stored:
 *
 *   active   an unfinished match, written as it is played and offered back as
 *            "resume" if the app reopens with one present.
 *   pending  a finished match that has not been written to Supabase or local
 *            history yet, so leaving the summary before it saves cannot
 *            silently discard it.
 *
 * Every access is guarded. localStorage throws on a full quota and in Safari
 * private mode, and losing persistence must never take the running match down
 * with it.
 */

import type { GameState } from '../engine/types';
import type { CenturyState } from '../engine/century';

const ACTIVE_KEY = 'snookerbee:activeMatch';
const PENDING_KEY = 'snookerbee:pendingMatch';
const CENTURY_KEY = 'snookerbee:centuryGame';

/** Frame-by-frame scores carried alongside the engine state. */
export interface FrameHistoryItem {
  frameNumber: number;
  scores: Record<string, number>;
}

export interface ActiveMatch {
  savedAt: string;
  state: GameState;
  frameHistory: FrameHistoryItem[];
}

export interface PendingMatch {
  savedAt: string;
  gameState: GameState;
  frameHistory: FrameHistoryItem[];
}

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    // Most likely QuotaExceededError. Drop the resume snapshot — it is the
    // larger and more disposable of the two — and try once more.
    try {
      localStorage.removeItem(ACTIVE_KEY);
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    /* nothing useful to do */
  }
}

/* ------------------------------------------------------------ active match */

/**
 * Persist an in-progress match. `undoStack` is dropped: it holds a full state
 * snapshot per action, which would multiply the payload for something nobody
 * expects to survive a reload.
 */
export function saveActiveMatch(state: GameState, frameHistory: FrameHistoryItem[]): void {
  if (state.players.length === 0) return;
  write(ACTIVE_KEY, {
    savedAt: new Date().toISOString(),
    state: { ...state, undoStack: [] },
    frameHistory,
  } satisfies ActiveMatch);
}

export function loadActiveMatch(): ActiveMatch | null {
  const saved = read<ActiveMatch>(ACTIVE_KEY);
  if (!saved?.state?.players?.length) return null;
  return saved;
}

export function clearActiveMatch(): void {
  remove(ACTIVE_KEY);
}

/** True when there is an unfinished match worth offering to resume. */
export function hasResumableMatch(): boolean {
  const saved = loadActiveMatch();
  return !!saved && saved.state.winner === null;
}

/* ----------------------------------------------------------- pending save */

export function savePendingMatch(
  gameState: GameState,
  frameHistory: FrameHistoryItem[]
): void {
  write(PENDING_KEY, {
    savedAt: new Date().toISOString(),
    gameState: { ...gameState, undoStack: [] },
    frameHistory,
  } satisfies PendingMatch);
}

export function loadPendingMatch(): PendingMatch | null {
  const saved = read<PendingMatch>(PENDING_KEY);
  if (!saved?.gameState?.players?.length) return null;
  return saved;
}

export function clearPendingMatch(): void {
  remove(PENDING_KEY);
}


/* --------------------------------------------------------- century game */

/** Century games persist for the same reason matches do: iOS ends the app. */
export function saveCenturyGame(state: CenturyState): void {
  if (state.players.length === 0) return;
  write(CENTURY_KEY, { ...state, undoStack: [] });
}

export function loadCenturyGame(): CenturyState | null {
  const saved = read<CenturyState>(CENTURY_KEY);
  if (!saved?.players?.length || saved.finished) return null;
  return { ...saved, undoStack: [] };
}

export function clearCenturyGame(): void {
  remove(CENTURY_KEY);
}
