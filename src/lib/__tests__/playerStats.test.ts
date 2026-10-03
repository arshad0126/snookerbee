import { describe, expect, it } from 'vitest';
import type { ActionLogEntry } from '../../engine/types';
import type { HistoryMatch } from '../history';
import { computePlayerStats, headToHead, summarize } from '../playerStats';

const P = (name: string, framesWon: number, totalScore: number) =>
  ({ name, framesWon, totalScore, highestBreak: 0, foulsCommitted: 0, timeSpentMs: 0 });
const pot = (playerName: string, points: number): ActionLogEntry =>
  ({ timestamp: '', type: 'pot', playerName, points, description: '' });
const match = (id: string, at: number, players: ReturnType<typeof P>[], frames?: ActionLogEntry[][]): HistoryMatch => ({
  id, at, mode: '1v1', bestOf: 3, redsCount: 15, durationMs: 0, winner: null, players,
  frames: frames?.map((actionLog, i) => ({ frameNumber: i + 1, durationMs: 0, actionLog })),
});

// Newest first, as loadHistory returns them.
const history = [
  // Awais won frame 1, Suraj frame 2, frame 3 not played.
  match('new', 2, [P('Awais', 1, 40), P('Suraj', 1, 60)], [
    [pot('Awais', 30), pot('Suraj', 10)],
    [pot('Awais', 10), pot('Suraj', 50)],
  ]),
  match('old', 1, [P('Awais', 2, 90), P('Suraj', 0, 30)]),
];

describe('stats count frames, not matches', () => {
  it('win rate is frames won out of frames played', () => {
    expect(summarize(history, 'Awais')).toMatchObject({ wins: 3, framesPlayed: 4, winRate: 75 });
    expect(summarize(history, 'Suraj')).toMatchObject({ wins: 1, framesPlayed: 4, winRate: 25 });
  });

  it('form and streak follow the frames in the order played', () => {
    expect(summarize(history, 'Awais').form.join('')).toBe('WWWL');
    const p = computePlayerStats('Awais', history, null);
    expect(p.streak).toBe('L1');
    expect(p.bestWinStreak).toBe(3);
  });

  it('head to head adds up frames each side won', () => {
    expect(headToHead(history, 'Awais', 1)[0]).toMatchObject({ name: 'Suraj', n: 2, w: 3, l: 1 });
  });

  it('a 1–1 match gives each player one frame won and one lost', () => {
    const one = [history[0]];
    expect(computePlayerStats('Awais', one, null)).toMatchObject({ wins: 1, losses: 1, winRate: 50 });
    expect(computePlayerStats('Suraj', one, null)).toMatchObject({ wins: 1, losses: 1, winRate: 50 });
  });
});

describe('stored frame winners', () => {
  it('give the real frame order without any shot logs', () => {
    const m: HistoryMatch = {
      ...match('x', 3, [P('Awais', 1, 40), P('Suraj', 2, 60)]),
      // Last frame unfinished: no winner saved for it.
      frameWinners: ['Suraj', 'Awais', 'Suraj', null],
    };
    expect(summarize([m], 'Awais').form.join('')).toBe('LWL');
  });

  it('are ignored when they disagree with the saved frame counts', () => {
    const m: HistoryMatch = { ...match('y', 3, [P('Awais', 2, 40), P('Suraj', 0, 60)]), frameWinners: ['Suraj', 'Awais'] };
    // Falls back to totals: losses first, then wins.
    expect(summarize([m], 'Awais').form.join('')).toBe('WW');
  });
});
