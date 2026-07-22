import { useEffect, useState } from 'react';

/**
 * Dev-only overlay toggled with `?debug=layout`. Draws the 8pt grid and the
 * safe-area inset boundaries so spacing regressions are visible.
 */
export function LayoutDebug() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const check = () =>
      setOn(new URLSearchParams(window.location.search).get('debug') === 'layout');
    check();
    window.addEventListener('popstate', check);
    return () => window.removeEventListener('popstate', check);
  }, []);

  if (!on) return null;
  return (
    <>
      <div className="ui-debug-grid" aria-hidden="true" />
      <div className="ui-debug-safe" aria-hidden="true" />
    </>
  );
}
