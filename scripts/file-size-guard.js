#!/usr/bin/env node
/**
 * file-size-guard.js — claude.md §2.3
 * Warn at 350 LOC, fail at 500 LOC (excluding tests, generated files).
 */
const fs = require('fs');
const path = require('path');

const SCOPES = ['backend/features', 'backend/pages', 'backend/utils', 'backend/shared', 'frontend/src'];
const EXCLUDE = /(__tests__|\.test\.|\.spec\.|node_modules|build|\.next|out|dist|service-worker|update-sw-version)/;
const WARN = 350, FAIL = 500;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (EXCLUDE.test(p)) continue;
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|jsx|ts|tsx)$/.test(e.name)) out.push(p);
  }
}

const files = [];
SCOPES.forEach(s => fs.existsSync(s) && walk(s, files));

let failed = 0, warned = 0;
for (const f of files) {
  const loc = fs.readFileSync(f, 'utf8').split('\n').filter(l => l.trim() && !l.trim().startsWith('//')).length;
  if (loc >= FAIL) { console.error(`✗ ${f} ${loc} LOC (fail ≥ ${FAIL})`); failed++; }
  else if (loc >= WARN) { console.warn(`! ${f} ${loc} LOC (warn ≥ ${WARN})`); warned++; }
}
console.log(`\n${files.length} files scanned. ${warned} warnings, ${failed} failures.`);
if (failed > 0) process.exit(1);
