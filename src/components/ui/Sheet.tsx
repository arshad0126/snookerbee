import {
  useCallback, useEffect, useRef, useState,
  type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

export type SheetDetent = 'medium' | 'large';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  detent?: SheetDetent;
  title?: ReactNode;
  children: ReactNode;
}

const CLOSE_THRESHOLD = 96; // px dragged before a release dismisses

export function Sheet({ open, onClose, detent = 'medium', title, children }: SheetProps) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const dragStartY = useRef<number | null>(null);

  // Mount on open; keep mounted through the close animation.
  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    setVisible(false);
    const t = window.setTimeout(() => setMounted(false), 300);
    return () => window.clearTimeout(t);
  }, [open]);

  // Escape to dismiss.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const onPointerDown = useCallback((e: ReactPointerEvent) => {
    dragStartY.current = e.clientY;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e: ReactPointerEvent) => {
    if (dragStartY.current === null) return;
    setDragOffset(Math.max(0, e.clientY - dragStartY.current));
  }, []);

  const onPointerUp = useCallback(() => {
    if (dragStartY.current === null) return;
    const shouldClose = dragOffset > CLOSE_THRESHOLD;
    dragStartY.current = null;
    setDragOffset(0);
    if (shouldClose) onClose();
  }, [dragOffset, onClose]);

  if (!mounted) return null;

  const height = detent === 'large' ? '92dvh' : '50dvh';
  const sheetStyle = {
    height,
    '--sheet-offset': `${dragOffset}px`,
  } as CSSProperties;

  return createPortal(
    <>
      <div
        className={`ui-sheet-scrim ${visible ? 'is-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={`ui-sheet ${visible ? 'is-open' : ''}`}
        style={sheetStyle}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
      >
        <div
          className="ui-sheet-grabber-hit"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{ touchAction: 'none', cursor: 'grab', paddingBottom: 'var(--space-1)' }}
        >
          <div className="ui-sheet-grabber" />
        </div>
        <div className="ui-sheet-body">{children}</div>
      </div>
    </>,
    document.body,
  );
}
