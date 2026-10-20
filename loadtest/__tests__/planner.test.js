const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const planner = require('../planner');

function entry(overrides) {
  return Object.assign({
    route: '/api/example',
    methods: ['GET'],
    classification: 1,
    purpose: 'Example read',
    sourceFile: 'backend/pages/api/example.js',
    authentication: 'No global session middleware.',
    effects: {
      reads: true,
      modifiesData: false,
      uploadsFiles: false,
      sendsSms: false,
      sendsEmail: false,
      callsGeminiOrPaidService: false,
      triggersBackgroundWork: false,
    },
  }, overrides);
}

test('a GET write route stays excluded', function () {
  const route = planner.classifyRoute(entry({
    classification: 2,
    methods: ['GET', 'POST'],
    effects: { reads: true, modifiesData: true },
  }), null, 'export default function handler() {}');
  assert.equal(route.status, 'excluded');
});

test('an inspected approved read stays safe only without side effects', function () {
  const route = planner.classifyRoute(entry({
    route: '/api/misc/server-time',
  }), {
    path: '/api/misc/server-time',
    approved: true,
    inspected: true,
    parametersKnown: true,
    requiredQuery: [],
    mayRedirect: false,
  }, 'export async function getServerTime() { return { httpStatus: 200 }; }');
  assert.equal(route.status, 'safe');
});

test('sms inside an approved route file excludes it', function () {
  const route = planner.classifyRoute(entry({
    route: '/api/misc/server-time',
  }), {
    approved: true,
    inspected: true,
    parametersKnown: true,
    requiredQuery: [],
    mayRedirect: false,
  }, 'await sendMdtSms(phone);');
  assert.equal(route.status, 'excluded');
});

test('a blocked read with known query needs test data and stays unapproved', function () {
  const route = planner.classifyRoute(entry({
    route: '/api/weight/history',
  }), {
    approved: false,
    inspected: true,
    parametersKnown: true,
    requiredQuery: ['userId'],
    mayRedirect: false,
  }, 'if (!query.userId) throw new Error("missing");');
  assert.equal(route.status, 'needs-test-data');
  assert.equal(route.catalogApproved, false);
});

test('an untraced GET stays in manual review', function () {
  const route = planner.classifyRoute(entry({
    route: '/api/activity/report',
  }), {
    approved: false,
    inspected: false,
    parametersKnown: false,
    requiredQuery: [],
    mayRedirect: false,
  }, 'export default function handler() { return runService(); }');
  assert.equal(route.status, 'manual-review');
});

test('the inventory reconciles to 144 routes and only inspected approved reads are safe', function () {
  const root = path.join(__dirname, '..', '..');
  const inventory = JSON.parse(fs.readFileSync(path.join(root, 'loadtest', 'api-inventory.json'), 'utf8'));
  const approved = JSON.parse(fs.readFileSync(path.join(root, 'loadtest', 'approved-endpoints.json'), 'utf8'));
  const plan = planner.buildPlan(inventory, approved, function (relativePath) {
    const fullPath = path.join(root, relativePath);
    if (!fs.existsSync(fullPath)) return null;
    return fs.readFileSync(fullPath, 'utf8');
  });
  assert.equal(plan.counts.discovered, 144);
  assert.equal(plan.requestsSent, false);
  const total = plan.counts.safe + plan.counts['needs-test-data'] + plan.counts['manual-review'] + plan.counts.excluded;
  assert.equal(total, 144);
  const safe = plan.routes.filter(function (route) { return route.status === 'safe'; }).map(function (route) { return route.route; }).sort();
  assert.deepEqual(safe, [
    '/api/dry-salad/search',
    '/api/misc/server-time',
    '/api/misc/time-windows',
    '/api/nutrition-centers/check-name',
  ]);
  plan.routes.forEach(function (route) {
    if (route.inventoryClass !== 1) assert.notEqual(route.status, 'safe');
    if (route.status === 'safe') assert.equal(route.catalogApproved, true);
  });
});

test('a failed stage stops the later stages and the report still lists them', function () {
  let calls = 0;
  const results = planner.executeStages(planner.STAGES, function (stage) {
    calls += 1;
    if (stage.id === 'stage-5') {
      return { id: stage.id, vus: stage.vus, durationSeconds: stage.durationSeconds, decision: 'fail', reason: 'stop' };
    }
    return { id: stage.id, vus: stage.vus, durationSeconds: stage.durationSeconds, decision: 'pass', reason: 'ok' };
  });
  assert.equal(calls, 2);
  assert.deepEqual(results.map(function (stage) { return stage.id; }), ['stage-1', 'stage-5', 'stage-10']);
  assert.equal(results[2].decision, 'not-run');
  assert.match(results[2].reason, /previous stage failed/);
});

test('the default stage list is stage-1, stage-5, then stage-10', function () {
  assert.deepEqual(planner.STAGES.map(function (stage) { return stage.id; }), ['stage-1', 'stage-5', 'stage-10']);
});

test('traced helper writes stay excluded and incomplete graphs stay blocked', function () {
  const root = path.join(__dirname, '..', '..');
  const inventory = JSON.parse(fs.readFileSync(path.join(root, 'loadtest', 'api-inventory.json'), 'utf8'));
  const approved = JSON.parse(fs.readFileSync(path.join(root, 'loadtest', 'approved-endpoints.json'), 'utf8'));
  const plan = planner.buildPlan(inventory, approved, function (relativePath) {
    const fullPath = path.join(root, relativePath);
    if (!fs.existsSync(fullPath)) return null;
    return fs.readFileSync(fullPath, 'utf8');
  });
  assert.equal(inventory.counts['1'] + inventory.counts['2'] + inventory.counts['3'] + inventory.counts['4'], 144);
  const status = function (route) {
    return plan.routes.find(function (item) { return item.route === route; });
  };
  assert.equal(status('/api/ai-credits/status').status, 'excluded');
  assert.match(status('/api/ai-credits/status').reason, /ensureUsageRow/);
  assert.equal(status('/api/wellness-score/daily').status, 'excluded');
  assert.match(status('/api/wellness-score/daily').reason, /upsertDailyScore/);
  assert.equal(status('/api/diary/list').status, 'manual-review');
  assert.equal(status('/api/food-corrections/global').status, 'manual-review');
  assert.equal(status('/api/dashboard').status, 'manual-review');
  assert.equal(status('/api/body-parameters-card/history').status, 'needs-test-data');
  assert.equal(status('/api/dry-salad/search').catalogApproved, true);
});

test('stage virtual users stay inside the runner cap', function () {
  planner.STAGES.forEach(function (stage) {
    assert.ok(stage.vus <= planner.HARD_MAX_VUS);
    assert.equal(stage.durationSeconds <= planner.HARD_MAX_DURATION_SECONDS, true);
  });
});
