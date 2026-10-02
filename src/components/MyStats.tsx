import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { loadHistory, guessMyName, type History } from '../lib/history';
import { getFramesForMatches } from '../lib/database';
import type { ActionLogEntry, BallType } from '../engine/types';
import {
  inRange, summarize, byMonth, breakBuckets, headToHead, byWeekday, potStats, centuryStats, hours,
  type Range,
} from '../lib/playerStats';
import { relativeDay, shortDuration } from '../lib/results';
import ThemeBackdrop from './ThemeBackdrop';
import { Icon } from './ui';

const RANGES: { id: Range; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'all', label: 'All time' },
];

const BALL_HEX: Record<BallType, string> = {
  red: 'var(--ball-red)', yellow: 'var(--ball-yellow)', green: 'var(--ball-green)', brown: 'var(--ball-brown)',
  blue: 'var(--ball-blue)', pink: 'var(--ball-pink)', black: 'var(--ball-black)',
};

const DAY_NAMES: Record<string, string> = {
  Mon: 'Mondays', Tue: 'Tuesdays', Wed: 'Wednesdays', Thu: 'Thursdays', Fri: 'Fridays', Sat: 'Saturdays', Sun: 'Sundays',
};

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default function MyStats() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isGuest } = useAuth();
  const { settings } = useSettings();
  const [history, setHistory] = useState<History | null>(null);
  const [logsById, setLogsById] = useState<Map<string, ActionLogEntry[][]> | null>(null);
  const [range, setRange] = useState<Range>('all');

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
        rows.forEach((r) => {
          const list = map.get(r.match_id ?? '') ?? [];
          list.push((r.action_log as ActionLogEntry[]) ?? []);
          map.set(r.match_id ?? '', list);
        });
      }
      if (live) setLogsById(map);
    });
    return () => { live = false; };
  }, [isGuest]);

  useEffect(() => {
    const id = location.hash.slice(1);
    if (!id || !history) return;
    const t = setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: 'start' }), 80);
    return () => clearTimeout(t);
  }, [location.hash, history]);

  const me = useMemo(
    () => settings.playerName || (history ? guessMyName(history.matches, history.centuries) : null),
    [settings.playerName, history]
  );

  const view = useMemo(() => {
    if (!history || !me) return null;
    const matches = inRange(history.matches, range);
    const centuries = inRange(history.centuries, range);
    const logs = logsById
      ? matches.filter((m) => m.players.some((p) => p.name === me)).flatMap((m) => logsById.get(m.id) ?? [])
      : [];
    return {
      summary: summarize(matches, me),
      allTime: summarize(history.matches, me),
      months: byMonth(history.matches, me),
      breaks: breakBuckets(matches, me),
      h2h: headToHead(matches, me),
      days: byWeekday(matches, me),
      pots: logsById ? potStats(logs, me) : undefined,
      century: centuryStats(centuries, me),
    };
  }, [history, me, range, logsById]);

  if (!history) {
    return <div className="ms-page ms-page--loading"><div className="spinner" /></div>;
  }

  const s = view?.summary;
  const empty = !view || !s || s.matches === 0;
  const maxMonth = Math.max(1, ...(view?.months.map((m) => m.games) ?? [1]));
  const maxBucket = Math.max(1, ...(view?.breaks.map((b) => b.count) ?? [1]));
  const maxDay = Math.max(1, ...(view?.days.map((d) => d.games) ?? [1]));
  const busiest = view?.days.reduce((a, b) => (b.games > a.games ? b : a), view.days[0]);
  const quietest = view?.days.reduce((a, b) => (b.games < a.games ? b : a), view.days[0]);
  const nextMilestone = s ? [10, 20, 30, 40, 50, 75, 100, 147].find((x) => x > s.bestBreak) : undefined;
  const fifteenPlus = view?.breaks.slice(3).reduce((a, b) => a + b.count, 0) ?? 0;

  return (
    <div className="ms-page">
      <ThemeBackdrop />
      <header className="ms-header">
        <button type="button" className="st-back" onClick={() => navigate('/dashboard')} aria-label="Back to dashboard">
          <Icon name="arrow-left" size={18} />
        </button>
        <div className="ms-titles">
          <h1 className="st-title">My stats</h1>
          <span className="ms-sub">
            {me ? `${me} · ` : ''}
            {view?.allTime.firstAt ? `${view.allTime.matches} matches since ${new Date(view.allTime.firstAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long' })}` : 'No matches yet'}
          </span>
        </div>
        <div className="st-seg ms-range" role="radiogroup" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              role="radio"
              aria-checked={range === r.id}
              className={`st-seg-btn${range === r.id ? ' is-on' : ''}`}
              onClick={() => setRange(r.id)}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {empty ? (
        <div className="ms-card ms-empty">
          <Icon name="chart" size={32} />
          <b>{range === 'all' ? 'No matches yet' : `No matches in the last ${range}`}</b>
          <span>{range === 'all' ? 'Play a game and your stats start here.' : 'Try All time.'}</span>
        </div>
      ) : (
        <main className="ms-body">
          <section id="overview" className="ms-card ms-kpis" aria-label="Overview">
            <div className="ms-kpi"><b>{s.matches}</b><span>Matches</span><small>{s.thisWeek} this week</small></div>
            <div className="ms-kpi"><b>{s.wins}</b><span>Won</span><small>{s.winRate}% win rate</small></div>
            <div className="ms-kpi"><b>{s.framesWon}</b><span>Frames won</span><small>across all matches</small></div>
            <div className="ms-kpi"><b>{s.avgPoints}</b><span>Avg points</span><small>per match</small></div>
            <div className="ms-kpi"><b>{hours(s.tableMs)}</b><span>At the table</span><small>your visits only</small></div>
          </section>

          <div className="ms-two">
            <section id="form" className="ms-card" aria-labelledby="ms-form">
              <div className="ms-card-head">
                <h2 id="ms-form" className="ms-h2">Form</h2>
                <span className="ms-meta">last {s.form.length}, oldest → newest</span>
              </div>
              <div className="ms-form" aria-label={`Results oldest first: ${s.form.map((r) => (r === 'W' ? 'win' : 'loss')).join(', ')}`}>
                {s.form.map((r, i) => <span key={i} className={`db-form-dot${r === 'W' ? ' is-win' : ''}`}>{r}</span>)}
              </div>
              <div className="ms-legend">
                <span><i className="ms-key ms-key--games" />Matches</span>
                <span><i className="ms-key ms-key--wins" />Wins</span>
              </div>
              <div className="ms-cols" role="img" aria-label={view.months.map((m) => `${m.label}: ${m.wins} of ${m.games}`).join('; ')}>
                {view.months.map((m) => (
                  <div key={m.key} className="ms-col" title={`${m.label}: ${m.wins} wins from ${m.games} matches`}>
                    <span className="ms-col-val">{m.games ? `${m.wins}/${m.games}` : '–'}</span>
                    <span className="ms-col-bar" style={{ height: `${(m.games / maxMonth) * 100}%` }}>
                      <span className="ms-col-fill" style={{ height: m.games ? `${(m.wins / m.games) * 100}%` : 0 }} />
                    </span>
                    <span className="ms-col-label">{m.label}</span>
                  </div>
                ))}
              </div>
            </section>

            <section id="breaks" className="ms-card" aria-labelledby="ms-breaks">
              <h2 id="ms-breaks" className="ms-h2">Breaks</h2>
              <div className="ms-heroes">
                <div><b className="ms-accent">{s.bestBreak}</b><span>highest break{s.bestBreakAt ? ` · ${relativeDay(s.bestBreakAt)}` : ''}</span></div>
                <div><b>{s.avgBestBreak}</b><span>avg best break per match</span></div>
              </div>
              <span className="ms-meta">Matches by your best break</span>
              <div className="ms-hbars">
                {view.breaks.map((b) => (
                  <div key={b.label} className="ms-hbar" title={`${b.count} matches with a best break of ${b.label}`}>
                    <span className="ms-hbar-label">{b.label}</span>
                    <span className="ms-hbar-track"><span className="ms-hbar-fill" style={{ width: `${(b.count / maxBucket) * 100}%` }} /></span>
                    <span className="ms-hbar-val">{b.count}</span>
                  </div>
                ))}
              </div>
              {nextMilestone && (
                <p className="ms-insight">
                  Next milestone: a <b>{nextMilestone} break</b>.
                  {fifteenPlus > 0 ? ` You've made 15+ ${fifteenPlus === 1 ? 'once' : `${fifteenPlus} times`}.` : ''}
                </p>
              )}
            </section>
          </div>

          <section id="head-to-head" className="ms-card" aria-labelledby="ms-h2h">
            <div className="ms-card-head">
              <h2 id="ms-h2h" className="ms-h2">Head to head</h2>
              <span className="ms-meta">who finished higher, every match you both played</span>
            </div>
            {view.h2h.length === 0 ? (
              <p className="ms-insight">Play at least two matches against someone to see your record.</p>
            ) : (
              <div className="ms-h2h">
                {view.h2h.slice(0, 8).map((h) => (
                  <div key={h.name} className="ms-opp">
                    <div className="ms-opp-head">
                      <span className="ms-opp-avatar">{h.name.charAt(0)}</span>
                      <span className="ms-opp-id"><b>{h.name}</b><small>{h.n} matches</small></span>
                    </div>
                    <span className="ms-opp-score">{h.w}<i> – </i>{h.l}</span>
                    <span className="ms-split" aria-hidden="true">
                      <span className="ms-split-win" style={{ width: `${(h.w / h.n) * 100}%` }} />
                    </span>
                    <small className="ms-meta">Avg points {h.myAvg} vs {h.theirAvg}</small>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="ms-two">
            <section id="pots" className="ms-card" aria-labelledby="ms-pots">
              <h2 id="ms-pots" className="ms-h2">What you pot</h2>
              {view.pots === undefined ? (
                <div className="ms-mini-loading"><div className="spinner" /></div>
              ) : view.pots === null ? (
                <p className="ms-insight">No shot-by-shot data for this period.</p>
              ) : (
                <>
                  <div className="ms-ratio-head"><span><b>{view.pots.reds}</b> reds</span><span><b>{view.pots.colours}</b> colours</span></div>
                  <span className="ms-ratio" aria-hidden="true">
                    <span style={{ width: `${(view.pots.reds / Math.max(1, view.pots.reds + view.pots.colours)) * 100}%`, background: 'var(--ball-red)' }} />
                    <span style={{ flex: 1, background: 'var(--ball-black)' }} />
                  </span>
                  <span className="ms-meta">
                    {view.pots.colours > 0
                      ? (() => { const r = Math.round((view.pots.reds / view.pots.colours) * 10) / 10; return `${r} red${r === 1 ? '' : 's'} for every colour`; })()
                      : 'No colours potted yet'}
                  </span>
                  <span className="ms-meta">Colours potted</span>
                  <div className="ms-balls">
                    {view.pots.byColour.map((c) => (
                      <div key={c.ball} className="ms-ball">
                        <span className="ms-ball-dot" style={{ background: BALL_HEX[c.ball] }} />
                        <b>{c.count}</b>
                        <small>{cap(c.ball)}</small>
                      </div>
                    ))}
                  </div>
                  {view.pots.byColour[0].count > 0 && (
                    <p className="ms-insight">{cap(view.pots.byColour[0].ball)} is your most-potted colour.</p>
                  )}
                </>
              )}
            </section>

            <section id="fouls" className="ms-card" aria-labelledby="ms-fouls">
              <h2 id="ms-fouls" className="ms-h2">Fouls</h2>
              {view.pots === undefined ? (
                <div className="ms-mini-loading"><div className="spinner" /></div>
              ) : view.pots === null || view.pots.fouls === 0 ? (
                <p className="ms-insight">No fouls recorded for this period. Nice.</p>
              ) : (
                <>
                  <div className="ms-heroes">
                    <div><b>{view.pots.fouls}</b><span>foul{view.pots.fouls === 1 ? '' : 's'} · {Math.round((view.pots.fouls / s.matches) * 10) / 10} per match</span></div>
                    <div><b className="ms-bad">{view.pots.foulPoints.toLocaleString()}</b><span>points given away</span></div>
                  </div>
                  <span className="ms-meta">Fouls by ball</span>
                  <div className="ms-hbars">
                    {view.pots.foulsByBall.map((f) => (
                      <div key={f.ball} className="ms-hbar" title={`${f.count} fouls on ${f.ball}`}>
                        <span className="ms-hbar-label">{cap(f.ball)}</span>
                        <span className="ms-hbar-track"><span className="ms-hbar-fill ms-hbar-fill--bad" style={{ width: `${(f.count / view.pots!.foulsByBall[0].count) * 100}%` }} /></span>
                        <span className="ms-hbar-val">{f.count}</span>
                      </div>
                    ))}
                  </div>
                  <p className="ms-insight">
                    {Math.round((view.pots.foulsByBall[0].count / view.pots.fouls) * 100)}% of your fouls are on the {view.pots.foulsByBall[0].ball}.
                  </p>
                </>
              )}
            </section>
          </div>

          <div className="ms-two">
            <section id="days" className="ms-card" aria-labelledby="ms-days">
              <div className="ms-card-head">
                <h2 id="ms-days" className="ms-h2">When you play</h2>
                <span className="ms-meta">avg match {shortDuration(s.avgMatchMs)}</span>
              </div>
              <div className="ms-cols ms-cols--days" role="img" aria-label={view.days.map((d) => `${d.label}: ${d.games}`).join('; ')}>
                {view.days.map((d) => (
                  <div key={d.label} className="ms-col" title={`${d.games} matches on ${d.label}`}>
                    <span className="ms-col-val">{d.games}</span>
                    <span className={`ms-col-bar ms-col-bar--solid${busiest && d.label === busiest.label ? ' is-top' : ''}`} style={{ height: `${(d.games / maxDay) * 100}%` }} />
                    <span className="ms-col-label">{d.label}</span>
                  </div>
                ))}
              </div>
              {busiest && quietest && busiest.games > 0 && (
                <p className="ms-insight">You play most on {DAY_NAMES[busiest.label]}{quietest.games < busiest.games ? `, least on ${DAY_NAMES[quietest.label]}` : ''}.</p>
              )}
            </section>

            <section id="century" className="ms-card" aria-labelledby="ms-century">
              <div className="ms-card-head">
                <h2 id="ms-century" className="ms-h2">Century</h2>
                <span className="ms-meta">first out · left short · reds</span>
              </div>
              {!view.century ? (
                <div className="ms-century-empty">
                  <Icon name="target" size={28} />
                  <b>No Century games {range === 'all' ? 'yet' : 'in this period'}</b>
                  <span>Play one and this fills in: how often you finish first, reds missed, and 10 vs 20 red results.</span>
                  <button type="button" className="db-link" onClick={() => navigate('/setup')}>Start a game →</button>
                </div>
              ) : (
                <>
                  <div className="ms-heroes">
                    <div><b>{view.century.games}</b><span>games</span></div>
                    <div><b className="ms-accent">{view.century.firstOut}</b><span>first out</span></div>
                    <div><b>{view.century.leftShort}</b><span>left short</span></div>
                  </div>
                  <p className="ms-insight">
                    Reds: {view.century.redsPotted} potted, {view.century.redsMissed} missed
                    {view.century.redsPotted + view.century.redsMissed > 0
                      ? ` (${Math.round((view.century.redsPotted / (view.century.redsPotted + view.century.redsMissed)) * 100)}% success)`
                      : ''}.
                  </p>
                  {view.century.byRedValue.length > 1 && (
                    <p className="ms-insight">
                      {view.century.byRedValue.map((v) => `Red ${v.value}: first out ${v.firstOut} of ${v.games}`).join(' · ')}
                    </p>
                  )}
                </>
              )}
            </section>
          </div>

          <p className="ms-foot">Based on your saved matches with at least one point scored.</p>
        </main>
      )}
    </div>
  );
}
