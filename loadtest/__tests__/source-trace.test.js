const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const trace = require('../source-trace');

const root = path.join(__dirname, '..', '..');

test('nested calls are both followed', function () {
  const names = trace.calledNames('runService(res, () => searchDrySalad(validateSearch(req.query)));');
  assert.ok(names.includes('searchDrySalad'));
  assert.ok(names.includes('validateSearch'));
});

test('a default parameter object does not truncate the function body', function () {
  const range = trace.findFunctionRange(
    'export function validateSuggestionsQuery(query = {}) {\n  if (!query?.userId) throw new Error("userId is required");\n}\n',
    'validateSuggestionsQuery',
  );
  assert.match(range.body, /userId is required/);
  assert.deepEqual(trace.requiredFields(range.body), ['userId']);
});

test('cache and hash updates are not database writes', function () {
  const effects = trace.lineEffects([
    'detailRowsCache.delete(oldest);',
    "return crypto.createHash('sha256').update(data).digest('hex');",
    'await supabase.from("t").delete().eq("id", 1);',
    'await supabase.from("t").update({ Status: "closed" });',
  ].join('\n'));
  assert.deepEqual(effects.writes, ['delete', 'update']);
});

test('dry-salad search follows the catalog read and does not write', function () {
  const evidence = trace.traceRoute(root, 'backend/pages/api/dry-salad/search.js');
  assert.equal(evidence.writes.length, 0);
  assert.equal(evidence.external.length, 0);
  assert.equal(evidence.redirects.length, 0);
  assert.equal(evidence.requiredQuery.length, 0);
  assert.ok(evidence.functions.some(function (name) { return name.endsWith('#listApproved'); }));
  assert.ok(evidence.functions.some(function (name) { return name.endsWith('#searchItems'); }));
  assert.equal(evidence.uncertain, false);
});

test('a missing required field message is detected', function () {
  assert.deepEqual(
    trace.requiredFields('if (!userId) throw new ValidationError(400, "Missing required field: userId");'),
    ['userId'],
  );
});

test('a helper database update is attributed to the called function', function () {
  const evidence = trace.traceRoute(root, 'backend/pages/api/admin/time-windows.js');
  assert.ok(evidence.writes.some(function (hit) {
    return hit.fn === 'updateAdminTimeWindow' && hit.match === 'update';
  }));
});
