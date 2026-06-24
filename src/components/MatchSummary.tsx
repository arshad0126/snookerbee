import { useState, useEffect } from 'react';
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

interface FrameHistoryItem {
  frameNumber: number;
  scores: Record<string, number>; // maps player/team name to score
}

export default function MatchSummary() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isGuest } = useAuth();
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Retrieve match state passed from ScoringScreen
  const stateData = location.state as {
    gameState: GameState;
    frameHistory: FrameHistoryItem[];
  } | null;

  useEffect(() => {
    if (!stateData) {
      navigate('/dashboard');
    }
  }, [stateData, navigate]);

  if (!stateData) return null;

  const { gameState, frameHistory } = stateData;
  const { players, teams, mode, bestOf, winner, matchTimerMs } = gameState;

  // Determine winner name
  let winnerName = 'Unknown';
  if (mode === 'team') {
    const winningTeam = teams.find(t => t.id === winner);
    if (winningTeam) winnerName = winningTeam.name;
  } else {
    const winningPlayer = players.find(p => p.id === winner);
    if (winningPlayer) winnerName = winningPlayer.name;
  }

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
              totalScore: p.score, // accumulated score (could be over multiple frames in components)
              highestBreak: p.highestBreak,
              framesWon,
              foulsCommitted: p.foulsCommitted,
              timeSpentMs: p.timeSpentMs,
            };
          }),
        };
        saveMatchLocally(localRecord);
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
            total_score: p.score,
            highest_break: p.highestBreak,
            frames_won: framesWon,
            fouls_committed: p.foulsCommitted,
            time_spent_ms: p.timeSpentMs,
          };
        });

        // Frame records with action log
        const frameRecs: MatchFrameRecord[] = [
          {
            frame_number: gameState.frameNumber,
            duration_ms: matchTimerMs, // approximated for the match/frame
            action_log: gameState.actionLog,
          },
        ];

        const matchId = await saveMatch(matchRec, playerRecs, frameRecs);
        if (matchId) {
          setSaveStatus('saved');
        } else {
          setSaveStatus('error');
        }
      }
    } catch (error) {
      console.error('Error saving match:', error);
      setSaveStatus('error');
    }
  };

  return (
    <div className="summary-page page">
      <header className="summary-header">
        <h2 className="summary-page-title">Match Summary</h2>
      </header>

      <main className="summary-content">
        <div className="summary-card card winner-card">
          <div className="winner-banner">
            <span className="trophy-large">🏆</span>
            <div className="winner-banner-text">
              <span className="winner-label">Winner</span>
              <span className="winner-name-highlight">{winnerName}</span>
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
                      <span className="player-stat-label">Highest Break</span>
                      <span className="player-stat-value">{p.highestBreak}</span>
                    </div>
                    <div className="player-stat-item">
                      <span className="player-stat-label">Fouls</span>
                      <span className="player-stat-value">{p.foulsCommitted}</span>
                    </div>
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
              ✓ Match record saved successfully!
            </div>
          ) : saveStatus === 'error' ? (
            <div className="save-status-msg error card">
              ⚠ Error saving match record.
            </div>
          ) : null}

          <div className="actions-button-row">
            {saveStatus !== 'saved' && (
              <button
                onClick={handleSave}
                disabled={saveStatus === 'saving'}
                className="btn btn-primary btn-lg"
                style={{ flex: 1 }}
              >
                {saveStatus === 'saving' ? 'Saving...' : 'Save Match 💾'}
              </button>
            )}
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
    </div>
  );
}
