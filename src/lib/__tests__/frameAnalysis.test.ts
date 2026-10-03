import { describe, expect, it } from 'vitest';
import type { ActionLogEntry } from '../../engine/types';
import { frameProgress, frameStats, frameVisits, isEmptyFrame } from '../frameAnalysis';

const e = (type: ActionLogEntry['type'], playerName: string, extra: Partial<ActionLogEntry> = {}): ActionLogEntry =>
  ({ timestamp: '', type, playerName, description: `${playerName} ${type}`, ...extra });
const pot = (p: string, ball: ActionLogEntry['ball'], points: number) => e('pot', p, { ball, points });
const players = [{ name: 'Awais' }, { name: 'Suraj' }];

const log: ActionLogEntry[] = [
  e('frameStart', 'Awais'),
  pot('Awais', 'red', 1), pot('Awais', 'black', 7), pot('Awais', 'red', 1),
  e('miss', 'Awais'),
  e('miss', 'Suraj'),
  e('foul', 'Awais', { ball: 'blue', points: 5, penaltyTo: ['Suraj'] }),
  pot('Suraj', 'red', 1), { ...pot('Suraj', 'pink', 6), undone: true },
  e('miss', 'Suraj'),
];

describe('frame analysis', () => {
  it('per-player stats skip undone shots', () => {
    const s = frameStats(log, players);
    expect(s.Awais).toMatchObject({ reds: 2, colours: 1, highestBreak: 9, fouls: 1, points: 9 });
    expect(s.Suraj).toMatchObject({ reds: 1, colours: 0, highestBreak: 1, points: 6 });
  });

  it('groups the play into visits', () => {
    const v = frameVisits(log);
    expect(v.map((x) => x.kind)).toEqual(['break', 'miss', 'foul', 'break']);
    expect(v[0]).toMatchObject({ player: 'Awais', balls: ['red', 'black', 'red'], points: 9 });
    expect(v[2]).toMatchObject({ player: 'Awais', points: 5, to: ['Suraj'] });
  });

  it('builds running totals, one step per scoring shot', () => {
    const p = frameProgress(log, players);
    expect(p).toHaveLength(6);
    expect(p.at(-1)!.totals).toEqual({ Awais: 9, Suraj: 6 });
  });

  it('a frame with only a start entry is empty', () => {
    expect(isEmptyFrame([e('frameStart', 'Awais')])).toBe(true);
    expect(isEmptyFrame(log)).toBe(false);
  });
});
