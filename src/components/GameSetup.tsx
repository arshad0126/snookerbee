import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { GameSetupConfig, GameMode } from '../engine/types';
import { useTheme } from '../hooks/useTheme';
import { Icon, type IconName } from './ui';

/** Frames per match. Odd only — an even best-of can end level (issue #10). */
const MATCH_LENGTHS = [1, 3, 5];

/** Regulars, offered as one-tap fills. Nothing is selected until tapped. */
const PRESET_PLAYERS = ['Awais', 'Suraj', 'Arshad'];

const MODES: { id: GameMode; label: string; icon: IconName }[] = [
  { id: '1v1', label: '1 v 1', icon: 'duo' },
  { id: 'team', label: 'Teams', icon: 'users' },
  { id: 'freeForAll', label: 'Free for All', icon: 'target' },
];

/** Reds shown as balls rather than a number — read at a glance, no label. */
function RedCluster({ count }: { count: 10 | 15 }) {
  const dots = count === 10 ? 2 : 3;
  return (
    <span className="red-cluster" aria-hidden="true">
      {Array.from({ length: dots }).map((_, i) => (
        <span key={i} className="red-ball" />
      ))}
    </span>
  );
}

export default function GameSetup() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [gameMode, setGameMode] = useState<GameMode>('1v1');
  const [teamSize, setTeamSize] = useState<2 | 3>(2);
  const [redsCount, setRedsCount] = useState<10 | 15>(15);
  const [bestOf, setBestOf] = useState<number>(3);
  const [playerNames, setPlayerNames] = useState<string[]>(['', '']);
  const [breakingPlayerIndex, setBreakingPlayerIndex] = useState(0);

  const slotsFor = (mode: GameMode, size: 2 | 3) =>
    mode === 'team' ? size * 2 : mode === 'freeForAll' ? 3 : 2;

  const changeMode = (mode: GameMode) => {
    setGameMode(mode);
    setPlayerNames(Array.from({ length: slotsFor(mode, teamSize) }, () => ''));
    setBreakingPlayerIndex(0);
  };

  const changeTeamSize = (size: 2 | 3) => {
    setTeamSize(size);
    setPlayerNames(Array.from({ length: size * 2 }, () => ''));
    setBreakingPlayerIndex(0);
  };

  /**
   * A slot is free when blank or still holding an untouched "Player N"
   * default, so seating a regular never overwrites a typed name.
   */
  const isFreeSlot = (name: string) =>
    !name.trim() || /^player\s*\d+$/i.test(name.trim());

  const togglePreset = (preset: string) => {
    const seated = playerNames.findIndex((n) => n.trim() === preset);
    const next = [...playerNames];

    if (seated !== -1) {
      next[seated] = '';
      setPlayerNames(next);
      return;
    }

    const free = next.findIndex(isFreeSlot);
    if (free !== -1) {
      next[free] = preset;
    } else if (gameMode === 'freeForAll' && next.length < 8) {
      next.push(preset);
    } else {
      return;
    }
    setPlayerNames(next);
  };

  const setName = (index: number, value: string) => {
    const next = [...playerNames];
    next[index] = value;
    setPlayerNames(next);
  };

  const addPlayer = () => {
    if (gameMode !== 'freeForAll' || playerNames.length >= 8) return;
    setPlayerNames([...playerNames, '']);
  };

  const removePlayer = (index: number) => {
    if (gameMode !== 'freeForAll' || playerNames.length <= 2) return;
    setPlayerNames(playerNames.filter((_, i) => i !== index));
    setBreakingPlayerIndex((b) => (b >= playerNames.length - 1 ? 0 : b));
  };

  const movePlayer = (index: number, direction: 'up' | 'down') => {
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= playerNames.length) return;

    const next = [...playerNames];
    [next[index], next[target]] = [next[target], next[index]];
    setPlayerNames(next);

    if (breakingPlayerIndex === index) setBreakingPlayerIndex(target);
    else if (breakingPlayerIndex === target) setBreakingPlayerIndex(index);
  };

  const startMatch = () => {
    const config: GameSetupConfig = {
      mode: gameMode,
      redsCount,
      bestOf,
      players: playerNames.map((name, i) => ({
        name: name.trim() || `Player ${i + 1}`,
      })),
      breakingPlayerIndex,
    };

    if (gameMode === 'team') {
      config.teamAssignments =
        teamSize === 2 ? { 0: [0, 2], 1: [1, 3] } : { 0: [0, 2, 4], 1: [1, 3, 5] };
    }

    navigate('/play', { state: { config } });
  };

  const canGrow = gameMode === 'freeForAll' && playerNames.length < 8;

  // Chips are a quick-add, so only offer regulars who are not already seated.
  // Showing all three regardless duplicated the roster directly beneath them,
  // wrapped to two rows, and squeezed the list into a ~100px scroller.
  const unseated = PRESET_PLAYERS.filter(
    (preset) => !playerNames.some((n) => n.trim() === preset)
  );

  return (
    <div className="setup-page">
      <button
        onClick={toggleTheme}
        className="theme-toggle-floating"
        aria-label="Toggle theme"
      >
        <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={18} />
      </button>

      <div className="setup-layout">
        {/* ---------------- Left: match configuration ---------------- */}
        <aside className="setup-config">
          <h1 className="setup-heading">New Match</h1>

          <fieldset className="setup-field">
            <legend className="setup-legend">Mode</legend>
            <div className="tile-row">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  aria-pressed={gameMode === m.id}
                  onClick={() => changeMode(m.id)}
                  className={`tile ${gameMode === m.id ? 'tile--on' : ''}`}
                >
                  <Icon name={m.icon} size={20} />
                  <span className="tile-label">{m.label}</span>
                </button>
              ))}
            </div>
            {gameMode === 'team' && (
              <div className="tile-row tile-row--sub">
                {([2, 3] as const).map((size) => (
                  <button
                    key={size}
                    type="button"
                    aria-pressed={teamSize === size}
                    onClick={() => changeTeamSize(size)}
                    className={`tile tile--slim ${teamSize === size ? 'tile--on' : ''}`}
                  >
                    <span className="tile-label">{size}v{size}</span>
                  </button>
                ))}
              </div>
            )}
          </fieldset>

          <fieldset className="setup-field">
            <legend className="setup-legend">Reds</legend>
            <div className="tile-row">
              {([10, 15] as const).map((count) => (
                <button
                  key={count}
                  type="button"
                  aria-pressed={redsCount === count}
                  aria-label={`${count} reds`}
                  onClick={() => setRedsCount(count)}
                  className={`tile tile--reds ${redsCount === count ? 'tile--on' : ''}`}
                >
                  <RedCluster count={count} />
                  <span className="tile-value">{count}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="setup-field">
            <legend className="setup-legend">Length</legend>
            <div className="tile-row">
              {MATCH_LENGTHS.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={bestOf === n}
                  aria-label={n === 1 ? '1 frame' : `Best of ${n} frames`}
                  onClick={() => setBestOf(n)}
                  className={`tile tile--slim ${bestOf === n ? 'tile--on' : ''}`}
                >
                  <span className="tile-value">{n}</span>
                </button>
              ))}
            </div>
            <p className="setup-hint">
              {bestOf === 1
                ? 'Single frame'
                : `First to ${Math.ceil(bestOf / 2)} wins`}
            </p>
          </fieldset>

        </aside>

        {/* ---------------- Right: who's playing ---------------- */}
        <section className="setup-roster">
          <div className="roster-head">
            <h2 className="setup-legend">Players</h2>
            {canGrow && (
              <button type="button" onClick={addPlayer} className="roster-add">
                <Icon name="plus" size={14} /> Add
              </button>
            )}
          </div>

          {unseated.length > 0 && (
            <div className="preset-chip-row">
              {unseated.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => togglePreset(preset)}
                  disabled={!playerNames.some(isFreeSlot) && !canGrow}
                  className="preset-chip"
                >
                  <span className="preset-chip-glyph">
                    <Icon name="plus" size={13} />
                  </span>
                  <span className="preset-chip-name">{preset}</span>
                </button>
              ))}
            </div>
          )}

          <div className="roster-list" role="radiogroup" aria-label="Who breaks first">
            {playerNames.map((name, idx) => {
              const breaking = breakingPlayerIndex === idx;
              const team = gameMode === 'team' ? (idx % 2 === 0 ? 'A' : 'B') : null;
              return (
                <div
                  key={idx}
                  className={`roster-row ${breaking ? 'breaking' : ''}`}
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={breaking}
                    onClick={() => setBreakingPlayerIndex(idx)}
                    className="roster-seat"
                    aria-label={`${name.trim() || `Player ${idx + 1}`} breaks first`}
                    title="Break first"
                  >
                    {breaking ? <Icon name="ball" size={15} /> : idx + 1}
                  </button>

                  {team && <span className="roster-team">{team}</span>}

                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(idx, e.target.value)}
                    maxLength={20}
                    className="roster-input"
                    placeholder={`Player ${idx + 1}`}
                  />

                  <div className="roster-controls">
                    <button
                      type="button"
                      onClick={() => movePlayer(idx, 'up')}
                      disabled={idx === 0}
                      className="rotation-arrow-btn"
                      aria-label="Move up"
                    >
                      <Icon name="chevron-up" size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePlayer(idx, 'down')}
                      disabled={idx === playerNames.length - 1}
                      className="rotation-arrow-btn"
                      aria-label="Move down"
                    >
                      <Icon name="chevron-down" size={14} />
                    </button>
                  </div>

                  {(name.trim() || (gameMode === 'freeForAll' && playerNames.length > 2)) && (
                    <button
                      type="button"
                      onClick={() => (name.trim() ? setName(idx, '') : removePlayer(idx))}
                      className="roster-remove"
                      aria-label={name.trim() ? `Clear ${name.trim()}` : `Remove slot ${idx + 1}`}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <p className="setup-hint roster-hint">
            Tap a number to set who breaks.
          </p>

          <div className="setup-cta">
            <button onClick={() => navigate('/dashboard')} className="btn btn-ghost">
              Cancel
            </button>
            <button onClick={startMatch} className="btn btn-primary btn-lg setup-start">
              Start Match
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
