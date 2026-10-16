import { describe, expect, it } from 'vitest';
import { createInitialState, gameReducer } from '../../engine/reducer';
import { centuryReducer, createCenturyState, toActionLog } from '../../engine/century';
import type { CenturyAction, CenturyState } from '../../engine/century';
import type { BallType, GameAction, GameSetupConfig, GameState } from '../../engine/types';
import { buildFrameVisits, sidesForGame } from '../frameVisits';

const run = (s: GameState, ...actions: GameAction[]) => actions.reduce(gameReducer, s);
const pot = (ball: BallType): GameAction => ({ type: 'POT_BALL', ball });
const miss: GameAction = { type: 'MISS' };
const foul = (ballInvolved: BallType): GameAction => ({ type: 'FOUL', ballInvolved });

const game = (config: Partial<GameSetupConfig> & Pick<GameSetupConfig, 'players'>): GameState =>
  createInitialState({ mode: '1v1', redsCount: 15, bestOf: 3, ...config });

const current = (s: GameState) => s.players[s.turnOrder[s.currentPlayerIndex]].name;

const visitsOf = (s: GameState) =>
  buildFrameVisits({
    actionLog: s.actionLog,
    sides: sidesForGame(s),
    currentPlayerName: current(s),
    isOver: s.phase === 'finished',
  });

/** The sheet's totals must equal the engine's scores, side by side. */
const expectTotalsMatch = (s: GameState) => {
  const { totals } = visitsOf(s);
  if (s.mode === 'team') {
    for (const t of s.teams) expect(totals[t.name]).toBe(t.totalScore);
  } else {
    for (const p of s.players) expect(totals[p.name]).toBe(p.score);
  }
};

describe('buildFrameVisits — snooker', () => {
  const two = () => game({ players: [{ name: 'Arshad' }, { name: 'Awais' }] });

  it('before break-off: one live row for the breaker', () => {
    const s = two();
    const { visits, visitCount } = visitsOf(s);
    expect(visits).toHaveLength(1);
    expect(visits[0]).toMatchObject({ player: 'Arshad', live: true, balls: [] });
    expect(visitCount).toBe(0);
  });

  it('groups pots into visits and keeps the running score', () => {
    const s = run(two(), miss, pot('red'), pot('brown'), miss, pot('red'), pot('black'), pot('red'), pot('pink'), miss);
    const { visits } = visitsOf(s);
    const real = visits.filter((v) => !v.live);
    expect(real.map((v) => v.player)).toEqual(['Arshad', 'Awais', 'Arshad']);
    expect(real[0].missed).toBe(true);
    expect(real[1]).toMatchObject({ points: 5, totals: { Arshad: 0, Awais: 5 } });
    expect(real[2].balls.map((b) => b.ball)).toEqual(['red', 'black', 'red', 'pink']);
    expect(real[2]).toMatchObject({ points: 15, highest: true, totals: { Arshad: 15, Awais: 5 } });
    expect(real[2].changed).toEqual(['Arshad']);
    expect(visits[visits.length - 1]).toMatchObject({ player: 'Awais', live: true });
    expectTotalsMatch(s);
  });

  it('a foul gives its points to the opponent and ends the visit', () => {
    const s = run(two(), pot('red'), pot('black'), foul('blue'));
    const v = visitsOf(s).visits[0];
    expect(v.points).toBe(8);
    expect(v.foul).toMatchObject({ ball: 'blue', penalty: 5, to: ['Awais'], inOff: false });
    expect(v.totals).toEqual({ Arshad: 8, Awais: 5 });
    expect(v.changed.sort()).toEqual(['Arshad', 'Awais']);
    expectTotalsMatch(s);
  });

  it('in-off is a foul too', () => {
    const s = run(two(), { type: 'IN_OFF', ballInvolved: 'red' });
    expect(visitsOf(s).visits[0].foul).toMatchObject({ inOff: true, penalty: 4 });
    expectTotalsMatch(s);
  });

  it('undone shots drop out; redone shots come back', () => {
    let s = run(two(), pot('red'), pot('black'), pot('red'), { type: 'UNDO' });
    expect(visitsOf(s).visits[0].balls.map((b) => b.ball)).toEqual(['red', 'black']);
    expect(visitsOf(s).visits[0].live).toBe(true);
    expectTotalsMatch(s);
    s = run(s, { type: 'REDO' });
    expect(visitsOf(s).visits[0].balls).toHaveLength(3);
    expectTotalsMatch(s);
  });

  it('marks a free-ball pot', () => {
    const s = run(two(), miss, { type: 'FREE_BALL' }, pot('blue'));
    const v = visitsOf(s).visits[1];
    expect(v.balls[0]).toEqual({ ball: 'blue', freeBall: true });
    expectTotalsMatch(s);
  });

  it('a concession closes the frame with no live row', () => {
    const s = run(two(), pot('red'), miss, { type: 'CONCEDE_FRAME' });
    const { visits } = buildFrameVisits({
      actionLog: s.actionLog,
      sides: sidesForGame(s),
      currentPlayerName: current(s),
      isOver: true,
    });
    expect(visits[visits.length - 1].kind).toBe('end');
    expect(visits.some((v) => v.live)).toBe(false);
  });

  it('team mode adds up by team, fouls included', () => {
    const s0 = game({
      mode: 'team',
      players: [{ name: 'A1' }, { name: 'A2' }, { name: 'B1' }, { name: 'B2' }],
      teamAssignments: { 0: [0, 1], 1: [2, 3] },
    });
    const s = run(s0, pot('red'), pot('black'), miss, pot('red'), foul('pink'), pot('red'), miss);
    const { visits } = visitsOf(s);
    expect(sidesForGame(s).map((x) => x.name)).toEqual(['Team 1', 'Team 2']);
    expect(visits[0].side).toBe('Team 1');
    expect(visits[1].foul?.to).toEqual(['Team 1']);
    expectTotalsMatch(s);
  });

  it('free-for-all with four players: each foul pays every opponent', () => {
    const s0 = game({
      mode: 'freeForAll',
      players: [{ name: 'Arshad' }, { name: 'Awais' }, { name: 'Suraj' }, { name: 'Tariq' }],
    });
    const s = run(s0, pot('red'), pot('blue'), miss, foul('pink'), pot('red'), pot('green'), miss, miss, pot('red'));
    const { visits } = visitsOf(s);
    expect(visits[1].foul?.to.sort()).toEqual(['Arshad', 'Suraj', 'Tariq']);
    expect(visits[visits.length - 1]).toMatchObject({ player: 'Arshad', live: true, points: 1 });
    expectTotalsMatch(s);
  });

  it('an empty live row still carries the running totals', () => {
    const s0 = game({
      mode: 'freeForAll',
      players: [{ name: 'Arshad' }, { name: 'Awais' }, { name: 'Suraj' }],
    });
    const s = run(s0, pot('red'), pot('black'), miss, miss, miss);
    const live = visitsOf(s).visits.at(-1)!;
    expect(live).toMatchObject({ player: 'Arshad', live: true, balls: [] });
    expect(live.totals.Arshad).toBe(8);
  });
});

describe('buildFrameVisits — Century', () => {
  const runC = (s: CenturyState, ...a: CenturyAction[]) => a.reduce(centuryReducer, s);

  it('own-score fouls and red misses come off the player', () => {
    const s0 = createCenturyState({ target: 50, players: [{ name: 'Arshad' }, { name: 'Awais' }] });
    const s = runC(s0, { type: 'POT', ball: 'black' }, { type: 'MISS_COLOUR' }, { type: 'MISS_RED' }, { type: 'POT', ball: 'pink' }, { type: 'FOUL', ball: 'blue' });
    const { visits, totals } = buildFrameVisits({
      actionLog: toActionLog(s.actionLog),
      sides: s.players.map((p) => ({ name: p.name, members: [p.name] })),
      currentPlayerName: s.players[s.turnOrder[s.currentTurn]].name,
    });
    for (const p of s.players) expect(totals[p.name]).toBe(p.score);
    expect(visits[1].note).toBe('Missed the red');
    expect(visits[1].points).toBeLessThan(0);
  });
});
