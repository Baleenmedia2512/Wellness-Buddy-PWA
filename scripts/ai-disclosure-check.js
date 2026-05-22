#!/usr/bin/env node
/**
 * ai-disclosure-check.js — claude.md §5
 * Verifies the AI Assistance Disclosure section was completed.
 */
const body = process.env.PR_BODY || '';
const block = body.match(/## AI Assistance Disclosure[\s\S]*?(?=\n## |\n#|$)/);
if (!block) { console.error('Missing "## AI Assistance Disclosure" section.'); process.exit(1); }
const has = /- \[x\] (No AI used|AI-assisted)/i.test(block[0]);
if (!has) {
  console.error('AI Assistance Disclosure: must mark either "No AI used" or "AI-assisted".');
  process.exit(1);
}
console.log('AI disclosure OK.');
