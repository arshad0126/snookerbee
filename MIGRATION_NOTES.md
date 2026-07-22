# SnookerBee v2 — Migration Notes (Phase 0)

> Audit of the current codebase and the disposition of every module under the v2 brief.
> **Decision locked:** keep all three game modes (1v1, team, free-for-all).
> **This document is the Phase 0 deliverable. It is a plan, not code. Review before Phase 1.**

---

## 1. Method

Every current source file was read in full (engine, screens, hooks, lib, styles) plus
`vite.config.ts`, `index.html`, `package.json`, and the working tree. Each is assigned a
disposition: **Keep**, **Rewrite**, or **Delete**, with the driving brief section noted.

Baseline: branch `v2-rebuild`, forked from `main @ d9b6c75` (tag `v1-checkpoint`).

---

## 2. Current architecture snapshot

| Area | Files | Responsibility today |
|---|---|---|
| Entry | `main.tsx`, `App.tsx` | Router, guest/auth route guards |
| Engine | `engine/{reducer,types,validators,constants,index,GameContext}.ts(x)` | Pure reducer, strict rule enforcement, undo via deep-clone stack |
| Screens | `components/{LandingPage,Dashboard,GameSetup,ScoringScreen,FrameSummary,MatchSummary,MatchHistory,MatchDetailsModal,FoulDialog,ActionLogDrawer,PreviousFramesModal,OrientationWarning,AuthCallback}.tsx` | All UI |
| Hooks | `hooks/{useAuth,useTheme}.ts(x)` | Supabase auth + guest; manual dark/light toggle |
| Lib | `lib/{supabase,database,audio}.ts` | Client, 3-table persistence + local fallback, Web Audio SFX |
| Styles | `styles/{index,components,pages,scoring}.css` | Dark-first design system |

Current data model (created out-of-band; **no migrations exist in-repo**): `matches`,
`match_players`, `match_frames`. Auth: Google OAuth via Supabase. Guest mode: `localStorage`.

---

## 3. Disposition

### 3.1 Delete

| File / concept | Why | Brief |
|---|---|---|
| `styles/index.css`, `styles/components.css`, `styles/pages.css`, `styles/scoring.css` | No CSS is carried over; replaced by token system + UI kit | §1.2, §1.5 |
| `components/OrientationWarning.tsx` | "Never show a please-rotate message… a failure state, not a feature" | §3.1 |
| `PreviousFramesModal.tsx`, `ActionLogDrawer.tsx`, `MatchDetailsModal.tsx` (as-is) | Rebuilt on the new UI kit (`Sheet`, `GroupedList`) — kept conceptually, not code | §1.4, §1.5 |
| `hooks/useTheme.ts` + all theme-toggle UI | v2 is light-primary; dark ships via `prefers-color-scheme` only, no manual toggle | §1.2 |
| `validators.ts::isLegalPot` + all "disabled ball" logic (`isBallEnabled`, `dimmed`, `disabled` on balls) | Every ball tappable at all times; the disabled-ball concept is removed from the codebase | §2.2 |
| Strict red↔colour alternation / phase enforcement in `reducer.ts` | Replaced by advisory-only hints | §2.4, §2.9 |

### 3.2 Rewrite

| File | New shape | Brief |
|---|---|---|
| `engine/reducer.ts` | Event-sourced fold over append-only `MatchEvent[]`; unlimited undo/redo via cursor | §2.3, §2.8 |
| `engine/types.ts` | `MatchEvent` union + `FrameState`; **extended for N players/teams** (see §5) | §2.3 |
| `engine/GameContext.tsx` | Append-event dispatch; sync every event to IndexedDB synchronously | §6 (crash recovery) |
| `engine/validators.ts` | Keep pure math (foul penalty, points-remaining, next colour) but **advisory only** — no enforcement | §2.9 |
| `lib/database.ts` | New 8-table schema + local-first outbox sync via `idb` | §5.2, §5.3 |
| `hooks/useAuth.tsx` | Keep Google OAuth; add profiles + guest-data-import sheet | §5.1 |
| All screens | Redesigned on the UI kit; delete old JSX/CSS coupling | §1.5 |

### 3.3 Keep (light touch)

| File | Note |
|---|---|
| `lib/supabase.ts` | Client init unchanged |
| `engine/constants.ts` | `BALL_VALUES`, `COLORS_IN_ORDER` reused verbatim |
| `lib/audio.ts` | Keep SFX; simplify light/dark branching (light-primary). Haptics added separately (§3.4) |
| `vite.config.ts` | PWA manifest already `orientation: "any"` ✓ (required by §3.3). Add update-prompt + offline font caching |
| `index.html` | Viewport already `viewport-fit=cover`, `user-scalable` removed ✓. Wire dynamic `theme-color` |
| `App.tsx` | Keep router + guest/auth guards; retarget to new routes |

### 3.4 New

`styles/tokens.{css,ts}` · `components/ui/*` (Screen, NavBar, GroupedList/ListRow, Card,
SegmentedControl, Button, Sheet, Stepper, Ball, Avatar, StatTile, EmptyState, Toast) ·
`hooks/useOrientationLock.ts`, `hooks/useWakeLock.ts` · `engine/__tests__/*` ·
`stats/*` (pure fns) · `supabase/migrations/*.sql` · share-card renderers.

---

## 4. Engine migration detail

- **State = fold(events)**. `FrameState` is derived, never stored as source of truth.
- **Undo/redo** = move `cursor`; a new event truncates the redo tail (§2.8).
- **Persistence**: each event written to IndexedDB *synchronously on append* so a crash
  mid-frame is recoverable by replay (§6 error boundary → "Recover match").
- **Fold-equivalence** is a required property test (§2.10 case 9): replay-from-scratch ===
  incremental state.
- Turn advancement is **explicit only** (`endTurn`); the engine never infers a turn ended (§2.5).

---

## 5. ✅ N-player reconciliation — APPROVED (§8.3) 2026-07-22

The brief's §5.2 schema, §2.3 foul event, §3.4 layout, and §5.5 stats are all **two-player**.
"Keep all three modes" forces deviations from that fixed schema. **The owner approved the
changes below as proposed.** Applied at their phases (schema → Phase 6, engine → Phase 2).

| Brief as written (2-player) | Proposed change (N-player) | Affected phase |
|---|---|---|
| `match_participants.seat int -- 1 or 2` | `seat int` = 1..N; add nullable `team_id` | 6 |
| — | New `teams` table (or `team` grouping) to store team membership + `frames_won` | 6 |
| Foul `{ againstPlayerId }` (single) | `{ byPlayerId, recipients: string[] }`; FFA → all opponents, team → opposing team, 1v1 → the one opponent (preserves current behavior) | 2, 6 |
| Landscape §3.4 = two score panels | Two-panel for 1v1/team; compact N-panel (scroll/grid) variant for 3–8 FFA players | 3, 5 |
| Head-to-head = 2 players | H2H = any two selected players across shared matches; unchanged UI, broader query | 7 |
| Tie → "Match drawn" | Multi-way tie handling for 3+ players/teams | 4 |

**Resolved decisions (2026-07-22):**

1. **§8.1 — Turn order (RESOLVED):** the **engine owns turn rotation**. On `endTurn` it
   auto-advances round-robin; team mode interleaves teams (T1P1,T2P1,T1P2…) as today. A
   `setActive` event can override the active player at any time (free/forgiving philosophy).
2. **§8.1 — Free-for-all standings & stats (RESOLVED):** FFA produces **full ranked standings,
   not binary win/lose**. Per frame: rank all players by frame score (1st = highest / cleared,
   2nd = next, … Nth). Per match: rank by frames won, tiebreak by total points across frames;
   remaining exact ties share the position. Stats track **placements** — count of 1st/2nd/3rd
   finishes and average finishing position; headline "win rate" = 1st-place finishes ÷ played.
   Per-player break stats (highest break, 20/30/50+, centuries) are identical across all modes.
   Final frame scores are already stored in `frame_scores`, so standings are derivable without
   extra schema.

**Still open (to resolve at their phase, not blocking Phase 1):**

3. **§8.2 — Vitest:** §2.10 mandates Vitest but it isn't in the §0 approved list. Treating the
   brief's own requirement as approval; confirm. (No other off-list deps needed for Phases 0–5.)
4. **§8.3 — Supabase environment:** no `supabase/` dir or CLI config exists; current tables were
   created manually. For Phase 6, is there a live project + CLI to apply migrations/RLS against,
   or do I author migrations for a fresh project you'll provision? Existing 3 tables → new schema
   needs a data-migration or clean-cutover decision.
5. **§8.4 — Old match history:** current `match_players`/`match_frames` rows. Migrate into the new
   `frame_events`-based model (lossy — old data has no event log), keep read-only in a legacy view,
   or drop? Offline guest `localStorage` history has the same question.

---

## 6. Risk register

| Risk | Mitigation |
|---|---|
| Losing a live frame to a crash | Synchronous per-event IndexedDB writes + replay recovery (§6) |
| iOS Safari has no orientation-lock API | Tier-2 CSS-rotation fallback; verify sheet drag + safe-area remap under rotation (§3.2) |
| Offline-first vs sync conflicts | Local-write-first outbox; `frame_events` append-only merged by `(frame_id, seq)`, never overwritten (§5.3) |
| RLS gaps leak cross-user data | Explicit `owner_id = auth.uid()` policies + a test that user B cannot read user A's rows (§5.2, Phase 6 gate) |
| Legacy data model incompatible with event sourcing | Decision item §5.5 above — resolve before Phase 6 |

---

## 7. Proposed Phase 1 entry criteria

Once these notes are approved and §5 open items 1–2 are answered (3–5 can wait for their phases),
Phase 1 begins: `tokens.{css,ts}` + UI component library + safe-area layout system + `?debug=layout`
overlay + a demo route. No engine or schema work until Phase 2/6.

**Stopping here for review per the Phase 0 gate ("Done when: Notes reviewed").**
