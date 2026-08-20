/**
 * shareImage — preview the card, then share it.
 *
 * Why preview-first: iOS drops user activation across an `await`. Generating
 * the PNG (`canvas.toBlob`) is async, so calling `navigator.share()` after it
 * throws NotAllowedError on iOS and the share sheet never opens — the failure
 * the previous download-link approach hid behind a success toast.
 *
 * So we split it in two gestures. The tap that builds the card opens a preview
 * overlay; the Share button on that overlay is a fresh gesture with the file
 * already in hand, so `navigator.share()` is reached with no `await` before it
 * and iOS opens the sheet. Desktop, which has no share sheet for files, gets a
 * download button instead.
 */

import { CARD } from './shareCard';

export type ShareOutcome = 'shared' | 'downloaded' | 'dismissed' | 'failed';

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
    background: CARD.bg,
    color: CARD.ink,
    padding: '10px 18px',
    borderRadius: '999px',
    font: '600 15px system-ui, -apple-system, sans-serif',
    boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
    zIndex: '10000',
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

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

const SHARE_GLYPH =
  '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" ' +
  'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="M12 15V3"/><path d="m8 7 4-4 4 4"/>' +
  '<path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';

function styleButton(el: HTMLButtonElement, primary: boolean): void {
  Object.assign(el.style, {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    border: primary ? 'none' : `1px solid ${CARD.rule}`,
    background: primary ? CARD.accent : 'transparent',
    color: primary ? CARD.bg : CARD.ink,
    borderRadius: '999px',
    padding: '13px 26px',
    font: '600 16px system-ui, -apple-system, sans-serif',
    minHeight: '46px',
    cursor: 'pointer',
    WebkitTapHighlightColor: 'transparent',
  } as Partial<CSSStyleDeclaration>);
}

/**
 * Show the rendered card with a share (or download) action.
 * Resolves once the overlay closes.
 */
export function presentShareCard(
  canvas: HTMLCanvasElement,
  filename: string,
  title: string
): Promise<ShareOutcome> {
  return canvasToBlob(canvas).then((blob) => {
    if (!blob) {
      flashMessage("Couldn't create the image");
      return 'failed' as ShareOutcome;
    }

    const file = new File([blob], filename, { type: 'image/png' });
    const canShareFile =
      typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

    return new Promise<ShareOutcome>((resolve) => {
      const objectUrl = URL.createObjectURL(blob);
      const previousOverflow = document.body.style.overflow;

      const overlay = document.createElement('div');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Share card');
      Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '9999',
        background: 'rgba(20, 22, 24, 0.82)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '18px',
        padding:
          'calc(env(safe-area-inset-top, 0px) + 20px) 20px calc(env(safe-area-inset-bottom, 0px) + 20px)',
      } as Partial<CSSStyleDeclaration>);

      const img = document.createElement('img');
      img.src = objectUrl;
      img.alt = title;
      Object.assign(img.style, {
        maxWidth: 'min(100%, 560px)',
        maxHeight: '58vh',
        borderRadius: '14px',
        boxShadow: '0 18px 48px rgba(0,0,0,0.5)',
        objectFit: 'contain',
      } as Partial<CSSStyleDeclaration>);

      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        flexWrap: 'wrap',
        justifyContent: 'center',
      } as Partial<CSSStyleDeclaration>);

      const shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.innerHTML = SHARE_GLYPH;
      shareBtn.appendChild(
        document.createTextNode(canShareFile ? 'Share' : 'Download')
      );
      styleButton(shareBtn, true);

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.textContent = 'Done';
      styleButton(closeBtn, false);

      const hint = document.createElement('p');
      hint.textContent = canShareFile
        ? 'Opens your share sheet — AirDrop, Messages, or Save to Photos.'
        : 'Saves the card as a PNG.';
      Object.assign(hint.style, {
        margin: '0',
        color: CARD.inkSoft,
        font: '400 13px system-ui, -apple-system, sans-serif',
        textAlign: 'center',
        maxWidth: '34ch',
      } as Partial<CSSStyleDeclaration>);

      let settled = false;
      const close = (outcome: ShareOutcome) => {
        if (settled) return;
        settled = true;
        document.removeEventListener('keydown', onKey);
        document.body.style.overflow = previousOverflow;
        overlay.remove();
        URL.revokeObjectURL(objectUrl);
        resolve(outcome);
      };

      const onKey = (e: KeyboardEvent) => {
        if (e.key === 'Escape') close('dismissed');
      };

      const download = () => {
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        flashMessage('Card saved');
        close('downloaded');
      };

      shareBtn.addEventListener('click', () => {
        if (!canShareFile) {
          download();
          return;
        }
        // Deliberately no `await` before share(): iOS revokes user activation
        // across one, which is what broke the previous implementation.
        navigator
          .share({ files: [file], title })
          .then(() => close('shared'))
          .catch((err: unknown) => {
            // Cancelling the sheet is normal — leave the preview open.
            if (err instanceof DOMException && err.name === 'AbortError') return;
            download();
          });
      });

      closeBtn.addEventListener('click', () => close('dismissed'));
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) close('dismissed');
      });
      document.addEventListener('keydown', onKey);

      row.append(shareBtn, closeBtn);
      overlay.append(img, row, hint);
      document.body.style.overflow = 'hidden';
      document.body.appendChild(overlay);
      shareBtn.focus();
    });
  });
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
