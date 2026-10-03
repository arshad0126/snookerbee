import { useEffect, Fragment } from 'react';
import type { GameState } from '../engine/types';
import { framesDecided, isMatchClinched, isMatchOver } from '../engine/validators';
import { audio } from '../lib/audio';
import { Icon } from './ui';

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

  // Every frame played → the match is done. Someone may have clinched it
  // earlier; the remaining frames can still be played, or the match ended.
  const matchEnded = isMatchOver(gameState);
  const clinched = !matchEnded && isMatchClinched(gameState);
  const framesLeft = Math.max(0, gameState.bestOf - framesDecided(gameState));
  const leaderName = (() => {
    const [id] = Object.entries(gameState.frameScores).sort((a, b) => b[1] - a[1])[0] ?? [];
    return teams.find((t) => t.id === id)?.name ?? players.find((p) => p.id === id)?.name ?? '';
  })();

  /** Per-player time within this frame; resets when the next frame starts. */
  const formatFrameTime = (ms: number) => {
    const total = Math.floor(ms / 1000);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

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
      backgroundColor: ['#D32F2F', '#FBC02D', '#388E3C', '#1565C0', '#E91E63', '#D4AA7D'][
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
        <div className="summary-scroll">
        <h2 className="summary-winner">
          {isTied ? (
            <span className="summary-winner-name">Frame Tied!</span>
          ) : (
            <>
              <Icon name="trophy" size={22} /> <span className="summary-winner-name">{winnerName}</span> wins the frame!
            </>
          )}
        </h2>

        <div className={`summary-scores${mode !== 'team' && players.length > 2 ? ' summary-scores--many' : ''}`}>
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
                  <span className="summary-score-time">
                    {formatFrameTime(p.frameTimeMs)}
                  </span>
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
          {players.reduce((n, p) => n + p.centuries, 0) > 0 && (
            <div className="summary-stat summary-stat--milestone">
              <div className="summary-stat-value">
                {players.reduce((n, p) => n + p.centuries, 0)}
              </div>
              <div className="summary-stat-label">Centuries</div>
            </div>
          )}
          {players.reduce((n, p) => n + p.halfCenturies, 0) > 0 && (
            <div className="summary-stat summary-stat--milestone">
              <div className="summary-stat-value">
                {players.reduce((n, p) => n + p.halfCenturies, 0)}
              </div>
              <div className="summary-stat-label">Fifties</div>
            </div>
          )}
        </div>
        </div>

        {clinched && (
          <p className="summary-clinched">
            {leaderName} has won the match. Play the last {framesLeft === 1 ? 'frame' : `${framesLeft} frames`} or end it here.
          </p>
        )}

        <div className="summary-actions">
          {matchEnded ? (
            <button onClick={onEndMatch} className="btn btn-primary btn-lg" style={{ width: '100%' }}>
              View Match Summary <Icon name="trophy" size={18} />
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 'var(--space-md)', width: '100%' }}>
              <button onClick={onEndMatch} className="btn btn-secondary btn-lg" style={{ flex: 1 }}>
                End Match
              </button>
              <button onClick={onNextFrame} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
                Next Frame <Icon name="ball" size={18} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
