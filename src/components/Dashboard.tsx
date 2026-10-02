import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import MatchDetailsModal from './MatchDetailsModal';
import CenturyDetailsModal from './CenturyDetailsModal';
import ProfileDrawer from './ProfileDrawer';
import ThemeBackdrop from './ThemeBackdrop';
import { Icon } from './ui';
import { loadActiveMatch } from '../lib/matchStorage';
import { loadHistory, guessMyName, toDetails, didWin, type History, type HistoryMatch } from '../lib/history';
import { summarize } from '../lib/playerStats';
import { modeLabel, relativeDay, shortDuration } from '../lib/results';
import { byFinish, type CenturyDetailsData } from '../lib/centuryHistory';

type RecentItem =
  | { kind: 'match'; at: number; m: HistoryMatch }
  | { kind: 'century'; at: number; c: CenturyDetailsData };

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** The rack drawn inside the New Game card. */
function CardRack() {
  const balls: [number, number][] = [];
  [1, 2, 3, 4].forEach((count, row) => {
    for (let i = 0; i < count; i += 1) balls.push([row * 31, (i - (count - 1) / 2) * 36]);
  });
  return (
    <svg className="db-new-art" viewBox="-20 -80 140 160" aria-hidden="true">
      {balls.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="16" />)}
    </svg>
  );
}

export default function Dashboard() {
  const { user, isGuest } = useAuth();
  const { settings } = useSettings();
  const navigate = useNavigate();
  const [history, setHistory] = useState<History | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState<HistoryMatch | null>(null);
  const [selectedCentury, setSelectedCentury] = useState<CenturyDetailsData | null>(null);

  // An unfinished match left behind by an evicted or closed session.
  const [resumable] = useState(() => {
    const saved = loadActiveMatch();
    return saved && saved.state.winner === null ? saved : null;
  });

  const accountName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Guest';
  const firstName = String(accountName).split(' ')[0];
  const avatarUrl: string | undefined = user?.user_metadata?.avatar_url;

  useEffect(() => {
    let live = true;
    void loadHistory(isGuest).then((h) => { if (live) setHistory(h); });
    return () => { live = false; };
  }, [isGuest]);

  const me = useMemo(
    () => settings.playerName || (history ? guessMyName(history.matches, history.centuries) : null),
    [settings.playerName, history]
  );

  const summary = useMemo(
    () => (history && me ? summarize(history.matches, me, 5) : null),
    [history, me]
  );

  const recent = useMemo<RecentItem[]>(() => {
    if (!history) return [];
    return [
      ...history.matches.map((m): RecentItem => ({ kind: 'match', at: m.at, m })),
      ...history.centuries.map((c): RecentItem => ({ kind: 'century', at: c.at, c })),
    ]
      .sort((a, b) => b.at - a.at)
      .slice(0, 6);
  }, [history]);

  const today = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="db-page">
      <ThemeBackdrop />

      <header className="db-header">
        <button type="button" className="db-avatar-btn" onClick={() => setDrawerOpen(true)} aria-label="Open profile menu">
          {avatarUrl ? (
            <img className="db-avatar" src={avatarUrl} alt="" />
          ) : (
            <span className="db-avatar db-avatar--initials">{firstName.charAt(0).toUpperCase()}</span>
          )}
          <span className="db-avatar-badge"><Icon name="menu" size={11} /></span>
        </button>
        <div className="db-hello">
          <span className="db-greeting">{greeting()}</span>
          <span className="db-name">{firstName}</span>
        </div>
        <span className="db-today">{today}</span>
      </header>

      <main className="db-grid">
        <div className="db-left">
          {resumable && (
            <button type="button" onClick={() => navigate('/play')} className="db-resume">
              <Icon name="pass" size={18} />
              <span className="db-resume-copy">
                <b>Resume match</b>
                <span>Frame {resumable.state.frameNumber} · {resumable.state.players.length} players</span>
              </span>
              <Icon name="arrow-right" size={16} />
            </button>
          )}

          <button type="button" onClick={() => navigate('/setup')} className="db-new">
            <CardRack />
            <span className="db-new-eyebrow">Ready when you are</span>
            <span className="db-new-row">
              <span className="db-new-copy">
                <span className="db-new-title">New game</span>
                <span className="db-new-sub">Snooker · Free for all · Century</span>
              </span>
              <span className="db-new-go"><Icon name="arrow-right" size={18} /></span>
            </span>
          </button>

          <div className="db-stats">
            <div className="db-stat">
              <span className="db-stat-value">{summary?.matches ?? '–'}</span>
              <span className="db-stat-label">Matches</span>
              <span className="db-stat-note db-stat-note--up">
                {summary && summary.thisWeek > 0 ? `▲ ${summary.thisWeek} this week` : 'none this week'}
              </span>
            </div>
            <div className="db-stat">
              <span className="db-stat-value">{summary ? `${summary.winRate}%` : '–'}</span>
              <span className="db-stat-label">Win rate</span>
              <span className="db-stat-note">{summary ? `${summary.wins} win${summary.wins === 1 ? '' : 's'}` : ''}</span>
            </div>
            <div className="db-stat">
              <span className="db-stat-value db-stat-value--accent">{summary?.bestBreak ?? '–'}</span>
              <span className="db-stat-label">Best break</span>
              <span className="db-stat-note">{summary?.bestBreakAt ? relativeDay(summary.bestBreakAt) : ''}</span>
            </div>
          </div>

          {summary && summary.form.length > 0 && (
            <div className="db-form">
              <span className="db-form-label">Last {summary.form.length}</span>
              <span
                className="db-form-dots"
                aria-label={`Last ${summary.form.length} results, oldest first: ${summary.form.map((r) => (r === 'W' ? 'win' : 'loss')).join(', ')}`}
              >
                {summary.form.map((r, i) => (
                  <span key={i} className={`db-form-dot${r === 'W' ? ' is-win' : ''}`}>{r}</span>
                ))}
              </span>
              <button type="button" className="db-link" onClick={() => navigate('/stats')}>My stats →</button>
            </div>
          )}
        </div>

        <section className="db-right" aria-label="Recent games">
          <div className="db-right-head">
            <h2 className="db-section-title">Recent</h2>
            {recent.length > 0 && (
              <button type="button" className="db-link" onClick={() => navigate('/history')}>See all</button>
            )}
          </div>

          {!history ? (
            <div className="db-loading"><div className="spinner" /></div>
          ) : recent.length === 0 ? (
            <div className="db-empty">
              <Icon name="trophy" size={32} />
              <b>No games yet</b>
              <span>Play your first game and it shows up here.</span>
            </div>
          ) : (
            <ul className="db-recent">
              {recent.map((item) => item.kind === 'match' ? (
                <li key={`m-${item.m.id}`}>
                  <button type="button" className={`db-row${me && didWin(item.m, me) ? ' is-mine' : ''}`} onClick={() => setSelectedMatch(item.m)}>
                    <span className="db-row-when">
                      <span className="db-row-day">{relativeDay(item.m.at)}</span>
                      <span className={`db-tag db-tag--${item.m.mode}`}>{modeLabel(item.m.mode)}</span>
                    </span>
                    <span className="db-row-players">
                      {[...item.m.players]
                        .sort((a, b) => {
                          const aw = a.name === item.m.winner || a.teamName === item.m.winner ? 1 : 0;
                          const bw = b.name === item.m.winner || b.teamName === item.m.winner ? 1 : 0;
                          return bw - aw || b.framesWon - a.framesWon || b.totalScore - a.totalScore;
                        })
                        .map((p) => {
                          const won = p.name === item.m.winner || (!!p.teamName && p.teamName === item.m.winner);
                          return (
                            <span key={p.name} className={`db-p${won ? ' is-winner' : ''}`}>
                              {won && <Icon name="trophy" size={13} className="db-p-trophy" />}
                              {p.name}
                              <span className="db-p-score">{p.totalScore}</span>
                            </span>
                          );
                        })}
                      {me && didWin(item.m, me) && <span className="db-you-won">You won</span>}
                      {!item.m.winner && <span className="db-draw">Draw</span>}
                    </span>
                    <span className="db-row-time">{shortDuration(item.m.durationMs)}</span>
                  </button>
                </li>
              ) : (
                <li key={`c-${item.c.id}`}>
                  <button type="button" className="db-row" onClick={() => setSelectedCentury(item.c)}>
                    <span className="db-row-when">
                      <span className="db-row-day">{relativeDay(item.c.at)}</span>
                      <span className="db-tag db-tag--century">Century</span>
                    </span>
                    <span className="db-row-players">
                      {byFinish(item.c.players).map((p) => (
                        <span key={p.name} className={`db-p${p.finishedAt === 1 ? ' is-winner' : ''}`}>
                          {p.finishedAt === 1 && <Icon name="trophy" size={13} className="db-p-trophy" />}
                          {p.name}
                          <span className="db-p-score">{p.finishedAt ? `#${p.finishedAt}` : 'short'}</span>
                        </span>
                      ))}
                    </span>
                    <span className="db-row-time">{shortDuration(item.c.durationMs)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <ProfileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        stats={summary ? { matches: summary.matches, wins: summary.wins, bestBreak: summary.bestBreak } : null}
        firstPlayedAt={summary?.firstAt ?? null}
      />

      {selectedMatch && (
        <MatchDetailsModal isOpen onClose={() => setSelectedMatch(null)} matchData={toDetails(selectedMatch)} />
      )}
      {selectedCentury && (
        <CenturyDetailsModal game={selectedCentury} onClose={() => setSelectedCentury(null)} />
      )}
    </div>
  );
}
