#!/usr/bin/env node
/**
 * bundle-size-guard.js — claude.md §10.1
 * Fails if frontend build size grows > 5% vs. baseline.
 * Usage: node scripts/bundle-size-guard.js <build-dir> [--baseline <ref>]
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BUILD_DIR = process.argv[2] || 'frontend/build';
const baselineRef = (process.argv.includes('--baseline') ? process.argv[process.argv.indexOf('--baseline') + 1] : 'origin/main');

function dirSize(dir) {
  let total = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    total += e.isDirectory() ? dirSize(p) : fs.statSync(p).size;
  }
  return total;
}

if (!fs.existsSync(BUILD_DIR)) { console.error('No build dir:', BUILD_DIR); process.exit(1); }
const current = dirSize(BUILD_DIR);
console.log(`Current bundle size: ${(current / 1024).toFixed(1)} KB`);

let baseline = 0;
try {
  baseline = parseInt(execSync(`git show ${baselineRef}:.bundle-size-baseline 2>/dev/null`).toString().trim(), 10);
} catch { console.log('No baseline available — writing one.'); }

if (!baseline) {
  fs.writeFileSync('.bundle-size-baseline', String(current));
  console.log('Baseline written.');
  process.exit(0);
}

const delta = ((current - baseline) / baseline) * 100;
console.log(`Baseline: ${(baseline / 1024).toFixed(1)} KB · Δ ${delta.toFixed(2)}%`);
if (delta > 5) {
  console.error(`FAIL — bundle grew ${delta.toFixed(2)}% (> 5% budget).`);
  process.exit(1);
}
console.log('OK — within bundle budget.');
