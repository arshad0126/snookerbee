import { useReducer, useEffect, useState, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { BallType } from '../engine/types';
import {
  centuryReducer,
  createCenturyState,
  currentPlayer,
  isBallBlocked,
  wouldBust,
  isCheckout,
  CENTURY_VALUES,
  RED_MISS_PENALTY,
  type CenturySetup,
} from '../engine/century';
import { audio } from '../lib/audio';
import { Icon } from './ui';
import WallClock from './WallClock';
import {
  saveCenturyGame as cacheCenturyGame,
  loadCenturyGame,
  clearCenturyGame,
} from '../lib/matchStorage';
import {
  saveCenturyGame as persistCenturyGame,
  saveCenturyGameLocally,
} from '../lib/database';
import { useAuth } from '../hooks/useAuth';

const BALLS: BallType[] = ['red', 'yellow', 'green', 'brown', 'blue', 'pink', 'black'];

const BALL_LABELS: Record<BallType, string> = {
  red: 'RED', yellow: 'YEL', green: 'GRN', brown: 'BRN',
  blue: 'BLU', pink: 'PNK', black: 'BLK',
};

export default function CenturyScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const setup = location.state?.setup as CenturySetup | undefined;

  const [state, dispatch] = useReducer(
    centuryReducer,
    undefined,
    () =>
      setup
        ? createCenturyState(setup)
        : loadCenturyGame() ?? createCenturyState({ target: 50, players: [] })
  );

  const [foulOpen, setFoulOpen] = useState(false);
  const { isGuest } = useAuth();
  const savedRef = useRef(false);

  // Save the result once, the moment the game ends. Same lesson as matches:
  // a result that needs a button press to survive is a result that gets lost.
  useEffect(() => {
    if (!state.finished || savedRef.current || state.players.length === 0) return;
    savedRef.current = true;

    const loser = state.players.find((p) => p.finishedAt === null);
    const durationMs = Math.max(0, Date.now() - Date.parse(state.startedAt));

    if (isGuest) {
      saveCenturyGameLocally({
        id: `century_${Date.now()}`,
        target: state.target,
        createdAt: state.startedAt,
        durationMs,
        loserName: loser?.name ?? null,
        players: state.players.map((p) => ({
          name: p.name,
          score: p.score,
          finishedAt: p.finishedAt,
          potted: p.potted,
          redsPotted: p.redsPotted,
          redsMissed: p.redsMissed,
          fouls: p.fouls,
        })),
      });
      return;
    }

    void persistCenturyGame(
      {
        target: state.target,
        duration_ms: durationMs,
        loser_name: loser?.name ?? null,
      },
      state.players.map((p) => ({
        player_name: p.name,
        final_score: p.score,
        finished_at: p.finishedAt,
        balls_potted: p.potted,
        reds_potted: p.redsPotted,
        reds_missed: p.redsMissed,
        fouls: p.fouls,
      }))
    );
  }, [state, isGuest]);

  // The AudioContext can only be created from a user gesture, so it is armed
  // on first interaction exactly as the scoring screen does. Without this
  // nothing would play at all.
  useEffect(() => {
    const arm = () => {
      audio.init();
      window.removeEventListener('click', arm);
      window.removeEventListener('touchstart', arm);
    };
    window.addEventListener('click', arm);
    window.addEventListener('touchstart', arm);
    return () => {
      window.removeEventListener('click', arm);
      window.removeEventListener('touchstart', arm);
    };
  }, []);

  // Fanfare when the game resolves.
  useEffect(() => {
    if (state.finished) audio.playVictory();
  }, [state.finished]);

  // Nothing to play — no setup and nothing stored.
  useEffect(() => {
    if (!setup && state.players.length === 0) navigate('/setup');
  }, [setup, state.players.length, navigate]);

  // Same lesson as the snooker screen: iOS can end the app at any moment.
  useEffect(() => {
    if (state.players.length === 0) return;
    if (state.finished) clearCenturyGame();
    else cacheCenturyGame(state);
  }, [state]);

  const player = currentPlayer(state);
  if (!player) return null;

  const remaining = state.target - player.score;

  const pot = (ball: BallType) => {
    // Busting is not a pot — it sounds like the miss it effectively is.
    if (wouldBust(state, ball)) {
      audio.playMiss();
      dispatch({ type: 'POT', ball });
      return;
    }

    audio.playPot();
    // Landing exactly on the target is this game's milestone.
    if (isCheckout(state, ball)) {
      setTimeout(() => audio.playBreakMilestone(), 260);
    }
    dispatch({ type: 'POT', ball });
  };

  return (
    <div className="scoring-screen felt-bg century-screen">
      <header className="century-topbar">
        <div className="century-topbar-side">
          <span className="century-target">{state.target}</span>
          <span className="century-target-label">target</span>
        </div>

        <WallClock frameStartTime={state.startedAt} />

        <div className="century-topbar-side century-topbar-right">
          <button
            onClick={() => {
              if (window.confirm('Abandon this game?')) {
                clearCenturyGame();
                navigate('/dashboard');
              }
            }}
            className="icon-btn icon-btn--danger"
            aria-label="Abandon game"
          >
            <Icon name="exit" size={18} />
          </button>
        </div>
      </header>

      {/* Standings — the scoring screen's player panels, same visual weight */}
      <div className="scoring-players-row century-players">
        {state.turnOrder.map((idx) => {
          const p = state.players[idx];
          const active = !state.finished && idx === state.turnOrder[state.currentTurn];
          return (
            <div
              key={p.id}
              className={`player-panel-horizontal ${active ? 'active' : ''} ${
                p.finishedAt ? 'century-done' : ''
              }`}
            >
              <div className="player-card-top">
                <div className="player-card-meta-left">
                  <div className="player-avatar-circle">
                    {p.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="player-card-name-wrapper">
                    <span className="player-card-name">{p.name}</span>
                    {active && <span className="glowing-active-dot" />}
                  </div>
                </div>
                {p.finishedAt && (
                  <span className="century-done-badge">#{p.finishedAt}</span>
                )}
              </div>

              <div className="player-card-middle">
                <div className="player-score-pill">{p.score}</div>
                <div className="player-break-badge">
                  {p.finishedAt ? 'safe' : `needs ${state.target - p.score}`}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Balls — same cards as the scoring screen, so the two read as one app */}
      <div className="scoring-ball-cards-row century-balls">
        {BALLS.map((ball) => {
          const blocked = isBallBlocked(state, ball);
          const busts = wouldBust(state, ball);
          const checkout = isCheckout(state, ball);
          const dulled = blocked || busts;
          return (
            <button
              key={ball}
              onClick={() => pot(ball)}
              disabled={blocked || state.finished}
              className={`scoring-ball-card ball-${ball} ${dulled ? 'dimmed' : ''} ${
                checkout ? 'expected' : ''
              }`}
              title={
                blocked
                  ? 'Potted twice already — take another ball'
                  : busts
                    ? `Past ${state.target} — would not score`
                    : undefined
              }
            >
              <span className="ball-card-name">{BALL_LABELS[ball]}</span>
              <span className="ball-card-points">+{CENTURY_VALUES[ball]}</span>
              {checkout && <span className="century-flag">FINISH</span>}
              {blocked && <span className="century-flag century-flag--stop">×2</span>}
            </button>
          );
        })}
      </div>

      {/* Turn outcomes — the scoring screen's premium action row */}
      <div className="action-buttons-row-premium century-actions">
        <button
          onClick={() => { audio.playUndo(); dispatch({ type: 'UNDO' }); }}
          disabled={state.undoStack.length === 0}
          className="btn-action-premium btn-action-undo"
        >
          <Icon name="arrow-left" size={15} /> UNDO
        </button>
        <button
          onClick={() => { audio.playFoul(); dispatch({ type: 'MISS_RED' }); }}
          disabled={state.finished}
          className="btn-action-premium btn-action-foul"
        >
          <Icon name="alert" size={15} /> MISSED RED −{RED_MISS_PENALTY}
        </button>
        <button
          onClick={() => setFoulOpen(true)}
          disabled={state.finished}
          className="btn-action-premium btn-action-foul btn-action-foul--soft"
        >
          FOUL
        </button>
        <button
          onClick={() => { audio.playMiss(); dispatch({ type: 'MISS_COLOUR' }); }}
          disabled={state.finished}
          className="btn-action-premium btn-action-pass"
        >
          PASS <Icon name="pass" size={17} />
        </button>
      </div>

      <p className="century-hint">
        {state.finished
          ? 'Game over'
          : `${player.name} to play · ${remaining} to go`}
      </p>

      {/* Foul: which ball? */}
      {foulOpen && (
        <div className="modal-backdrop modal-centered" onClick={() => setFoulOpen(false)}>
          <div className="century-foul-card" onClick={(e) => e.stopPropagation()}>
            <h3 className="century-foul-title">Foul on which ball?</h3>
            <div className="century-foul-balls">
              {BALLS.map((ball) => (
                <button
                  key={ball}
                  onClick={() => {
                    audio.playFoul();
                    dispatch({ type: 'FOUL', ball });
                    setFoulOpen(false);
                  }}
                  className={`scoring-ball-card ball-${ball}`}
                >
                  <span className="ball-card-name">{BALL_LABELS[ball]}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setFoulOpen(false)} className="btn btn-ghost">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {state.finished && (
        <div className="modal-backdrop modal-centered">
          <div className="century-result-card">
            <h2 className="century-result-title">Game over</h2>
            <ol className="century-result-list">
              {[...state.players]
                .sort((a, b) => (a.finishedAt ?? 99) - (b.finishedAt ?? 99))
                .map((p) => (
                  <li
                    key={p.id}
                    className={`century-result-row ${
                      p.finishedAt === null ? 'loser' : ''
                    }`}
                  >
                    <span className="century-result-pos">
                      {p.finishedAt ?? '—'}
                    </span>
                    <span className="century-result-name">{p.name}</span>
                    <span className="century-result-score">
                      {p.finishedAt === null ? `${p.score} · lost` : p.score}
                    </span>
                  </li>
                ))}
            </ol>
            <button
              onClick={() => { clearCenturyGame(); navigate('/dashboard'); }}
              className="btn btn-primary btn-lg"
              style={{ width: '100%' }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
