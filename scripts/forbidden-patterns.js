#!/usr/bin/env node
/**
 * forbidden-patterns.js — claude.md §1.2
 * Greps the repo for patterns that auto-reject a PR.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCOPES = ['backend/features', 'backend/pages', 'frontend/src'];
const EXCLUDE = /(__tests__|\.test\.|\.spec\.|node_modules|build|\.next|out|dist)/;

const RULES = [
  { name: 'console.log',            re: /console\.log\(/g,                msg: 'Use the shared logger.' },
  { name: 'empty catch',            re: /catch\s*\([^)]*\)\s*\{\s*\}/g,   msg: 'Silent catch is forbidden.' },
  { name: 'TODO without id',        re: /TODO(?!\(#?\d)/g,                msg: 'TODO must reference an issue id.' },
  { name: 'eslint-disable no-just', re: /eslint-disable(?!.*\/\/\s?[A-Za-z])/g, msg: 'eslint-disable requires inline justification.' },
  { name: 'localStorage direct',    re: /(^|[^.\w])localStorage\./g,      msg: 'Use shared/lib/storage wrapper.', scopeIncludes: ['frontend/src/features'] },
];

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

let violations = 0;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  for (const rule of RULES) {
    if (rule.scopeIncludes && !rule.scopeIncludes.some(s => f.includes(s))) continue;
    const matches = src.match(rule.re);
    if (matches) {
      console.error(`✗ ${f}: ${rule.name} (${matches.length}) — ${rule.msg}`);
      violations += matches.length;
    }
  }
}

if (violations > 0) {
  console.error(`\nFAIL — ${violations} forbidden patterns found.`);
  process.exit(1);
}
console.log('OK — no forbidden patterns.');
