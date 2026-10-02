#!/usr/bin/env node
/**
 * Runs before every build (npm "prebuild"), so Vercel refuses to deploy a
 * version without release notes. Checks that:
 *   - package.json "version" equals the newest entry in src/changelog.ts
 *   - every changelog version is x.y.z, and they run newest → oldest
 *   - every entry has a date and at least one change listed
 */

import { readFileSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const pkg = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'));
const src = readFileSync(new URL('src/changelog.ts', root), 'utf8');

const fail = (msg) => {
  console.error(`\n✖ Release check failed: ${msg}\n`);
  console.error('  Add an entry at the top of src/changelog.ts and set the same');
  console.error('  "version" in package.json (feature → 1.x+1.0, fix → 1.x.y+1).\n');
  process.exit(1);
};

const entries = [...src.matchAll(/version:\s*'([^']+)'[\s\S]*?date:\s*'([^']+)'([\s\S]*?)(?=\n  \{|\n\];)/g)]
  .map((m) => ({ version: m[1], date: m[2], body: m[3] }));

if (entries.length === 0) fail('no entries found in src/changelog.ts');

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const parts = (v) => v.match(SEMVER).slice(1).map(Number);
const newer = (a, b) => {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < 3; i += 1) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};

entries.forEach((e, i) => {
  if (!SEMVER.test(e.version)) fail(`"${e.version}" is not a version like 1.2.3`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date)) fail(`${e.version} has no YYYY-MM-DD date`);
  if (!/(added|improved|fixed):\s*\[\s*['"]/.test(e.body)) fail(`${e.version} lists no changes`);
  if (i > 0 && !newer(entries[i - 1].version, e.version)) {
    fail(`${entries[i - 1].version} must be newer than the entry below it (${e.version})`);
  }
});

if (pkg.version !== entries[0].version) {
  fail(`package.json is ${pkg.version} but the newest changelog entry is ${entries[0].version}`);
}

console.log(`✓ Release ${pkg.version} has release notes (${entries.length} versions in the changelog)`);
