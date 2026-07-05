import type { CompletedFrame } from '../engine/types';

interface PreviousFramesModalProps {
  isOpen: boolean;
  onClose: () => void;
  completedFrames: CompletedFrame[];
}

export default function PreviousFramesModal({
  isOpen,
  onClose,
  completedFrames,
}: PreviousFramesModalProps) {
  if (!isOpen) return null;

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  return (
    <div className="modal-backdrop modal-centered" onClick={onClose}>
      <div
        className="prev-frames-modal card"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="prev-frames-header">
          <h3 className="prev-frames-title">Previous Frames</h3>
          <button onClick={onClose} className="prev-frames-close-btn" title="Close">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="prev-frames-content">
          {completedFrames.length === 0 ? (
            <div className="prev-frames-empty">
              <span className="prev-frames-empty-icon">🎱</span>
              <p className="prev-frames-empty-text">No completed frames yet.</p>
              <p className="prev-frames-empty-subtext">Frame summaries will appear here after each completed frame.</p>
            </div>
          ) : (
            <div className="prev-frames-list">
              {completedFrames.map((frame) => (
                <div key={frame.frameNumber} className="prev-frame-card">
                  {/* Frame Header */}
                  <div className="prev-frame-header">
                    <span className="prev-frame-number">Frame {frame.frameNumber}</span>
                    <div className="prev-frame-header-right">
                      {frame.durationMs > 0 && (
                        <span className="prev-frame-duration">
                          ⏱ {formatDuration(frame.durationMs)}
                        </span>
                      )}
                      {frame.winnerName && (
                        <span className="prev-frame-winner-badge">
                          🏆 {frame.winnerName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Player Stats */}
                  <div className="prev-frame-players">
                    {frame.playerStats.map((ps) => {
                      const isWinner = ps.playerId === frame.winnerId;
                      return (
                        <div
                          key={ps.playerId}
                          className={`prev-frame-player-row ${isWinner ? 'winner' : ''}`}
                        >
                          <div className="prev-frame-player-name-area">
                            <span className="prev-frame-player-avatar">
                              {ps.playerName.charAt(0).toUpperCase()}
                            </span>
                            <span className="prev-frame-player-name">
                              {ps.playerName}
                              {isWinner && <span className="prev-frame-winner-icon">★</span>}
                            </span>
                          </div>
                          <div className="prev-frame-player-stats">
                            <div className="prev-frame-stat">
                              <span className="prev-frame-stat-value">{ps.score}</span>
                              <span className="prev-frame-stat-label">Score</span>
                            </div>
                            <div className="prev-frame-stat">
                              <span className="prev-frame-stat-value">{ps.highestBreak}</span>
                              <span className="prev-frame-stat-label">H. Break</span>
                            </div>
                            <div className="prev-frame-stat">
                              <span className="prev-frame-stat-value prev-frame-fouls-val">{ps.foulsCommitted}</span>
                              <span className="prev-frame-stat-label">Fouls</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
