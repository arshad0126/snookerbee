# SnookerBee — notes for Claude Code

Snooker scoring PWA. React 19 + TypeScript + Vite, Supabase (Google auth,
Postgres), hosted on Vercel. Works signed in or as a guest (localStorage).

## Read before you change

| If you touch… | Read first |
|---|---|
| `src/engine/**`, `src/lib/results.ts`, `src/lib/playerStats.ts`, anything that adds up scores | `docs/SCORING.md` |
| anything that re-opens a settled choice (share flow, stats, orientation, audio, undo) | `docs/DECISIONS.md` |
| any screen, CSS or colour | `docs/DESIGN.md` |

`MIGRATION_NOTES.md` is the original v2 plan, not a description of the code.
Large parts of it were never built (event-sourced engine, free-tap balls,
deleting the old CSS). When it disagrees with the code, the code wins.

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

## Hard rules

- **No new dependencies** unless the task explicitly asks for one.
- **Don't change scoring or results logic** unless the task is about it. If a
  UI task seems to need a rule change, stop and say so.
- **Ask before building** when the request is ambiguous, contradicts
  `docs/`, or would change stored data. Don't guess a rule.
- Keep changes focused. No drive-by refactors or renames in unrelated files.
- Never commit secrets. Supabase keys come from env vars (`.env.example`).
- Saved matches in Supabase and localStorage must keep loading. Anything that
  changes their shape needs a fallback for older saves (see the `?` fields in
  `src/engine/types.ts` for the pattern).

## Before you say it's done

Run the same checks CI runs, in this order, and report the result:

```
npm run lint
npm test
npm run build
```

If you changed a rule in `src/engine` or `src/lib/results.ts`, add or update a
test in the matching `__tests__` folder. If you changed a rule or a settled
decision, update `docs/SCORING.md` or `docs/DECISIONS.md` in the same commit.

## Commits

One logical change per commit, message in the existing style
(`feat(area): …`, `fix(area): …`), version in brackets when it's a release.
