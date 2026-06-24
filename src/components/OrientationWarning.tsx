import { useState, useEffect } from 'react';

export default function OrientationWarning() {
  const [isPortrait, setIsPortrait] = useState(window.innerHeight > window.innerWidth);

  useEffect(() => {
    const handleResize = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
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

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  if (!isPortrait) return null;

  return (
    <div className="orientation-warning">
      <div className="orientation-content">
        <div className="orientation-icon">📱</div>
        <h2 className="orientation-title">Rotate Your Device</h2>
        <p className="orientation-text">
          For the best scoring experience, please rotate to landscape mode.
        </p>
      </div>
    </div>
  );
}
