import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  getLocalMatchHistory,
  getMatchHistory,
  deleteLocalMatch,
  deleteMatch,
  type MatchRecord,
  type MatchPlayerRecord,
} from '../lib/database';
import MatchDetailsModal, { type MatchDetailsData } from './MatchDetailsModal';

export default function MatchHistory() {
  const { isGuest } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<MatchDetailsData[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchDetailsData | null>(null);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      if (isGuest) {
        const localHistory = getLocalMatchHistory();
        const mapped = localHistory.map((m): MatchDetailsData => ({
          id: m.id,
          date: new Date(m.createdAt).toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
          mode: m.mode,
          bestOf: m.bestOf,
          redsCount: m.redsCount,
          durationMs: m.durationMs,
          winnerName: m.winnerName,
          players: m.players.map(p => ({
            name: p.name,
            teamName: p.teamName,
            totalScore: p.totalScore,
            highestBreak: p.highestBreak,
            framesWon: p.framesWon,
            foulsCommitted: p.foulsCommitted,
            timeSpentMs: p.timeSpentMs,
          })),
          frames: m.frames,
        }));
        setMatches(mapped);
      } else {
        const dbHistory = await getMatchHistory();
        const mapped = dbHistory.map((m: MatchRecord & { players: MatchPlayerRecord[] }): MatchDetailsData => ({
          id: m.id || '',
          date: m.created_at
            ? new Date(m.created_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : '',
          mode: m.mode,
          bestOf: m.best_of,
          redsCount: m.reds_count,
          durationMs: m.duration_ms,
          winnerName: m.winner_name,
          players: m.players.map(p => ({
            name: p.player_name,
            teamName: p.team_name ?? undefined,
            totalScore: p.total_score,
            highestBreak: p.highest_break,
            framesWon: p.frames_won,
            foulsCommitted: p.fouls_committed,
            timeSpentMs: p.time_spent_ms,
          })),
        }));
        setMatches(mapped);
      }
    } catch (error) {
      console.error('Error fetching match history:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [isGuest]);

  const handleDelete = async (matchId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this match record?')) return;

    try {
      if (isGuest) {
        deleteLocalMatch(matchId);
        setMatches(prev => prev.filter(m => m.id !== matchId));
      } else {
        const success = await deleteMatch(matchId);
        if (success) {
          setMatches(prev => prev.filter(m => m.id !== matchId));
        } else {
          alert('Failed to delete match from server. Please check your connection and try again.');
        }
      }
    } catch (err) {
      console.error('Failed to delete match:', err);
      alert('An unexpected error occurred while deleting the match.');
    }
  };

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="page page-centered">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="history-page page">
      <header className="history-header">
        <button onClick={() => navigate('/dashboard')} className="setup-back-btn btn-back">
          ←
        </button>
        <h2 className="history-title">Match History</h2>
      </header>

      <main className="history-content">
        {matches.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-state-icon">🏆</div>
            <h3 className="empty-state-title">No matches yet</h3>
            <p className="empty-state-text">Play your first game to record match history!</p>
            <button onClick={() => navigate('/setup')} className="btn btn-primary" style={{ marginTop: 'var(--space-lg)' }}>
              Start Match 🎱
            </button>
          </div>
        ) : (
          <div className="history-list">
            {matches.map(match => (
              <div
                key={match.id}
                onClick={() => setSelectedMatch(match)}
                className="history-card card ripple"
                style={{ cursor: 'pointer' }}
              >
                <div className="history-card-header">
                  <span className="history-card-date">{match.date}</span>
                  <span className="history-card-mode badge">{match.mode}</span>
                </div>

                <div className="history-card-players">
                  {match.players.map((p, i) => {
                    const isWinner = p.name === match.winnerName || p.teamName === match.winnerName;
                    return (
                      <div key={i} className={`history-card-player ${isWinner ? 'history-card-winner' : ''}`}>
                        <span className="player-name-span">
                          {p.teamName ? `[${p.teamName}] ` : ''}
                          {p.name}
                        </span>
                        <span className="history-card-score">{p.totalScore}</span>
                        {i < match.players.length - 1 && <span className="history-card-vs"> vs </span>}
                      </div>
                    );
                  })}
                </div>

                <div className="history-card-details">
                  <span>Reds: {match.redsCount}</span>
                  <span>•</span>
                  <span>Best of: {match.bestOf}</span>
                  <span>•</span>
                  <span>Duration: {formatDuration(match.durationMs)}</span>
                  <button
                    onClick={(e) => handleDelete(match.id, e)}
                    className="history-card-delete btn btn-ghost"
                    title="Delete Match"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedMatch && (
        <MatchDetailsModal
          isOpen={!!selectedMatch}
          onClose={() => setSelectedMatch(null)}
          matchData={selectedMatch}
        />
      )}
    </div>
  );
}
