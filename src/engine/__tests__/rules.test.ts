import { describe, expect, it } from 'vitest';
import { createInitialState, gameReducer } from '../reducer';
import { isLegalPot, isMatchClinched, isMatchOver } from '../validators';
import type { GameAction, GameState } from '../types';

const start = (bestOf = 3): GameState =>
  createInitialState({ mode: '1v1', redsCount: 10, bestOf, players: [{ name: 'Awais' }, { name: 'Suraj' }] });
const run = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);
const pot = (ball: Parameters<typeof isLegalPot>[1]): GameAction => ({ type: 'POT_BALL', ball });

/** Current player pots one red and concedes, so the other player wins the frame. */
const winFrameFor = (s: GameState, name: string): GameState => {
  const current = s.players[s.turnOrder[s.currentPlayerIndex]].name;
  // Score for whoever must win, then the other concedes.
  let next = s;
  if (current !== name) next = run(next, { type: 'MISS' });
  next = run(next, pot('red'), { type: 'MISS' });
  return run(next, { type: 'CONCEDE_FRAME' });
};
const nextFrame = (s: GameState) => run(s, { type: 'START_NEXT_FRAME' });

describe('reds', () => {
  it('a red stays legal straight after a red — two can drop in one shot', () => {
    const s = run(start(), pot('red'));
    expect(isLegalPot(s, 'red')).toBe(true);
    const two = run(s, pot('red'));
    expect(two.redsRemaining).toBe(8);
    expect(two.players[0].score).toBe(2);
    expect(two.expectedBall).toBe('color');
  });

  it('no red once they are all gone', () => {
    let s = start();
    for (let i = 0; i < 10; i += 1) s = run(s, pot('red'));
    expect(s.redsRemaining).toBe(0);
    expect(isLegalPot(s, 'red')).toBe(false);
    expect(isLegalPot(s, 'black')).toBe(true);
  });
});

describe('free ball', () => {
  it('unlocks the colours when a red is on, and scores as a red', () => {
    const s = { ...start(), isFreeBall: true };
    expect(isLegalPot(s, 'blue')).toBe(true);
    const after = run(s, pot('blue'));
    expect(after.players[0].score).toBe(1);
    expect(after.redsRemaining).toBe(10);
    expect(after.expectedBall).toBe('color');
  });

  it('potting an actual red with a free ball awarded is just a red', () => {
    const after = run({ ...start(), isFreeBall: true }, pot('red'));
    expect(after.redsRemaining).toBe(9);
    expect(after.isFreeBall).toBe(false);
  });
});

describe('reset frame', () => {
  it('drops the abandoned frame completely', () => {
    const s = run(start(), pot('red'), pot('black'), pot('red'), { type: 'RESET_FRAME' });
    expect(s.frameNumber).toBe(1);
    expect(s.completedFrames).toHaveLength(0);
    expect(s.players.map((p) => p.score)).toEqual([0, 0]);
    expect(s.players[0].matchHighestBreak).toBe(0);
    expect(s.redsRemaining).toBe(10);
  });
});

describe('play all frames', () => {
  it('reaching the frames needed clinches the match but does not end it', () => {
    let s = winFrameFor(start(3), 'Awais');
    s = winFrameFor(nextFrame(s), 'Awais');
    expect(isMatchClinched(s)).toBe(true);
    expect(isMatchOver(s)).toBe(false);
    expect(s.winner).toBeNull();

    s = winFrameFor(nextFrame(s), 'Suraj');
    expect(isMatchOver(s)).toBe(true);
    expect(s.players.find((p) => p.id === s.winner)?.name).toBe('Awais');
  });
});
