import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGame } from '../engine/GameContext';
import { useTheme } from '../hooks/useTheme';
import type { BallType, Player } from '../engine/types';
import {
  BALL_VALUES,
  isFrameOver,
  getPointsRemaining,
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
  const { theme, toggleTheme } = useTheme();

  // Dialog / Drawer States
  const [isFoulOpen, setIsFoulOpen] = useState(false);
  const [isInOff, setIsInOff] = useState(false);
  const [isLogOpen, setIsLogOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNextFrameSetupOpen, setIsNextFrameSetupOpen] = useState(false);
  const [nextFrameBreakerId, setNextFrameBreakerId] = useState('');
  const [nextFramePlayersOrder, setNextFramePlayersOrder] = useState<Player[]>([]);

  // Score pop animations
  const [poppingPlayerId, setPoppingPlayerId] = useState<string | null>(null);
  const prevScoresRef = useRef<Record<string, number>>({});

  // Frame score history tracking
  const [frameHistory, setFrameHistory] = useState<FrameHistoryItem[]>([]);

  // Visit timer state
  const [visitTimeMs, setVisitTimeMs] = useState(0);

  // Reset visit timer on turn change or frame reset
  useEffect(() => {
    setVisitTimeMs(0);
  }, [state.currentPlayerIndex, state.frameNumber]);

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
      setVisitTimeMs(prev => prev + 1000);
      dispatch({ type: 'UPDATE_TIMER' });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.phase, state.players.length, dispatch]);

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

  // Format Visit Timer
  const formatVisitTimer = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
    const ss = String(totalSeconds % 60).padStart(2, '0');
    return `V: ${mm}:${ss} (${totalSeconds}s)`;
  };

  // Ball Selection Eligibility Helper
  const isBallEnabled = (ball: BallType): boolean => {
    if (state.phase === 'finished') return false;
    if (state.phase === 'respottedBlack') return ball === 'black';
    if (state.phase === 'colorsInOrder') return ball === state.currentColorTarget;
    if (state.phase === 'finalColor') return ball !== 'red';
    if (state.phase === 'reds') {
      if (state.expectedBall === 'red') return ball === 'red' && state.redsRemaining > 0;
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
  const handleConfirmFoul = (ball: BallType, customPenalty: number, redPottedOnFoul: boolean) => {
    setIsFoulOpen(false);
    audio.playFoul();
    if (isInOff) {
      dispatch({ type: 'IN_OFF', ballInvolved: ball, customPenalty, redPottedOnFoul });
    } else {
      dispatch({ type: 'FOUL', ballInvolved: ball, customPenalty, redPottedOnFoul });
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

    // Initialize next frame player order
    setNextFramePlayersOrder([...state.players]);
    
    // Default selected breaker is standard rotation index
    const autoNextBreakerIdx = state.frameNumber % state.turnOrder.length;
    const defaultBreakerId = state.players[state.turnOrder[autoNextBreakerIdx]]?.id || state.players[0].id;
    setNextFrameBreakerId(defaultBreakerId);

    setIsNextFrameSetupOpen(true);
  };

  const handleConfirmNextFrameSetup = () => {
    setIsNextFrameSetupOpen(false);
    dispatch({
      type: 'START_NEXT_FRAME',
      payload: {
        breakingPlayerId: nextFrameBreakerId,
        turnOrderIds: nextFramePlayersOrder.map(p => p.id),
      }
    });
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
    return getPointsRemaining(state);
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
        const isBreaker = state.teams[0].playerIds.includes(state.players[state.turnOrder[0]].id) ? idx === 0 : idx === 1;

        return (
          <div
            key={t.id}
            className={`player-panel-horizontal ${isActive ? 'active' : ''}`}
          >
            <div className="player-card-top">
              <div className="player-card-meta-left">
                <div className="player-avatar-circle team-avatar">
                  {t.name.charAt(0).toUpperCase() || 'T'}
                </div>
                <div className="player-card-name-wrapper">
                  <span className="player-card-name">{t.name}</span>
                  <span className="player-team-active-member">
                    ({isActive ? activeTeamPlayer.name : firstPlayerName})
                  </span>
                  {isActive && <span className="glowing-active-dot"></span>}
                </div>
                {isBreaker && <span className="breaker-badge">B</span>}
              </div>
              <span className="player-card-wins">W: {frameWins}</span>
            </div>
            
            <div className="player-card-middle">
              <div className={`player-score-pill ${isPopping ? 'score-pop' : ''}`}>
                {t.totalScore}
              </div>
              {isActive && activeTeamPlayer.currentBreak > 0 && (
                <div className="player-break-badge">
                  Break: {activeTeamPlayer.currentBreak}
                </div>
              )}
            </div>

            <div className="player-card-bottom">
              <span className="player-card-timer">
                ⏱ {formatTimer(isActive ? activeTeamPlayer.timeSpentMs : 0)}
              </span>
              {isActive && (
                <span className="player-card-visit">{formatVisitTimer(visitTimeMs)}</span>
              )}
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
          <div className="player-card-top">
            <div className="player-card-meta-left">
              <div className="player-avatar-circle">
                {p.name.charAt(0).toUpperCase()}
              </div>
              <div className="player-card-name-wrapper">
                <span className="player-card-name">{p.name}</span>
                {isActive && <span className="glowing-active-dot"></span>}
              </div>
              {isBreaker && <span className="breaker-badge">B</span>}
            </div>
            <span className="player-card-wins">W: {frameWins}</span>
          </div>
          
          <div className="player-card-middle">
            <div className={`player-score-pill ${isPopping ? 'score-pop' : ''}`}>
              {p.score}
            </div>
            {p.currentBreak > 0 && (
              <div className="player-break-badge">
                Break: {p.currentBreak}
              </div>
            )}
          </div>

          <div className="player-card-bottom">
            <span className="player-card-timer">⏱ {formatTimer(p.timeSpentMs)}</span>
            {isActive && (
              <span className="player-card-visit">{formatVisitTimer(visitTimeMs)}</span>
            )}
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
          <span className="match-timer-display" title="Current Frame Time">⏱ {formatTimer(state.currentFrameDurationMs)}</span>
        </div>

        <div className="scoring-topbar-right">
          <button onClick={toggleTheme} className="btn-topbar-icon" title="Toggle Theme">
            {theme === 'dark' ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"></circle>
                <line x1="12" y1="1" x2="12" y2="3"></line>
                <line x1="12" y1="21" x2="12" y2="23"></line>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
                <line x1="1" y1="12" x2="3" y2="12"></line>
                <line x1="21" y1="12" x2="23" y2="12"></line>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
              </svg>
            )}
          </button>
          <button onClick={() => setIsMenuOpen(true)} className="btn-topbar-icon" title="Menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"></line>
              <line x1="12" y1="20" x2="12" y2="4"></line>
              <line x1="6" y1="20" x2="6" y2="14"></line>
            </svg>
          </button>
          <button onClick={() => setIsLogOpen(true)} className="btn-topbar-icon" title="Timeline & Log">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
              <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              <line x1="9" y1="12" x2="15" y2="12"></line>
              <line x1="9" y1="16" x2="15" y2="16"></line>
              <line x1="9" y1="8" x2="10" y2="8"></line>
            </svg>
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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '4px'}}>
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                <path d="M3 3v5h5"/>
              </svg>
              UNDO
            </button>
            <button
              onClick={() => {
                setIsInOff(false);
                setIsFoulOpen(true);
              }}
              className="btn-action-premium btn-action-foul"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '4px'}}>
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              FOUL
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
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: '4px', verticalAlign: 'middle'}}>
                <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
              </svg>
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

      {/* Next Frame Configuration Dialog */}
      {isNextFrameSetupOpen && (
        <div className="modal-backdrop modal-centered" style={{ zIndex: 9999 }}>
          <div className="menu-overlay-card card" style={{ maxWidth: '440px', padding: 'var(--space-md)' }} onClick={e => e.stopPropagation()}>
            <header style={{ marginBottom: 'var(--space-md)' }}>
              <h3 className="menu-title" style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Frame {state.frameNumber + 1} Configuration</h3>
            </header>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', margin: '0 0 var(--space-sm) 0', lineHeight: '1.4' }}>
                Set the breaking player and turn rotation order for the upcoming frame.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {nextFramePlayersOrder.map((player, idx) => {
                  const isBreaker = nextFrameBreakerId === player.id;
                  return (
                    <div
                      key={player.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: 'var(--space-sm)',
                        borderRadius: 'var(--radius-md)',
                        background: isBreaker ? 'rgba(78, 149, 255, 0.1)' : 'var(--bg-secondary)',
                        border: `1px solid ${isBreaker ? 'var(--accent-sage)' : 'var(--border-color)'}`
                      }}
                    >
                      {/* Arrows for rearrangement in FFA mode */}
                      {state.mode === 'freeForAll' ? (
                        <div style={{ display: 'flex', gap: '4px', marginRight: '8px' }}>
                          <button
                            onClick={() => {
                              if (idx === 0) return;
                              const rearranged = [...nextFramePlayersOrder];
                              const temp = rearranged[idx];
                              rearranged[idx] = rearranged[idx - 1];
                              rearranged[idx - 1] = temp;
                              setNextFramePlayersOrder(rearranged);
                            }}
                            disabled={idx === 0}
                            style={{
                              padding: '2px 6px',
                              background: 'none',
                              border: 'none',
                              color: idx === 0 ? 'var(--text-muted)' : 'var(--text-secondary)',
                              cursor: idx === 0 ? 'not-allowed' : 'pointer'
                            }}
                          >
                            ▲
                          </button>
                          <button
                            onClick={() => {
                              if (idx === nextFramePlayersOrder.length - 1) return;
                              const rearranged = [...nextFramePlayersOrder];
                              const temp = rearranged[idx];
                              rearranged[idx] = rearranged[idx + 1];
                              rearranged[idx + 1] = temp;
                              setNextFramePlayersOrder(rearranged);
                            }}
                            disabled={idx === nextFramePlayersOrder.length - 1}
                            style={{
                              padding: '2px 6px',
                              background: 'none',
                              border: 'none',
                              color: idx === nextFramePlayersOrder.length - 1 ? 'var(--text-muted)' : 'var(--text-secondary)',
                              cursor: idx === nextFramePlayersOrder.length - 1 ? 'not-allowed' : 'pointer'
                            }}
                          >
                            ▼
                          </button>
                        </div>
                      ) : null}

                      <span style={{ flex: 1, fontWeight: '600', color: 'var(--text-primary)', fontSize: 'var(--text-sm)' }}>
                        {idx + 1}. {player.name}
                      </span>

                      <button
                        onClick={() => setNextFrameBreakerId(player.id)}
                        className={`btn-breaker ${isBreaker ? 'active' : ''}`}
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: `1px solid ${isBreaker ? 'var(--accent-sage-dark)' : 'var(--border-color)'}`,
                          cursor: 'pointer',
                          fontSize: 'var(--text-xs)',
                          fontWeight: '700',
                          background: isBreaker ? 'var(--accent-sage)' : 'var(--bg-btn-secondary)',
                          color: isBreaker ? '#ffffff' : 'var(--text-secondary)'
                        }}
                      >
                        {isBreaker ? 'Breaker' : 'Set Breaker'}
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                className="btn btn-primary"
                onClick={handleConfirmNextFrameSetup}
                style={{ width: '100%', marginTop: 'var(--space-md)', padding: '12px', fontWeight: 'bold' }}
              >
                Start Frame 🎱
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
