import { useEffect, useRef } from 'react';
import type { ActionLogEntry } from '../engine/types';

interface ActionLogDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  actionLog: ActionLogEntry[];
  frameStartTime: number;
}

export default function ActionLogDrawer({
  isOpen,
  onClose,
  actionLog,
  frameStartTime,
}: ActionLogDrawerProps) {
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, actionLog]);

  if (!isOpen) return null;

  const formatRelativeTime = (timestamp: string) => {
    const elapsedMs = Math.max(0, new Date(timestamp).getTime() - frameStartTime);
    const seconds = Math.floor(elapsedMs / 1000);
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const getLogClass = (type: string) => {
    switch (type) {
      case 'pot':
        return 'log-pot';
      case 'foul':
      case 'in_off':
        return 'log-foul';
      case 'undo':
        return 'log-undo';
      case 'frame_end':
      case 'concede':
        return 'log-frame';
      default:
        return 'log-turn';
    }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'pot':
        return '🟢';
      case 'foul':
      case 'in_off':
        return '🔴';
      case 'undo':
        return '🔵';
      case 'frame_end':
      case 'concede':
        return '🍑';
      default:
        return '⚪';
    }
  };

  return (
    <div className="action-log-overlay" onClick={onClose}>
      <div className="action-log-drawer card" onClick={(e) => e.stopPropagation()}>
        <div className="action-log-header">
          <h3 className="action-log-title">Action Log</h3>
          <button onClick={onClose} className="btn-close" aria-label="Close action log">
            ✕
          </button>
        </div>

        <div className="action-log-list">
          {actionLog.length === 0 ? (
            <div className="action-log-empty">No actions in this frame yet.</div>
          ) : (
            actionLog.map((entry, index) => (
              <div key={index} className={`action-log-entry ${getLogClass(entry.type)}`}>
                <span className="action-log-time">{formatRelativeTime(entry.timestamp)}</span>
                <span className="action-log-icon">{getLogIcon(entry.type)}</span>
                <span className="action-log-desc">{entry.description}</span>
              </div>
            ))
          )}
          <div ref={listEndRef} />
        </div>
      </div>
    </div>
  );
}
