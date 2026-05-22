#!/usr/bin/env node
/**
 * pr-template-check.js — claude.md §6.2
 * Fails if mandatory PR template sections are missing/empty.
 */
const body = process.env.PR_BODY || '';

const REQUIRED_HEADINGS = [
  '## Summary',
  '## Ticket / Issue',
  '## Type',
  '## Scope',
  '## Pre-Edit Checklist',
  '## A.R.E.R.V.T Workflow',
  '## Architecture Impact',
  '## API Impact',
  '## Database / Migration Impact',
  '## Security Impact',
  '## Dependency Impact',
  '## Regression Risk',
  '## Testing Evidence',
  '## AI Assistance Disclosure',
  '## Reviewer Routing'
];

const missing = REQUIRED_HEADINGS.filter(h => !body.includes(h));
if (missing.length) {
  console.error('PR description missing required sections:');
  missing.forEach(m => console.error('  - ' + m));
  process.exit(1);
}

// Summary non-empty
const m = body.match(/## Summary\s*\n([\s\S]*?)(?=\n## |\n#|$)/);
if (!m || !m[1].trim() || m[1].trim().startsWith('<!--')) {
  console.error('## Summary is empty.');
  process.exit(1);
}

// At least one Type checked
if (!/- \[x\] (feat|fix|refactor|perf|test|docs|chore|sec|infra)/i.test(body)) {
  console.error('At least one Type must be checked.');
  process.exit(1);
}

console.log('PR template OK.');
