import { useCallback, useEffect, useRef, useState } from 'react';
import { currentCardLook, drawCard, type CardShape, type CardTheme } from '../lib/shareCard';
import { onShareSheet, type ShareRequest } from '../lib/shareSheet';
import ThemeBackdrop from './ThemeBackdrop';
import { Icon } from './ui';

/**
 * The share screen. Shows the card as it will be sent, lets the player pick
 * Light / Dark, Wide / Story and whether to add stats, then shares or saves.
 *
 * iOS only opens the share sheet straight from a tap, with no waiting in
 * between — so the image file is prepared every time an option changes, and
 * Share hands over the file that's already made.
 */

// Shape and stats are remembered for the session; the look always starts
// from the app's own light or dark.
let lastShape: CardShape = 'wide';
let lastStats = false;

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export default function ShareSheet() {
  const [req, setReq] = useState<ShareRequest | null>(null);
  const [theme, setTheme] = useState<CardTheme>('dark');
  const [shape, setShape] = useState<CardShape>(lastShape);
  const [stats, setStats] = useState(lastStats);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shareRef = useRef<HTMLButtonElement>(null);

  useEffect(() => onShareSheet((r) => {
    setTheme(currentCardLook().theme);
    setShape(lastShape);
    setStats(lastStats);
    setReq(r);
  }), []);

  // Redraw and re-encode whenever the card or an option changes.
  useEffect(() => {
    if (!req) return;
    let live = true;
    const canvas = canvasRef.current ?? (canvasRef.current = document.createElement('canvas'));
    drawCard(canvas, req.spec, { theme, shape, stats, accent: currentCardLook().accent });
    canvas.toBlob((blob) => {
      if (!live || !blob) return;
      const name = `${req.filename}${shape === 'story' ? '-story' : ''}.png`;
      setFile(new File([blob], name, { type: 'image/png' }));
      setUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
    }, 'image/png');
    return () => { live = false; };
  }, [req, theme, shape, stats]);

  const close = useCallback(() => {
    setReq(null);
    setFile(null);
    setUrl((old) => { if (old) URL.revokeObjectURL(old); return null; });
  }, []);

  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    shareRef.current?.focus();
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [req, close]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!req) return null;

  const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  // iOS can't save a file from a web app; its share sheet has "Save Image".
  const canSave = !isIOS();

  const save = () => {
    if (!file || !url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setToast('Image saved');
  };

  const share = () => {
    if (!file) return;
    if (!canShareFile) { save(); return; }
    // No await before share(): iOS needs it to come straight from the tap.
    navigator.share({ files: [file], title: req.title }).catch((err: unknown) => {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      if (canSave) save(); else setToast("Couldn't open sharing");
    });
  };

  const pickShape = (s: CardShape) => { lastShape = s; setShape(s); };
  const pickStats = (v: boolean) => { lastStats = v; setStats(v); };

  return (
    <div className="sh-screen" role="dialog" aria-modal="true" aria-labelledby="sh-title">
      <ThemeBackdrop />
      <div className={`sh-preview sh-preview--${shape}`}>
        {url ? <img src={url} alt={`${req.title} card preview`} /> : <div className="spinner" />}
      </div>

      <div className="sh-panel">
        <header className="sh-head">
          <h2 id="sh-title" className="sh-title">{req.title}</h2>
          <button type="button" className="sh-close" onClick={close} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </header>

        <div className="sh-group">
          <span className="sh-label" id="sh-look">Look</span>
          <div className="sh-seg" role="radiogroup" aria-labelledby="sh-look">
            {(['light', 'dark'] as const).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={theme === t} className={theme === t ? 'is-on' : ''} onClick={() => setTheme(t)}>
                {t === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
        </div>

        <div className="sh-group">
          <span className="sh-label" id="sh-shape">Shape</span>
          <div className="sh-seg" role="radiogroup" aria-labelledby="sh-shape">
            {(['wide', 'story'] as const).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={shape === s} className={shape === s ? 'is-on' : ''} onClick={() => pickShape(s)}>
                {s === 'wide' ? 'Wide' : 'Story'}
              </button>
            ))}
          </div>
        </div>

        <label className="sh-switch">
          <span>Add stats</span>
          <input type="checkbox" role="switch" checked={stats} onChange={(e) => pickStats(e.target.checked)} />
          <i aria-hidden="true" />
        </label>

        <div className="sh-actions">
          <button ref={shareRef} type="button" className="sh-btn sh-btn--primary" onClick={share} disabled={!file}>
            <Icon name="share" size={18} /> {canShareFile || !canSave ? 'Share' : 'Download'}
          </button>
          {canSave && canShareFile && (
            <button type="button" className="sh-btn" onClick={save} disabled={!file}>Save image</button>
          )}
        </div>
        {!canSave && <p className="sh-hint">To keep it, tap Share, then Save Image.</p>}
      </div>

      {toast && <div className="sh-toast" role="status">{toast}</div>}
    </div>
  );
}
