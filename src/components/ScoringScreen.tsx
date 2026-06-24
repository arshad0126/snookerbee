import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGame } from '../engine/GameContext';
import type { BallType } from '../engine/types';
import {
  BALL_VALUES,
  isFrameOver,
} from '../engine';
import { audio } from '../lib/audio';
import OrientationWarning from './OrientationWarning';
import FoulDialog from './FoulDialog';
import ActionLogDrawer from './ActionLogDrawer';
import FrameSummary from './FrameSummary';

interface FrameHistoryItem {
  frameNumber: number;
  scores: Record<string, number>;
}

export default function ScoringScreen() {
  const { state, dispatch, setupGame } = useGame();
  const location = useLocation();
  const navigate = useNavigate();

  // Dialog / Drawer States
  const [isFoulOpen, setIsFoulOpen] = useState(false);
  const [isInOff, setIsInOff] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // Score pop animations
  const [poppingPlayerId, setPoppingPlayerId] = useState<string | null>(null);
  const prevScoresRef = useRef<Record<string, number>>({});

  // Frame score history tracking
  const [frameHistory, setFrameHistory] = useState<FrameHistoryItem[]>([]);

  // Initialize game setup from navigation state if available
  useEffect(() => {
    if (location.state?.config) {
      setupGame(location.state.config);
    } else if (state.players.length === 0) {
      // If no game is configured, redirect to setup
      navigate('/setup');
    }
  }, [location.state, state.players.length, setupGame, navigate]);

  // Audio initialization on first click
  useEffect(() => {
    const handleFirstInteraction = () => {
      audio.init();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  // Timer Tick and player timing
  useEffect(() => {
    if (state.phase === 'finished' || state.players.length === 0) return;

    const interval = setInterval(() => {
      const nextMatchTime = state.matchTimerMs + 1000;
      const activePlayerIndex = state.turnOrder[state.currentPlayerIndex];
      const updatedPlayers = state.players.map((p, idx) => {
        if (idx === activePlayerIndex) {
          return { ...p, timeSpentMs: p.timeSpentMs + 1000 };
        }
        return p;
      });

      dispatch({
        type: 'SET_STATE',
        state: {
          ...state,
          matchTimerMs: nextMatchTime,
          players: updatedPlayers,
        },
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state, dispatch]);

  // Handle score pop animation when scores increase
  useEffect(() => {
    if (state.players.length === 0) return;

    state.players.forEach(p => {
      const prevScore = prevScoresRef.current[p.id] ?? 0;
      if (p.score > prevScore) {
        setPoppingPlayerId(p.id);
        const timer = setTimeout(() => setPoppingPlayerId(null), 500);
        return () => clearTimeout(timer);
      }
    });

    const newScores: Record<string, number> = {};
    state.players.forEach(p => {
      newScores[p.id] = p.score;
    });
    prevScoresRef.current = newScores;
  }, [state.players]);

  if (state.players.length === 0) {
    return (
      <div className="page page-centered">
        <div className="spinner" />
      </div>
    );
  }

  // Active Player Lookup
  const activePlayer = state.players[state.turnOrder[state.currentPlayerIndex]];

  // Format Timer
  const formatTimer = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  // Ball Selection Eligibility Helper
  const isBallEnabled = (ball: BallType): boolean => {
    if (state.phase === 'finished') return false;
    if (state.phase === 'respottedBlack') return ball === 'black';
    if (state.phase === 'colorsInOrder') return ball === state.currentColorTarget;
    if (state.phase === 'finalColor') return ball !== 'red';
    if (state.phase === 'reds') {
      if (state.expectedBall === 'red') return ball === 'red';
      if (state.expectedBall === 'color') return ball !== 'red';
    }
    if (state.isFreeBall) return true;
    return false;
  };

  // Ball Pot Handler
  const handlePotBall = (ball: BallType) => {
    audio.playPot();
    dispatch({ type: 'POT_BALL', ball });

    // Check for break milestones
    const nextBreak = activePlayer.currentBreak + BALL_VALUES[ball];
    if ([25, 50, 100].includes(nextBreak)) {
      setTimeout(() => audio.playBreakMilestone(), 300);
    }
  };

  // Foul Dialog Confirm
  const handleConfirmFoul = (ball: BallType) => {
    setIsFoulOpen(false);
    audio.playFoul();
    if (isInOff) {
      dispatch({ type: 'IN_OFF', ballInvolved: ball });
    } else {
      dispatch({ type: 'FOUL', ballInvolved: ball });
    }
  };

  // Miss Handler
  const handleMiss = () => {
    audio.playMiss();
    dispatch({ type: 'MISS' });
  };

  // Undo Handler
  const handleUndo = () => {
    if (state.undoStack.length > 0) {
      audio.playUndo();
      dispatch({ type: 'UNDO' });
    }
  };

  // Frame transition handlers
  const handleNextFrame = () => {
    // Save current scores to frameHistory before resetting
    const currentScores: Record<string, number> = {};
    if (state.mode === 'team') {
      state.teams.forEach(t => {
        currentScores[t.name] = t.totalScore;
      });
    } else {
      state.players.forEach(p => {
        currentScores[p.name] = p.score;
      });
    }

    setFrameHistory(prev => [
      ...prev,
      { frameNumber: state.frameNumber, scores: currentScores },
    ]);

    dispatch({ type: 'START_NEXT_FRAME' });
  };

  const handleEndMatch = () => {
    // Append last frame's scores to history before summary navigation
    const currentScores: Record<string, number> = {};
    if (state.mode === 'team') {
      state.teams.forEach(t => {
        currentScores[t.name] = t.totalScore;
      });
    } else {
      state.players.forEach(p => {
        currentScores[p.name] = p.score;
      });
    }

    const finalFrameHistory = [
      ...frameHistory,
      { frameNumber: state.frameNumber, scores: currentScores },
    ];

    navigate('/summary', {
      state: {
        gameState: state,
        frameHistory: finalFrameHistory,
      },
    });
  };

  // Remaining Points Calculator helper
  const getPointsOnTable = () => {
    if (state.phase === 'reds') {
      return (state.redsRemaining * 8) + 27;
    }
    if (state.phase === 'finalColor') {
      return 27; // all 6 colors
    }
    if (state.phase === 'colorsInOrder') {
      const colors = ['yellow', 'green', 'brown', 'blue', 'pink', 'black'] as BallType[];
      const targetIndex = colors.indexOf(state.currentColorTarget || 'yellow');
      if (targetIndex === -1) return 0;
      return colors.slice(targetIndex).reduce((sum, c) => sum + BALL_VALUES[c], 0);
    }
    if (state.phase === 'respottedBlack') {
      return 7;
    }
    return 0;
  };

  const showFrameSummary = isFrameOver(state) || state.phase === 'finished';

  const ballsList: BallType[] = ['red', 'yellow', 'green', 'brown', 'blue', 'pink', 'black'];

  const getMatchLead = () => {
    if (state.players.length === 0) return 0;
    
    // For teams mode, calculate lead between teams
    if (state.mode === 'team' && state.teams) {
      const teamAScore = state.teams[0].totalScore;
      const teamBScore = state.teams[1].totalScore;
      const activeTeamIndex = state.teams[0].playerIds.includes(activePlayer.id) ? 0 : 1;
      
      if (activeTeamIndex === 0) {
        return teamAScore - teamBScore;
      } else {
        return teamBScore - teamAScore;
      }
    }

    const scores = state.players.map(p => p.score);
    const maxScore = Math.max(...scores);
    if (activePlayer.score === maxScore) {
      const otherScores = state.players.filter(p => p.id !== activePlayer.id).map(p => p.score);
      const secondMax = otherScores.length > 0 ? Math.max(...otherScores) : 0;
      return activePlayer.score - secondMax;
    } else {
      return activePlayer.score - maxScore;
    }
  };

  const getBallLabel = (ball: BallType) => {
    switch (ball) {
      case 'red': return 'RED';
      case 'yellow': return 'YEL';
      case 'green': return 'GRN';
      case 'brown': return 'BRN';
      case 'blue': return 'BLU';
      case 'pink': return 'PNK';
      case 'black': return 'BLK';
      default: return '';
    }
  };

  const renderOnBallIndicator = () => {
    if (state.isFreeBall) {
      return <span className="on-ball-text-label free-ball">FREE BALL</span>;
    }
    
    const ballColor = state.phase === 'reds'
      ? (state.expectedBall === 'red' ? 'red' : 'color')
      : (state.phase === 'colorsInOrder' ? state.currentColorTarget : 'black');
      
    if (ballColor === 'color') {
      return <span className="on-ball-text-label color-any">COLOR</span>;
    }
    
    if (!ballColor) return <span className="on-ball-text-label">NONE</span>;
    
    return (
      <div className="on-ball-indicator-wrapper">
        <span className={`tiny-ball-sphere ball-${ballColor}`} />
        <span className={`on-ball-text text-${ballColor}`}>{ballColor.toUpperCase()}</span>
      </div>
    );
  };

  const renderPlayerList = () => {
    if (state.mode === 'team' && state.teams) {
      return state.teams.map((t, idx) => {
        const activeTeamPlayer = state.players[state.turnOrder[state.currentPlayerIndex]];
        const isActive = t.playerIds.includes(activeTeamPlayer.id);
        const isPopping = t.playerIds.includes(poppingPlayerId || '');
        const frameWins = state.frameScores[t.id] || 0;
        
        const firstPlayer = state.players.find(p => p.id === t.playerIds[0]);
        const firstPlayerName = firstPlayer ? firstPlayer.name : '';
        
        return (
          <div
            key={t.id}
            className={`player-panel-horizontal ${isActive ? 'active' : ''}`}
          >
            <div className="player-card-meta">
              <div className="player-avatar-circle team-avatar">
                {t.name.charAt(idx === 0 ? 5 : 5).toUpperCase() || 'T'}
              </div>
              <div className="player-card-name-wrapper">
                <span className="player-card-name">{t.name}</span>
                <span className="player-team-active-member">
                  ({isActive ? activeTeamPlayer.name : firstPlayerName})
                </span>
                {isActive && <span className="glowing-active-dot"></span>}
              </div>
              <span className="player-card-wins">W: {frameWins}</span>
            </div>
            
            <div className={`player-card-score ${isPopping ? 'score-pop' : ''}`}>
              {t.totalScore}
            </div>

            <div className="player-card-stats">
              <span className="player-card-timer">
                ⏱ {formatTimer(isActive ? activeTeamPlayer.timeSpentMs : 0)}
              </span>
              <span className="player-card-break">
                {isActive && activeTeamPlayer.currentBreak > 0 
                  ? `Break: ${activeTeamPlayer.currentBreak}` 
                  : `B: 0`}
              </span>
            </div>
          </div>
        );
      });
    }

    // 1v1 and Free For All
    return state.players.map((p, pIdx) => {
      const isActive = activePlayer.id === p.id;
      const isPopping = poppingPlayerId === p.id;
      const isBreaker = state.turnOrder[0] === pIdx;
      const frameWins = state.frameScores[p.id] || 0;

      return (
        <div
          key={p.id}
          className={`player-panel-horizontal ${isActive ? 'active' : ''}`}
        >
          <div className="player-card-meta">
            <div className="player-avatar-circle">
              {p.name.charAt(0).toUpperCase()}
            </div>
            <div className="player-card-name-wrapper">
              <span className="player-card-name">{p.name}</span>
              {isBreaker && <span className="breaker-icon-dot" title="Breaker">B</span>}
              {isActive && <span className="glowing-active-dot"></span>}
            </div>
            <span className="player-card-wins">W: {frameWins}</span>
          </div>
          
          <div className={`player-card-score ${isPopping ? 'score-pop' : ''}`}>
            {p.score}
          </div>

          <div className="player-card-stats">
            <span className="player-card-timer">⏱ {formatTimer(p.timeSpentMs)}</span>
            <span className="player-card-break">
              {p.currentBreak > 0 ? `Break: ${p.currentBreak}` : `B: 0`}
            </span>
          </div>
        </div>
      );
    });
  };

  return (
    <div className="scoring-screen felt-bg">
      <OrientationWarning />

      {/* Top Bar */}
      <header className="scoring-topbar">
        <div className="scoring-topbar-left">
          <span className="frame-pill">Frame {state.frameNumber}</span>
          <div className="session-name-wrapper">
            <span className="session-title">SnookerBee</span>
            <span className="sync-status">
              <span className="sync-dot"></span> Synced
            </span>
          </div>
        </div>

        <div className="scoring-topbar-center">
          <span className="match-timer-display">⏱ {formatTimer(state.matchTimerMs)}</span>
        </div>

        <div className="scoring-topbar-right">
          <button onClick={() => setIsMenuOpen(true)} className="btn-topbar-icon" title="Menu">
            ⚙️
          </button>
          <button onClick={() => setIsLogOpen(true)} className="btn-topbar-icon" title="Timeline & Log">
            📋
          </button>
          <button
            onClick={() => {
              if (window.confirm('Concede this frame?')) {
                dispatch({ type: 'CONCEDE_FRAME' });
              }
            }}
            className="btn-end-frame"
          >
            End Frame
          </button>
        </div>
      </header>

      {/* Main Scoring Section */}
      <div className="scoring-multiplayer-container">
        <div className="multiplayer-players-list">
          {renderPlayerList()}
        </div>

        {/* Info / Status Bar */}
        <div className="scoring-status-bar">
          <div className="status-bar-item">
            <span className="status-bar-label">ON:</span>
            {renderOnBallIndicator()}
          </div>
          <div className="status-bar-item">
            <span className="status-bar-label">REDS:</span>
            <span className="status-bar-value highlight-red">{state.redsRemaining}</span>
          </div>
          <div className="status-bar-item">
            <span className="status-bar-label">POINTS LEFT:</span>
            <span className="status-bar-value highlight-green">{getPointsOnTable()}</span>
          </div>
          <div className="status-bar-item">
            <span className="status-bar-label">LEAD:</span>
            <span className="status-bar-value highlight-yellow">{getMatchLead()}</span>
          </div>
          <div className="status-bar-item">
            <span className="status-bar-label">STRIKER:</span>
            <span className="status-bar-value highlight-white">{activePlayer.name}</span>
          </div>
          <span className="active-match-pill">ACTIVE</span>
        </div>

        {/* Central Controls Area */}
        <div className="scoring-controls-center">
          {/* Ball cards row */}
          <div className="scoring-ball-cards-row">
            {ballsList.map(ball => {
              const enabled = isBallEnabled(ball);
              const isExpected =
                (state.expectedBall === ball && state.phase === 'reds') ||
                (state.currentColorTarget === ball && state.phase === 'colorsInOrder') ||
                (state.phase === 'respottedBlack' && ball === 'black');

              const ballPoints = BALL_VALUES[ball];
              const ballLabel = getBallLabel(ball);

              return (
                <button
                  key={ball}
                  onClick={() => enabled && handlePotBall(ball)}
                  disabled={!enabled}
                  className={`scoring-ball-card ball-${ball} ${!enabled ? 'dimmed' : ''} ${
                    isExpected ? 'expected' : ''
                  }`}
                >
                  <span className="ball-card-name">{ballLabel}</span>
                  <span className="ball-card-points">+{ballPoints}</span>
                  {ball === 'red' && state.redsRemaining > 0 && (
                    <span className="ball-card-red-count">{state.redsRemaining}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Action buttons row */}
          <div className="action-buttons-row-premium">
            <button
              onClick={handleUndo}
              disabled={state.undoStack.length === 0}
              className="btn-action-premium btn-action-undo"
            >
              ↩ UNDO
            </button>
            <button
              onClick={() => {
                setIsInOff(false);
                setIsFoulOpen(true);
              }}
              className="btn-action-premium btn-action-foul"
            >
              ⚠️ FOUL
            </button>
            <button onClick={handleMiss} className="btn-action-premium btn-action-pass">
              PASS ➔
            </button>
          </div>

          {/* Reset Frame action */}
          <div className="reset-frame-container">
            <button
              onClick={() => {
                if (window.confirm('Reset this frame? All current frame scores will be lost.')) {
                  dispatch({ type: 'START_NEXT_FRAME' });
                }
              }}
              className="btn-reset-frame"
            >
              Reset Frame
            </button>
          </div>
        </div>
      </div>

      {/* Foul entry Dialog */}
      <FoulDialog
        isOpen={isFoulOpen}
        isInOff={isInOff}
        gameState={state}
        onConfirm={handleConfirmFoul}
        onCancel={() => setIsFoulOpen(false)}
      />

      {/* Action Log Drawer */}
      <ActionLogDrawer
        isOpen={isLogOpen}
        onClose={() => setIsLogOpen(false)}
        actionLog={state.actionLog}
        frameStartTime={new Date(state.frameStartTime).getTime()}
      />

      {/* Menu Overlay / Sidebar */}
      {isMenuOpen && (
        <div className="modal-backdrop" onClick={() => setIsMenuOpen(false)}>
          <div className="menu-overlay-card card" onClick={e => e.stopPropagation()}>
            <h3 className="menu-title">Match Options</h3>
            <div className="menu-options-list">
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  dispatch({ type: 'FREE_BALL' });
                }}
                className={`btn btn-secondary ${state.isFreeBall ? 'active' : ''}`}
              >
                {state.isFreeBall ? '✓ Disable Free Ball' : '⭐ Award Free Ball'}
              </button>
              <button
                onClick={() => {
                  setIsMenuOpen(false);
                  dispatch({ type: 'CONCEDE_FRAME' });
                }}
                className="btn btn-secondary"
              >
                🏳 Concede Frame
              </button>
              <button
                onClick={() => {
                  if (window.confirm('End this match now? It will not be saved.')) {
                    navigate('/dashboard');
                  }
                }}
                className="btn btn-danger"
              >
                🚪 Abort Match
              </button>
            </div>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="btn btn-ghost"
              style={{ marginTop: 'var(--space-md)' }}
            >
              Resume Play
            </button>
          </div>
        </div>
      )}

      {/* Frame Summary Overlay */}
      {showFrameSummary && (
        <FrameSummary
          gameState={state}
          onNextFrame={handleNextFrame}
          onEndMatch={handleEndMatch}
        />
      )}
    </div>
  );
}
