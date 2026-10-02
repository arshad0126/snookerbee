import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSettings } from './useSettings';
import { Icon } from '../components/ui';

/** A second Undo inside this window is a finger bounce, not intent. */
const DOUBLE_TAP_MS = 500;
/** How long the "Undone · Redo" bar stays up. */
const BAR_MS = 4000;

interface Options {
  /** What Undo would take back right now, or null when there's nothing. */
  describe: () => string | null;
  undo: () => void;
  redo: () => void;
}

/**
 * Undo with three safety nets: a double-tap guard, an optional "Ask before
 * undo" confirm (Settings), and a 4-second bar naming what was undone with
 * a Redo button.
 */
export function useUndoControls({ describe, undo, redo }: Options) {
  const { settings } = useSettings();
  const lastUndoAt = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const [bar, setBar] = useState<{ label: string; key: number } | null>(null);

  const hideBar = useCallback(() => {
    window.clearTimeout(timer.current);
    setBar(null);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onUndo = useCallback(() => {
    const now = Date.now();
    if (now - lastUndoAt.current < DOUBLE_TAP_MS) return;
    const label = describe();
    if (!label) return;
    if (settings.confirmUndo && !window.confirm(`Undo this?\n\n${label}`)) return;
    lastUndoAt.current = Date.now();
    undo();
    window.clearTimeout(timer.current);
    setBar({ label, key: now });
    timer.current = window.setTimeout(() => setBar(null), BAR_MS);
  }, [describe, undo, settings.confirmUndo]);

  const onRedo = useCallback(() => {
    redo();
    hideBar();
  }, [redo, hideBar]);

  const undoBar = bar
    ? createPortal(
        <div className="undo-bar" role="status" aria-live="polite" key={bar.key}>
          <Icon name="arrow-left" size={15} />
          <span className="undo-bar-msg">
            Undone: <b>{bar.label}</b>
          </span>
          <button type="button" className="undo-bar-redo" onClick={onRedo}>
            Redo
          </button>
          <button type="button" className="undo-bar-close" onClick={hideBar} aria-label="Dismiss">
            <Icon name="close" size={14} />
          </button>
        </div>,
        document.body
      )
    : null;

  return { onUndo, undoBar };
}
