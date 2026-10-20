/**
 * Safe staging load-test gate.
 * Sends nothing unless --confirm is present, config.enabled is true,
 * and the base URL is exactly the configured HTTPS staging host.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = __dirname;
const CONFIG_PATH = path.join(ROOT, 'config.json');
const CATALOG_PATH = path.join(ROOT, 'approved-endpoints.json');
const K6_SCRIPT = path.join(ROOT, 'k6', 'read-only.js');
const RESULTS_DIR = path.join(ROOT, 'results');

const PRODUCTION_HOSTS = new Set([
  'wellness-valley.vercel.app',
  'wellness-buddy-pwa.vercel.app',
  'app.wellnessvalley.app',
  'www.wellnessvalley.app',
  'wellnessvalley.app',
]);

function redact(text) {
  return String(text || '')
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/(authorization|token|secret|api[_-]?key|password)\s*[:=]\s*\S+/gi, '$1=[redacted]');
}

function fail(message) {
  console.error(redact(message));
  process.exit(1);
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (err) {
    fail('Could not read ' + path.basename(filePath) + '.');
  }
}

function parseArgs(argv) {
  const out = {
    dryRun: false,
    confirm: false,
    inspectThresholds: false,
    endpoint: '',
    group: '',
    vus: null,
    duration: null,
    help: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--confirm') out.confirm = true;
    else if (arg === '--inspect-thresholds') out.inspectThresholds = true;
    else if (arg === '--endpoint') out.endpoint = argv[++i] || '';
    else if (arg === '--group') out.group = argv[++i] || '';
    else if (arg === '--vus') out.vus = Number(argv[++i]);
    else if (arg === '--duration') out.duration = argv[++i] || '';
    else if (arg === '--help' || arg === '-h') out.help = true;
    else fail('Unknown argument: ' + arg);
  }
  return out;
}

function printHelp() {
  console.log([
    'Usage:',
    '  node loadtest/runner.js --dry-run --endpoint /api/misc/server-time',
    '  node loadtest/runner.js --dry-run --group public-read',
    '  node loadtest/runner.js --inspect-thresholds',
    '  node loadtest/runner.js --confirm --endpoint /api/misc/server-time',
    '',
    'A live run also requires config.enabled true and an HTTPS staging host',
    'that exactly matches config.allowedHost.',
    'VUs cannot exceed 10. Duration cannot exceed 30 seconds.',
  ].join('\n'));
}

function parseDurationSeconds(raw) {
  const text = String(raw || '').trim();
  const match = text.match(/^(\d+)(s)?$/);
  if (!match) return NaN;
  return Number(match[1]);
}

function requirePositiveInteger(value, name) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    fail('config.' + name + ' must be a positive integer. The live run was not started.');
  }
  return value;
}

function resolveLoad(config, args) {
  const maxVus = requirePositiveInteger(config.maxVus, 'maxVus');
  const maxDuration = requirePositiveInteger(config.maxDurationSeconds, 'maxDurationSeconds');
  if (maxVus > 10 || maxDuration > 30) {
    fail('config.json safety cap cannot be raised above 10 VUs and 30 seconds. The live run was not started.');
  }
  const vus = args.vus == null ? Number(config.vus) : args.vus;
  const seconds = args.duration == null
    ? requirePositiveInteger(config.durationSeconds, 'durationSeconds')
    : parseDurationSeconds(args.duration);
  if (!Number.isInteger(vus) || vus < 1) fail('VUs must be a whole number of at least 1.');
  if (vus > maxVus) fail('VUs cannot exceed ' + maxVus + '.');
  if (!Number.isInteger(seconds) || seconds < 1) fail('Duration must be a whole number of seconds. The live run was not started.');
  if (seconds > 30 || seconds > maxDuration) fail('Duration cannot exceed ' + maxDuration + ' seconds. The live run was not started.');
  return { vus: vus, seconds: seconds };
}

function validateStaging(config) {
  const problems = [];
  const raw = String(config.stagingBaseUrl || '').trim();
  const allowedHost = String(config.allowedHost || '').trim().toLowerCase();
  if (!raw) problems.push('stagingBaseUrl is empty');
  if (!allowedHost) problems.push('allowedHost is empty');
  if (allowedHost.includes('://') || allowedHost.includes('/')) {
    problems.push('allowedHost must be a hostname only');
  }
  let parsed = null;
  if (raw) {
    try {
      parsed = new URL(raw);
    } catch (err) {
      problems.push('stagingBaseUrl is not a valid URL');
    }
  }
  if (parsed) {
    if (parsed.protocol !== 'https:') problems.push('stagingBaseUrl must use HTTPS');
    if (parsed.username || parsed.password) problems.push('stagingBaseUrl must not contain credentials');
    if (parsed.search || parsed.hash) problems.push('stagingBaseUrl must not contain a query or hash');
    if (parsed.pathname !== '/' && parsed.pathname !== '') problems.push('stagingBaseUrl must not contain a path');
    const host = parsed.hostname.toLowerCase();
    if (PRODUCTION_HOSTS.has(host)) problems.push('stagingBaseUrl uses a known production host');
    if (host === 'supabase.co' || host.endsWith('.supabase.co')) {
      problems.push('stagingBaseUrl must be the API host, not a Supabase host');
    }
    if (allowedHost && host !== allowedHost) {
      problems.push('stagingBaseUrl host does not exactly match allowedHost');
    }
  }
  return {
    ok: problems.length === 0,
    problems: problems,
    baseUrl: parsed ? parsed.origin : '',
    allowedHost: allowedHost,
  };
}

function selectEndpoints(catalog, args) {
  let list = catalog.endpoints || [];
  if (args.group) list = list.filter(function (ep) { return ep.group === args.group; });
  if (args.endpoint) {
    const key = String(args.endpoint).replace(/\/$/, '');
    list = list.filter(function (ep) { return ep.path === key || ep.id === key; });
  }
  return list;
}

function buildQuery(ep, config) {
  const query = {};
  const reasons = [];
  const map = ep.queryFromConfig || {};
  const data = config.testData || {};
  Object.keys(map).forEach(function (queryName) {
    const configKey = map[queryName];
    const value = data[configKey];
    if (value == null || String(value).trim() === '') {
      reasons.push('missing config.testData.' + configKey);
    } else {
      query[queryName] = String(value).trim();
    }
  });
  (ep.requiredQuery || []).forEach(function (name) {
    if (!Object.prototype.hasOwnProperty.call(map, name)) {
      reasons.push('required query ' + name + ' has no config mapping');
    }
  });
  return { query: query, reasons: reasons };
}

function readiness(ep, config) {
  const reasons = [];
  if (ep.approved !== true) reasons.push(ep.blockedReason || 'not approved');
  if (ep.mayRedirect === true) reasons.push('endpoint may redirect to another host');
  if (ep.parametersKnown !== true) reasons.push('required parameters are not fully known');
  if (ep.method !== 'GET') reasons.push('only GET is allowed');
  if (String(ep.path || '').includes(':')) reasons.push('path still contains an unfilled parameter');
  if (!String(ep.path || '').startsWith('/api/')) reasons.push('path is outside /api');
  const built = buildQuery(ep, config);
  return {
    ok: reasons.length === 0 && built.reasons.length === 0,
    reasons: reasons.concat(built.reasons),
    query: built.query,
  };
}

function printEndpoint(ep, ready) {
  console.log('- ' + ep.method + ' ' + ep.path);
  console.log('  group: ' + ep.group);
  console.log('  approval: ' + ep.approvalStatus);
  console.log('  endpoint configured: ' + (ready.ok ? 'yes' : 'no'));
  if (!ready.ok) console.log('  blocked: ' + ready.reasons.join('; '));
  if ((ep.requiredQuery || []).length) {
    console.log('  required query: ' + ep.requiredQuery.join(', '));
  }
  console.log('  test data: ' + ep.testDataRequirements);
}

function printGroups(catalog) {
  const groups = {};
  (catalog.endpoints || []).forEach(function (ep) {
    if (!groups[ep.group]) groups[ep.group] = { approved: 0, blocked: 0 };
    if (ep.approved === true) groups[ep.group].approved += 1;
    else groups[ep.group].blocked += 1;
  });
  console.log('No endpoint or group was selected, so nothing will be called.');
  console.log('Groups:');
  Object.keys(groups).sort().forEach(function (name) {
    const row = groups[name];
    console.log('- ' + name + ': approved ' + row.approved + ', blocked ' + row.blocked);
  });
}

function stamp() {
  const now = new Date();
  const p = function (n) { return String(n).padStart(2, '0'); };
  return now.getFullYear()
    + p(now.getMonth() + 1)
    + p(now.getDate())
    + '-'
    + p(now.getHours())
    + p(now.getMinutes())
    + p(now.getSeconds());
}

function slugFor(list, args) {
  const raw = args.endpoint || args.group || (list[0] && list[0].id) || 'run';
  return String(raw).replace(/^\/api\//, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'run';
}


function metric(summary, name, field) {
  const metricData =
    summary &&
    summary.metrics &&
    summary.metrics[name];

  if (!metricData || metricData[field] == null) {
    return 'n/a';
  }

  const number = Number(metricData[field]);

  return Number.isFinite(number)
    ? String(Math.round(number * 1000) / 1000)
    : 'n/a';
}


function writeHumanReport(filePath, meta, summary) {
  const lines = [
    '# Load-test report',
    '',
    'This report records HTTP timing and status checks from one confirmed run.',
    'A successful HTTP status does not prove the business result is correct.',
    'This is not a pass or fail of the application.',
    '',
    '- When: ' + meta.when,
    '- Base host: ' + meta.allowedHost,
    '- Endpoints: ' + meta.paths.join(', '),
    '- VUs: ' + meta.vus,
    '- Duration: ' + meta.seconds + 's',
    '- k6 exit code: ' + meta.exitCode,
    '',
    '## Timing',
   
    '',
    '- Iterations: ' + metric(summary, 'iterations', 'count'),
    '- Failed request rate (%): ' + (
      Number(metric(summary, 'http_req_failed', 'value')) * 100
    ),
    '- Average latency (ms): ' + metric(summary, 'http_req_duration', 'avg'),
    '- p95 latency (ms): ' + metric(summary, 'http_req_duration', 'p(95)'),
    '- Max latency (ms): ' + metric(summary, 'http_req_duration', 'max'),
    '- Check pass rate (%): ' + (
      summary.metrics &&
      summary.metrics.checks &&
      (summary.metrics.checks.passes + summary.metrics.checks.fails) > 0
        ? Math.round(
            summary.metrics.checks.passes /
            (summary.metrics.checks.passes + summary.metrics.checks.fails) *
            10000
          ) / 100
        : 'n/a'
    ),
    '- Server errors counted: ' + metric(summary, 'server_errors', 'count'),
    '',
    '## How to read this',
    '',
    '- server_errors counts HTTP 5xx responses only.',
    '- http_req_failed counts network failures and HTTP 5xx responses.',
    '- Checks compare the status and, when known, a few JSON fields.',
    '- A check can pass while the database row, photo, or score is still wrong.',
    '- If the run stopped early, k6 aborted on a redirect, repeated 5xx responses, or too many unexpected statuses.',
    '',
  ];
  fs.writeFileSync(filePath, lines.join('\n'));
}

function inspectPlanError(childEnv) {
  if (!childEnv || typeof childEnv.WV_PLAN_JSON !== 'string' || childEnv.WV_PLAN_JSON.trim() === '') {
    return 'Refusing to start k6. The child environment has no WV_PLAN_JSON.';
  }
  if (!childEnv.PATH && !childEnv.Path) {
    return 'Refusing to start k6. The child environment has no PATH.';
  }
  let plan;
  try {
    plan = JSON.parse(childEnv.WV_PLAN_JSON);
  } catch (err) {
    return 'Refusing to start k6. WV_PLAN_JSON in the child environment is not valid JSON.';
  }
  if (!plan || plan.maxFailureRate !== 0.2 || plan.max5xxCount !== 5 || plan.maxUnexpectedStatus !== 10) {
    return 'Refusing to start k6. The child plan does not match the synthetic thresholds.';
  }
  return '';
}

function inspectThresholds() {
  const syntheticPlan = {
    maxFailureRate: 0.2,
    max5xxCount: 5,
    maxUnexpectedStatus: 10,
  };
  const childEnv = {
    WV_PLAN_JSON: JSON.stringify(syntheticPlan),
  };
  ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP'].forEach(function (key) {
    if (process.env[key]) childEnv[key] = process.env[key];
  });
  const preflightError = inspectPlanError(childEnv);
  if (preflightError) {
    console.error(preflightError);
    process.exit(1);
  }
  console.log('Local threshold check only. k6 inspect does not send HTTP requests.');
  console.log('Synthetic plan: maxFailureRate 0.2, max5xxCount 5, maxUnexpectedStatus 10.');
  const child = spawnSync('k6', ['inspect', '--include-system-env-vars', K6_SCRIPT], {
    env: childEnv,
    stdio: 'inherit',
  });
  if (child.error) {
    console.error('k6 could not be started. Install k6, then repeat --inspect-thresholds. ' + child.error.code);
    process.exit(1);
  }
  if (child.status !== 0) {
    console.error('k6 inspect failed. Thresholds were not accepted.');
    process.exit(child.status || 1);
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  if (args.inspectThresholds) {
    inspectThresholds();
    return;
  }

  const config = readJson(CONFIG_PATH);
  const catalog = readJson(CATALOG_PATH);
  const staging = validateStaging(config);
  const load = resolveLoad(config, args);
  const chosen = args.endpoint || args.group
    ? selectEndpoints(catalog, args)
    : [];

  console.log('Dry run sends no requests: ' + (args.dryRun || !args.confirm ? 'yes' : 'no'));
  console.log('Config enabled: ' + (config.enabled === true ? 'yes' : 'no'));
  console.log('Staging host configured: ' + (staging.ok ? staging.allowedHost : 'no'));
  if (!staging.ok) console.log('Staging problems: ' + staging.problems.join('; '));

  if (!args.endpoint && !args.group) {
    printGroups(catalog);
    console.log('Choose one endpoint or one group. The full catalog is not run by default.');
    return;
  }

  if (!chosen.length) {
    fail('No catalog entry matched that endpoint or group.');
  }

  console.log('Selected:');
  const runnable = [];
  chosen.forEach(function (ep) {
    const ready = readiness(ep, config);
    printEndpoint(ep, ready);
    if (ready.ok) {
      runnable.push({
        path: ep.path,
        method: 'GET',
        query: ready.query,
        expect: ep.expect || { status: 200 },
      });
    }
  });

  if (args.dryRun || !args.confirm) {
    console.log('No HTTP request was sent.');
    if (!args.dryRun && !args.confirm) {
      console.log('Add --confirm before any live run. A live run also needs config.enabled true.');
    }
    return;
  }

  if (config.enabled !== true) fail('Live runs are disabled. Set config.enabled to true after you review the staging host.');
  if (!staging.ok) fail('Live run refused: ' + staging.problems.join('; '));
  if (!runnable.length) fail('None of the selected endpoints are approved and fully configured.');
  if (runnable.length !== chosen.length) {
    fail('The selection includes blocked endpoints. Choose only an approved endpoint or the public-read group.');
  }

  const maxFailureRate = Number(config.maxFailureRate);
  if (!Number.isFinite(maxFailureRate) || maxFailureRate < 0 || maxFailureRate > 1) {
    fail('config.maxFailureRate must be a number from 0 through 1. The live run was not started.');
  }
  const max5xxCount = requirePositiveInteger(config.max5xxCount, 'max5xxCount');
  const maxUnexpectedStatus = requirePositiveInteger(config.maxUnexpectedStatus, 'maxUnexpectedStatus');

  const plan = {
    baseUrl: staging.baseUrl,
    allowedHost: staging.allowedHost,
    maxFailureRate: maxFailureRate,
    max5xxCount: max5xxCount,
    maxUnexpectedStatus: maxUnexpectedStatus,
    issuedBy: 'loadtest-runner',
    endpoints: runnable,
  };

  const fileSlug = slugFor(chosen, args);
  const baseName = stamp() + '-' + fileSlug;
  const summaryPath = path.join(RESULTS_DIR, baseName + '.summary.json');
  const reportPath = path.join(RESULTS_DIR, baseName + '.md');
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  console.log('Starting k6. Paths only; query values are not printed.');
  runnable.forEach(function (ep) { console.log('- GET ' + ep.path); });

  const childEnv = {
    WV_PLAN_JSON: JSON.stringify(plan),
    WV_VUS: String(load.vus),
    WV_DURATION: load.seconds + 's',
  };
  ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP'].forEach(function (key) {
    if (process.env[key]) childEnv[key] = process.env[key];
  });

  const child = spawnSync('k6', [
    'run',
    '--summary-export',
    summaryPath,
    K6_SCRIPT,
  ], {
    env: childEnv,
    stdio: 'inherit',
  });

  if (child.error) {
    fail('k6 could not be started. Install k6, then repeat the dry-run before using --confirm. ' + child.error.code);
  }

  let summary = {};
  if (fs.existsSync(summaryPath)) {
    try {
      summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    } catch (err) {
      summary = {};
    }
  }
  writeHumanReport(reportPath, {
    when: new Date().toISOString(),
    allowedHost: staging.allowedHost,
    paths: runnable.map(function (ep) { return ep.path; }),
    vus: load.vus,
    seconds: load.seconds,
    exitCode: child.status == null ? 'unknown' : child.status,
  }, summary);

  console.log('Summary: ' + summaryPath);
  console.log('Report: ' + reportPath);
  if (child.status !== 0) {
    console.error('The run failed. k6 crossed a safety threshold or exited with an error. The failed-request rate must stay at or below config.maxFailureRate.');
    process.exit(child.status || 1);
  }
}

main();
