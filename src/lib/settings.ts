/**
 * settings — the user's appearance and identity choices.
 *
 * Kept on the device (so they apply before anything loads) and, for
 * signed-in users, mirrored to the `user_settings` table so they follow the
 * account to another phone.
 */

import { supabase } from './supabase';

export type ColorMode = 'light' | 'dark' | 'auto';

export const ACCENTS = [
  { id: 'blue', name: 'Club Blue', swatch: '#2F6E9E' },
  { id: 'green', name: 'Baize', swatch: '#2E7550' },
  { id: 'claret', name: 'Claret', swatch: '#9E2F45' },
  { id: 'gold', name: 'Gold', swatch: '#86620F' },
  { id: 'pink', name: 'Pink Ball', swatch: '#AD3A6C' },
  { id: 'slate', name: 'Slate', swatch: '#4A5868' },
  { id: 'clay', name: 'Clay', swatch: '#975430' },
] as const;
export type Accent = (typeof ACCENTS)[number]['id'];

export const BACKDROPS = [
  { id: 'rack', name: 'Classic' },
  { id: 'baize', name: 'Baize' },
  { id: 'breakoff', name: 'Break-off' },
  { id: 'pocket', name: 'Pocket' },
  { id: 'plain', name: 'Plain' },
] as const;
export type Backdrop = (typeof BACKDROPS)[number]['id'];

export interface AppSettings {
  mode: ColorMode;
  accent: Accent;
  backdrop: Backdrop;
  /** The name you play under, for stats. Null = worked out from history. */
  playerName: string | null;
  /** Ask "Undo this?" before every undo. */
  confirmUndo: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  // Follow the phone until the player picks a mode themselves.
  mode: 'auto',
  accent: 'blue',
  backdrop: 'rack',
  playerName: null,
  confirmUndo: false,
};

const KEY = 'snookerbee:settings';
const LEGACY_THEME_KEY = 'theme';

const isAccent = (v: unknown): v is Accent => ACCENTS.some((a) => a.id === v);
const isBackdrop = (v: unknown): v is Backdrop => BACKDROPS.some((b) => b.id === v);
/** Left-to-right order of the three-way theme switch. */
export const SWITCH_MODES: readonly ColorMode[] = ['dark', 'auto', 'light'];

/** One step along the switch (arrow keys). Stops at the ends, never wraps. */
export function stepMode(mode: ColorMode, dir: -1 | 1): ColorMode {
  const i = SWITCH_MODES.indexOf(mode);
  const next = Math.min(SWITCH_MODES.length - 1, Math.max(0, (i < 0 ? 1 : i) + dir));
  return SWITCH_MODES[next];
}

const isMode = (v: unknown): v is ColorMode => v === 'light' || v === 'dark' || v === 'auto';

/** Accept anything, keep only values this version understands. */
export function sanitize(raw: unknown): AppSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  return {
    mode: isMode(r.mode) ? r.mode : DEFAULT_SETTINGS.mode,
    accent: isAccent(r.accent) ? r.accent : DEFAULT_SETTINGS.accent,
    backdrop: isBackdrop(r.backdrop) ? r.backdrop : DEFAULT_SETTINGS.backdrop,
    playerName:
      typeof r.playerName === 'string' && r.playerName.trim() ? r.playerName.trim().slice(0, 60) : null,
    confirmUndo: r.confirmUndo === true,
  };
}

export function loadLocalSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return sanitize(JSON.parse(raw));
    // First run after the update: carry over the old light/dark toggle. A
    // fresh install has neither key and starts in Auto.
    const legacy = localStorage.getItem(LEGACY_THEME_KEY);
    if (legacy === 'light' || legacy === 'dark') return { ...DEFAULT_SETTINGS, mode: legacy };
    return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveLocalSettings(s: AppSettings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
    localStorage.setItem(LEGACY_THEME_KEY, s.mode === 'light' ? 'light' : 'dark');
  } catch {
    /* storage full or blocked: settings still apply for this session */
  }
}

export async function fetchRemoteSettings(userId: string): Promise<AppSettings | null> {
  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('settings')
      .eq('user_id', userId)
      .maybeSingle();
    if (error || !data) return null;
    return sanitize(data.settings);
  } catch {
    return null;
  }
}

export async function saveRemoteSettings(userId: string, s: AppSettings): Promise<void> {
  try {
    await supabase
      .from('user_settings')
      .upsert({ user_id: userId, settings: s, updated_at: new Date().toISOString() });
  } catch {
    /* offline: the device copy is kept and synced on the next change */
  }
}
