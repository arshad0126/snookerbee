/**
 * shareImage — cross-platform "share this canvas as a PNG".
 *
 * Why this exists: the previous implementation used `canvas.toDataURL()` +
 * a programmatic `<a download>` click. That silently does nothing on iOS,
 * especially in standalone (home-screen) PWA mode, where there is no
 * download manager. The correct path on mobile is Web Share Level 2
 * (`navigator.share` with files), with graceful fallbacks.
 *
 * Tiers:
 *   1. navigator.share({ files }) — iOS Safari 15+, Android Chrome, incl. PWAs
 *   2. Object-URL download — desktop browsers
 *   3. Full-screen preview with "touch and hold to save" — old standalone iOS
 *
 * Every outcome produces visible feedback. Nothing fails silently.
 * No React dependency: feedback is rendered with plain DOM so any caller
 * (inside or outside a ToastProvider) can use it.
 */

export type ShareResult = 'shared' | 'downloaded' | 'preview' | 'failed';

function isStandaloneDisplay(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    // iOS Safari legacy flag for home-screen apps
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/** Minimal, self-cleaning toast. Inline styles so it needs no stylesheet. */
function flashMessage(message: string): void {
  const el = document.createElement('div');
  el.setAttribute('role', 'status');
  el.textContent = message;
  Object.assign(el.style, {
    position: 'fixed',
    left: '50%',
    bottom: 'calc(env(safe-area-inset-bottom, 0px) + 24px)',
    transform: 'translateX(-50%)',
    background: 'var(--label-primary, #272727)',
    color: 'var(--bg-elevated, #FFFFFF)',
    padding: '10px 18px',
    borderRadius: '999px',
    font: '600 15px var(--font-sans, system-ui)',
    boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
    zIndex: '9999',
    opacity: '0',
    transition: 'opacity 200ms ease',
    pointerEvents: 'none',
    maxWidth: '86vw',
    textAlign: 'center',
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  requestAnimationFrame(() => { el.style.opacity = '1'; });
  window.setTimeout(() => {
    el.style.opacity = '0';
    window.setTimeout(() => el.remove(), 250);
  }, 2600);
}

/**
 * Tier 3: full-screen image preview for environments that can neither
 * share files nor download (old iOS home-screen installs).
 */
function showSavePreview(blob: Blob): void {
  const url = URL.createObjectURL(blob);

  const overlay = document.createElement('div');
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Save image');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(0,0,0,0.72)',
    backdropFilter: 'blur(12px)',
    zIndex: '9998',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    padding:
      'calc(env(safe-area-inset-top, 0px) + 24px) 20px calc(env(safe-area-inset-bottom, 0px) + 24px)',
  } as Partial<CSSStyleDeclaration>);

  const img = document.createElement('img');
  img.src = url;
  img.alt = 'Match card';
  Object.assign(img.style, {
    maxWidth: '100%',
    maxHeight: '70vh',
    borderRadius: '16px',
    boxShadow: '0 12px 32px rgba(0,0,0,0.4)',
  } as Partial<CSSStyleDeclaration>);

  const hint = document.createElement('p');
  hint.textContent = 'Touch and hold the image, then choose "Save to Photos".';
  Object.assign(hint.style, {
    color: '#FFFFFF',
    font: '400 15px var(--font-sans, system-ui)',
    textAlign: 'center',
    margin: '0',
    maxWidth: '32ch',
  } as Partial<CSSStyleDeclaration>);

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = 'Done';
  Object.assign(close.style, {
    background: '#FFFFFF',
    color: '#272727',
    border: 'none',
    borderRadius: '999px',
    padding: '12px 32px',
    font: '600 17px var(--font-sans, system-ui)',
    cursor: 'pointer',
    minHeight: '44px',
  } as Partial<CSSStyleDeclaration>);
  close.addEventListener('click', () => {
    overlay.remove();
    URL.revokeObjectURL(url);
  });

  overlay.append(img, hint, close);
  document.body.appendChild(overlay);
}

export async function shareCanvasAsImage(
  canvas: HTMLCanvasElement,
  filename: string,
  title: string
): Promise<ShareResult> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  );
  if (!blob) {
    flashMessage("Couldn't create the image");
    return 'failed';
  }

  const file = new File([blob], filename, { type: 'image/png' });

  // Tier 1 — Web Share Level 2. Keep this synchronous with the tap chain:
  // no awaits above except toBlob, or iOS drops the user activation.
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (err) {
      // User cancelling the share sheet is a normal outcome, not an error.
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
      // Anything else: fall through to the next tier.
    }
  }

  // Tier 2 — plain download for desktop browsers.
  if (!isStandaloneDisplay()) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    flashMessage('Card saved');
    return 'downloaded';
  }

  // Tier 3 — standalone app with no file sharing: show the image instead.
  showSavePreview(blob);
  return 'preview';
}

/** `Arshad`, `Rahul jr.` → `snookerbee-arshad-vs-rahul-jr-2026-08-20.png` */
export function cardFilename(parts: string[], suffix?: string): string {
  const date = new Date().toISOString().slice(0, 10);
  const slug = parts
    .map((p) =>
      p
        .toLowerCase()
        .normalize('NFKD')
        .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
        .replace(/^-+|-+$/g, '')
    )
    .filter(Boolean)
    .join('-vs-');
  return `snookerbee-${slug || 'match'}${suffix ? `-${suffix}` : ''}-${date}.png`;
}

/**
 * Shared card palette — Sandy Clay on Shadow Grey (matches the app's
 * dark-mode tokens). Canvas can't read CSS variables, so it lives here.
 */
export const CARD = {
  bg: '#272727',
  ink: '#F3EDE3',
  inkFaint: 'rgba(243, 237, 227, 0.5)',
  accent: '#D4AA7D',
  accentFill: 'rgba(212, 170, 125, 0.10)',
  accentLine: 'rgba(212, 170, 125, 0.5)',
  rule: 'rgba(243, 237, 227, 0.14)',
} as const;
