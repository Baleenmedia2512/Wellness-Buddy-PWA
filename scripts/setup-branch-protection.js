#!/usr/bin/env node
/**
 * setup-branch-protection.js — applies the protection rules from claude.md §11.3.
 * Usage:
 *   GITHUB_TOKEN=<pat> REPO=owner/name node scripts/setup-branch-protection.js
 */
const https = require('https');
const repo = process.env.REPO;
const token = process.env.GITHUB_TOKEN;
if (!repo || !token) { console.error('Set REPO and GITHUB_TOKEN.'); process.exit(1); }

const COMMON_CHECKS = [
  'Lint', 'Typecheck (jsconfig)', 'Architecture (VSA + dep-cruiser)',
  'Secrets scan', 'Unit tests', 'Integration tests', 'Coverage gate (claude.md §9.1)',
  'Build backend (Next.js)', 'Build frontend (CRA)', 'PR title, template, AI tag'
];

const BRANCHES = {
  main: {
    required_status_checks: { strict: true, contexts: COMMON_CHECKS.concat(['Semgrep (OWASP)', 'OSV scanner']) },
    enforce_admins: true,
    required_pull_request_reviews: { required_approving_review_count: 2, require_code_owner_reviews: true, dismiss_stale_reviews: true },
    required_linear_history: true,
    allow_force_pushes: false,
    allow_deletions: false,
    required_signatures: true,
    restrictions: null
  },
  staging: {
    required_status_checks: { strict: true, contexts: COMMON_CHECKS },
    enforce_admins: false,
    required_pull_request_reviews: { required_approving_review_count: 1, require_code_owner_reviews: true },
    required_linear_history: true,
    allow_force_pushes: false,
    allow_deletions: false,
    restrictions: null
  }
};

function api(method, path, body) {
  return new Promise((res, rej) => {
    const req = https.request({
      method, hostname: 'api.github.com', path,
      headers: {
        'User-Agent': 'gov-setup',
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'Content-Length': body ? Buffer.byteLength(body) : 0
      }
    }, r => {
      let data = ''; r.on('data', c => data += c);
      r.on('end', () => (r.statusCode < 300 ? res(data) : rej(new Error(`${r.statusCode} ${data}`))));
    });
    req.on('error', rej);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  for (const [branch, cfg] of Object.entries(BRANCHES)) {
    console.log('→ protecting', branch);
    await api('PUT', `/repos/${repo}/branches/${branch}/protection`, JSON.stringify(cfg));
  }
  console.log('Done.');
})().catch(e => { console.error(e); process.exit(1); });
