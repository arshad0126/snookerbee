/**
 * changelog — what changed in each version, newest first.
 *
 * Every release adds an entry at the top and bumps "version" in
 * package.json to match. `npm run build` (and so every Vercel deploy) runs
 * scripts/check-release.mjs, which fails if the two disagree — a version
 * can't ship without its notes.
 *
 * Numbering: a new feature bumps the middle number (1.2.0 → 1.3.0); a fix or
 * small tweak bumps the last (1.3.0 → 1.3.1).
 */

export interface Release {
  version: string;
  /** YYYY-MM-DD */
  date: string;
  title: string;
  added?: string[];
  improved?: string[];
  fixed?: string[];
}

export const CHANGELOG: Release[] = [
  {
    version: '2.0.1',
    date: '2026-10-03',
    title: 'Popups in the middle, easier next-frame setup',
    improved: [
      'Next frame setup: the breaker is always on top. Tap any player to make them the breaker, and move the others with big up/down buttons.',
      'Next frame setup now has Cancel and a close button — go back to the frame result without changing anything, and tap Next Frame again when ready.',
      'Your chosen background art now shows on the scoring screens too.',
      'The frame result with three or more players is a tidy list instead of a jumbled row.',
    ],
    fixed: [
      'Popups during a game — foul, match options, next frame and the Century foul picker — now open in the middle of the screen instead of the top-left corner.',
      'Opening Next Frame and backing out no longer records the frame twice.',
    ],
  },
  {
    version: '2.0.0',
    date: '2026-10-03',
    title: 'SnookerBee 2.0 — frames first',
    added: [
      'Play every frame: winning the frames you need no longer ends the match. Play the rest, or tap End Match whenever you like.',
      'Every frame now saves who won it and the score, so stats and your form are exact — including your older matches.',
      'Starting or resuming a match turns the phone to landscape on Android.',
    ],
    improved: [
      'Pot two reds in one shot: the red stays tappable straight after a red.',
      'Share cards show the frame score — "Winner · 2–1 in frames" — and a level match reads "Draw · 1–1".',
      'Your Last 5 frames on the home screen are now in the real order they were played.',
    ],
    fixed: [
      'Reset Frame really starts the frame again. Before, the reset frame still counted as played and its points went into the match total.',
      'Free ball now unlocks the colours on the scoring screen, and scores as the ball on.',
    ],
  },
  {
    version: '1.7.1',
    date: '2026-10-03',
    title: 'Level on frames is a draw',
    fixed: [
      'A match that ends level on frames — say 1–1 with frame 3 not played — now shows "Draw · 1–1" instead of giving it to whoever scored more points.',
      'Older matches decided on points are re-read the same way, so they show as draws too.',
    ],
    improved: [
      'Drawn matches note who scored more points, e.g. "Suraj scored more (60–40)", without calling it a win.',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-10-03',
    title: 'Stats count frames, not matches',
    improved: [
      'Win rate is now frames won out of frames played. Win frame 1 and lose frame 2, and you are 1 won, 1 lost — nobody gets a whole match win for it.',
      'Form, streaks, the monthly chart, By format, Head to head and You vs … all count frames too.',
      'Played together: the form strip and streak follow frames; "Matches won" is gone from the comparison.',
      'Recent matches on Player Stats show your frames won–lost instead of W or L.',
    ],
    fixed: [
      'A drawn match no longer counts as a loss in your win rate — frames always have a winner.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-10-03',
    title: 'Played together',
    added: [
      'Played together: pick two or three players, tap Calculate, and see stats from only the games where exactly that group played.',
      'Pick Arshad, Awais and Suraj and you get your three-way games only — no 1 v 1s between any two of you, and no games where someone else joined.',
      'Leaderboard, side-by-side numbers with the best in each row highlighted, frame finishes (1st, 2nd, 3rd), who won lately, and Century games together.',
      'Find it in the profile menu, or tap "Just you and …" on a player\'s stats.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-10-02',
    title: 'Safer undo, with Redo',
    added: [
      'Redo: after every undo, a bar shows what was undone with a Redo button for a few seconds.',
      'Settings → Scoring → Ask before undo: shows what will be undone and asks first. Off by default.',
    ],
    improved: [
      'The timeline keeps every step. Undone shots stay, struck through, with an "Undid: …" line.',
      'A quick accidental double-tap on Undo is ignored.',
      'All of this works in Century too.',
    ],
    fixed: [
      'Two undos in a row only showed one in the timeline, and never said what was undone.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-10-02',
    title: 'Stats for every player',
    added: [
      'Player Stats: pick anyone you play with from the top-right and see their stats.',
      'You vs them: wins each, frames, best breaks, and games you played on the same team.',
      'Tap a player\'s name in history, Match Analysis or recent games to open their stats.',
      'Streaks, frames won, results by format, and each player\'s last 10 matches.',
    ],
  },
  {
    version: '1.3.0',
    date: '2026-10-02',
    title: "What's new",
    added: [
      "This page: every version and what changed, in the profile menu.",
      'A dot in the menu when there is an update you have not seen yet.',
    ],
    improved: [
      'The version number now goes up with every update.',
    ],
  },
  {
    version: '1.2.0',
    date: '2026-10-02',
    title: 'New dashboard, themes and My Stats',
    added: [
      'Profile menu: tap your photo. Stats, history, settings and Log out live here.',
      'Themes: pick a background (Classic, Baize, Break-off, Pocket, Plain) and one of seven accent colours.',
      'Light, Dark or Auto mode. Your theme follows your account to other phones.',
      'My Stats: form, breaks, head-to-head, what you pot, fouls by ball, when you play, Century.',
      'Settings: choose your name in matches, export your history.',
    ],
    improved: [
      'Dashboard redesign: one stats strip, your last 5 results, recent games with the winner.',
      'Recent games include Century, with "Yesterday"-style dates and mode tags.',
    ],
    fixed: [
      'Match scores only counted the last frame. They now add up every frame, old matches included.',
      'Matches ended early showed no winner. Now: most frames, then most points.',
      'Top break showed the best break by anyone. It now shows yours.',
      'Games where nothing was scored are no longer saved.',
    ],
  },
  {
    version: '1.1.1',
    date: '2026-10-02',
    title: 'Easier-to-find Century timeline',
    improved: [
      'A labelled Timeline button on the Century screen.',
      'The end-of-game sheet reads Share · Timeline · Done.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-10-02',
    title: 'Results on share cards, Century red value',
    added: [
      'Frame share card shows who won and the score.',
      'Century: choose a red worth 10 or 20. A missed red costs the same.',
      'Century: full shot-by-shot timeline, saved with every game.',
      'Century games appear in Match History, with a shareable result card.',
    ],
  },
  {
    version: '1.0.4',
    date: '2026-08-21',
    title: 'Century mode and the big rebuild',
    added: [
      'Century: race to exactly 50 or 100.',
      'Wall clock and frame start time on the scoring screen.',
      'Preset players, breaker choice and frame rotation.',
      'Break milestones: 50+ and century breaks.',
      'Pause a match; previous frames at a glance.',
    ],
    improved: [
      'Landscape-only layout with a one-screen setup.',
      'New icon set and the Icy Blue / Shadow Grey look.',
    ],
    fixed: [
      'Matches no longer lost if the phone closes the app before saving.',
      'Share as image now opens the iPhone share sheet.',
    ],
  },
  {
    version: '1.0.0',
    date: '2026-06-25',
    title: 'First release',
    added: [
      'Snooker scoring with the rules built in: reds, colours, fouls, free ball, re-spotted black.',
      '1 v 1, free-for-all and team games.',
      'Sign in with Google or play as a guest.',
      'Match history and shareable score cards.',
    ],
  },
];

export const CURRENT_VERSION = CHANGELOG[0].version;
