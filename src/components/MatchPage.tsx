import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ActionLogEntry, BallType } from '../engine/types';
import { useAuth } from '../hooks/useAuth';
import { getMatchFrames } from '../lib/database';
import { loadHistory, type HistoryMatch } from '../lib/history';
import { framesPlayed } from '../lib/playerStats';
import { computeFrameResult } from '../lib/frameResult';
import { frameProgress, frameStats, frameVisits, isEmptyFrame, sidesOf, type Visit } from '../lib/frameAnalysis';
import { frameLine, modeLabel, pointsLeader, relativeDay, shortDuration } from '../lib/results';
import { drawFrameCard, drawMatchCard } from '../lib/shareCard';
import { cardFilename, presentShareCard } from '../lib/shareImage';
import ThemeBackdrop from './ThemeBackdrop';
import PlayerLink from './PlayerLink';
import FrameChart from './FrameChart';
import { Icon } from './ui';

/**
 * One match, as a full page (was a popup): the result, a scoreboard, every
 * frame, and for the chosen frame how the points built up and how the play
 * went, visit by visit.
 */

interface PageFrame {
  frameNumber: number;
  durationMs: number;
  actionLog: ActionLogEntry[];
  /** Saved since 2.0; undefined for older frames. null = unfinished or level. */
  winnerName?: string | null;
}

const BALL_SHORT: Record<BallType, string> = {
  red: 'Red', yellow: 'Yellow', green: 'Green', brown: 'Brown', blue: 'Blue', pink: 'Pink', black: 'Black',
};

const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function MatchPage() {
  const { id } = useParams();
  const { isGuest } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [match, setMatch] = useState<HistoryMatch | null | undefined>(undefined);
  const [frames, setFrames] = useState<PageFrame[] | null>(null);
  const [active, setActive] = useState(0);
  const [showMisses, setShowMisses] = useState(false);

  useEffect(() => {
    let live = true;
    void loadHistory(isGuest).then(async (h) => {
      const m = h.matches.find((x) => x.id === id) ?? null;
      if (!live) return;
      setMatch(m);
      if (!m) return;
      if (m.frames?.length) {
        setFrames(m.frames.map((f) => ({ ...f, actionLog: f.actionLog ?? [] })));
      } else {
        const rows = await getMatchFrames(m.id);
        if (!live) return;
        setFrames(rows.map((r) => ({
          frameNumber: r.frame_number,
          durationMs: r.duration_ms || 0,
          actionLog: (r.action_log as ActionLogEntry[]) ?? [],
          winnerName: r.winner_name,
        })));
      }
    });
    return () => { live = false; };
  }, [id, isGuest]);

  const players = match?.players ?? [];
  const sides = useMemo(() => sidesOf(players.map((p) => ({ name: p.name, teamName: p.teamName }))), [players]);

  // Frames that were actually played — an empty last frame (started, then
  // the match was ended) is left out.
  const shown = useMemo(() => {
    if (!frames || !match) return [];
    const played = framesPlayed(match);
    return frames
      .filter((f) => !isEmptyFrame(f.actionLog))
      .map((f, i) => {
        const result = computeFrameResult(f.actionLog, players);
        // Saved winner first; otherwise the log's leader, but only for frames
        // that were finished (the saved frame counts say how many).
        const winner = f.winnerName !== undefined ? f.winnerName : i < played ? result.winnerName : null;
        return { ...f, result, winner };
      });
  }, [frames, match, players]);

  if (match === undefined) {
    return <div className="ms-page ms-page--loading"><div className="spinner" /></div>;
  }
  if (match === null) {
    return (
      <div className="ms-page">
        <ThemeBackdrop />
        <header className="ms-header">
          <button type="button" className="st-back" onClick={() => navigate(-1)} aria-label="Back"><Icon name="arrow-left" size={18} /></button>
          <div className="ms-titles"><h1 className="st-title">Match not found</h1><span className="ms-sub">It may have been deleted.</span></div>
        </header>
      </div>
    );
  }

  const isDraw = !match.winner;
  const line = frameLine(players);
  const note = isDraw ? pointsLeader(players) : null;
  const when = `${relativeDay(match.at)}, ${new Date(match.at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  const ranked = [...players].sort((a, b) => b.framesWon - a.framesWon || b.totalScore - a.totalScore);
  const isWinner = (p: (typeof players)[number]) => !!match.winner && (p.name === match.winner || p.teamName === match.winner);

  const current = shown[Math.min(active, Math.max(0, shown.length - 1))];
  const stats = current ? frameStats(current.actionLog, players) : null;
  const progress = current ? frameProgress(current.actionLog, players) : [];
  const visits = current ? frameVisits(current.actionLog) : [];
  const visible = showMisses ? visits : visits.filter((v) => v.kind !== 'miss');
  const misses = visits.length - visits.filter((v) => v.kind !== 'miss').length;

  const shareMatch = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawMatchCard(canvas, {
      winnerName: match.winner ?? 'Draw',
      mode: match.mode,
      bestOf: match.bestOf,
      dateLabel: when,
      durationLabel: shortDuration(match.durationMs),
      redsCount: match.redsCount,
      players: players.map((p) => ({
        name: p.name, teamName: p.teamName, score: p.totalScore, framesWon: p.framesWon,
        highestBreak: p.highestBreak, fouls: p.foulsCommitted, isWinner: isWinner(p),
      })),
    });
    await presentShareCard(canvas, cardFilename(players.slice(0, 2).map((p) => p.name)), 'SnookerBee match summary');
  };

  const shareFrame = async (f: (typeof shown)[number]) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const s = frameStats(f.actionLog, players);
    const names = players.map((p) => p.name);
    const pick = (k: 'reds' | 'colours' | 'highestBreak' | 'fouls') => names.map((n) => s[n]?.[k] ?? 0);
    drawFrameCard(canvas, {
      frameNumber: f.frameNumber,
      ranked: f.result.ranked,
      winnerName: f.winner,
      mode: match.mode,
      dateLabel: when,
      durationLabel: shortDuration(f.durationMs),
      playerNames: names,
      rows: [
        { label: 'Reds potted', values: pick('reds'), higherIsBetter: true },
        { label: 'Colors potted', values: pick('colours'), higherIsBetter: true },
        { label: 'Highest break', values: pick('highestBreak'), higherIsBetter: true },
        { label: 'Fouls', values: pick('fouls'), higherIsBetter: false },
      ],
    });
    await presentShareCard(canvas, cardFilename(names.slice(0, 2), `frame-${f.frameNumber}`), `SnookerBee frame ${f.frameNumber}`);
  };

  const sideIndex = (name: string) => {
    const p = players.find((x) => x.name === name);
    const side = p?.teamName && sides.includes(p.teamName) ? p.teamName : name;
    return Math.max(0, sides.indexOf(side));
  };

  return (
    <div className="ms-page mp-page">
      <ThemeBackdrop />
      <canvas ref={canvasRef} width={1600} height={1200} style={{ display: 'none' }} />

      <header className="ms-header">
        <button type="button" className="st-back" onClick={() => navigate(-1)} aria-label="Back">
          <Icon name="arrow-left" size={18} />
        </button>
        <div className="ms-titles">
          <h1 className="st-title">Match</h1>
          <span className="ms-sub">{when} · {modeLabel(match.mode)} · Best of {match.bestOf} · {shortDuration(match.durationMs)}</span>
        </div>
        <button type="button" className="mp-share" onClick={() => { void shareMatch(); }}>
          <Icon name="share" size={16} /> Share
        </button>
      </header>

      <main className="ms-body">
        {/* Result + scoreboard */}
        <section className="ms-card mp-result" aria-label="Result">
          <div className="mp-hero">
            <span className="mp-eyebrow">{isDraw ? 'Result' : 'Winner'}</span>
            <span className="mp-hero-main">
              {!isDraw && <Icon name="trophy" size={24} className="mp-trophy" />}
              {isDraw ? `Draw · ${line}` : `${match.winner} · ${line}`}
            </span>
            {note && <span className="mp-hero-note">{note.name} scored more points ({note.line}), but matches are decided on frames.</span>}
          </div>

          <div className="mp-board" role="table" aria-label="Scoreboard">
            <div className="mp-board-row mp-board-head" role="row">
              <span role="columnheader">Player</span>
              <span role="columnheader">Frames</span>
              <span role="columnheader">Points</span>
              <span role="columnheader">Best break</span>
              <span role="columnheader">Fouls</span>
              <span role="columnheader">Time</span>
            </div>
            {ranked.map((p) => (
              <div key={p.name} className={`mp-board-row${isWinner(p) ? ' is-winner' : ''}`} role="row">
                <span role="cell" className="mp-board-name">
                  <i className="mp-swatch" style={{ background: `var(--mp-s${(sideIndex(p.name) % 8) + 1})` }} />
                  <PlayerLink name={p.name} />
                  {p.teamName && <small>{p.teamName}</small>}
                </span>
                <span role="cell" className="mp-num mp-strong">{p.framesWon}</span>
                <span role="cell" className="mp-num">{p.totalScore}</span>
                <span role="cell" className="mp-num">
                  {p.highestBreak}
                  {(p.centuries ?? 0) + (p.halfCenturies ?? 0) > 0 && <small> · {(p.centuries ?? 0) > 0 ? `${p.centuries}×100+` : `${p.halfCenturies}×50+`}</small>}
                </span>
                <span role="cell" className={`mp-num${p.foulsCommitted > 0 ? ' ms-bad' : ''}`}>{p.foulsCommitted}</span>
                <span role="cell" className="mp-num mp-muted">{clock(p.timeSpentMs)}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Frames */}
        <section className="ms-card" aria-labelledby="mp-frames">
          <div className="ms-card-head">
            <h2 id="mp-frames" className="ms-h2">Frames</h2>
            <span className="ms-meta">Tap a frame to see how it went</span>
          </div>
          {frames === null ? (
            <div className="ms-mini-loading"><div className="spinner" /></div>
          ) : shown.length === 0 ? (
            <p className="ms-insight">No shots were recorded for this match.</p>
          ) : (
            <div className="mp-frames" role="tablist">
              {shown.map((f, i) => (
                <div key={f.frameNumber} className={`mp-frame${i === active ? ' is-active' : ''}`}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={i === active}
                    className="mp-frame-main"
                    onClick={() => setActive(i)}
                  >
                    <span className="mp-frame-n">Frame {f.frameNumber}</span>
                    <span className="mp-frame-who">
                      {f.winner ? <><Icon name="trophy" size={13} /> {f.winner}</> : 'Not finished'}
                    </span>
                    <span className="mp-frame-score">{f.result.ranked.map((r) => r.score).join('–')} · {shortDuration(f.durationMs)}</span>
                  </button>
                  <button type="button" className="mp-frame-share" onClick={() => { void shareFrame(f); }} aria-label={`Share frame ${f.frameNumber}`}>
                    <Icon name="share" size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {current && stats && (
          <>
            <div className="ms-two mp-two">
              <section className="ms-card" aria-labelledby="mp-chart">
                <div className="ms-card-head">
                  <h2 id="mp-chart" className="ms-h2">How frame {current.frameNumber} went</h2>
                  <span className="ms-meta">Points after every scoring shot</span>
                </div>
                <FrameChart points={progress} sides={sides} />
              </section>

              <section className="ms-card" aria-labelledby="mp-fstats">
                <div className="ms-card-head">
                  <h2 id="mp-fstats" className="ms-h2">Frame {current.frameNumber} by player</h2>
                  <span className="ms-meta">{shortDuration(current.durationMs)}</span>
                </div>
                <div className="mp-fstats" role="table">
                  <div className="mp-fstats-row mp-board-head" role="row">
                    <span role="columnheader">Player</span>
                    <span role="columnheader">Points</span>
                    <span role="columnheader">Reds</span>
                    <span role="columnheader">Colours</span>
                    <span role="columnheader">Break</span>
                    <span role="columnheader">Fouls</span>
                  </div>
                  {[...players]
                    .sort((a, b) => (stats[b.name]?.points ?? 0) - (stats[a.name]?.points ?? 0))
                    .map((p) => {
                      const s = stats[p.name];
                      return (
                        <div key={p.name} className="mp-fstats-row" role="row">
                          <span role="cell" className="mp-board-name">
                            <i className="mp-swatch" style={{ background: `var(--mp-s${(sideIndex(p.name) % 8) + 1})` }} />
                            {p.name}
                          </span>
                          <span role="cell" className="mp-num mp-strong">{s?.points ?? 0}</span>
                          <span role="cell" className="mp-num">{s?.reds ?? 0}</span>
                          <span role="cell" className="mp-num">{s?.colours ?? 0}</span>
                          <span role="cell" className="mp-num">{s?.highestBreak ?? 0}</span>
                          <span role="cell" className={`mp-num${(s?.fouls ?? 0) > 0 ? ' ms-bad' : ''}`}>{s?.fouls ?? 0}</span>
                        </div>
                      );
                    })}
                </div>
              </section>
            </div>

            <section className="ms-card" aria-labelledby="mp-play">
              <div className="ms-card-head">
                <h2 id="mp-play" className="ms-h2">Frame {current.frameNumber}, visit by visit</h2>
                {misses > 0 && (
                  <button type="button" className="db-link" onClick={() => setShowMisses((v) => !v)}>
                    {showMisses ? 'Hide misses' : `Show ${misses} miss${misses === 1 ? '' : 'es'}`}
                  </button>
                )}
              </div>
              <ol className="mp-visits">
                {visible.map((v, i) => <VisitRow key={i} v={v} swatch={`var(--mp-s${(sideIndex(v.player) % 8) + 1})`} />)}
              </ol>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function VisitRow({ v, swatch }: { v: Visit; swatch: string }) {
  if (v.kind === 'break') {
    return (
      <li className="mp-visit">
        <i className="mp-swatch" style={{ background: swatch }} />
        <span className="mp-visit-who">{v.player}</span>
        <span className="mp-balls" aria-label={v.balls.map((b) => BALL_SHORT[b]).join(', ')}>
          {v.balls.map((b, i) => <span key={i} className={`mp-ball mp-ball--${b}`} title={BALL_SHORT[b]} />)}
          {v.freeBall && <span className="mp-tag">free ball</span>}
        </span>
        <b className="mp-visit-pts">{v.balls.length > 1 ? `Break ${v.points}` : `+${v.points}`}</b>
      </li>
    );
  }
  if (v.kind === 'foul') {
    return (
      <li className="mp-visit mp-visit--foul">
        <i className="mp-swatch" style={{ background: swatch }} />
        <span className="mp-visit-who">{v.player}</span>
        <span className="mp-visit-what">
          {v.inOff ? 'In-off' : 'Foul'}{v.ball ? ` on the ${BALL_SHORT[v.ball].toLowerCase()}` : ''}
          {v.to.length > 0 && <> · +{v.points} to {v.to.join(', ')}</>}
        </span>
        <b className="mp-visit-pts ms-bad">Foul</b>
      </li>
    );
  }
  if (v.kind === 'miss') {
    return (
      <li className="mp-visit mp-visit--miss">
        <i className="mp-swatch" style={{ background: swatch }} />
        <span className="mp-visit-who">{v.player}</span>
        <span className="mp-visit-what">No score</span>
        <span />
      </li>
    );
  }
  return <li className="mp-visit mp-visit--note"><span className="mp-visit-what">{v.text}</span></li>;
}
