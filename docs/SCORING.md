# Scoring rules

The rules the app enforces, written down so nobody has to reverse-engineer
them from `src/engine/reducer.ts`. If code and this file disagree, treat it as
a bug in one of them and ask which is right. Don't silently pick one.

Tests that pin these rules: `src/engine/__tests__/rules.test.ts`,
`src/lib/__tests__/*.test.ts`.

## Two different games

| | Snooker | Century |
|---|---|---|
| Code | `engine/reducer.ts`, `engine/validators.ts` | `engine/century.ts` (own reducer) |
| Win condition | Most frames | Land exactly on the target |

Century is deliberately a separate reducer. **Never add `if (century)`
branches to the snooker reducer.** They share only the ball types.

---

## Snooker

### Setup
- Modes: `1v1`, `team` (2v2 or 3v3, players alternate between teams),
  `freeForAll` (2–8 players, round-robin).
- Reds: 10 or 15. Match length: best of 1, 3 or 5.
- Ball values: red 1, yellow 2, green 3, brown 4, blue 5, pink 6, black 7.
- Max break = reds × 8 + 27 (147 with 15 reds, 107 with 10).

### Ball on (what the scoring screen allows)
Balls that aren't "on" are disabled on the scoring screen (`isLegalPot`).

| Phase | Legal pot |
|---|---|
| `reds`, red expected | red |
| `reds`, colour expected | any colour, **or another red** (two reds can drop in one shot) |
| `finalColor` (just potted last red) | any colour |
| `colorsInOrder` | only the next colour, yellow → black, not re-spotted |
| `respottedBlack` | black only |
| `finished` | nothing |

Colours are re-spotted while reds remain.

### Free ball
- When a free ball is awarded, every ball is legal for the next pot.
- Potting a colour as a free ball while a red is on: it scores **1** (as a
  red), reds remaining don't change, and a colour is then expected.
- Potting an actual red while a free ball is awarded: it's just a red.
- In `colorsInOrder` the free ball is re-spotted and the colour on stays on.
- On the re-spotted black, a free ball scores 7.

### Fouls (including in-off)
- Penalty = max(4, value of ball on, value of ball involved). The player can
  override it with a custom penalty.
- The fouler scores nothing for that shot, their break ends, foul count +1.
- Who receives the penalty:
  - `1v1`: the opponent.
  - `freeForAll`: **every** other player gets the full penalty.
  - `team`: the opposing team (credited to its first player, so team totals
    add up).
- A red potted during a foul removes that red from the table. If it was the
  last red, play moves to colours in order, starting at yellow.
- A foul on the re-spotted black ends the frame.

### End of frame
- After the final black, if scores are level the black is re-spotted. The
  next pot or foul ends the frame.
- A player can concede the frame.
- **Reset Frame** wipes the current frame completely: it isn't counted, its
  points and breaks don't reach the match, and the same player breaks again.

### End of match
- Reaching the frames needed (e.g. 2 of 3) **clinches** the match but does
  **not** end it. Remaining frames are still played unless the players stop.
- The winner is whoever won the most frames. **Points never decide a match.**
  Level on frames is a draw. Nobody won a frame means no winner. In team mode
  each team counts once. (`lib/results.ts → pickWinner`)

### Undo and redo
- Undo is a state stack capped at 10 (`MAX_UNDO_STACK`), with redo. Any new
  action clears redo.
- Undone actions **stay in the action log** marked `undone: true`. Anything
  that adds up scores or builds stats from the log must skip them.

### Breaks
- 100+ is a century, 50–99 a half-century. A break counts once, at the
  highest tier it reached.

---

## Stats and history

- **Everything is counted per frame, not per match.** Win rate = frames won ÷
  frames played. Form and streak follow frames in the order played. Head to
  head adds up frames each side won. A 1–1 match is one frame won and one lost
  for each player.
- Match totals are summed across **every** frame. The engine resets scores
  each frame, so never read the current `player.score` as a match total.
- Each frame's winner and scores are saved. Stats read those; if a stored
  frame winner disagrees with the saved frame counts, it is ignored.
- "Played together" only uses matches where exactly the chosen group of
  players took part.

---

## Century

- 2–8 players race to land **exactly** on the target (50 or 100).
- Red is worth 10 or 20 (chosen at setup); colours keep snooker values.
- No sequence: any ball, any time. Red is never compulsory.
- Potting a red scores the red value. Missing a red costs the same and ends the
  visit. Missing a colour just ends the visit, no penalty.
- Other fouls deduct from the fouler. Nobody else gains.
- The same ball can be potted at most twice in a row in a visit.
- Overshooting doesn't score: the ball re-spots and the visit ends, but
  earlier points in that visit stand.
- Landing exactly on the target puts a player out, safe. The last player still
  short is the loser. Scores can go negative.
