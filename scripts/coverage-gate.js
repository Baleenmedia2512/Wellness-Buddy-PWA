#!/usr/bin/env node
/**
 * coverage-gate.js — claude.md §9.1
 * Reads merged Jest coverage JSON and enforces per-path floors.
 * Usage: node scripts/coverage-gate.js <coverage-dir>
 */
const fs = require('fs');
const path = require('path');

const FLOORS = [
  { match: /backend\/features\/[^/]+\/domain\//,     lines: 95, branches: 90 },
  { match: /backend\/features\/[^/]+\/validation\//, lines: 95, branches: 90 },
  { match: /backend\/features\/[^/]+\/api\//,        lines: 85, branches: 75 },
  { match: /backend\/features\/[^/]+\/data\//,       lines: 70, branches: 60 },
  { match: /frontend\/src\/features\/[^/]+\/hooks\//,lines: 85, branches: 75 },
  { match: /frontend\/src\/features\/[^/]+\/components\//, lines: 70, branches: 60 },
  { match: /(backend|frontend)\/.*shared\//,         lines: 90, branches: 80 },
];
const OVERALL = { lines: 80, branches: 70 };

const dir = process.argv[2] || 'coverage-raw';
const files = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.json')) files.push(p);
  }
}
if (!fs.existsSync(dir)) { console.error(`No coverage dir: ${dir}`); process.exit(1); }
walk(dir);

const merged = {};
for (const f of files) {
  try {
    const data = JSON.parse(fs.readFileSync(f, 'utf8'));
    Object.assign(merged, data);
  } catch (e) { console.error('Skip invalid coverage file', f, e.message); }
}

function pct(c, key) {
  const k = c[key];
  if (!k) return 100;
  return k.total === 0 ? 100 : (k.covered / k.total) * 100;
}

let totalLines = { covered: 0, total: 0 }, totalBranches = { covered: 0, total: 0 };
const violations = [];

for (const [file, cov] of Object.entries(merged)) {
  const linePct = pct({ lines: cov.lines || cov.l }, 'lines');
  const branchPct = pct({ branches: cov.branches || cov.b }, 'branches');
  const l = cov.lines || cov.l || { covered: 0, total: 0 };
  const b = cov.branches || cov.b || { covered: 0, total: 0 };
  totalLines.covered += l.covered || 0; totalLines.total += l.total || 0;
  totalBranches.covered += b.covered || 0; totalBranches.total += b.total || 0;

  const floor = FLOORS.find(r => r.match.test(file));
  if (!floor) continue;
  if (linePct < floor.lines)
    violations.push(`${file} lines ${linePct.toFixed(1)}% < ${floor.lines}%`);
  if (branchPct < floor.branches)
    violations.push(`${file} branches ${branchPct.toFixed(1)}% < ${floor.branches}%`);
}

const overallLines = (totalLines.covered / Math.max(totalLines.total, 1)) * 100;
const overallBranches = (totalBranches.covered / Math.max(totalBranches.total, 1)) * 100;
console.log(`Overall lines: ${overallLines.toFixed(1)}%  branches: ${overallBranches.toFixed(1)}%`);

if (overallLines < OVERALL.lines) violations.push(`Overall lines ${overallLines.toFixed(1)}% < ${OVERALL.lines}%`);
if (overallBranches < OVERALL.branches) violations.push(`Overall branches ${overallBranches.toFixed(1)}% < ${OVERALL.branches}%`);

if (violations.length) {
  console.error('\nCOVERAGE FAILURES:');
  violations.forEach(v => console.error('  ✗ ' + v));
  process.exit(1);
}
console.log('OK — coverage floors satisfied.');
