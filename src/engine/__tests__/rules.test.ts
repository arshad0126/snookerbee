import { describe, expect, it } from 'vitest';
import { createInitialState, gameReducer } from '../reducer';
import { isLegalPot, isMatchClinched, isMatchOver, needsRespotToss, respotContenders } from '../validators';
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

describe('reset frame keeps the breaker', () => {
  it('the player who broke breaks again', () => {
    const s0 = createInitialState({ mode: '1v1', redsCount: 10, bestOf: 3, players: [{ name: 'Awais' }, { name: 'Suraj' }], breakingPlayerIndex: 1 });
    const s = run(s0, pot('red'), { type: 'MISS' }, { type: 'RESET_FRAME' });
    expect(s.players[s.turnOrder[s.currentPlayerIndex]].name).toBe('Suraj');
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

// ---------------------------------------------------------------------------
// Re-spotted black (2.4.5): only the tied players play it; 1v1 and
// free-for-all toss for who goes first; teams have no toss.
// ---------------------------------------------------------------------------

const ffa3 = () =>
  createInitialState({
    mode: 'freeForAll', redsCount: 10, bestOf: 1,
    players: [{ name: 'Arshad' }, { name: 'Awais' }, { name: 'Suraj' }],
  });

/** On the final black with the given frame scores, `seat` at the table. */
const onFinalBlack = (s: GameState, scores: number[], seat = 0): GameState => ({
  ...s,
  phase: 'colorsInOrder',
  redsRemaining: 0,
  expectedBall: null,
  currentColorTarget: 'black',
  currentPlayerIndex: seat,
  players: s.players.map((p, i) => ({ ...p, score: scores[i] })),
});

const striker = (s: GameState) => s.players[s.turnOrder[s.currentPlayerIndex]].name;
const idOf = (s: GameState, name: string) => s.players.find((p) => p.name === name)!.id;
const toss = (s: GameState, name: string): GameAction => ({ type: 'RESPOT_TOSS', winnerId: idOf(s, name) });

describe('re-spotted black', () => {
  it('waits for the toss: nothing can be played until it is made', () => {
    const s = run(onFinalBlack(ffa3(), [40, 47, 20]), pot('black'));
    expect(s.phase).toBe('respottedBlack');
    expect(needsRespotToss(s)).toBe(true);
    expect(isLegalPot(s, 'black')).toBe(false);
    expect(run(s, { type: 'MISS' })).toBe(s);
    expect(run(s, { type: 'FOUL', ballInvolved: 'black' })).toBe(s);
  });

  it('only the tied players play it — the player not level is skipped', () => {
    let s = run(onFinalBlack(ffa3(), [40, 47, 20]), pot('black'));
    expect(respotContenders(s)).toEqual([idOf(s, 'Arshad'), idOf(s, 'Awais')]);
    s = run(s, toss(s, 'Awais'));
    expect(striker(s)).toBe('Awais');
    s = run(s, { type: 'MISS' });
    expect(striker(s)).toBe('Arshad'); // Suraj is not tied, so skipped
    s = run(s, { type: 'MISS' });
    expect(striker(s)).toBe('Awais');
  });

  it('works when the player who potted the last black is not tied', () => {
    const s = run(onFinalBlack(ffa3(), [50, 50, 10], 2), pot('black'));
    expect(s.phase).toBe('respottedBlack');
    expect(run(s, toss(s, 'Suraj'))).toBe(s); // Suraj can't win a toss he isn't in
    expect(striker(run(s, toss(s, 'Arshad')))).toBe('Arshad');
  });

  it('1v1 tosses too, and the winner can hand the first shot over', () => {
    let s = run(onFinalBlack(start(1), [40, 47]), pot('black'));
    expect(needsRespotToss(s)).toBe(true);
    s = run(s, toss(s, 'Awais'));
    expect(striker(s)).toBe('Awais');
    s = run(s, { type: 'RESPOT_SWAP' });
    expect(striker(s)).toBe('Suraj');
    s = run(s, { type: 'RESPOT_SWAP' });
    expect(striker(s)).toBe('Awais');
    // Once a shot is played the first shot can't be swapped.
    const afterMiss = run(s, { type: 'MISS' });
    expect(run(afterMiss, { type: 'RESPOT_SWAP' })).toBe(afterMiss);
  });

  it('is a fresh visit: the break that ended with the last black does not carry on', () => {
    let s = run(onFinalBlack(start(1), [40, 47]), pot('black'));
    expect(s.players[0].currentBreak).toBe(7);
    s = run(s, toss(s, 'Awais'), pot('black'));
    expect(s.phase).toBe('finished');
    expect(s.players[0].currentBreak).toBe(0);
    expect(s.players[0].highestBreak).toBe(7); // not 14
    expect(s.frameScores[idOf(s, 'Awais')]).toBe(1);
  });

  it('a resumed match keeps the toss result', () => {
    const s = run(onFinalBlack(ffa3(), [40, 47, 20]), pot('black'));
    const tossed = run(s, toss(s, 'Awais'));
    const resumed = run(start(), { type: 'SET_STATE', state: JSON.parse(JSON.stringify(tossed)) });
    expect(needsRespotToss(resumed)).toBe(false);
    expect(striker(resumed)).toBe('Awais');
  });

  it('undo takes the toss back', () => {
    const s = run(onFinalBlack(start(1), [40, 47]), pot('black'));
    const undone = run(s, toss(s, 'Suraj'), { type: 'UNDO' });
    expect(needsRespotToss(undone)).toBe(true);
  });

  it('three-way tie: a foul drops the fouler and the other two play on', () => {
    let s = run(onFinalBlack(ffa3(), [33, 40, 40]), pot('black'));
    expect(respotContenders(s)).toHaveLength(3);
    s = run(s, toss(s, 'Arshad'), { type: 'FOUL', ballInvolved: 'black' });
    expect(s.phase).toBe('respottedBlack');
    expect(striker(s)).toBe('Awais');
    s = run(s, { type: 'MISS' });
    expect(striker(s)).toBe('Suraj'); // Arshad fouled, no longer level
    s = run(s, pot('black'));
    expect(s.phase).toBe('finished');
    expect(s.frameScores[idOf(s, 'Suraj')]).toBe(1);
  });

  it('a foul in a two-way tie still ends the frame', () => {
    const s = run(onFinalBlack(start(1), [40, 47]), pot('black'));
    const after = run(s, toss(s, 'Awais'), { type: 'FOUL', ballInvolved: 'black' });
    expect(after.phase).toBe('finished');
    expect(after.frameScores[idOf(after, 'Suraj')]).toBe(1);
  });

  it('teams: no toss, play carries on between the tied teams', () => {
    const t0 = createInitialState({
      mode: 'team', redsCount: 10, bestOf: 1,
      players: [{ name: 'A1' }, { name: 'B1' }, { name: 'A2' }, { name: 'B2' }],
      teamAssignments: { 0: [0, 2], 1: [1, 3] },
    });
    // Team A 33 (A1 33), team B 40 (B1 40); A1 pots the final black → 40–40.
    const atBlack = onFinalBlack(t0, [33, 40, 0, 0]);
    const teamed = { ...atBlack, teams: atBlack.teams.map((t, i) => ({ ...t, totalScore: i === 0 ? 33 : 40 })) };
    const s = run(teamed, pot('black'));
    expect(s.phase).toBe('respottedBlack');
    expect(needsRespotToss(s)).toBe(false);
    expect(isLegalPot(s, 'black')).toBe(true);
    expect(striker(s)).toBe('A1');
    expect(striker(run(s, { type: 'MISS' }))).toBe('B1');
  });
});
