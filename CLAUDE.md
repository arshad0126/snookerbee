# SnookerBee — notes for Claude Code

## Every change ships with a version bump and release notes

1. Add an entry at the **top** of `src/changelog.ts` (version, date, title, and
   `added` / `improved` / `fixed` lines written for players, not developers).
2. Set the same `"version"` in `package.json`.
   - New feature → bump the middle number: 1.3.0 → 1.4.0
   - Fix or small tweak → bump the last number: 1.3.0 → 1.3.1
3. `npm run build` runs `scripts/check-release.mjs` first and **fails** if the
   two don't match, so Vercel won't deploy a version without its notes.

The app shows the notes on the What's new page (profile menu) and puts a dot on
the profile photo until the user has seen the latest version.
