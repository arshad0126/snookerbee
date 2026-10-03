import { describe, expect, it } from 'vitest';
import { frameLine, pickWinner, pointsLeader, savedWinner } from '../results';

const P = (name: string, framesWon: number, totalScore: number, teamName?: string) =>
  ({ name, framesWon, totalScore, teamName });

describe('match winner', () => {
  it('level on frames is a draw, whatever the points', () => {
    const players = [P('Awais', 1, 40), P('Suraj', 1, 60)];
    expect(savedWinner('Suraj', players)).toBeNull();
    expect(frameLine(players)).toBe('1–1');
    expect(pointsLeader(players)).toEqual({ name: 'Suraj', line: '60–40' });
  });

  it('most frames wins, even with fewer points', () => {
    expect(savedWinner(null, [P('Awais', 2, 40), P('Suraj', 1, 90)])).toBe('Awais');
  });

  it('nobody won a frame: no winner', () => {
    expect(pickWinner([{ name: 'A', framesWon: 0, points: 30 }, { name: 'B', framesWon: 0, points: 10 }])).toBeNull();
  });

  it('teams count each team once', () => {
    const players = [P('A', 2, 30, 'Red'), P('B', 2, 10, 'Red'), P('C', 1, 50, 'Blue'), P('D', 1, 5, 'Blue')];
    expect(savedWinner(null, players)).toBe('Red');
    expect(frameLine(players)).toBe('2–1');
  });
});
