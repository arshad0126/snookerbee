import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  deleteLocalMatch,
  deleteMatch,
  deleteLocalCenturyGame,
  deleteCenturyGame,
} from '../lib/database';
import { loadHistory, toDetails } from '../lib/history';
import ThemeBackdrop from './ThemeBackdrop';
import MatchDetailsModal, { type MatchDetailsData } from './MatchDetailsModal';
import CenturyDetailsModal from './CenturyDetailsModal';
import { Icon } from './ui';
import { shareCenturyCard } from '../lib/centuryShare';
import { byFinish, type CenturyDetailsData } from '../lib/centuryHistory';
import { modeLabel } from '../lib/results';

/** Snooker matches and Century games share one list, newest first. */
type HistoryItem =
  | { kind: 'match'; at: number; data: MatchDetailsData }
  | { kind: 'century'; at: number; data: CenturyDetailsData };

export default function MatchHistory() {
  const { isGuest } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<MatchDetailsData | null>(null);
  const [selectedCentury, setSelectedCentury] = useState<CenturyDetailsData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const merge = (matches: HistoryItem[], centuries: CenturyDetailsData[]) =>
    setItems(
      [...matches, ...centuries.map((c): HistoryItem => ({ kind: 'century', at: c.at, data: c }))]
        .sort((a, b) => b.at - a.at)
    );

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const h = await loadHistory(isGuest);
      merge(
        h.matches.map((m): HistoryItem => ({ kind: 'match', at: m.at, data: toDetails(m) })),
        h.centuries
      );
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
        setItems(prev => prev.filter(m => m.data.id !== matchId));
      } else {
        const success = await deleteMatch(matchId);
        if (success) {
          setItems(prev => prev.filter(m => m.data.id !== matchId));
        } else {
          alert('Failed to delete match from server. Please check your connection and try again.');
        }
      }
    } catch (err) {
      console.error('Failed to delete match:', err);
      alert('An unexpected error occurred while deleting the match.');
    }
  };

  const handleDeleteCentury = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this Century game?')) return;
    if (isGuest) {
      deleteLocalCenturyGame(id);
    } else if (!(await deleteCenturyGame(id))) {
      alert('Failed to delete the game from the server. Please check your connection and try again.');
      return;
    }
    setItems(prev => prev.filter(m => !(m.kind === 'century' && m.data.id === id)));
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

  const renderMatchCard = (match: MatchDetailsData) => (
    <div
      key={match.id}
      onClick={() => setSelectedMatch(match)}
      className="history-card card ripple"
      style={{ cursor: 'pointer' }}
    >
      <div className="history-card-header">
        <span className="history-card-date">{match.date}</span>
        <span className="history-card-mode badge">{modeLabel(match.mode)}</span>
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
          <Icon name="trash" size={18} />
        </button>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="page page-centered">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="history-page page">
      <ThemeBackdrop />
      <header className="history-header">
        <button onClick={() => navigate('/dashboard')} className="setup-back-btn btn-back">
          <Icon name="arrow-left" size={20} />
        </button>
        <h2 className="history-title">Match History</h2>
      </header>

      <main className="history-content">
        {items.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-state-icon"><Icon name="trophy" size={40} /></div>
            <h3 className="empty-state-title">No matches yet</h3>
            <p className="empty-state-text">Play your first game to record match history!</p>
            <button onClick={() => navigate('/setup')} className="btn btn-primary" style={{ marginTop: 'var(--space-lg)' }}>
              Start Match <Icon name="ball" size={18} />
            </button>
          </div>
        ) : (
          <div className="history-list">
            {items.map(item => item.kind === 'century' ? (
              <div
                key={`c-${item.data.id}`}
                onClick={() => setSelectedCentury(item.data)}
                className="history-card card ripple"
                style={{ cursor: 'pointer' }}
              >
                <div className="history-card-header">
                  <span className="history-card-date">{item.data.date}</span>
                  <span className="history-card-mode badge">century</span>
                </div>

                <div className="history-card-players">
                  {byFinish(item.data.players).map((p, i, all) => (
                    <div
                      key={i}
                      className={`history-card-player ${p.finishedAt === 1 ? 'history-card-winner' : ''}`}
                    >
                      <span className="player-name-span">
                        {p.finishedAt ? `#${p.finishedAt} ` : 'Short · '}
                        {p.name}
                      </span>
                      <span className="history-card-score">{p.score}</span>
                      {i < all.length - 1 && <span className="history-card-vs"> · </span>}
                    </div>
                  ))}
                </div>

                <div className="history-card-details">
                  <span>Target: {item.data.target}</span>
                  <span>•</span>
                  <span>Red: {item.data.redValue}</span>
                  <span>•</span>
                  <span>Duration: {formatDuration(item.data.durationMs)}</span>
                  <button
                    onClick={(e) => { void handleDeleteCentury(item.data.id, e); }}
                    className="history-card-delete btn btn-ghost"
                    title="Delete Game"
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              </div>
            ) : renderMatchCard(item.data))}
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

      {/* Off-screen canvas for the Century share card */}
      <canvas ref={canvasRef} width={1600} height={1200} style={{ display: 'none' }} />

      {selectedCentury && (
        <CenturyDetailsModal
          game={selectedCentury}
          onClose={() => setSelectedCentury(null)}
          onShare={() => {
            if (!canvasRef.current) return;
            void shareCenturyCard(canvasRef.current, {
              ...selectedCentury,
              playedAt: selectedCentury.at,
            });
          }}
        />
      )}
    </div>
  );
}
