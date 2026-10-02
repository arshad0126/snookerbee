import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './useAuth';
import {
  fetchRemoteSettings,
  loadLocalSettings,
  saveLocalSettings,
  saveRemoteSettings,
  type AppSettings,
} from '../lib/settings';

interface SettingsContextValue {
  settings: AppSettings;
  /** The mode actually showing ('auto' resolved against the phone). */
  resolvedMode: 'light' | 'dark';
  update: (patch: Partial<AppSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

function systemPrefersLight(): boolean {
  return typeof window !== 'undefined'
    && !!window.matchMedia
    && window.matchMedia('(prefers-color-scheme: light)').matches;
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AppSettings>(loadLocalSettings);
  const [systemLight, setSystemLight] = useState(systemPrefersLight);
  const syncedFor = useRef<string | null>(null);

  // Follow the phone's light/dark switch while in Auto.
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => setSystemLight(mq.matches);
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, []);

  const resolvedMode: 'light' | 'dark' =
    settings.mode === 'auto' ? (systemLight ? 'light' : 'dark') : settings.mode;

  // Apply to the page: light/dark class, accent and backdrop attributes, and
  // the browser chrome colour.
  useEffect(() => {
    const body = document.body;
    body.classList.toggle('light-theme', resolvedMode === 'light');
    body.dataset.accent = settings.accent;
    body.dataset.backdrop = settings.backdrop;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', resolvedMode === 'light' ? '#F5F6F8' : '#07090b');
  }, [resolvedMode, settings.accent, settings.backdrop]);

  // On sign-in, the account's saved settings win over this device's.
  useEffect(() => {
    if (!user || syncedFor.current === user.id) return;
    syncedFor.current = user.id;
    void fetchRemoteSettings(user.id).then((remote) => {
      if (remote) {
        setSettings(remote);
        saveLocalSettings(remote);
      } else {
        void saveRemoteSettings(user.id, loadLocalSettings());
      }
    });
  }, [user]);

  const update = useCallback(
    (patch: Partial<AppSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        saveLocalSettings(next);
        if (user) void saveRemoteSettings(user.id, next);
        return next;
      });
    },
    [user]
  );

  return (
    <SettingsContext.Provider value={{ settings, resolvedMode, update }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
  return ctx;
}
