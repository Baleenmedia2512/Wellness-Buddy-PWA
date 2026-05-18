#!/usr/bin/env node
/**
 * qa-bot.js — claude.md §10.2
 * Drives the top user journeys with Playwright as a "human-like" QA pass.
 * Produces reports/qa-bot-<sha>.json with a production-confidence score.
 *
 * Requires: e2e/ Playwright setup. Reads env: SMOKE_BASE_URL, QA_BOT_USER, QA_BOT_PASS.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const sha = (process.env.GITHUB_SHA || execSync('git rev-parse HEAD').toString().trim()).slice(0, 12);
const outDir = path.resolve('reports');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `qa-bot-${sha}.json`);

let result;
try {
  execSync(
    'npx playwright test --grep @journey --reporter=json --output=playwright-report-qabot',
    { cwd: 'e2e', stdio: 'inherit', env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: 'qa-bot-result.json' } }
  );
  const raw = JSON.parse(fs.readFileSync('e2e/qa-bot-result.json', 'utf8'));
  result = raw;
} catch (e) {
  console.error('QA Bot Playwright run failed:', e.message);
  result = { stats: { expected: 0, unexpected: 0, flaky: 0 } };
}

const passed = result.stats?.expected || 0;
const failed = result.stats?.unexpected || 0;
const flaky = result.stats?.flaky || 0;
const total = passed + failed;

let score = 100;
score -= failed * 25;
score -= flaky * 10;
if (total === 0) score = 0;
score = Math.max(0, Math.min(100, score));

const recommendation = failed > 0 ? 'NO-GO' : score >= 80 ? 'GO' : 'NO-GO';

const report = {
  sha,
  feature: 'top-10-journeys',
  journeysRun: total,
  journeysPassed: passed,
  journeysFailed: failed,
  flaky,
  productionConfidenceScore: score,
  recommendation,
  reasoning: failed
    ? `${failed} critical journey(s) failed. Block release.`
    : flaky
      ? `Flaky tests detected. Investigate before release.`
      : `All journeys passed.`,
  generatedAt: new Date().toISOString()
};

fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
console.log('QA Bot report:', outFile);
console.log(JSON.stringify(report, null, 2));
if (recommendation === 'NO-GO') process.exit(1);
