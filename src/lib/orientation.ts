/**
 * orientation — turn the phone sideways when a match starts.
 *
 * Android honours the Screen Orientation API: an installed app can lock
 * straight away, and a browser tab can lock once it's fullscreen. Both need
 * a tap, so this is called from the Start / Resume button. iOS has no API at
 * all; there the landscape gate (OrientationWarning) asks the player to
 * rotate instead. Every step fails silently — scoring must never wait on it.
 */

type LockableOrientation = ScreenOrientation & { lock?: (o: 'landscape') => Promise<void> };

const isStandalone = (): boolean =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export async function requestLandscape(): Promise<void> {
  const orientation = window.screen?.orientation as LockableOrientation | undefined;
  if (!orientation?.lock) return; // iOS and older browsers
  if (orientation.type?.startsWith('landscape')) return;

  try {
    await orientation.lock('landscape');
    return;
  } catch {
    /* a browser tab needs fullscreen first — try that below */
  }

  if (isStandalone() || !document.fullscreenEnabled || document.fullscreenElement) return;
  try {
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    await orientation.lock('landscape');
  } catch {
    /* refused — the landscape gate still covers it */
  }
}
