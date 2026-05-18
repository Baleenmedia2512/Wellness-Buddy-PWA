#!/usr/bin/env node
/**
 * adr-required-check.js — claude.md §2
 * Fails if a PR adds a new top-level folder under backend/features or
 * frontend/src/features without an accompanying ADR file under docs/adr/.
 *
 * Usage: node scripts/adr-required-check.js <base-sha> <head-sha>
 */
const { execSync } = require('child_process');
const [, , base, head] = process.argv;
if (!base || !head) { console.log('No SHAs given, skipping.'); process.exit(0); }

const changed = execSync(`git diff --name-status ${base}...${head}`, { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);

const newFeatureFolders = new Set();
const adrAdded = changed.some(l => /^A\s+docs\/adr\/\d{4}-/.test(l));

for (const line of changed) {
  const m = line.match(/^A\s+((?:backend\/features|frontend\/src\/features)\/([^/]+))\//);
  if (m) newFeatureFolders.add(m[2]);
}

// Detect if folder existed before
const filtered = [...newFeatureFolders].filter(folder => {
  try {
    execSync(`git ls-tree ${base} -- backend/features/${folder} frontend/src/features/${folder}`, { stdio: 'pipe' });
    return false;
  } catch { return true; }
});

if (filtered.length && !adrAdded) {
  console.error('New feature folder(s) added without an ADR:');
  filtered.forEach(f => console.error('  - ' + f));
  console.error('Create docs/adr/NNNN-<title>.md describing the decision.');
  process.exit(1);
}
console.log('ADR check OK.');
