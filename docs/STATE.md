# Where state lives

Every piece of the app that moves between states, where it lives, and how
explicit it is. Read this before adding a flag, a status string or another
`useState` that has to agree with an existing one.

Rule of thumb: if two values can contradict each other (`isOpen` + `isOtherOpen`,
`status` + `error`), make them one value with a union type, like `Overlay` in
`ScoringScreen.tsx` or `exportState` in `Settings.tsx`.

## Explicit (a single typed value decides)

| State | Values | Where |
|---|---|---|
| Frame phase | `reds → colorsInOrder → respottedBlack → finished` | `GameState.phase`, `engine/reducer.ts`. Transitions in `docs/SCORING.md` → *Frame phases* |
| Century game | playing → `finished` | `engine/century.ts` (own reducer, on purpose) |
| Scoring screen sheet | `none`, `foul`, `menu`, `log`, `previousFrames`, `nextFrameSetup` — one at a time | `Overlay` in `components/ScoringScreen.tsx` |
| Match summary save | `idle → saving → saved \| error \| empty` | `saveStatus` in `components/MatchSummary.tsx` |
| Settings export | `idle → working → done \| failed` | `exportState` in `components/Settings.tsx` |
| Colour mode | `dark \| auto \| light` | `lib/settings.ts`, `ui/ThemeSwitch.tsx` |
| Sound | the browser's own `AudioContext.state` (`running` / `suspended`), standby after idle | `lib/audio.ts` |

## Derived (computed, never stored — keep it that way)

| Shown | Comes from |
|---|---|
| Frame summary overlay | `isFrameOver(state)` |
| Re-spotted black toss | `needsRespotToss(state)` (+ a UI-only "show the result until Play" flag) |
| Match over | `isMatchOver(state)` — **not** `winner` (null for a drawn match) |
| Balls enabled | `isLegalPot(state, ball)` and not paused |
| Timers | timestamps in the reducer; no ticking interval |

## Implicit (spread over several values — handle with care)

| State | How it's represented today | Watch out for |
|---|---|---|
| Match lifecycle: playing → finished → saved | `localStorage` keys `activeMatch` (written every shot) and `pendingMatch` (written at End Match, cleared on a successful save), plus `saveStatus` on the summary | Nothing retries a failed signed-in save once the summary is left (to-do job 2). Changing these shapes needs a fallback for older saves |
| Century save | `savedRef` boolean, fire-and-forget | A failed Supabase write is silent (to-do job 2) |
| Sign-in | `loading`, `user`, `isGuest` in `hooks/useAuth.tsx` | Guest and signed-in are separate flags |
| History loading | `history === null` means loading | A failed Supabase read returns `[]`, so offline looks like "no matches yet" |
| Single match page | `match === undefined` loading, `null` not found | |
| Pause | `isPaused` in `ScoringScreen.tsx`, not saved | Locks every scoring button; the match clock keeps running |
| Share screen | `req` (open), `file` (ready to send), `url` (preview) | `file` is cleared on every option change so Share never sends an old image |
| Undo bar | `bar` + timer in `hooks/useUndoControls.tsx` | |

## Not in use

- `GamePhase` `'finalColor'` is declared and handled but nothing enters it.
  See `docs/SCORING.md`.
- `FoulDialog`'s `isInOff` is supported end to end (`IN_OFF` action), but the
  scoring screen has no button that opens the foul sheet as an in-off.
