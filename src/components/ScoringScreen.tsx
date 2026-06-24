import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGame } from '../engine/GameContext';
import type { BallType, Player, Team } from '../engine/types';
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

  // Render individual player panel details
  const renderPlayerPanel = (player: Player, team?: Team) => {
    const isActive = activePlayer.id === player.id;
    const isPopping = poppingPlayerId === player.id;

    // Determine frame wins
    const winsKey = team ? team.id : player.id;
    const frameWins = state.frameScores[winsKey] || 0;

    return (
      <div className={`player-panel ${isActive ? 'active' : ''}`}>
        {team && <div className="player-panel-team-label">{team.name}</div>}
        <div className="player-name">
          {player.name}
          {isActive && <span className="active-dot"> ▶</span>}
        </div>
        <div className={`player-score-value ${isPopping ? 'score-pop' : ''}`}>
          {team ? team.totalScore : player.score}
        </div>
        <div className="player-panel-substats">
          <div className="player-break">Break: {player.currentBreak}</div>
          <div className="player-timer">visit: {formatTimer(player.timeSpentMs)}</div>
          <div className="player-highest-break">Best: {player.highestBreak}</div>
          <div className="player-frames-won">Frames: {frameWins}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="scoring-screen felt-bg">
      <OrientationWarning />

      {/* Top Bar */}
      <header className="scoring-topbar">
        <div className="scoring-topbar-left">
          <button onClick={() => setIsMenuOpen(true)} className="btn btn-ghost">
            ☰ Menu
          </button>
          <span className="frame-info-badge">
            Frame {state.frameNumber} / {state.bestOf}
          </span>
        </div>

        <div className="scoring-topbar-center">
          <span className="match-timer-display">⏱ {formatTimer(state.matchTimerMs)}</span>
        </div>

        <div className="scoring-topbar-right">
          <button
            onClick={handleUndo}
            disabled={state.undoStack.length === 0}
            className="btn btn-ghost btn-undo"
            title="Undo"
          >
            ↩ Undo
          </button>
          <button onClick={() => setIsLogOpen(true)} className="btn btn-ghost">
            📋 Log
          </button>
        </div>
      </header>

      {/* Main Scoring Section */}
      {state.mode === 'freeForAll' || state.players.length > 2 ? (
        // Multi-player Layout: Horizontal Player List at top, controls below
        <div className="scoring-multiplayer-container">
          <div className="multiplayer-players-list">
            {state.players.map(p => {
              const isActive = activePlayer.id === p.id;
              const isPopping = poppingPlayerId === p.id;
              return (
                <div
                  key={p.id}
                  className={`player-panel-horizontal ${isActive ? 'active' : ''}`}
                >
                  <div className="horizontal-player-name">
                    {isActive && <span className="active-dot">▶ </span>}
                    {p.name}
                  </div>
                  <div className={`horizontal-player-score ${isPopping ? 'score-pop' : ''}`}>
                    {p.score}
                  </div>
                  <div className="horizontal-player-break">B: {p.currentBreak}</div>
                </div>
              );
            })}
          </div>

          <div className="scoring-controls-center">
            {/* Ball buttons */}
            <div className="ball-buttons-row">
              {ballsList.map(ball => {
                const enabled = isBallEnabled(ball);
                const isExpected =
                  (state.expectedBall === ball && state.phase === 'reds') ||
                  (state.currentColorTarget === ball && state.phase === 'colorsInOrder') ||
                  (state.phase === 'respottedBlack' && ball === 'black');

                return (
                  <button
                    key={ball}
                    onClick={() => enabled && handlePotBall(ball)}
                    disabled={!enabled}
                    className={`btn-ball ball-${ball} ${!enabled ? 'dimmed' : ''} ${
                      isExpected ? 'expected' : ''
                    }`}
                  >
                    {ball === 'red' && state.redsRemaining > 0 && (
                      <span className="red-count-badge">{state.redsRemaining}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Actions row */}
            <div className="action-buttons-row">
              <button onClick={handleMiss} className="btn btn-action btn-miss">
                Miss
              </button>
              <button
                onClick={() => {
                  setIsInOff(false);
                  setIsFoulOpen(true);
                }}
                className="btn btn-action btn-foul"
              >
                Foul
              </button>
              <button
                onClick={() => {
                  setIsInOff(true);
                  setIsFoulOpen(true);
                }}
                className="btn btn-action btn-inoff"
              >
                In-Off
              </button>
              <button
                onClick={() => dispatch({ type: 'FREE_BALL' })}
                className={`btn btn-action btn-freeball ${state.isFreeBall ? 'active' : ''}`}
              >
                {state.isFreeBall ? '✓ Free Ball' : 'Free Ball'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        // 1v1 / Team Layout: Left Player, Center Controls, Right Player
        <main className="scoring-main">
          {/* Left Player / Team Panel */}
          {state.mode === 'team'
            ? renderPlayerPanel(state.players[state.turnOrder[0]], state.teams[0])
            : renderPlayerPanel(state.players[0])}

          {/* Center Scoring Controls */}
          <div className="scoring-controls-center">
            {/* Ball buttons */}
            <div className="ball-buttons-row">
              {ballsList.map(ball => {
                const enabled = isBallEnabled(ball);
                const isExpected =
                  (state.expectedBall === ball && state.phase === 'reds') ||
                  (state.currentColorTarget === ball && state.phase === 'colorsInOrder') ||
                  (state.phase === 'respottedBlack' && ball === 'black');

                return (
                  <button
                    key={ball}
                    onClick={() => enabled && handlePotBall(ball)}
                    disabled={!enabled}
                    className={`btn-ball ball-${ball} ${!enabled ? 'dimmed' : ''} ${
                      isExpected ? 'expected' : ''
                    }`}
                  >
                    {ball === 'red' && state.redsRemaining > 0 && (
                      <span className="red-count-badge">{state.redsRemaining}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Actions row */}
            <div className="action-buttons-row">
              <button onClick={handleMiss} className="btn btn-action btn-miss">
                Miss
              </button>
              <button
                onClick={() => {
                  setIsInOff(false);
                  setIsFoulOpen(true);
                }}
                className="btn btn-action btn-foul"
              >
                Foul
              </button>
              <button
                onClick={() => {
                  setIsInOff(true);
                  setIsFoulOpen(true);
                }}
                className="btn btn-action btn-inoff"
              >
                In-Off
              </button>
              <button
                onClick={() => dispatch({ type: 'FREE_BALL' })}
                className={`btn btn-action btn-freeball ${state.isFreeBall ? 'active' : ''}`}
              >
                {state.isFreeBall ? '✓ Free Ball' : 'Free Ball'}
              </button>
            </div>
          </div>

          {/* Right Player / Team Panel */}
          {state.mode === 'team'
            ? renderPlayerPanel(state.players[state.turnOrder[1]], state.teams[1])
            : renderPlayerPanel(state.players[1])}
        </main>
      )}

      {/* Info Bar */}
      <footer className="scoring-infobar">
        <div className="infobar-item">
          <span className="infobar-label">Active:</span>
          <span className="infobar-value">{activePlayer.name}</span>
        </div>
        <div className="infobar-item">
          <span className="infobar-label">On:</span>
          <span className="infobar-value">
            {state.isFreeBall
              ? 'Free Ball (Any)'
              : state.phase === 'reds'
              ? state.expectedBall === 'red'
                ? 'Red'
                : 'Color'
              : state.phase === 'colorsInOrder'
              ? state.currentColorTarget
              : state.phase === 'respottedBlack'
              ? 'Black (Re-spotted)'
              : 'None'}
          </span>
        </div>
        <div className="infobar-item">
          <span className="infobar-label">Reds:</span>
          <span className="infobar-value">{state.redsRemaining}</span>
        </div>
        <div className="infobar-item">
          <span className="infobar-label">Points on Table:</span>
          <span className="infobar-value">{getPointsOnTable()}</span>
        </div>
      </footer>

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
