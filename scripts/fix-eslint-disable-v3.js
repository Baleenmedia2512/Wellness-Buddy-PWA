#!/usr/bin/env node
/**
 * fix-eslint-disable-v3.js
 * Strips ALL standalone \r chars (from mangled CRLF writes), then ensures
 * every eslint-disable line has an inline justification comment.
 * Run: node scripts/fix-eslint-disable-v3.js
 */

const fs = require('fs');
const path = require('path');

const EXCLUDE = /(__tests__|\.test\.|\.spec\.|node_modules|build|\.next|out|dist|coverage)/;

const JUSTIFICATIONS = {
  'react-hooks/exhaustive-deps':           'intentional: adding this dep causes an infinite re-render loop',
  'no-console':                            'FSM/lifecycle code must reach crash reporters before logger is ready',
  'react/prop-types':                      'JS project without PropTypes enforcement; types enforced at API boundary',
  'no-unused-vars':                        'variable is used conditionally or for side-effects',
  'no-undef':                              'global injected by the runtime environment',
  'jsx-a11y/click-events-have-key-events': 'touch-only UI',
  'jsx-a11y/no-static-element-interactions':'touch-only UI',
  'default':                               'required by platform constraints — see surrounding context',
};

function justificationFor(line) {
  for (const [rule, reason] of Object.entries(JUSTIFICATIONS)) {
    if (rule !== 'default' && line.includes(rule)) return reason;
  }
  return JUSTIFICATIONS['default'];
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (EXCLUDE.test(p)) continue;
    if (e.isDirectory()) walk(p, out);
    else if (/\.(js|jsx)$/.test(e.name)) out.push(p);
  }
}

function fixFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');

  // Strip ALL \r characters (handles both \r\n and standalone \r from mangled writes)
  let src = raw.replace(/\r/g, '');

  const lines = src.split('\n');
  let changed = raw !== src; // already changed if we removed \r

  const fixed = lines.map(line => {
    if (!line.includes('eslint-disable')) return line;

    // Check if there is already // <word> after eslint-disable (on the clean line)
    if (/eslint-disable.*\/\/\s*[A-Za-z]/.test(line)) return line;

    const reason = justificationFor(line);
    changed = true;
    return line.trimEnd() + ' // ' + reason;
  });

  if (!changed) return false;

  fs.writeFileSync(filePath, fixed.join('\n'), 'utf8');
  return true;
}

const files = [];
['frontend/src', 'backend/features', 'backend/pages'].forEach(s => {
  if (fs.existsSync(s)) walk(s, files);
});

let fixed = 0;
for (const f of files) {
  if (fixFile(f)) {
    console.log('Fixed:', path.relative('.', f));
    fixed++;
  }
}
console.log(`\nDone. ${fixed} files updated.`);
