# Decisions

Choices that are already settled, with the reason, so they aren't re-argued or
quietly undone. Newest first. To change one, add a new entry that replaces it.
Don't edit history.

Format: **Decision** — why. *(where it lives, version)*

---

### Timeline and undo
- **Undone shots stay on the timeline, struck through, and are skipped in every
  total.** Players argue about what happened; deleting history makes that
  worse. *(`ActionLogEntry.undone`, `lib/frameVisits.ts`, 2.4.x)*
- **The frame log is a centred, score-led scoresheet, not columns per
  player.** It must work for 2–8 players and team mode, and read the same in
  any mode. *(`lib/frameVisits.ts`, 2.4.0)*
- **Undo is guarded against double taps, can optionally ask first (Settings →
  Ask before undo, off by default), and has Redo.** Accidental undos on a
  phone at the table were common. *(1.5.0)*

### Results and stats
- **Stats count frames, not matches.** A 2–1 loss and a 0–2 loss are very
  different evenings; match-level win rates hid that. *(1.7.0)*
- **Level on frames is a draw; points never decide a match.** That's how real
  snooker works. *(`lib/results.ts`, 1.7.1)*
- **Every frame of the best-of is played, even after the match is clinched.**
  Friends play for the frames, not just the result. *(2.0.0)*
- **Each frame's winner and scores are saved.** Rebuilding them from shot logs
  was fragile and older saves had no logs. *(2.0.0)*
- **Match totals are summed from every frame.** Older saves only kept the last
  frame's scores and showed wrong totals. *(`lib/results.ts`)*

### Game rules
- **Two reds may be potted in one shot.** It happens at club level, and
  blocking it forced players to fake a foul. *(2.0.0)*
- **Reset Frame drops the frame completely and the same player breaks.**
  A restarted frame isn't a played frame. *(2.0.0)*
- **Re-spotted black: only the tied players play it, and a toss decides who
  goes first** (1v1 and free-for-all). Mirrors "which hand is the ball in" at
  the table. The toss winner plays first by default, with a Swap for a winner
  who'd rather not (the official rule lets the winner choose). Teams have no
  toss and the side at the table carries on. The random pick is made in the
  UI and saved through the reducer, so the engine stays deterministic and a
  resume never re-tosses. *(`components/RespotToss.tsx`, 2.4.5)*
- **Century is its own reducer.** The snooker rules took real work to get
  right; mixing in a different game would put them at risk.
  *(`engine/century.ts`)*

### Sharing
- **Share uses the Web Share API with a file when the device supports it,
  otherwise it downloads the image.** On iOS in standalone (home-screen)
  mode, `canvas.toDataURL()` plus a programmatic `<a download>` silently does
  nothing, so the share sheet has to come first and a fallback is required.
  *(`components/ShareSheet.tsx`)*
- **Share cards follow light/dark, with a tall Story shape option and the
  app's backdrop art.** *(`lib/shareCard.ts`, 2.2.0)*

### Device behaviour
- **Landscape on match start: lock it on Android; on iOS, show a rotate
  gate.** iOS has no orientation API. Every step fails silently; scoring
  never waits on orientation. *(`lib/orientation.ts`, 2.0.x)*
- **Sound goes on standby (AudioContext suspended) when idle.** A running
  AudioContext kept the phone awake and drained the battery. *(`lib/audio.ts`,
  2.3.2)*
- **Battery problems are profiled before they're fixed** (Safari Web
  Inspector → Timelines). Guessing led to changes that didn't help.

### Delivery
- **Every change ships with a version bump and player-facing release notes;
  the build fails without them.** *(`scripts/check-release.mjs`)*
- **No new dependencies without an explicit reason.** The app is small and
  should stay that way.
- **Phased, small commits that can each be rolled back.**

### Not done (on purpose, for now)
These were in the v2 plan (`docs/archive/v2-plan.md`) but the shipped code works
differently. Don't "finish" them without asking:
- Event-sourced engine. The engine still uses a state reducer with an undo
  stack.
- Every ball tappable at all times. Balls that aren't on are still disabled.
- Removing the old CSS files and the manual light/dark toggle. Both are still
  in use.
