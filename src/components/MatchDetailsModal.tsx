import { useState, useEffect, useRef } from 'react';
import type { ActionLogEntry } from '../engine/types';
import { getMatchFrames } from '../lib/database';
import { presentShareCard, cardFilename } from '../lib/shareImage';
import { drawMatchCard, drawFrameCard } from '../lib/shareCard';

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

      <div className="match-details-card" onClick={(e) => e.stopPropagation()}>
        <header className="match-details-header">
          <div>
            <h3 className="match-details-title">Match Analysis</h3>
            <span className="match-details-subtitle">{matchData.date}</span>
          </div>
          <button className="match-details-close-btn" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="match-details-body">
          {/* Quick summary header */}
          <div className="details-summary-strip">
            <div className="summary-strip-item">
              <span className="strip-label">WINNER</span>
              <span className="strip-val winner-text">🏆 {matchData.winnerName}</span>
            </div>
            <div className="summary-strip-item">
              <span className="strip-label">DURATION</span>
              <span className="strip-val">⏱ {formatDuration(matchData.durationMs)}</span>
            </div>
            <div className="summary-strip-item">
              <span className="strip-label">MODE</span>
              <span className="strip-val">{matchData.mode.toUpperCase()}</span>
            </div>
            <button className="btn btn-primary share-card-btn" onClick={() => { void handleShareCard(); }}>
              📤 Share Summary Card
            </button>
          </div>

          {/* Player stats comparison */}
          <section className="details-section">
            <h4 className="section-title-small">Player Performance</h4>
            <div className="details-players-table-wrapper">
              <table className="details-players-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th className="text-center">Score</th>
                    <th className="text-center">Frames Won</th>
                    <th className="text-center">Max Break</th>
                    <th className="text-center">Fouls</th>
                    <th className="text-center">Time Spent</th>
                  </tr>
                </thead>
                <tbody>
                  {matchData.players.map((p, i) => {
                    const isWinner = p.name === matchData.winnerName || p.teamName === matchData.winnerName;
                    return (
                      <tr key={i} className={isWinner ? 'winner-row' : ''}>
                        <td>
                          {p.teamName ? <span className="team-badge">{p.teamName}</span> : null}{' '}
                          <span className="player-bold">{p.name}</span>
                        </td>
                        <td className="text-center">{p.totalScore}</td>
                        <td className="text-center font-bold text-lavender">{p.framesWon}</td>
                        <td className="text-center">{p.highestBreak}</td>
                        <td className="text-center text-red">{p.foulsCommitted}</td>
                        <td className="text-center">{formatTimeSimple(p.timeSpentMs)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* Frame-by-frame breakdown */}
          <section className="details-section">
            <h4 className="section-title-small">Frame Breakdown</h4>
            {loadingFrames ? (
              <div className="spinner-container">
                <div className="spinner" />
              </div>
            ) : frames.length === 0 ? (
              <div className="no-frames-text">No frame data recorded for this match.</div>
            ) : (
              <div>
                {/* Frame list tabs */}
                <div className="frame-tabs">
                  {frames.map((f, idx) => (
                    <div key={idx} className="frame-tab-container">
                      <button
                        onClick={() => setActiveFrameIndex(idx)}
                        className={`frame-tab-btn ${activeFrameIndex === idx ? 'active' : ''}`}
                      >
                        Frame {f.frameNumber} ({formatDuration(f.durationMs)})
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleShareFrameCard(f);
                        }}
                        className="frame-share-icon-btn"
                        title={`Share Frame ${f.frameNumber} Summary Card`}
                      >
                        📤
                      </button>
                    </div>
                  ))}
                </div>

                {/* Active Frame details */}
                {activeFrame && frameAnalysis && (
                  <div className="frame-analysis-panel">
                    <h5 className="analysis-panel-title">Frame {activeFrame.frameNumber} Statistics</h5>
                    
                    {/* Computed frame stats */}
                    <div className="frame-stats-grid">
                      {matchData.players.map((p, i) => (
                        <div key={i} className="frame-player-stat-card">
                          <span className="stat-player-name">{p.name}</span>
                          <div className="stat-rows">
                            <div className="stat-row">
                              <span>Reds Potted</span>
                              <span className="stat-val font-bold text-green">
                                {frameAnalysis.redsPotted[p.name] || 0}
                              </span>
                            </div>
                            <div className="stat-row">
                              <span>Colors Potted</span>
                              <span className="stat-val font-bold text-lavender">
                                {frameAnalysis.colorsPotted[p.name] || 0}
                              </span>
                            </div>
                            <div className="stat-row">
                              <span>Fouls Committed</span>
                              <span className="stat-val font-bold text-red">
                                {frameAnalysis.foulsCommitted[p.name] || 0}
                              </span>
                            </div>
                            <div className="stat-row">
                              <span>Highest Break</span>
                              <span className="stat-val font-bold">
                                {frameAnalysis.highestBreak[p.name] || 0}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Frame event timeline */}
                    <h5 className="analysis-panel-title" style={{ marginTop: 'var(--space-md)' }}>
                      Event Timeline
                    </h5>
                    <div className="frame-timeline">
                      {activeFrame.actionLog.length === 0 ? (
                        <div className="no-events-text">No events logged in this frame.</div>
                      ) : (
                        activeFrame.actionLog.map((entry, idx) => {
                          const isFoul = entry.type === 'foul' || entry.type === 'inOff';
                          return (
                            <div key={idx} className="timeline-item">
                              <div className="timeline-dot-wrapper">
                                <span className={`timeline-dot dot-${entry.type} ${isFoul ? 'dot-foul' : ''}`} />
                              </div>
                              <div className="timeline-content">
                                <span className="timeline-player">{entry.playerName}</span>
                                <p className="timeline-desc">{entry.description}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
