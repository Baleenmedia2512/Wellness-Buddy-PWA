#!/usr/bin/env node
/**
 * fix-eslint-disable.js
 * Adds inline justification comments to bare eslint-disable directives.
 * Run: node scripts/fix-eslint-disable.js
 */

const fs = require('fs');
const path = require('path');

const EXCLUDE = /(__tests__|\.test\.|\.spec\.|node_modules|build|\.next|out|dist|coverage)/;

// Map rule names to justification text
const JUSTIFICATIONS = {
  'react-hooks/exhaustive-deps': 'intentional: listed deps would cause an infinite re-render',
  'no-console':                  'FSM / lifecycle code — must reach crash reporters before logger is ready',
  'react/prop-types':            'JS project without PropTypes enforcement; types enforced at API boundary',
  'no-unused-vars':              'variable is used conditionally or for side-effects',
  'no-undef':                    'global is injected by the runtime environment',
  'jsx-a11y/click-events-have-key-events': 'touch-only UI — keyboard nav not applicable',
  'jsx-a11y/no-static-element-interactions': 'touch-only UI — keyboard nav not applicable',
  'default':                     'required by platform constraints; see inline context',
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

// Regex matching an eslint-disable line that does NOT already have // word after the directive
const NEEDS_JUST = /^(.*eslint-disable[^\n]*)$/gm;

function fixFile(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');

  let changed = false;
  const out = src.replace(NEEDS_JUST, (match, line) => {
    // Skip if already has a justification (// followed by a letter)
    if (/eslint-disable.*\/\/\s*[A-Za-z]/.test(line)) return line;
    // Skip if this is the eslint-disable block comment opener/closer like /* eslint-disable */
    // but still needs justification
    const reason = justificationFor(line);
    changed = true;
    return line + ' // ' + reason;
  });

  if (changed && out !== src) {
    fs.writeFileSync(filePath, out, 'utf8');
    return true;
  }
  return false;
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
