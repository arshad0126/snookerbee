import { afterEach, describe, expect, it, vi } from 'vitest';

// settings.ts imports the Supabase client; these tests only touch local logic.
vi.mock('../supabase', () => ({ supabase: {} }));

import {
  DEFAULT_SETTINGS,
  SWITCH_MODES,
  loadLocalSettings,
  sanitize,
  stepMode,
} from '../settings';

function fakeStorage(seed: Record<string, string> = {}) {
  const data = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => { data.set(k, v); },
    removeItem: (k: string) => { data.delete(k); },
    clear: () => data.clear(),
  };
}

describe('colour mode defaults', () => {
  const original = globalThis.localStorage;
  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', { value: original, configurable: true });
  });
  const useStorage = (seed: Record<string, string>) =>
    Object.defineProperty(globalThis, 'localStorage', { value: fakeStorage(seed), configurable: true });

  it('starts a fresh install in Auto', () => {
    expect(DEFAULT_SETTINGS.mode).toBe('auto');
    useStorage({});
    expect(loadLocalSettings().mode).toBe('auto');
  });

  it('keeps the old light/dark toggle choice on upgrade', () => {
    useStorage({ theme: 'light' });
    expect(loadLocalSettings().mode).toBe('light');
    useStorage({ theme: 'dark' });
    expect(loadLocalSettings().mode).toBe('dark');
  });

  it('keeps a saved mode, including Auto', () => {
    useStorage({ 'snookerbee:settings': JSON.stringify({ mode: 'auto' }), theme: 'dark' });
    expect(loadLocalSettings().mode).toBe('auto');
    useStorage({ 'snookerbee:settings': JSON.stringify({ mode: 'dark' }) });
    expect(loadLocalSettings().mode).toBe('dark');
  });

  it('falls back to Auto for a missing or unknown saved mode', () => {
    expect(sanitize({}).mode).toBe('auto');
    expect(sanitize({ mode: 'sepia' }).mode).toBe('auto');
  });
});

describe('theme switch order', () => {
  it('runs Dark, Auto, Light from left to right', () => {
    expect(SWITCH_MODES).toEqual(['dark', 'auto', 'light']);
  });

  it('steps one position and stops at the ends', () => {
    expect(stepMode('dark', 1)).toBe('auto');
    expect(stepMode('auto', 1)).toBe('light');
    expect(stepMode('light', 1)).toBe('light');
    expect(stepMode('light', -1)).toBe('auto');
    expect(stepMode('auto', -1)).toBe('dark');
    expect(stepMode('dark', -1)).toBe('dark');
  });
});
