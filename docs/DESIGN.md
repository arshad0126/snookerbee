# Design

Direction: **Apple-inspired** (iOS/visionOS). Calm, generous spacing, precise
type, one strong colour at a time. The balls are the only saturated colour on
the scoring screen.

This file points at the source of truth. It deliberately doesn't copy colour
values: copies go stale, and the CSS is the real definition.

## Where values live

| What | File |
|---|---|
| Colours, spacing, radius, type scale, motion | `src/styles/tokens.css` |
| Same tokens for canvas / share cards (JS can't read CSS vars) | `src/styles/tokens.ts`, which **must stay in sync** with tokens.css |
| Accent presets (Club Blue default, Baize, Claret, Gold, Pink Ball, Slate, Clay) | `src/styles/accents.css`, list in `src/lib/settings.ts` |
| Dashboard, profile, settings, stats, backdrops | `src/styles/v3.css` |
| Older screen styles still in use | `index.css`, `components.css`, `pages.css`, `scoring.css` |

## Rules

- **No raw colour, size or font values in components.** Use a token. If none
  fits, add one to `tokens.css` (and `tokens.ts` if canvas needs it) and say
  so in the change.
- Colour mode is light, dark or auto (`body.light-theme`); accent is set by
  `body[data-accent]`. Every screen must look right in **both modes and every
  accent**. Check at least light + Club Blue and dark + one other accent.
- Accent text must stay readable. accents.css lists contrast targets; keep to
  them when adding a preset.
- **Build from the UI kit first:** `src/components/ui/` (Button, Card, Sheet,
  GroupedList/ListRow, SegmentedControl, Stepper, StatTile, Avatar,
  EmptyState, Screen/NavBar, Toast, Ball, Icon). Add to it rather than writing
  a one-off.
- **Icons come only from `ui/Icon.tsx`** (inline SVG, `currentColor`). No
  emoji as UI icons. An icon-only button needs an `aria-label`.
- Numbers that change while playing (scores, breaks, timers) use
  `--font-numeric` so they don't jump in width.
- Popups during play are centred, not side drawers.
- The scoring screen is played in **landscape** on a phone held at the table.
  The app frame doesn't scroll, bounce or zoom. Respect safe areas once, at
  the frame level.
- Phone-first. Check any new screen at 375px wide, and in landscape if it
  appears during a match.

## Share cards

Drawn on canvas in `src/lib/shareCard.ts` using `tokens.ts`. They follow the
app's light/dark mode, offer a tall Story shape, and use the same backdrop
art as the app. If you change a token used there, check a card in both modes.
