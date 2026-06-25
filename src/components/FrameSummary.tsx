import { useEffect, Fragment } from 'react';
import type { GameState } from '../engine/types';
import { isMatchOver } from '../engine/validators';
import { audio } from '../lib/audio';

interface FrameSummaryProps {
  gameState: GameState;
  onNextFrame: () => void;
  onEndMatch: () => void;
}

export default function FrameSummary({
  gameState,
  onNextFrame,
  onEndMatch,
}: FrameSummaryProps) {
  useEffect(() => {
    // Play victory sound on mount
    audio.playVictory();
  }, []);

  const { players, teams, mode } = gameState;

  // Determine winner of this frame
  // In snooker, the frame winner is the player (or team) with the highest score
  let winnerName = 'Unknown';
  let isTied = false;

  if (mode === 'team') {
    const teamA = teams[0];
    const teamB = teams[1];
    if (teamA && teamB) {
      if (teamA.totalScore > teamB.totalScore) {
        winnerName = teamA.name;
      } else if (teamB.totalScore > teamA.totalScore) {
        winnerName = teamB.name;
      } else {
        isTied = true;
      }
    }
  } else {
    // 1v1 or freeForAll
    let highestScore = -1;
    let winningPlayer = null;
    players.forEach(p => {
      if (p.score > highestScore) {
        highestScore = p.score;
        winningPlayer = p;
        isTied = false;
      } else if (p.score === highestScore) {
        isTied = true;
      }
    });

    if (winningPlayer && !isTied) {
      winnerName = (winningPlayer as { name: string }).name;
    } else if (isTied) {
      winnerName = 'Tied';
    }
  }

  const matchEnded = isMatchOver(gameState);

  const formatDuration = (start: string) => {
    const elapsed = Date.now() - new Date(start).getTime();
    const totalSeconds = Math.floor(elapsed / 1000);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  // Generate confetti items
  const confettiPieces = Array.from({ length: 30 }).map((_, idx) => {
    const style = {
      left: `${Math.random() * 100}%`,
      backgroundColor: ['#D32F2F', '#FBC02D', '#388E3C', '#1565C0', '#E91E63', '#7BA68A'][
        Math.floor(Math.random() * 6)
      ],
      animationDelay: `${Math.random() * 3}s`,
      animationDuration: `${2 + Math.random() * 2}s`,
    };
    return <div key={idx} className="confetti-piece" style={style} />;
  });

  return (
    <div className="summary-overlay">
      <div className="confetti-container">{confettiPieces}</div>

      <div className="summary-card card fadeInUp">
        <h2 className="summary-winner">
          {isTied ? (
            <span className="summary-winner-name">Frame Tied!</span>
          ) : (
            <>
              🏆 <span className="summary-winner-name">{winnerName}</span> wins the frame!
            </>
          )}
        </h2>

        <div className="summary-scores">
          {mode === 'team' ? (
            <>
              <div className="summary-player-score">
                <span className="summary-score-name">{teams[0]?.name}</span>
                <span className="summary-score-val">{teams[0]?.totalScore}</span>
              </div>
              <span className="summary-vs">vs</span>
              <div className="summary-player-score">
                <span className="summary-score-name">{teams[1]?.name}</span>
                <span className="summary-score-val">{teams[1]?.totalScore}</span>
              </div>
            </>
          ) : (
            players.map((p, i) => (
              <Fragment key={p.id}>
                <div className="summary-player-score">
                  <span className="summary-score-name">{p.name}</span>
                  <span className="summary-score-val">{p.score}</span>
                </div>
                {i < players.length - 1 && <span className="summary-vs">vs</span>}
              </Fragment>
            ))
          )}
        </div>

        <h3 className="summary-stats-title">Frame Stats</h3>
        <div className="summary-stats">
          <div className="summary-stat">
            <div className="summary-stat-value">
              {players.reduce((max, p) => Math.max(max, p.highestBreak), 0)}
            </div>
            <div className="summary-stat-label">Highest Break</div>
          </div>
          <div className="summary-stat">
            <div className="summary-stat-value">
              {players.reduce((sum, p) => sum + p.foulsCommitted, 0)}
            </div>
            <div className="summary-stat-label">Total Fouls</div>
          </div>
          <div className="summary-stat">
            <div className="summary-stat-value">{formatDuration(gameState.frameStartTime)}</div>
            <div className="summary-stat-label">Duration</div>
          </div>
        </div>

        <div className="summary-actions">
          {matchEnded ? (
            <button onClick={onEndMatch} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
              View Match Summary 🏆
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 'var(--space-md)', width: '100%' }}>
              <button onClick={onEndMatch} className="btn btn-secondary btn-lg" style={{ flex: 1 }}>
                End Match
              </button>
              <button onClick={onNextFrame} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
                Next Frame 🎱
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
