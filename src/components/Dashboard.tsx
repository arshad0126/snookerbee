import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import {
  getLocalMatchHistory,
  getMatchHistory,
  type MatchRecord,
  type MatchPlayerRecord,
} from '../lib/database';
import MatchDetailsModal, { type MatchDetailsData } from './MatchDetailsModal';

export default function Dashboard() {
  const { user, isGuest, signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalGames: 0, highestBreak: 0, winRate: 0 });
  const [recentMatches, setRecentMatches] = useState<MatchDetailsData[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchDetailsData | null>(null);

  const userName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Guest';
  const avatarUrl = user?.user_metadata?.avatar_url;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        if (isGuest) {
          const localHistory = getLocalMatchHistory();
          const totalGames = localHistory.length;

          let maxBreak = 0;
          let wins = 0;

          // Guest default stats calculation
          localHistory.forEach(m => {
            m.players.forEach(p => {
              maxBreak = Math.max(maxBreak, p.highestBreak);
            });
            // Assume the first player is the guest for simple local stats
            if (m.players[0] && m.winnerName === m.players[0].name) {
              wins++;
            }
          });

          const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
          setStats({ totalGames, highestBreak: maxBreak, winRate });

          // Map to unified match format
          const mapped: MatchDetailsData[] = localHistory.slice(0, 5).map(m => ({
            id: m.id,
            date: new Date(m.createdAt).toLocaleDateString(),
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
          setRecentMatches(mapped);
        } else {
          // Logged in user (Supabase)
          const dbHistory = await getMatchHistory();
          const totalGames = dbHistory.length;

          let maxBreak = 0;
          let wins = 0;

          dbHistory.forEach((m: MatchRecord & { players: MatchPlayerRecord[] }) => {
            m.players.forEach((p: MatchPlayerRecord) => {
              maxBreak = Math.max(maxBreak, p.highest_break || 0);
            });

            // Check if user is among players and has won
            // Or if user name matches winner
            const userPlayer = m.players.find(p => p.player_name === userName);
            if (userPlayer) {
              if (m.winner_name === userPlayer.player_name) {
                wins++;
              }
            } else if (m.players[0] && m.winner_name === m.players[0].player_name) {
              wins++;
            }
          });

          const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
          setStats({ totalGames, highestBreak: maxBreak, winRate });

          const mapped: MatchDetailsData[] = dbHistory.slice(0, 5).map(m => ({
            id: m.id || '',
            date: m.created_at ? new Date(m.created_at).toLocaleDateString() : '',
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
          setRecentMatches(mapped);
        }
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [isGuest, userName]);

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="page page-centered">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="dashboard-page page">
      <header className="dashboard-header">
        <div className="dashboard-welcome">
          {avatarUrl ? (
            <img src={avatarUrl} alt={userName} className="dashboard-avatar" />
          ) : (
            <div className="dashboard-avatar dashboard-avatar-placeholder">
              {userName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="dashboard-greeting">{getGreeting()},</div>
            <div className="dashboard-name">{userName}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
          <button onClick={toggleTheme} className="btn-topbar-icon" style={{ borderRadius: 'var(--radius-md)' }} aria-label="Toggle theme">
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
          <button onClick={handleLogout} className="btn btn-ghost">
            Log Out
          </button>
        </div>
      </header>

      <main className="dashboard-grid">
        <div
          onClick={() => navigate('/setup')}
          className="dashboard-card-new-game card ripple"
        >
          <div className="new-game-icon">🎱</div>
          <div>
            <h3>New Game</h3>
            <p>Start a new frame</p>
          </div>
        </div>

        <div className="stats-row">
          <div className="stat-card card">
            <div className="stat-value">{stats.totalGames}</div>
            <div className="stat-label">Total Games</div>
          </div>
          <div className="stat-card card">
            <div className="stat-value">{stats.highestBreak}</div>
            <div className="stat-label">Highest Break</div>
          </div>
          <div className="stat-card card">
            <div className="stat-value">{stats.winRate}%</div>
            <div className="stat-label">Win Rate</div>
          </div>
        </div>

        <section className="recent-matches-section">
          <h3 className="dashboard-section-title">Recent Matches</h3>
          {recentMatches.length === 0 ? (
            <div className="empty-state card">
              <div className="empty-state-icon">🏆</div>
              <h4 className="empty-state-title">No matches yet</h4>
              <p className="empty-state-text">Play your first game to see history!</p>
            </div>
          ) : (
            <div className="history-list">
              {recentMatches.map(match => (
                <div
                  key={match.id}
                  onClick={() => setSelectedMatch(match)}
                  className="history-card card"
                >
                  <div className="history-card-header">
                    <span className="history-card-date">{match.date}</span>
                    <span className="history-card-mode badge">{match.mode}</span>
                  </div>
                  <div className="history-card-players">
                    {match.players.map((p, i) => {
                      const isWinner = p.name === match.winnerName || p.teamName === match.winnerName;
                      return (
                        <span key={i} className={isWinner ? 'history-card-winner' : ''}>
                          {p.teamName ? `[${p.teamName}] ` : ''}{p.name} ({p.totalScore})
                          {i < match.players.length - 1 && <span className="history-card-vs"> vs </span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {recentMatches.length > 0 && (
            <button
              onClick={() => navigate('/history')}
              className="btn btn-ghost view-all-btn"
              style={{ marginTop: 'var(--space-md)', width: '100%' }}
            >
              View All History →
            </button>
          )}
        </section>
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
