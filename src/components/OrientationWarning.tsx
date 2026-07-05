import { useState, useEffect } from 'react';

export default function OrientationWarning() {
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      const nowPortrait = window.innerHeight > window.innerWidth;
      setIsPortrait(nowPortrait);
      // If user rotates to landscape, auto-dismiss so banner doesn't flash back
      if (!nowPortrait) {
        setIsDismissed(true);
      }
    };

    window.addEventListener('resize', handleResize);

    // Try to lock orientation to landscape (where supported)
    try {
      if (window.screen.orientation && window.screen.orientation.lock) {
        window.screen.orientation.lock('landscape').catch(() => {
          // Ignore orientation lock failures (common on browsers / iOS)
        });
      }
    } catch {
      // Ignore errors
    }

    // Try to request fullscreen for immersive landscape experience
    try {
      const doc = document.documentElement;
      if (doc.requestFullscreen && !document.fullscreenElement) {
        doc.requestFullscreen().catch(() => {
          // Ignore fullscreen failures — not all contexts support it
        });
      }
    } catch {
      // Ignore errors
    }

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Don't show if already landscape, dismissed, or not portrait
  if (!isPortrait || isDismissed) return null;

  return (
    <div className="orientation-banner">
      <div className="orientation-banner-content">
        <span className="orientation-banner-icon">📱</span>
        <span className="orientation-banner-text">
          Rotate to landscape for the best scoring experience
        </span>
      </div>
      <button
        className="orientation-banner-dismiss"
        onClick={() => setIsDismissed(true)}
        title="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
