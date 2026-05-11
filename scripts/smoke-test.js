#!/usr/bin/env node
/**
 * VSA Smoke Test — hits every backend endpoint and records HTTP status.
 *
 * Purpose: capture a "before" snapshot now, re-run after every migration step,
 * and detect regressions (an endpoint that returned 200/401 yesterday must
 * still return 200/401 today).
 *
 * What "passing" means here:
 *   - 200/201/204 → endpoint reachable + happy
 *   - 400/401/403/405 → endpoint reachable + correctly rejecting our empty
 *     request (also fine — proves routing works)
 *   - 5xx, ECONNREFUSED, timeout → FAIL (regression)
 *
 * Usage:
 *   1. Start backend:  cd backend && npm run dev
 *   2. In another shell:  node scripts/smoke-test.js
 *   3. Compare output against the previous run
 *
 * Configurable via env:
 *   SMOKE_BASE_URL   default http://localhost:3000
 *   SMOKE_TIMEOUT_MS default 8000
 *   SMOKE_OUTPUT     default reports/smoke-<timestamp>.json
 */

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const TIMEOUT_MS = Number(process.env.SMOKE_TIMEOUT_MS || 8000);
const OUT_DIR = path.resolve(__dirname, '..', 'reports');
const OUT_FILE = process.env.SMOKE_OUTPUT
  || path.join(OUT_DIR, `smoke-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);

// Endpoints discovered from backend/pages/api/**/*.js
// Each entry: [method, path, body?]
// Methods chosen based on filename verb (save/update/delete vs get/list).
const ENDPOINTS = [
  ['GET',  '/api/admin/all-members-discipline'],
  ['GET',  '/api/admin/time-windows'],
  ['POST', '/api/check-center-name', { name: '__smoke__' }],
  ['GET',  '/api/coach/attendance-report'],
  ['GET',  '/api/coach/club-attendance-report'],
  ['GET',  '/api/coach/discipline-report'],
  ['GET',  '/api/coach/download-attendance-excel'],
  ['GET',  '/api/coach/hierarchical-club-attendance'],
  ['GET',  '/api/coach/hierarchical-clubs-overview'],
  ['GET',  '/api/coach/team-hierarchy'],
  ['GET',  '/api/coach/team-steps'],
  ['GET',  '/api/counselling/get-assessments'],
  ['GET',  '/api/counselling/hierarchical-assessments'],
  ['POST', '/api/counselling/save-assessment', {}],
  ['POST', '/api/delete-background-analysis', {}],
  ['POST', '/api/delete-education-log', {}],
  ['POST', '/api/delete-user-account', {}],
  ['DELETE', '/api/weight/delete', { userId: 0, entryId: 0 }],
  ['POST', '/api/detect-face', {}],
  ['GET',  '/api/get-activity-time-report'],
  ['GET',  '/api/get-background-analysis'],
  ['GET',  '/api/get-daily-activity'],
  ['GET',  '/api/get-education-log-image'],
  ['GET',  '/api/get-education-logs'],
  ['GET',  '/api/get-education-summary'],
  ['GET',  '/api/get-food-corrections'],
  ['GET',  '/api/get-global-corrections'],
  ['GET',  '/api/get-latest-token-costs'],
  ['GET',  '/api/get-my-club-attendance'],
  ['GET',  '/api/get-nutrition-centers'],
  ['GET',  '/api/get-screen-time'],
  ['GET',  '/api/get-time-windows'],
  ['GET',  '/api/get-token-correction'],
  ['GET',  '/api/get-token-pricing'],
  ['GET',  '/api/get-token-usage'],
  ['GET',  '/api/get-user-context'],
  ['GET',  '/api/get-user-profile'],
  ['GET',  '/api/get-watch-burned-calories'],
  ['GET',  '/api/get-water-intake'],
  ['GET',  '/api/weight/history'],
  ['GET',  '/api/leaderboard/get-discipline-leaderboard'],
  ['GET',  '/api/leaderboard/get-global-leaderboard'],
  ['GET',  '/api/lookup-user-id'],
  ['POST', '/api/register-nutrition-center', {}],
  ['POST', '/api/reverse-lookup-correction', {}],
  ['POST', '/api/save-background-analysis', {}],
  ['POST', '/api/save-daily-activity', {}],
  ['POST', '/api/save-education-log', {}],
  ['POST', '/api/save-food-correction', {}],
  ['POST', '/api/save-google-user', {}],
  ['POST', '/api/save-screen-time', {}],
  ['POST', '/api/save-token-correction', {}],
  ['POST', '/api/save-token-usage', {}],
  ['POST', '/api/weight/save', {}],
  ['POST', '/api/search-food-history', {}],
  ['POST', '/api/send-otp', {}],
  ['GET',  '/api/server-time'],
  ['POST', '/api/snooze-profile-pic', {}],
  ['GET',  '/api/team/check-availability'],
  ['POST', '/api/team/claim-id', {}],
  ['POST', '/api/undo-deleted-analysis', {}],
  ['POST', '/api/undo-deleted-education-log', {}],
  ['POST', '/api/weight/undo', {}],
  ['POST', '/api/unregister-nutrition-center', {}],
  ['POST', '/api/update-nutrition-analysis', {}],
  ['POST', '/api/update-user-profile', {}],
  ['POST', '/api/upline/cancel-request', {}],
  ['POST', '/api/upline/request', {}],
  ['POST', '/api/upline/validate-otp', {}],
  ['POST', '/api/user/skip-setup', {}],
  ['GET',  '/api/user/status'],
  ['GET',  '/api/user-nutrition-stats'],
  ['GET',  '/api/users/search'],
  ['POST', '/api/verify-otp', {}],
  ['POST', '/api/wellness-university/enroll', {}],
  ['GET',  '/api/wellness-university/get-enrollments'],
  ['POST', '/api/wellness-university/update-enrollment', {}],
];

// Acceptable: routing works, even if business validation rejects.
const ACCEPTABLE = new Set([200, 201, 204, 400, 401, 403, 405, 422]);

function request(method, fullUrl, body) {
  return new Promise((resolve) => {
    const u = url.parse(fullUrl);
    const lib = u.protocol === 'https:' ? https : http;
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      method,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.path,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'vsa-smoke-test/1.0',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
      timeout: TIMEOUT_MS,
    };
    const start = Date.now();
    const req = lib.request(opts, (res) => {
      // drain
      res.on('data', () => {});
      res.on('end', () => resolve({ status: res.statusCode, ms: Date.now() - start }));
    });
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', (e) => resolve({ status: 0, ms: Date.now() - start, error: e.code || e.message }));
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`Smoke testing ${ENDPOINTS.length} endpoints against ${BASE_URL}\n`);
  const results = [];
  let pass = 0, fail = 0;

  for (const [method, p, body] of ENDPOINTS) {
    const full = BASE_URL + p;
    const r = await request(method, full, body);
    const ok = ACCEPTABLE.has(r.status);
    if (ok) pass++; else fail++;
    const tag = ok ? 'PASS' : 'FAIL';
    const detail = r.error ? `(${r.error})` : `${r.status} ${r.ms}ms`;
    console.log(`[${tag}] ${method.padEnd(4)} ${p.padEnd(48)} ${detail}`);
    results.push({ method, path: p, ...r, ok });
  }

  const summary = {
    generated: new Date().toISOString(),
    baseUrl: BASE_URL,
    total: ENDPOINTS.length,
    pass,
    fail,
    results,
  };
  fs.writeFileSync(OUT_FILE, JSON.stringify(summary, null, 2));
  console.log(`\n${pass}/${ENDPOINTS.length} acceptable, ${fail} regressions`);
  console.log(`Report: ${path.relative(process.cwd(), OUT_FILE)}`);
  process.exit(fail === 0 ? 0 : 1);
})();
