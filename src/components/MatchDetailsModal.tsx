import { useState, useEffect, useRef } from 'react';
import type { ActionLogEntry } from '../engine/types';
import { getMatchFrames } from '../lib/database';
import { presentShareCard, cardFilename } from '../lib/shareImage';
import { drawMatchCard, drawFrameCard } from '../lib/shareCard';
import { Icon } from './ui';

interface PlayerDetail {
  name: string;
  teamName?: string;
  totalScore: number;
  highestBreak: number;
  framesWon: number;
  foulsCommitted: number;
  timeSpentMs: number;
}

interface FrameDetail {
  frameNumber: number;
  durationMs: number;
  actionLog: ActionLogEntry[];
}

export interface MatchDetailsData {
  id: string;
  date: string;
  mode: string;
  bestOf: number;
  redsCount: number;
  durationMs: number;
  winnerName: string;
  players: PlayerDetail[];
  frames?: FrameDetail[]; // Optional initially, loaded dynamically for DB
}

interface MatchDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  matchData: MatchDetailsData;
}

interface FrameAnalysis {
  redsPotted: Record<string, number>;
  colorsPotted: Record<string, number>;
  foulsCommitted: Record<string, number>;
  highestBreak: Record<string, number>;
}

export default function MatchDetailsModal({
  isOpen,
  onClose,
  matchData,
}: MatchDetailsModalProps) {
  const [frames, setFrames] = useState<FrameDetail[]>([]);
  const [loadingFrames, setLoadingFrames] = useState(false);
  const [activeFrameIndex, setActiveFrameIndex] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load frames dynamically if not already present
  useEffect(() => {
    if (!isOpen) return;

    if (matchData.frames && matchData.frames.length > 0) {
      setFrames(matchData.frames);
      setActiveFrameIndex(0);
    } else {
      setLoadingFrames(true);
      getMatchFrames(matchData.id)
        .then((dbFrames) => {
          const mapped = dbFrames.map((f) => ({
            frameNumber: f.frame_number,
            durationMs: f.duration_ms || 0,
            actionLog: (f.action_log as ActionLogEntry[]) || [],
          }));
          setFrames(mapped);
          if (mapped.length > 0) {
            setActiveFrameIndex(0);
          }
        })
        .finally(() => {
          setLoadingFrames(false);
        });
    }
  }, [isOpen, matchData]);

  if (!isOpen) return null;

  const formatDuration = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const formatTimeSimple = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${String(secs).padStart(2, '0')}`;
  };

  // Analyze action log for specific stats
  const analyzeFrameLog = (actionLog: ActionLogEntry[]): FrameAnalysis => {
    const analysis: FrameAnalysis = {
      redsPotted: {},
      colorsPotted: {},
      foulsCommitted: {},
      highestBreak: {},
    };

    matchData.players.forEach((p) => {
      analysis.redsPotted[p.name] = 0;
      analysis.colorsPotted[p.name] = 0;
      analysis.foulsCommitted[p.name] = 0;
      analysis.highestBreak[p.name] = 0;
    });

    let currentBreak = 0;
    let breakPlayer = '';

    actionLog.forEach((entry) => {
      const { playerName, type, ball, points } = entry;

      if (!analysis.redsPotted[playerName]) {
        analysis.redsPotted[playerName] = 0;
        analysis.colorsPotted[playerName] = 0;
        analysis.foulsCommitted[playerName] = 0;
        analysis.highestBreak[playerName] = 0;
      }

      if (type === 'pot' && ball) {
        if (ball === 'red') {
          analysis.redsPotted[playerName] += 1;
        } else {
          analysis.colorsPotted[playerName] += 1;
        }

        // Calculate break
        if (breakPlayer === playerName) {
          currentBreak += points || 0;
        } else {
          breakPlayer = playerName;
          currentBreak = points || 0;
        }
        analysis.highestBreak[playerName] = Math.max(
          analysis.highestBreak[playerName],
          currentBreak
        );
      } else if (type === 'foul' || type === 'inOff') {
        analysis.foulsCommitted[playerName] += 1;
        currentBreak = 0;
        breakPlayer = '';
      } else if (type === 'miss' || type === 'undo') {
        currentBreak = 0;
        breakPlayer = '';
      }
    });

    return analysis;
  };

  const handleShareCard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    drawMatchCard(canvas, {
      winnerName: matchData.winnerName,
      mode: matchData.mode,
      bestOf: matchData.bestOf,
      dateLabel: matchData.date,
      durationLabel: formatDuration(matchData.durationMs),
      redsCount: matchData.redsCount,
      players: matchData.players.map((p) => ({
        name: p.name,
        teamName: p.teamName,
        score: p.totalScore,
        framesWon: p.framesWon,
        highestBreak: p.highestBreak,
        fouls: p.foulsCommitted,
        isWinner:
          p.name === matchData.winnerName || p.teamName === matchData.winnerName,
      })),
    });

    await presentShareCard(
      canvas,
      cardFilename(matchData.players.slice(0, 2).map(p => p.name)),
      'SnookerBee match summary'
    );
  };

  const handleShareFrameCard = async (frame: FrameDetail) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const analysis = analyzeFrameLog(frame.actionLog);
    const names = matchData.players.map(p => p.name);
    const pick = (key: keyof FrameAnalysis) =>
      names.map(n => (analysis[key] && analysis[key][n]) || 0);

    drawFrameCard(canvas, {
      frameNumber: frame.frameNumber,
      mode: matchData.mode,
      dateLabel: matchData.date,
      durationLabel: formatDuration(frame.durationMs),
      playerNames: names,
      rows: [
        { label: 'Reds potted', values: pick('redsPotted'), higherIsBetter: true },
        { label: 'Colors potted', values: pick('colorsPotted'), higherIsBetter: true },
        { label: 'Highest break', values: pick('highestBreak'), higherIsBetter: true },
        { label: 'Fouls', values: pick('foulsCommitted'), higherIsBetter: false },
      ],
    });

    await presentShareCard(
      canvas,
      cardFilename(matchData.players.slice(0, 2).map(p => p.name), `frame-${frame.frameNumber}`),
      `SnookerBee frame ${frame.frameNumber}`
    );
  };

  const activeFrame = activeFrameIndex !== null ? frames[activeFrameIndex] : null;
  const frameAnalysis = activeFrame ? analyzeFrameLog(activeFrame.actionLog) : null;

  return (
    <div className="modal-backdrop modal-centered" onClick={onClose}>
      {/* Off-screen canvas for image generation */}
      <canvas ref={canvasRef} width={1600} height={1200} style={{ display: 'none' }} />

      <div className="ma-sheet" onClick={(e) => e.stopPropagation()}>
        <header className="ma-header">
          <div>
            <h3 className="ma-title">Match Analysis</h3>
            <span className="ma-date">{matchData.date}</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close match analysis">
            <Icon name="close" size={20} />
          </button>
        </header>

        <div className="ma-body">
          {/* Result */}
          <div className="ma-result">
            <div className="ma-result-top">
              <Icon name="trophy" size={26} className="ma-result-trophy" />
              <div className="ma-result-names">
                <span className="ma-result-label">Winner</span>
                <span className="ma-result-name">{matchData.winnerName}</span>
              </div>
            </div>

            <div className="ma-meta-row">
              <span className="ma-meta"><Icon name="clock" size={14} />{formatDuration(matchData.durationMs)}</span>
              <span className="ma-meta"><Icon name="target" size={14} />{matchData.mode.toUpperCase()}</span>
              <span className="ma-meta"><Icon name="ball" size={14} />Best of {matchData.bestOf}</span>
            </div>

            <button className="ma-share" onClick={() => { void handleShareCard(); }}>
              <Icon name="share" size={17} />
              Share Summary Card
            </button>
          </div>

          {/* Players — stacked cards rather than a table, so nothing is cut off
              on a phone the way the old six-column layout was. */}
          <section className="ma-section">
            <h4 className="ma-section-title">Player Performance</h4>
            <div className="ma-players">
              {matchData.players.map((p, i) => {
                const isWinner =
                  p.name === matchData.winnerName || p.teamName === matchData.winnerName;
                return (
                  <article key={i} className={`ma-player${isWinner ? ' is-winner' : ''}`}>
                    <div className="ma-player-head">
                      {isWinner && <Icon name="trophy" size={15} className="ma-player-trophy" />}
                      <span className="ma-player-name">{p.name}</span>
                      {p.teamName ? <span className="ma-team">{p.teamName}</span> : null}
                      <span className="ma-player-score">{p.totalScore}</span>
                    </div>
                    <div className="ma-stats">
                      <div className="ma-stat">
                        <b>{p.framesWon}</b><span>Frames</span>
                      </div>
                      <div className="ma-stat">
                        <b>{p.highestBreak}</b><span>Max break</span>
                      </div>
                      <div className="ma-stat">
                        <b className={p.foulsCommitted > 0 ? 'is-warn' : undefined}>{p.foulsCommitted}</b><span>Fouls</span>
                      </div>
                      <div className="ma-stat">
                        <b>{formatTimeSimple(p.timeSpentMs)}</b><span>Time</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>

          {/* Frames */}
          <section className="ma-section">
            <h4 className="ma-section-title">Frame Breakdown</h4>
            {loadingFrames ? (
              <div className="spinner-container">
                <div className="spinner" />
              </div>
            ) : frames.length === 0 ? (
              <p className="ma-empty">No frame data recorded for this match.</p>
            ) : (
              <>
                <div className="ma-chips">
                  {frames.map((f, idx) => (
                    <div key={idx} className={`ma-chip${activeFrameIndex === idx ? ' is-active' : ''}`}>
                      <button
                        className="ma-chip-main"
                        onClick={() => setActiveFrameIndex(idx)}
                        aria-pressed={activeFrameIndex === idx}
                      >
                        <span className="ma-chip-n">Frame {f.frameNumber}</span>
                        <span className="ma-chip-t">{formatDuration(f.durationMs)}</span>
                      </button>
                      <button
                        className="ma-chip-share"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleShareFrameCard(f);
                        }}
                        aria-label={`Share frame ${f.frameNumber} card`}
                      >
                        <Icon name="share" size={15} />
                      </button>
                    </div>
                  ))}
                </div>

                {activeFrame && frameAnalysis && (
                  <div className="ma-frame">
                    <div className="ma-players">
                      {matchData.players.map((p, i) => (
                        <article key={i} className="ma-player">
                          <div className="ma-player-head">
                            <span className="ma-player-name">{p.name}</span>
                          </div>
                          <div className="ma-stats">
                            <div className="ma-stat">
                              <b>{frameAnalysis.redsPotted[p.name] || 0}</b><span>Reds</span>
                            </div>
                            <div className="ma-stat">
                              <b>{frameAnalysis.colorsPotted[p.name] || 0}</b><span>Colors</span>
                            </div>
                            <div className="ma-stat">
                              <b>{frameAnalysis.highestBreak[p.name] || 0}</b><span>Break</span>
                            </div>
                            <div className="ma-stat">
                              <b className={(frameAnalysis.foulsCommitted[p.name] || 0) > 0 ? 'is-warn' : undefined}>
                                {frameAnalysis.foulsCommitted[p.name] || 0}
                              </b><span>Fouls</span>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>

                    <h5 className="ma-sub-title">Event Timeline</h5>
                    <ol className="ma-timeline">
                      {activeFrame.actionLog.length === 0 ? (
                        <li className="ma-empty">No events logged in this frame.</li>
                      ) : (
                        activeFrame.actionLog.map((entry, idx) => (
                          <li key={idx} className={`ma-event ma-event--${entry.type}`}>
                            <span className="ma-event-dot" />
                            <span className="ma-event-who">{entry.playerName}</span>
                            <span className="ma-event-what">{entry.description}</span>
                          </li>
                        ))
                      )}
                    </ol>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
