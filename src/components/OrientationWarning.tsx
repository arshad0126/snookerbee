import { useState, useEffect } from 'react';
import { Icon } from './ui';

/**
 * Landscape gate.
 *
 * The app is designed for landscape, but iOS cannot be forced into it: the
 * Screen Orientation API is unsupported in every iOS browser and PWA, and the
 * manifest's `orientation` field is ignored there. (Both are honoured on
 * Android, so the manifest still declares landscape and the lock is still
 * attempted — they just no-op on iPhone.)
 *
 * Since it can't be forced, portrait is blocked instead: a full-screen gate
 * that can't be dismissed, so the scoring UI is never rendered into a layout
 * it wasn't built for. This used to be a dismissible banner, which meant the
 * app could still be driven in portrait with a broken layout.
 */
export default function OrientationWarning() {
  const [isPortrait, setIsPortrait] = useState(
    () => window.innerHeight > window.innerWidth
  );

  useEffect(() => {
    const update = () => setIsPortrait(window.innerHeight > window.innerWidth);

    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);

    // Honoured on Android; a silent no-op on iOS. Attempted anyway so the
    // platforms that can respect it do.
    const orientation = window.screen?.orientation as
      | (ScreenOrientation & { lock?: (o: string) => Promise<void> })
      | undefined;
    void orientation?.lock?.('landscape').catch(() => {
      /* unsupported (iOS) or refused — the gate below covers it */
    });

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);

  if (!isPortrait) return null;

  return (
    <div className="orientation-gate" role="alertdialog" aria-label="Rotate your device">
      <div className="orientation-gate-inner">
        <div className="orientation-gate-icon">
          <Icon name="rotate" size={56} />
        </div>
        <h2 className="orientation-gate-title">Rotate your phone</h2>
        <p className="orientation-gate-text">
          SnookerBee is built for landscape. Turn your phone sideways to keep scoring.
        </p>
        <p className="orientation-gate-hint">
          If the screen doesn&rsquo;t turn, switch off Portrait Orientation Lock in Control Centre.
        </p>
      </div>
    </div>
  );
}
