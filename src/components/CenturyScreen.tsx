import { useReducer, useEffect, useState } from 'react';
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
  saveCenturyGame,
  loadCenturyGame,
  clearCenturyGame,
} from '../lib/matchStorage';

const BALLS: BallType[] = ['red', 'yellow', 'green', 'brown', 'blue', 'pink', 'black'];

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

  // Nothing to play — no setup and nothing stored.
  useEffect(() => {
    if (!setup && state.players.length === 0) navigate('/setup');
  }, [setup, state.players.length, navigate]);

  // Same lesson as the snooker screen: iOS can end the app at any moment.
  useEffect(() => {
    if (state.players.length === 0) return;
    if (state.finished) clearCenturyGame();
    else saveCenturyGame(state);
  }, [state]);

  const player = currentPlayer(state);
  if (!player) return null;

  const remaining = state.target - player.score;

  const pot = (ball: BallType) => {
    audio.playPot();
    dispatch({ type: 'POT', ball });
  };

  return (
    <div className="century-screen">
      <header className="century-topbar">
        <div className="century-topbar-side">
          <span className="century-target">{state.target}</span>
          <span className="century-target-label">target</span>
        </div>

        <WallClock frameStartTime={state.startedAt} />

        <div className="century-topbar-side century-topbar-right">
          <button
            onClick={() => dispatch({ type: 'UNDO' })}
            disabled={state.undoStack.length === 0}
            className="icon-btn"
            aria-label="Undo"
          >
            <Icon name="arrow-left" size={18} />
          </button>
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

      {/* Standings */}
      <div className="century-players">
        {state.turnOrder.map((idx) => {
          const p = state.players[idx];
          const active = !state.finished && idx === state.turnOrder[state.currentTurn];
          return (
            <div
              key={p.id}
              className={`century-player ${active ? 'active' : ''} ${
                p.finishedAt ? 'done' : ''
              }`}
            >
              <div className="century-player-top">
                <span className="century-player-name">{p.name}</span>
                {p.finishedAt && (
                  <span className="century-done-badge">#{p.finishedAt}</span>
                )}
              </div>
              <span className="century-player-score">{p.score}</span>
              <span className="century-player-need">
                {p.finishedAt ? 'safe' : `needs ${state.target - p.score}`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Balls */}
      <div className="century-balls">
        {BALLS.map((ball) => {
          const blocked = isBallBlocked(state, ball);
          const busts = wouldBust(state, ball);
          const checkout = isCheckout(state, ball);
          return (
            <button
              key={ball}
              onClick={() => pot(ball)}
              disabled={blocked || state.finished}
              className={`century-ball ball-${ball} ${busts ? 'busts' : ''} ${
                checkout ? 'checkout' : ''
              } ${blocked ? 'blocked' : ''}`}
              title={
                blocked
                  ? 'Already potted twice in a row — take another ball'
                  : busts
                    ? `Past ${state.target} — would not score`
                    : undefined
              }
            >
              <span className="century-ball-dot" />
              <span className="century-ball-value">+{CENTURY_VALUES[ball]}</span>
              {checkout && <span className="century-ball-flag">finish</span>}
              {blocked && <span className="century-ball-flag">×2</span>}
            </button>
          );
        })}
      </div>

      {/* Turn outcomes */}
      <div className="century-actions">
        <button
          onClick={() => { audio.playFoul(); dispatch({ type: 'MISS_RED' }); }}
          disabled={state.finished}
          className="btn century-miss-red"
        >
          Missed red −{RED_MISS_PENALTY}
        </button>
        <button
          onClick={() => dispatch({ type: 'MISS_COLOUR' })}
          disabled={state.finished}
          className="btn btn-secondary"
        >
          Miss / pass
        </button>
        <button
          onClick={() => setFoulOpen(true)}
          disabled={state.finished}
          className="btn btn-danger"
        >
          <Icon name="alert" size={16} /> Foul
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
                  className={`century-ball ball-${ball}`}
                >
                  <span className="century-ball-dot" />
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
