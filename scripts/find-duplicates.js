#!/usr/bin/env node
/**
 * find-duplicates.js — claude.md §1.1 / §5.1
 * Naive textual similarity finder across feature folders. Flags candidate
 * duplicate exported functions/hooks. NOT a perfect tool; raises hints for
 * reviewers and AI to verify.
 *
 * Usage: node scripts/find-duplicates.js [--threshold 0.85] [--fail-on-new]
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = process.cwd();
const SCOPES = ['backend/features', 'backend/utils', 'backend/shared', 'frontend/src/features', 'frontend/src/shared'];
const EXCLUDE = /(__tests__|\.test\.|node_modules|build|\.next|out|dist)/;
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => {
  if (v.startsWith('--')) a.push([v.slice(2), arr[i + 1]?.startsWith('--') ? true : arr[i + 1]]);
  return a;
}, []));
const THRESHOLD = parseFloat(args.threshold || 0.85);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (EXCLUDE.test(p)) continue;
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|jsx)$/.test(e.name)) out.push(p);
  }
}
const files = [];
SCOPES.forEach(s => walk(path.join(ROOT, s), files));

const FN_RE = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)\s*\{/g;
const ARROW_RE = /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g;

const fns = [];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = FN_RE.exec(src)))   fns.push({ file: f, name: m[1], sig: m[2].replace(/\s+/g, '') });
  while ((m = ARROW_RE.exec(src))) fns.push({ file: f, name: m[1], sig: m[2].replace(/\s+/g, '') });
}

// group by normalised name
const groups = {};
for (const fn of fns) {
  const key = fn.name.toLowerCase().replace(/(get|fetch|load|compute|calc|calculate)/g, '').replace(/[^a-z]/g, '');
  if (!key) continue;
  (groups[key] = groups[key] || []).push(fn);
}

const dupes = Object.entries(groups).filter(([, g]) => g.length > 1 && new Set(g.map(x => x.file)).size > 1);
if (dupes.length) {
  console.log('Possible duplicate logic (review required):\n');
  for (const [key, g] of dupes) {
    console.log(`  ~${key}`);
    g.forEach(x => console.log(`    - ${x.name}(${x.sig}) — ${path.relative(ROOT, x.file)}`));
  }
}

if (args['fail-on-new']) {
  // Compare against a baseline file if it exists.
  const baseline = '.duplicates-baseline.json';
  const current = dupes.map(([k, g]) => k).sort();
  if (fs.existsSync(baseline)) {
    const base = JSON.parse(fs.readFileSync(baseline, 'utf8'));
    const added = current.filter(k => !base.includes(k));
    if (added.length) {
      console.error('\nNew duplicate-logic clusters introduced:', added);
      process.exit(1);
    }
  } else {
    fs.writeFileSync(baseline, JSON.stringify(current, null, 2));
    console.log(`Baseline written to ${baseline}.`);
  }
}
