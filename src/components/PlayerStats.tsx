import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { loadHistory, guessMyName, toDetails, didWin, type History, type HistoryMatch } from '../lib/history';
import { getFramesForMatches } from '../lib/database';
import type { ActionLogEntry, BallType } from '../engine/types';
import {
  inRange, summarize, byMonth, breakBuckets, headToHead, byWeekday, potStats, centuryStats, hours,
  listPlayers, computePlayerStats, MIN_GAMES_FOR_LIST,
  type Range,
} from '../lib/playerStats';
import { relativeDay, shortDuration, modeLabel } from '../lib/results';
import MatchDetailsModal from './MatchDetailsModal';
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

export default function PlayerStats() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isGuest } = useAuth();
  const { settings, update } = useSettings();
  const [params, setParams] = useSearchParams();
  const [openMatch, setOpenMatch] = useState<HistoryMatch | null>(null);
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

  const meName = me;
  const players = useMemo(() => (history ? listPlayers(history.matches, history.centuries) : []), [history]);
  const asked = params.get('name');
  // The player in the URL if they're in this account's history, else me.
  const subject = asked && players.some((p) => p.name === asked) ? asked : me;
  const isMe = !!subject && subject === me;
  const their = isMe ? 'your' : `${subject}'s`;

  const pick = (name: string) => {
    if (name === me) setParams({}, { replace: true });
    else setParams({ name }, { replace: true });
  };

  const view = useMemo(() => {
    if (!history || !subject) return null;
    const me = subject;
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
      profile: computePlayerStats(me, matches, isMe ? null : (meName ?? null)),
    };
  }, [history, subject, isMe, meName, range, logsById]);

  if (!history) {
    return <div className="ms-page ms-page--loading"><div className="spinner" /></div>;
  }

  const avatarUrl: string | undefined = user?.user_metadata?.avatar_url;
  const others = players.filter((p) => p.name !== me);
  const regulars = others.filter((p) => p.games >= MIN_GAMES_FOR_LIST);
  const occasional = others.filter((p) => p.games < MIN_GAMES_FOR_LIST);
  const pr = view?.profile;
  const dash = (v: number | null | undefined, suffix = '') => (v === null || v === undefined ? '–' : `${v}${suffix}`);

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
        <button type="button" className="st-back" onClick={() => navigate(-1)} aria-label="Back">
          <Icon name="arrow-left" size={18} />
        </button>
        {isMe && avatarUrl ? (
          <img className="ps-avatar" src={avatarUrl} alt="" />
        ) : (
          <span className="ps-avatar ps-avatar--initial" aria-hidden="true">{(subject ?? '?').charAt(0).toUpperCase()}</span>
        )}
        <div className="ms-titles">
          <h1 className="st-title">{subject ?? 'Player stats'}{isMe && <span className="ps-you"> (you)</span>}</h1>
          <span className="ms-sub">
            {view?.allTime.firstAt
              ? `Based on ${view.allTime.matches} match${view.allTime.matches === 1 ? '' : 'es'} recorded in this account`
              : 'No matches yet'}
          </span>
        </div>
        <div className="ps-controls">
          <label className="ps-picker">
            <span className="visually-hidden">Player</span>
            <select value={subject ?? ''} onChange={(e) => pick(e.target.value)}>
              {me && <option value={me}>{me} (you)</option>}
              {regulars.map((p) => <option key={p.name} value={p.name}>{p.name} · {p.games}</option>)}
              {occasional.length > 0 && (
                <optgroup label="Fewer games">
                  {occasional.map((p) => <option key={p.name} value={p.name}>{p.name} · {p.games}</option>)}
                </optgroup>
              )}
            </select>
            <Icon name="chevron-down" size={14} />
          </label>
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
        </div>
      </header>

      {empty ? (
        <div className="ms-card ms-empty">
          <Icon name="chart" size={32} />
          <b>{range === 'all' ? 'No matches yet' : `No matches in the last ${range}`}</b>
          <span>{range === 'all' ? (isMe ? 'Play a game and your stats start here.' : `No matches with ${subject} recorded here yet.`) : 'Try All time.'}</span>
        </div>
      ) : (
        <main className="ms-body">
          <section id="overview" className="ms-card ms-kpis" aria-label="Overview">
            <div className="ms-kpi"><b>{s.matches}</b><span>Matches</span><small>{pr?.wins ?? 0} won · {pr?.losses ?? 0} lost</small></div>
            <div className="ms-kpi"><b>{dash(pr?.winRate, '%')}</b><span>Win rate</span><small>{s.thisWeek} this week</small></div>
            <div className="ms-kpi"><b>{pr ? `${pr.framesWon}/${pr.framesPlayed}` : '–'}</b><span>Frames</span><small>{dash(pr?.frameWinRate, '%')} of frames won</small></div>
            <div className="ms-kpi"><b>{pr?.streak ?? '–'}</b><span>Streak</span><small>best run W{pr?.bestWinStreak ?? 0}</small></div>
            <div className="ms-kpi"><b>{dash(pr?.avgPointsPerMatch)}</b><span>Avg points</span><small>{dash(pr?.avgPointsPerFrame)} per frame</small></div>
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
                {pr && pr.halfCenturies + pr.centuries > 0 && (
                  <div><b>{pr.halfCenturies}<i className="ms-sep"> / </i>{pr.centuries}</b><span>50+ / 100+ breaks</span></div>
                )}
              </div>
              <span className="ms-meta">Matches by {their} best break</span>
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
                  {fifteenPlus > 0 ? ` ${isMe ? "You've" : `${subject} has`} made 15+ ${fifteenPlus === 1 ? 'once' : `${fifteenPlus} times`}.` : ''}
                </p>
              )}
            </section>
          </div>

          {isMe ? (
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
          ) : pr?.vsMe && (
            <section id="head-to-head" className="ms-card" aria-labelledby="ms-vs">
              <div className="ms-card-head">
                <h2 id="ms-vs" className="ms-h2">You vs {subject}</h2>
                <span className="ms-meta">{pr.vsMe.matches} match{pr.vsMe.matches === 1 ? '' : 'es'} against each other</span>
              </div>
              {pr.vsMe.matches === 0 ? (
                <p className="ms-insight">You haven't played against {subject} yet.</p>
              ) : (
                <div className="ps-vs">
                  <div className="ps-vs-score">
                    <div><b className="ms-accent">{pr.vsMe.myWins}</b><span>{me} won</span></div>
                    <div><b>{pr.vsMe.theirWins}</b><span>{subject} won</span></div>
                    {pr.vsMe.othersWins > 0 && <div><b>{pr.vsMe.othersWins}</b><span>someone else won</span></div>}
                    {pr.vsMe.draws > 0 && <div><b>{pr.vsMe.draws}</b><span>drawn</span></div>}
                  </div>
                  <span className="ms-split" aria-hidden="true">
                    <span className="ms-split-win" style={{ width: `${(pr.vsMe.myWins / Math.max(1, pr.vsMe.myWins + pr.vsMe.theirWins)) * 100}%` }} />
                  </span>
                  <div className="ps-vs-rows">
                    <div><span>Frames won</span><b>{pr.vsMe.myFrames} – {pr.vsMe.theirFrames}</b></div>
                    <div><span>Best break in these matches</span><b>{pr.vsMe.myBestBreak} – {pr.vsMe.theirBestBreak}</b></div>
                    {pr.vsMe.together > 0 && (
                      <div><span>Played together (same team)</span><b>{pr.vsMe.together} · {pr.vsMe.togetherWins} won</b></div>
                    )}
                  </div>
                </div>
              )}
            </section>
          )}

          <div className="ms-two">
            <section id="pots" className="ms-card" aria-labelledby="ms-pots">
              <h2 id="ms-pots" className="ms-h2">{isMe ? 'What you pot' : `What ${subject} pots`}</h2>
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
                    <p className="ms-insight">{cap(view.pots.byColour[0].ball)} is {their} most-potted colour.</p>
                  )}
                </>
              )}
            </section>

            <section id="fouls" className="ms-card" aria-labelledby="ms-fouls">
              <h2 id="ms-fouls" className="ms-h2">Fouls</h2>
              {view.pots === undefined ? (
                <div className="ms-mini-loading"><div className="spinner" /></div>
              ) : view.pots === null ? (
                <p className="ms-insight">No shot-by-shot data for this period.</p>
              ) : view.pots.fouls === 0 ? (
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
                    {Math.round((view.pots.foulsByBall[0].count / view.pots.fouls) * 100)}% of {their} fouls are on the {view.pots.foulsByBall[0].ball}.
                  </p>
                </>
              )}
            </section>
          </div>

          <div className="ms-two">
            <section id="days" className="ms-card" aria-labelledby="ms-days">
              <div className="ms-card-head">
                <h2 id="ms-days" className="ms-h2">{isMe ? 'When you play' : `When ${subject} plays`}</h2>
                <span className="ms-meta">avg match {shortDuration(s.avgMatchMs)} · {hours(s.tableMs)} at the table</span>
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
                <p className="ms-insight">{isMe ? 'You play' : `${subject} plays`} most on {DAY_NAMES[busiest.label]}{quietest.games < busiest.games ? `, least on ${DAY_NAMES[quietest.label]}` : ''}.</p>
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

          <div className="ms-two">
            <section id="formats" className="ms-card" aria-labelledby="ms-formats">
              <h2 id="ms-formats" className="ms-h2">By format</h2>
              <div className="ps-formats">
                {pr?.byFormat.map((f) => (
                  <div key={f.mode} className="ps-format">
                    <span className={`db-tag db-tag--${f.mode}`}>{modeLabel(f.mode)}</span>
                    <b>{f.wins}/{f.games}</b>
                    <span className="ms-meta">{f.winRate}% won</span>
                  </div>
                ))}
              </div>
              <div className="ps-vs-rows">
                <div><span>Fouls</span><b>{pr?.fouls ?? 0} · {dash(pr?.avgFoulsPerMatch)} per match</b></div>
                <div><span>Points</span><b>{pr?.totalPoints ?? 0} total</b></div>
                {pr?.firstAt && <div><span>First / latest match</span><b>{relativeDay(pr.firstAt)} · {relativeDay(pr.lastAt!)}</b></div>}
              </div>
            </section>

            <section id="recent" className="ms-card" aria-labelledby="ms-recent">
              <h2 id="ms-recent" className="ms-h2">Recent matches</h2>
              <ul className="ps-recent">
                {pr?.recent.map((m) => {
                  const won = !!subject && didWin(m, subject);
                  const p = m.players.find((x) => x.name === subject);
                  const opp = m.players.filter((x) => x.name !== subject && (!p?.teamName || x.teamName !== p.teamName)).map((x) => x.name);
                  return (
                    <li key={m.id}>
                      <button type="button" className="ps-recent-row" onClick={() => setOpenMatch(m)}>
                        <span className="ps-recent-day">{relativeDay(m.at)}</span>
                        <span className="ps-recent-opp">vs {opp.join(', ') || '—'}</span>
                        <span className="ps-recent-score">{p?.totalScore ?? 0}</span>
                        <span className={`db-form-dot${won ? ' is-win' : ''}`}>{won ? 'W' : 'L'}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </div>

          {!isMe && subject && (
            <div className="ps-thisisme">
              <button type="button" className="db-link" onClick={() => { update({ playerName: subject }); pick(subject); }}>
                This is me
              </button>
              <span className="ms-meta">Use if {subject} is the name you play under.</span>
            </div>
          )}

          <p className="ms-foot">Only matches recorded in this account count, not {their} whole record.</p>
        </main>
      )}
      {openMatch && (
        <MatchDetailsModal isOpen onClose={() => setOpenMatch(null)} matchData={toDetails(openMatch)} />
      )}
    </div>
  );
}
