import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { ACCENTS, BACKDROPS, type ColorMode } from '../lib/settings';
import { loadHistory, guessMyName, knownNames, type History } from '../lib/history';
import { getFramesForMatches } from '../lib/database';
import ThemeBackdrop, { BackdropArt } from './ThemeBackdrop';
import { Icon } from './ui';

const MODES: { id: ColorMode; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'auto', label: 'Auto' },
];

async function exportHistory(history: History, isGuest: boolean): Promise<'shared' | 'downloaded' | 'failed'> {
  let frames: unknown = undefined;
  if (!isGuest && history.matches.length > 0) {
    frames = await getFramesForMatches(history.matches.map((m) => m.id));
  }
  const payload = {
    app: 'SnookerBee',
    version: __APP_VERSION__,
    exportedAt: new Date().toISOString(),
    matches: history.matches,
    frames,
    centuryGames: history.centuries,
  };
  const name = `snookerbee-history-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  try {
    if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'SnookerBee history' });
      return 'shared';
    }
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return 'shared';
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return 'downloaded';
  } catch {
    return 'failed';
  }
}

export default function Settings() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isGuest } = useAuth();
  const { settings, update } = useSettings();
  const [history, setHistory] = useState<History | null>(null);
  const [exportState, setExportState] = useState<'idle' | 'working' | 'done' | 'failed'>('idle');

  useEffect(() => {
    let live = true;
    void loadHistory(isGuest).then((h) => { if (live) setHistory(h); });
    return () => { live = false; };
  }, [isGuest]);

  // Arriving from the drawer's Export or About items: scroll there.
  useEffect(() => {
    const id = location.hash.slice(1);
    if (!id) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 60);
    return () => clearTimeout(t);
  }, [location.hash]);

  const names = useMemo(() => (history ? knownNames(history.matches) : []), [history]);
  const guessed = useMemo(() => (history ? guessMyName(history.matches, history.centuries) : null), [history]);

  const onExport = async () => {
    if (!history) return;
    setExportState('working');
    const r = await exportHistory(history, isGuest);
    setExportState(r === 'failed' ? 'failed' : 'done');
  };

  return (
    <div className="st-page">
      <ThemeBackdrop />
      <header className="st-header">
        <button type="button" className="st-back" onClick={() => navigate('/dashboard')} aria-label="Back to dashboard">
          <Icon name="arrow-left" size={18} />
        </button>
        <h1 className="st-title">Settings</h1>
      </header>

      <main className="st-body">
        <section className="st-section" aria-labelledby="st-appearance">
          <h2 id="st-appearance" className="st-h2">Appearance</h2>

          <div className="st-preview" aria-hidden="true">
            <div className="st-preview-art theme-backdrop" data-kind={settings.backdrop}>
              <BackdropArt kind={settings.backdrop} />
            </div>
            <div className="st-preview-card">
              <span className="st-preview-eyebrow">Ready when you are</span>
              <span className="st-preview-title">New game</span>
            </div>
            <div className="st-preview-rows">
              <span className="st-preview-row"><span className="st-preview-win">Arshad 54</span><span>Awais 52</span></span>
              <span className="st-preview-row"><span className="st-preview-win">Suraj 64</span><span>Awais 41</span></span>
            </div>
            <span className="st-preview-btn">Start match</span>
          </div>

          <div className="st-field">
            <span className="st-label" id="st-mode-label">Mode</span>
            <div className="st-seg" role="radiogroup" aria-labelledby="st-mode-label">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={settings.mode === m.id}
                  className={`st-seg-btn${settings.mode === m.id ? ' is-on' : ''}`}
                  onClick={() => update({ mode: m.id })}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="st-field st-field--stack">
            <span className="st-label" id="st-bg-label">Background</span>
            <div className="st-tiles" role="radiogroup" aria-labelledby="st-bg-label">
              {BACKDROPS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  role="radio"
                  aria-checked={settings.backdrop === b.id}
                  className={`st-tile${settings.backdrop === b.id ? ' is-on' : ''}`}
                  onClick={() => update({ backdrop: b.id })}
                >
                  <span className="st-tile-art theme-backdrop" data-kind={b.id}>
                    <BackdropArt kind={b.id} />
                  </span>
                  <span className="st-tile-name">{b.name}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="st-field st-field--stack">
            <span className="st-label" id="st-accent-label">Accent colour</span>
            <div className="st-swatches" role="radiogroup" aria-labelledby="st-accent-label">
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={settings.accent === a.id}
                  aria-label={a.name}
                  className={`st-swatch${settings.accent === a.id ? ' is-on' : ''}`}
                  onClick={() => update({ accent: a.id })}
                >
                  <span className="st-swatch-dot" style={{ background: a.swatch }}>
                    {settings.accent === a.id && <Icon name="check" size={16} />}
                  </span>
                  <span className="st-swatch-name">{a.name}</span>
                </button>
              ))}
            </div>
            <p className="st-note">Ball colours never change, so scoring always reads the same.</p>
          </div>
          {!isGuest && <p className="st-note">Your theme is saved to your account and follows you to other devices.</p>}
        </section>

        <section className="st-section" aria-labelledby="st-you">
          <h2 id="st-you" className="st-h2">You</h2>
          <div className="st-field">
            <label className="st-label" htmlFor="st-name">Your name in matches</label>
            <select
              id="st-name"
              className="st-select"
              value={settings.playerName ?? ''}
              onChange={(e) => update({ playerName: e.target.value || null })}
            >
              <option value="">{guessed ? `Automatic (${guessed})` : 'Automatic'}</option>
              {names.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <p className="st-note">Used for your win rate, form and head-to-head. Automatic picks the name in most of your games.</p>
        </section>

        <section className="st-section" aria-labelledby="st-scoring">
          <h2 id="st-scoring" className="st-h2">Scoring</h2>
          <div className="st-field">
            <span className="st-label" id="st-confirm-undo">Ask before undo</span>
            <button
              type="button"
              role="switch"
              aria-checked={settings.confirmUndo}
              aria-labelledby="st-confirm-undo"
              className={`st-switch${settings.confirmUndo ? ' is-on' : ''}`}
              onClick={() => update({ confirmUndo: !settings.confirmUndo })}
            >
              <span className="st-switch-knob" />
            </button>
          </div>
          <p className="st-note">
            Shows what will be undone and asks first. Either way, a quick double-tap is ignored and you get a
            Redo button for a few seconds after every undo.
          </p>
        </section>

        <section className="st-section" id="data" aria-labelledby="st-data">
          <h2 id="st-data" className="st-h2">Export &amp; backup</h2>
          <p className="st-note">
            {history
              ? `${history.matches.length} matches and ${history.centuries.length} Century games, with every shot.`
              : 'Loading your history…'}
          </p>
          <button type="button" className="st-btn" disabled={!history || exportState === 'working'} onClick={() => { void onExport(); }}>
            <Icon name="download" size={18} />
            {exportState === 'working' ? 'Preparing…' : 'Export history (JSON)'}
          </button>
          {exportState === 'done' && <p className="st-note st-note--ok">Exported.</p>}
          {exportState === 'failed' && <p className="st-note st-note--bad">Couldn't export on this device.</p>}
          {isGuest && <p className="st-note">Guest games live only on this phone. Sign in to keep them safe.</p>}
        </section>

        <section className="st-section" id="about" aria-labelledby="st-about">
          <h2 id="st-about" className="st-h2">About &amp; feedback</h2>
          <div className="st-about">
            <button type="button" className="st-btn st-btn--ghost" onClick={() => navigate('/whats-new')}>
              <Icon name="star" size={18} /> What's new in v{__APP_VERSION__}
            </button>
            <button type="button" className="st-btn st-btn--ghost" onClick={() => navigate('/about')}>
              <Icon name="info" size={18} /> About SnookerBee &amp; send feedback
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
