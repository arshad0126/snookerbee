import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  saveMatch,
  saveMatchLocally,
  type MatchRecord,
  type MatchPlayerRecord,
  type MatchFrameRecord,
  type LocalMatchRecord,
} from '../lib/database';
import type { GameState } from '../engine/types';
import { presentShareCard, cardFilename } from '../lib/shareImage';
import { drawMatchCard } from '../lib/shareCard';
import { Icon } from './ui';
import { loadPendingMatch, clearPendingMatch } from '../lib/matchStorage';
import { matchTotals, matchWinnerName, isEmptyGame, pointsLeader } from '../lib/results';

interface FrameHistoryItem {
  frameNumber: number;
  scores: Record<string, number>; // maps player/team name to score
}

export default function MatchSummary() {
  const location = useLocation();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  const { isGuest } = useAuth();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error' | 'empty'>('idle');
  const [dbError, setDbError] = useState<string | null>(null);

  // Router state does not survive a reload, and on iOS a backgrounded PWA can
  // be evicted between finishing a match and saving it. ScoringScreen writes a
  // pending copy on the way here, so fall back to that rather than bouncing to
  // the dashboard with the match gone.
  const routed = location.state as {
    gameState: GameState;
    frameHistory: FrameHistoryItem[];
  } | null;

  const [recovered] = useState(() => (routed ? null : loadPendingMatch()));
  const stateData = routed ?? recovered;

  // handleSave is defined after the early return, so the auto-save effect
  // reaches it through a ref rather than closing over it directly.
  const handleSaveRef = useRef<(() => Promise<void>) | null>(null);

  useEffect(() => {
    if (!stateData) {
      navigate('/dashboard');
    }
  }, [stateData, navigate]);

  // Saving used to be entirely manual, so leaving this screen without tapping
  // the button discarded a fully played match. Save on arrival; the button is
  // now a retry for when that fails.
  //
  // Declared above the early return: hooks must run in the same order on every
  // render, so this cannot sit below `if (!stateData) return null`.
  const autoSaveStarted = useRef(false);
  useEffect(() => {
    if (!stateData || autoSaveStarted.current) return;
    autoSaveStarted.current = true;
    void handleSaveRef.current?.();
  }, [stateData]);

  if (!stateData) return null;

  const { gameState, frameHistory } = stateData;
  const { players, teams, mode, bestOf, matchTimerMs } = gameState;

  // Winner: whoever reached the frames-to-win mark, or — for a match ended
  // early — most frames. Level on frames is a draw; points never decide it.
  // Totals span every frame; the players' own score/foul fields only hold
  // the last one.
  const winnerName = matchWinnerName(gameState);
  const totals = matchTotals(gameState);
  const drawNote = winnerName === 'Draw'
    ? pointsLeader(players.map((p) => ({
        name: p.name,
        teamName: mode === 'team' ? teams.find((t) => t.playerIds.includes(p.id))?.name : undefined,
        totalScore: totals.points[p.id] ?? 0,
        framesWon: 0,
      })))
    : null;
  const drawFrames = (mode === 'team' ? teams.map((t) => t.id) : players.map((p) => p.id))
    .map((id) => gameState.frameScores[id] || 0)
    .sort((a, b) => b - a)
    .join('–');
  const empty = isEmptyGame(gameState);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const formatPlayerTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  const handleSave = async () => {
    // A match where nothing was scored is not worth a history row.
    if (empty) {
      clearPendingMatch();
      setSaveStatus('empty');
      return;
    }
    setSaveStatus('saving');
    try {
      if (isGuest) {
        // Save locally
        const localRecord: LocalMatchRecord = {
          id: `match_${Date.now()}`,
          mode,
          redsCount: gameState.redsTotal,
          bestOf,
          createdAt: new Date().toISOString(),
          durationMs: matchTimerMs,
          winnerName,
          players: players.map(p => {
            const playerTeam = mode === 'team'
              ? teams.find(t => t.playerIds.includes(p.id))
              : undefined;

            // In team mode, count how many frames this team won
            let framesWon = 0;
            if (mode === 'team' && playerTeam) {
              framesWon = gameState.frameScores[playerTeam.id] || 0;
            } else {
              framesWon = gameState.frameScores[p.id] || 0;
            }

            return {
              name: p.name,
              teamName: playerTeam?.name,
              totalScore: totals.points[p.id] ?? p.score,
              highestBreak: p.matchHighestBreak,
              framesWon,
              foulsCommitted: totals.fouls[p.id] ?? p.foulsCommitted,
              timeSpentMs: p.timeSpentMs,
              centuries: p.centuries,
              halfCenturies: p.halfCenturies,
            };
          }),
          frames: [
            ...(gameState.completedFrames || []).map(f => ({
              frameNumber: f.frameNumber,
              durationMs: f.durationMs,
              actionLog: f.actionLog,
            })),
            {
              frameNumber: gameState.frameNumber,
              durationMs: gameState.currentFrameDurationMs,
              actionLog: gameState.actionLog,
            }
          ],
        };
        if (!saveMatchLocally(localRecord)) {
          setSaveStatus('error');
          setDbError('Device storage is full — delete some saved matches and try again.');
          return;
        }
        clearPendingMatch();
        setSaveStatus('saved');
      } else {
        // Save to Supabase
        const matchRec: MatchRecord = {
          mode,
          reds_count: gameState.redsTotal,
          best_of: bestOf,
          duration_ms: matchTimerMs,
          winner_name: winnerName,
        };

        const playerRecs: MatchPlayerRecord[] = players.map(p => {
          const playerTeam = mode === 'team'
            ? teams.find(t => t.playerIds.includes(p.id))
            : undefined;

          let framesWon = 0;
          if (mode === 'team' && playerTeam) {
            framesWon = gameState.frameScores[playerTeam.id] || 0;
          } else {
            framesWon = gameState.frameScores[p.id] || 0;
          }

          return {
            player_name: p.name,
            team_name: playerTeam?.name ?? undefined,
            total_score: totals.points[p.id] ?? p.score,
            highest_break: p.matchHighestBreak,
            frames_won: framesWon,
            fouls_committed: totals.fouls[p.id] ?? p.foulsCommitted,
            time_spent_ms: p.timeSpentMs,
            centuries: p.centuries,
            half_centuries: p.halfCenturies,
          };
        });

        // Frame records with action log
        const frameRecs: MatchFrameRecord[] = [
          ...(gameState.completedFrames || []).map(f => ({
            frame_number: f.frameNumber,
            duration_ms: f.durationMs,
            action_log: f.actionLog,
          })),
          {
            frame_number: gameState.frameNumber,
            duration_ms: gameState.currentFrameDurationMs,
            action_log: gameState.actionLog,
          }
        ];

        const result = await saveMatch(matchRec, playerRecs, frameRecs);
        if (result.success) {
          clearPendingMatch();
          setSaveStatus('saved');
          setDbError(null);
        } else {
          setSaveStatus('error');
          setDbError(result.error || 'Database operation failed.');
        }
      }
    } catch (error: any) {
      console.error('Error saving match:', error);
      setSaveStatus('error');
      setDbError(error?.message || String(error));
    }
  };

  handleSaveRef.current = handleSave;

  const handleShareCard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rows = players.map((p) => {
      const pTeam = mode === 'team'
        ? teams.find(t => t.playerIds.includes(p.id))
        : undefined;

      const framesWon = mode === 'team' && pTeam
        ? (gameState.frameScores[pTeam.id] || 0)
        : (gameState.frameScores[p.id] || 0);

      return {
        name: p.name,
        teamName: pTeam?.name,
        score: totals.points[p.id] ?? p.score,
        framesWon,
        highestBreak: p.matchHighestBreak,
        fouls: totals.fouls[p.id] ?? p.foulsCommitted,
        isWinner: p.name === winnerName || (!!pTeam && pTeam.name === winnerName),
      };
    });

    drawMatchCard(canvas, {
      winnerName,
      mode,
      bestOf,
      dateLabel: new Date().toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      durationLabel: formatTime(matchTimerMs),
      redsCount: gameState.redsTotal,
      players: rows,
    });

    const names = mode === 'team' ? teams.map(t => t.name) : players.map(p => p.name);
    await presentShareCard(
      canvas,
      cardFilename(names.slice(0, 2)),
      'SnookerBee match summary'
    );
  };

  return (
    <div className="summary-page page">
      <header className="summary-header">
        <h2 className="summary-page-title">Match Summary</h2>
      </header>

      <main className="summary-content">
        <div className="summary-card card winner-card">
          <div className="winner-banner">
            <span className="trophy-large"><Icon name="trophy" size={56} /></span>
            <div className="winner-banner-text">
              <span className="winner-label">{winnerName === 'Draw' ? 'Result' : 'Winner'}</span>
              <span className="winner-name-highlight">{winnerName === 'Draw' ? `Draw · ${drawFrames}` : winnerName}</span>
              {winnerName === 'Draw' && drawNote && (
                <span className="winner-note">{drawNote.name} scored more ({drawNote.line})</span>
              )}
            </div>
          </div>
        </div>

        {/* Frame by Frame Table */}
        {frameHistory && frameHistory.length > 0 && (
          <section className="summary-section">
            <h3 className="dashboard-section-title">Frame Scores</h3>
            <div className="table-wrapper card">
              <table className="summary-table">
                <thead>
                  <tr>
                    <th>Frame</th>
                    {Object.keys(frameHistory[0].scores).map(name => (
                      <th key={name}>{name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {frameHistory.map(f => (
                    <tr key={f.frameNumber}>
                      <td className="frame-num-td">Frame {f.frameNumber}</td>
                      {Object.keys(f.scores).map(name => {
                        // Highlight winning score in the frame
                        const maxVal = Math.max(...Object.values(f.scores));
                        const isWin = f.scores[name] === maxVal;
                        return (
                          <td key={name} className={isWin ? 'score-win-td' : ''}>
                            {f.scores[name]}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Player Stats Grid */}
        <section className="summary-section">
          <h3 className="dashboard-section-title">Player Statistics</h3>
          <div className="stats-comparison-grid">
            {players.map(p => {
              const pTeam = mode === 'team'
                ? teams.find(t => t.playerIds.includes(p.id))
                : undefined;

              const framesWon = mode === 'team' && pTeam
                ? (gameState.frameScores[pTeam.id] || 0)
                : (gameState.frameScores[p.id] || 0);

              return (
                <div key={p.id} className="player-stats-card card">
                  <h4 className="player-stats-name">
                    {p.name}
                    {pTeam && <span className="player-team-label"> ({pTeam.name})</span>}
                  </h4>
                  <div className="player-stats-grid">
                    <div className="player-stat-item">
                      <span className="player-stat-label">Frames Won</span>
                      <span className="player-stat-value">{framesWon}</span>
                    </div>
                    <div className="player-stat-item">
                      <span className="player-stat-label">Total Points</span>
                      <span className="player-stat-value">{totals.points[p.id] ?? p.score}</span>
                    </div>
                    <div className="player-stat-item">
                      <span className="player-stat-label">Highest Break</span>
                      <span className="player-stat-value">{p.matchHighestBreak}</span>
                    </div>
                    <div className="player-stat-item">
                      <span className="player-stat-label">Fouls</span>
                      <span className="player-stat-value">{totals.fouls[p.id] ?? p.foulsCommitted}</span>
                    </div>
                    {p.centuries > 0 && (
                      <div className="player-stat-item">
                        <span className="player-stat-label">Centuries</span>
                        <span className="player-stat-value milestone">{p.centuries}</span>
                      </div>
                    )}
                    {p.halfCenturies > 0 && (
                      <div className="player-stat-item">
                        <span className="player-stat-label">50+ breaks</span>
                        <span className="player-stat-value milestone">{p.halfCenturies}</span>
                      </div>
                    )}
                    <div className="player-stat-item">
                      <span className="player-stat-label">Time Spent</span>
                      <span className="player-stat-value">{formatPlayerTime(p.timeSpentMs)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="summary-section match-meta-section card">
          <div className="meta-item">
            <span className="meta-label">Match Duration:</span>
            <span className="meta-value">{formatTime(matchTimerMs)}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Match Mode:</span>
            <span className="meta-value badge">{mode === '1v1' ? '1 vs 1' : mode}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Reds Count:</span>
            <span className="meta-value">{gameState.redsTotal} Reds</span>
          </div>
        </section>

        <div className="summary-footer-actions">
          {saveStatus === 'saved' ? (
            <div className="save-status-msg success card">
              <Icon name="check" size={16} /> Match record saved successfully!
            </div>
          ) : saveStatus === 'empty' ? (
            <div className="save-status-msg card">
              <Icon name="alert" size={16} /> Nothing was scored, so this match wasn't saved.
            </div>
          ) : saveStatus === 'error' ? (
            <div className="save-status-msg error card">
              <Icon name="alert" size={16} /> Error saving match record: {dbError || 'Unknown error'}
            </div>
          ) : null}

          <div className="actions-button-row">
            {saveStatus !== 'saved' && saveStatus !== 'empty' && (
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                className="btn btn-primary btn-lg"
                style={{ flex: 1 }}
              >
                {saveStatus === 'saving' ? 'Saving...' : <>Save Match <Icon name="save" size={18} /></>}
              </button>
            )}
            <button
              onClick={() => { void handleShareCard(); }}
              className="btn btn-secondary btn-lg"
              style={{ flex: 1 }}
            >
              <Icon name="share" size={18} /> Share Card
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn btn-secondary btn-lg"
              style={{ flex: 1 }}
            >
              Home
            </button>
          </div>
        </div>
      </main>
      
      {/* Off-screen canvas for image generation */}
      <canvas ref={canvasRef} width={1600} height={1200} style={{ display: 'none' }} />
    </div>
  );
}
