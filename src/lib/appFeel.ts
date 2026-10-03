/**
 * appFeel — make the PWA behave like an app rather than a web page.
 *
 * iOS Safari ignores user-scalable=no in the browser and can still pinch an
 * installed app, so the pinch is also stopped here: Safari's own gesture
 * events, and any touch move with two or more fingers. One-finger scrolling
 * is untouched.
 */
export function lockAppFeel(): void {
  const stop = (e: Event) => e.preventDefault();
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, stop, { passive: false });
  }
  document.addEventListener(
    'touchmove',
    (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); },
    { passive: false },
  );
}
