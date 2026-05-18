#!/usr/bin/env node
/**
 * impacted-tests.js — claude.md §9.5
 * Given the changed files in the PR, compute the set of feature folders
 * whose test suites must run because they (transitively) import a modified
 * shared/domain module.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const base = process.argv[2] || 'origin/main';
const head = process.argv[3] || 'HEAD';

const changed = execSync(`git diff --name-only ${base}...${head}`).toString().split('\n').filter(Boolean);
const sharedTouched = changed.filter(f => /(shared\/|utils\/|domain\/)/.test(f));
if (!sharedTouched.length) { console.log('No shared/domain changes.'); process.exit(0); }
console.log('Shared/domain changes:', sharedTouched);

// crude: any feature folder whose files reference the basename of a changed file
const FEATURE_ROOTS = ['backend/features', 'frontend/src/features'];
function listFeatures() {
  const out = [];
  for (const r of FEATURE_ROOTS) if (fs.existsSync(r))
    for (const d of fs.readdirSync(r, { withFileTypes: true })) if (d.isDirectory()) out.push(path.join(r, d.name));
  return out;
}
function grep(folder, needle) {
  try {
    execSync(`grep -r --include="*.js" --include="*.jsx" -l "${needle}" ${folder}`, { stdio: 'pipe' });
    return true;
  } catch { return false; }
}
const impacted = new Set();
for (const feature of listFeatures()) {
  for (const f of sharedTouched) {
    const base = path.basename(f, path.extname(f));
    if (grep(feature, base)) { impacted.add(feature); break; }
  }
}
console.log('\nImpacted features:');
[...impacted].forEach(f => console.log('  - ' + f));
fs.writeFileSync('reports/impacted-features.json', JSON.stringify([...impacted], null, 2));
