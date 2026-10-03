import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { loadHistory, guessMyName, toDetails, type History, type HistoryMatch } from '../lib/history';
import { getFramesForMatches } from '../lib/database';
import type { ActionLogEntry } from '../engine/types';
import { listPlayers, hours } from '../lib/playerStats';
import { computeGroupStats, normName, type GroupPlayer } from '../lib/groupStats';
import { relativeDay } from '../lib/results';
import MatchDetailsModal from './MatchDetailsModal';
import ThemeBackdrop from './ThemeBackdrop';
import { Icon } from './ui';

const SLOTS = 3;
const PLACE = ['1st', '2nd', '3rd'];

/**
 * Played together — pick two or three players, tap Calculate, and see stats
 * from only the games where exactly that group played.
 *
 * The chosen group lives in the URL (?p=Arshad&p=Awais&p=Suraj), so Back
 * and a refresh keep it, and Player Stats can link straight to a pair.
 */
export default function PlayedTogether() {
  const navigate = useNavigate();
  const { isGuest } = useAuth();
  const { settings } = useSettings();
  const [params, setParams] = useSearchParams();
  const [history, setHistory] = useState<History | null>(null);
  const [logsById, setLogsById] = useState<Map<string, ActionLogEntry[][]> | null>(null);
  const [openMatch, setOpenMatch] = useState<HistoryMatch | null>(null);

  useEffect(() => {
    let live = true;
    void loadHistory(isGuest).then(async (h) => {
      if (!live) return;
      setHistory(h);
      const map = new Map<string, ActionLogEntry[][]>();
      if (isGuest) {
        h.matches.forEach((m) => map.set(m.id, (m.frames ?? []).map((f) => f.actionLog ?? [])));
      } else {
        const rows = await getFramesForMatches(h.matches.map((m) => m.id));
        [...rows]
          .sort((a, b) => (a.frame_number ?? 0) - (b.frame_number ?? 0))
          .forEach((r) => {
            const list = map.get(r.match_id ?? '') ?? [];
            list.push((r.action_log as ActionLogEntry[]) ?? []);
            map.set(r.match_id ?? '', list);
          });
      }
      if (live) setLogsById(map);
    });
    return () => { live = false; };
  }, [isGuest]);

  const me = useMemo(
    () => settings.playerName || (history ? guessMyName(history.matches, history.centuries) : null),
    [settings.playerName, history]
  );
  const players = useMemo(() => (history ? listPlayers(history.matches, history.centuries) : []), [history]);

  // What Calculate last ran on, from the URL.
  const applied = useMemo(() => {
    const known = new Map(players.map((p) => [normName(p.name), p.name]));
    const out: string[] = [];
    params.getAll('p').forEach((n) => {
      const real = known.get(normName(n));
      if (real && !out.includes(real)) out.push(real);
    });
    return out.length >= 2 ? out.slice(0, SLOTS) : null;
  }, [params, players]);

  // The dropdowns: start from the URL, else me in the first slot.
  const [picks, setPicks] = useState<string[]>(['', '', '']);
  useEffect(() => {
    if (!history) return;
    if (applied) setPicks([...applied, '', ''].slice(0, SLOTS));
    else if (me) setPicks((p) => (p.every((x) => !x) ? [me, '', ''] : p));
  }, [history, applied, me]);

  const chosen = picks.filter(Boolean);
  const canCalc = chosen.length >= 2;
  const dirty = !applied || chosen.join('|') !== applied.join('|');

  const setPick = (i: number, v: string) => setPicks((p) => p.map((x, j) => (j === i ? v : x)));
  const calculate = () => {
    if (!canCalc) return;
    const next = new URLSearchParams();
    chosen.forEach((n) => next.append('p', n));
    setParams(next, { replace: false });
  };

  const stats = useMemo(
    () => (history && applied ? computeGroupStats(applied, history.matches, history.centuries, logsById) : null),
    [history, applied, logsById]
  );

  if (!history) {
    return <div className="ms-page ms-page--loading"><div className="spinner" /></div>;
  }

  const label = (n: string) => (n === me ? `${n} (you)` : n);
  const groupText = (g: string[]) =>
    g.length === 2 ? `${g[0]} and ${g[1]}` : `${g.slice(0, -1).join(', ')} and ${g[g.length - 1]}`;

  // Highlight the best value in each comparison row.
  const best = (vals: (number | null)[], higher = true) => {
    const nums = vals.filter((v): v is number => v !== null);
    if (nums.length < 2) return null;
    const top = higher ? Math.max(...nums) : Math.min(...nums);
    return vals.filter((v) => v === top).length === 1 ? top : null;
  };

  const rows: { label: string; get: (p: GroupPlayer) => number | null; fmt?: (v: number) => string; lowWins?: boolean; hint?: string }[] = [
    { label: 'Frames won', get: (p) => p.framesWon },
    { label: 'Frame win %', get: (p) => p.frameWinRate, fmt: (v) => `${v}%` },
    { label: 'Avg points / frame', get: (p) => p.avgPointsPerFrame },
    { label: 'Total points', get: (p) => p.totalPoints },
    { label: 'Highest break', get: (p) => p.highestBreak },
    { label: '50+ breaks', get: (p) => p.fiftyPlus },
    { label: 'Fouls', get: (p) => p.fouls, lowWins: true },
    { label: 'Points given away', get: (p) => p.pots?.foulPoints ?? null, lowWins: true },
    { label: 'Reds potted', get: (p) => p.pots?.reds ?? null },
    { label: 'Colours potted', get: (p) => p.pots?.colours ?? null },
    { label: 'Time at the table', get: (p) => p.tableMs, fmt: (v) => hours(v), hint: 'no-best' },
  ];

  const ranked = stats ? [...stats.players].sort((a, b) => b.framesWon - a.framesWon || (b.frameWinRate ?? 0) - (a.frameWinRate ?? 0)) : [];
  const n = stats?.group.length ?? 0;
  const hasPlaces = !!stats && stats.players.some((p) => p.places);

  return (
    <div className="ms-page">
      <ThemeBackdrop />
      <header className="ms-header">
        <button type="button" className="st-back" onClick={() => navigate(-1)} aria-label="Back">
          <Icon name="arrow-left" size={18} />
        </button>
        <span className="ps-avatar ps-avatar--initial" aria-hidden="true"><Icon name="users" size={18} /></span>
        <div className="ms-titles">
          <h1 className="st-title">Played together</h1>
          <span className="ms-sub">Stats from only the games where exactly these players played</span>
        </div>
      </header>

      <main className="ms-body">
        <section className="ms-card pt-pick" aria-label="Choose players">
          <div className="pt-selects">
            {picks.map((v, i) => {
              const taken = new Set(picks.filter((x, j) => x && j !== i));
              return (
                <label key={i} className="pt-field">
                  <span className="ms-meta">Player {i + 1}{i === 2 ? ' · optional' : ''}</span>
                  <span className="ps-picker">
                    <select value={v} onChange={(e) => setPick(i, e.target.value)}>
                      <option value="">{i === 2 ? 'None (just two)' : 'Choose…'}</option>
                      {players.filter((p) => !taken.has(p.name)).map((p) => (
                        <option key={p.name} value={p.name}>{label(p.name)} · {p.games}</option>
                      ))}
                    </select>
                    <Icon name="chevron-down" size={14} />
                  </span>
                </label>
              );
            })}
          </div>
          <button type="button" className="pt-calc" disabled={!canCalc || (!dirty && !!stats)} onClick={calculate}>
            <Icon name="chart" size={16} /> Calculate
          </button>
          {players.length < 2 && <p className="ms-insight">Play with at least one other named player to compare.</p>}
        </section>

        {!stats ? (
          <div className="ms-card ms-empty">
            <Icon name="users" size={32} />
            <b>Pick two or three players</b>
            <span>Then tap Calculate. Only games with exactly those players count.</span>
          </div>
        ) : stats.matches.length === 0 && stats.centuries.length === 0 ? (
          <div className="ms-card ms-empty">
            <Icon name="users" size={32} />
            <b>No games with exactly {groupText(stats.group)}</b>
            <span>
              {n === 3
                ? 'Games where only two of them played, or someone else joined, don’t count here.'
                : 'Games where a third player joined don’t count here.'}
            </span>
          </div>
        ) : (
          <>
            {stats.matches.length > 0 && (
              <>
                <section className="ms-card ms-kpis pt-kpis" aria-label="Overview">
                  <div className="ms-kpi"><b>{stats.matches.length}</b><span>Matches</span><small>together</small></div>
                  <div className="ms-kpi"><b>{stats.frames}</b><span>Frames</span><small>{stats.matches.length ? `${Math.round((stats.frames / stats.matches.length) * 10) / 10} per match` : ''}</small></div>
                  <div className="ms-kpi"><b>{hours(stats.tableMs)}</b><span>Played</span><small>{stats.firstAt ? `since ${relativeDay(stats.firstAt)}` : ''}</small></div>
                  <div className="ms-kpi"><b>{stats.lastAt ? relativeDay(stats.lastAt) : '–'}</b><span>Last game</span><small>{stats.streak && stats.streak.n > 1 ? `${stats.streak.name} won ${stats.streak.n} frames in a row` : ' '}</small></div>
                </section>

                <section className="ms-card" aria-labelledby="pt-board">
                  <div className="ms-card-head">
                    <h2 id="pt-board" className="ms-h2">Leaderboard</h2>
                    <span className="ms-meta">by frames won</span>
                  </div>
                  <ol className="pt-board">
                    {ranked.map((p, i) => (
                      <li key={p.name} className={i === 0 && p.framesWon > 0 ? 'is-top' : ''}>
                        <span className="ms-opp-avatar">{p.name.charAt(0).toUpperCase()}</span>
                        <span className="pt-board-name"><b>{label(p.name)}</b><small>{p.framesWon} of {stats.frames} frames won</small></span>
                        <span className="pt-board-frames"><b>{p.framesWon}</b><small>{p.frameWinRate ?? 0}%</small></span>
                        <span className="ms-split pt-board-bar" aria-hidden="true">
                          <span className="ms-split-win" style={{ width: `${p.frameWinRate ?? 0}%` }} />
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>

                <section className="ms-card" aria-labelledby="pt-side">
                  <div className="ms-card-head">
                    <h2 id="pt-side" className="ms-h2">Side by side</h2>
                    <span className="ms-meta">best in each row highlighted</span>
                  </div>
                  <div className="pt-table" role="table" style={{ ['--pt-cols' as string]: n }}>
                    <div className="pt-tr pt-th" role="row">
                      <span role="columnheader" />
                      {stats.players.map((p) => <span key={p.name} role="columnheader">{p.name}</span>)}
                    </div>
                    {rows.map((r) => {
                      const vals = stats.players.map(r.get);
                      if (vals.every((v) => v === null)) return null;
                      const top = r.hint === 'no-best' ? null : best(vals, !r.lowWins);
                      return (
                        <div key={r.label} className="pt-tr" role="row">
                          <span role="rowheader">{r.label}</span>
                          {vals.map((v, i) => (
                            <span key={i} role="cell" className={v !== null && v === top ? 'is-best' : ''}>
                              {v === null ? '–' : r.fmt ? r.fmt(v) : v.toLocaleString()}
                            </span>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </section>

                <div className="ms-two">
                  {hasPlaces && (
                    <section className="ms-card" aria-labelledby="pt-places">
                      <div className="ms-card-head">
                        <h2 id="pt-places" className="ms-h2">Frame finishes</h2>
                        <span className="ms-meta">{stats.framesWithLogs} frame{stats.framesWithLogs === 1 ? '' : 's'} with shot-by-shot data</span>
                      </div>
                      <div className="pt-places">
                        {stats.players.map((p) => {
                          const total = (p.places ?? []).reduce((a, b) => a + b, 0) || 1;
                          return (
                            <div key={p.name} className="pt-place-row">
                              <span className="pt-place-name">{p.name}</span>
                              <span className="pt-place-bar" aria-label={(p.places ?? []).map((c, i) => `${PLACE[i]}: ${c}`).join(', ')}>
                                {(p.places ?? []).map((c, i) => c > 0 && (
                                  <span key={i} className={`pt-place-seg pt-place-seg--${i}`} style={{ width: `${(c / total) * 100}%` }}>{c}</span>
                                ))}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <div className="ms-legend">
                        {PLACE.slice(0, n).map((l, i) => <span key={l}><i className={`ms-key pt-place-seg--${i}`} />{l}</span>)}
                      </div>
                    </section>
                  )}

                  <section className="ms-card" aria-labelledby="pt-form">
                    <div className="ms-card-head">
                      <h2 id="pt-form" className="ms-h2">Who won lately</h2>
                      <span className="ms-meta">last {stats.form.length} frames, oldest → newest</span>
                    </div>
                    <div className="ms-form">
                      {stats.form.map((w, i) => (
                        <span key={i} className={`db-form-dot${w === me ? ' is-win' : ''}`} title={w ?? 'Draw'}>
                          {w ? w.charAt(0).toUpperCase() : '='}
                        </span>
                      ))}
                    </div>
                    {stats.streak && (
                      <p className="ms-insight">
                        <b>{stats.streak.name}</b> won the last {stats.streak.n === 1 ? 'frame' : `${stats.streak.n} frames`}.
                      </p>
                    )}
                  </section>
                </div>
              </>
            )}

            {stats.centuries.length > 0 && (
              <section className="ms-card" aria-labelledby="pt-century">
                <div className="ms-card-head">
                  <h2 id="pt-century" className="ms-h2">Century together</h2>
                  <span className="ms-meta">{stats.centuries.length} game{stats.centuries.length === 1 ? '' : 's'}</span>
                </div>
                <div className="pt-table" role="table" style={{ ['--pt-cols' as string]: n }}>
                  <div className="pt-tr pt-th" role="row">
                    <span role="columnheader" />
                    {stats.players.map((p) => <span key={p.name} role="columnheader">{p.name}</span>)}
                  </div>
                  {([
                    ['First out', (p: GroupPlayer) => p.century?.firstOut ?? 0, false],
                    ['Left short', (p: GroupPlayer) => p.century?.leftShort ?? 0, true],
                    ['Best score', (p: GroupPlayer) => p.century?.bestScore ?? 0, false],
                  ] as const).map(([l, get, low]) => {
                    const vals = stats.players.map(get);
                    const top = best(vals, !low);
                    return (
                      <div key={l} className="pt-tr" role="row">
                        <span role="rowheader">{l}</span>
                        {vals.map((v, i) => <span key={i} role="cell" className={v === top ? 'is-best' : ''}>{v}</span>)}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {stats.matches.length > 0 && (
              <section className="ms-card" aria-labelledby="pt-recent">
                <h2 id="pt-recent" className="ms-h2">Games together</h2>
                <ul className="ps-recent">
                  {stats.matches.slice(0, 15).map((m) => {
                    const top = [...m.players].sort((a, b) => b.framesWon - a.framesWon || b.totalScore - a.totalScore);
                    return (
                      <li key={m.id}>
                        <button type="button" className="ps-recent-row pt-recent-row" onClick={() => setOpenMatch(m)}>
                          <span className="ps-recent-day">{relativeDay(m.at)}</span>
                          <span className="ps-recent-opp">{m.winner ? `${m.winner} won` : 'Draw'}</span>
                          <span className="ps-recent-score">{top.map((p) => p.framesWon).join('–')}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {stats.matches.length > 15 && <span className="ms-meta">Showing the latest 15 of {stats.matches.length}.</span>}
              </section>
            )}

            <p className="ms-foot">
              Only games where exactly {groupText(stats.group)} played.
              {n === 3 ? ' Two-player games between any of them aren’t counted.' : ''}
              {stats.teamGamesSkipped > 0 ? ` ${stats.teamGamesSkipped} team game${stats.teamGamesSkipped === 1 ? '' : 's'} left out.` : ''}
            </p>
          </>
        )}
      </main>
      {openMatch && (
        <MatchDetailsModal isOpen onClose={() => setOpenMatch(null)} matchData={toDetails(openMatch)} />
      )}
    </div>
  );
}
