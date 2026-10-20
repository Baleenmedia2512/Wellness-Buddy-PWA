
const fs = require('fs');
const path = require('path');

const resultsDir = path.join(__dirname, 'results');
const baseName = '20261018-134412-misc-server-time';

const summaryPath = path.join(
  resultsDir,
  baseName + '.summary.json'
);

const reportPath = path.join(
  resultsDir,
  baseName + '.md'
);

const summary = JSON.parse(
  fs.readFileSync(summaryPath, 'utf8')
);

function metric(name, field) {
  const data = summary.metrics?.[name];
  if (!data || data[field] == null) return 'n/a';

  const value = Number(data[field]);
  return Number.isFinite(value)
    ? String(Math.round(value * 1000) / 1000)
    : 'n/a';
}

const checks = summary.metrics?.checks;
const checkRate =
  checks && checks.passes + checks.fails > 0
    ? (checks.passes / (checks.passes + checks.fails)) * 100
    : null;

const lines = [
  '# Load-test report',
  '',
  'Existing k6 results; no new HTTP requests were sent.',
  'This is not a pass or fail of the application.',
  '',
  '- Base host: wellness-valley-pwa-backend-test.vercel.app',
  '- Endpoint: /api/misc/server-time',
  '- VUs: 1',
  '- Duration: 30s',
  '',
  '## Timing',
  '',
  '- Iterations: ' + metric('iterations', 'count'),
  '- Failed request rate (%): ' +
    (Number(metric('http_req_failed', 'value')) * 100),
  '- Average latency (ms): ' + metric('http_req_duration', 'avg'),
  '- p95 latency (ms): ' + metric('http_req_duration', 'p(95)'),
  '- Max latency (ms): ' + metric('http_req_duration', 'max'),
  '- Check pass rate (%): ' +
    (checkRate == null ? 'n/a' : Math.round(checkRate * 100) / 100),
  '- Server errors counted: ' + metric('server_errors', 'count'),
  '',
  '## Checks',
  '',
  '- Checks passed: ' + (checks?.passes ?? 'n/a'),
  '- Checks failed: ' + (checks?.fails ?? 'n/a'),
  '',
  'No new HTTP requests were sent to staging.',
  ''
];

fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
console.log('Report regenerated:', reportPath);
console.log(fs.readFileSync(reportPath, 'utf8'));
