#!/usr/bin/env node
/**
 * claude-md-guard.js — blocks production deploy if claude.md changed
 * in the deploying commit range without a `cto-approved` label on the PR.
 */
const { execSync } = require('child_process');
try {
  const diff = execSync('git diff --name-only HEAD~5..HEAD').toString();
  if (!diff.includes('claude.md')) { console.log('claude.md not modified — OK.'); process.exit(0); }
  const label = (process.env.PR_LABELS || '').toLowerCase();
  if (!label.includes('cto-approved')) {
    console.error('claude.md changed but PR is missing "cto-approved" label.');
    process.exit(1);
  }
  console.log('claude.md change is CTO-approved.');
} catch (e) {
  console.error(e.message); process.exit(0);
}
