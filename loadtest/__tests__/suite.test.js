const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const suite = require('../suite');

test('omitting --stage selects stage-1, stage-5, and stage-10 in order', function () {
  assert.deepEqual(suite.selectedStages('').map(function (stage) { return stage.id; }), [
    'stage-1',
    'stage-5',
    'stage-10',
  ]);
});

test('restoreEnabledFalse changes only a true flag and leaves false untouched', function () {
  const filePath = path.join(os.tmpdir(), 'wellness-suite-enabled-' + process.pid + '.json');
  fs.writeFileSync(filePath, '{\n  "enabled": true,\n  "allowedHost": "staging.example"\n}\n');
  assert.equal(suite.restoreEnabledFalse(filePath), true);
  assert.match(fs.readFileSync(filePath, 'utf8'), /"enabled": false/);
  assert.match(fs.readFileSync(filePath, 'utf8'), /staging\.example/);
  assert.equal(suite.restoreEnabledFalse(filePath), false);
  fs.unlinkSync(filePath);
});

test('production and non-https hosts are rejected before a stage can start', function () {
  assert.match(suite.stagingProblem({
    stagingBaseUrl: 'https://wellness-valley.vercel.app',
    allowedHost: 'wellness-valley.vercel.app',
  }), /Production/);
  assert.match(suite.stagingProblem({
    stagingBaseUrl: 'http://staging.example',
    allowedHost: 'staging.example',
  }), /HTTPS/);
  assert.equal(suite.stagingProblem({
    stagingBaseUrl: 'https://wellness-valley-pwa-backend-test.vercel.app',
    allowedHost: 'wellness-valley-pwa-backend-test.vercel.app',
  }), '');
});

test('a group with a blocked route is not eligible', function () {
  const problem = suite.groupProblem({
    routes: [
      { group: 'public-read', status: 'safe' },
      { group: 'needs-configuration', status: 'manual-review' },
    ],
  }, 'needs-configuration');
  assert.match(problem, /not safe/);
  assert.equal(suite.groupProblem({
    routes: [{ group: 'public-read', status: 'safe' }],
  }, 'public-read'), '');
});
