#!/usr/bin/env node
/**
 * business-logic-block-check.js — claude.md §3.3
 * If any file under `**\/domain\/**` is touched, the PR body must
 * contain a populated Business Logic Impact block.
 */
const https = require('https');

const token = process.env.GITHUB_TOKEN;
const repo = process.env.REPO;          // owner/name
const pr = process.env.PR_NUMBER;
const body = process.env.PR_BODY || '';

function gh(path) {
  return new Promise((res, rej) => {
    https.get({
      hostname: 'api.github.com', path,
      headers: { 'User-Agent': 'pr-check', 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' }
    }, r => {
      let data = ''; r.on('data', c => data += c);
      r.on('end', () => res(JSON.parse(data)));
    }).on('error', rej);
  });
}

(async () => {
  const files = await gh(`/repos/${repo}/pulls/${pr}/files?per_page=100`);
  const domainTouched = files.some(f => /\/domain\//.test(f.filename));
  if (!domainTouched) { console.log('No domain/ changes — block not required.'); return; }

  const required = [
    /\*\*Why changed:\*\*\s*\S/,
    /\*\*Rules changed:\*\*\s*\S/,
    /\*\*Side effects:\*\*\s*\S/,
    /\*\*Modules impacted:\*\*\s*\S/,
    /\*\*Backward compatibility:\*\*/,
    /\*\*Edge cases considered.*\*\*\s*(?:\n\s*1\.\s*\S)/s,
    /\*\*Tests added:\*\*\s*\S/
  ];
  const missing = required.filter(r => !r.test(body));
  if (missing.length) {
    console.error('Business Logic Impact block incomplete:');
    missing.forEach((_, i) => console.error('  - field ' + i));
    process.exit(1);
  }
  console.log('Business Logic Impact block OK.');
})().catch(e => { console.error(e); process.exit(1); });
