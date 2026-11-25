/**
 * MilesWeb staging load script.
 *
 * The API is one long-running Node process behind LiteSpeed, with a Prisma
 * pool of at most 8 MySQL connections per process. Virtual users are open
 * HTTP requests, not database connections.
 *
 * This file does not call production. The only accepted host is
 * test.wellnessvalley.in. A normal run is a 5-user smoke test.
 * The direct 1,500-user run starts all virtual users together. It stays
 * locked until both of these are set:
 *   WV_PROFILE=direct
 *   WV_CONFIRM=staging
 *
 * Smoke, no database:
 *   $env:BASE_URL="https://test.wellnessvalley.in"
 *   k6 run loadtest/k6/milesweb-staging.js
 *
 * Direct 1,500, still no database. --summary-export saves timings and failure counts:
 *   $env:BASE_URL="https://test.wellnessvalley.in"
 *   $env:WV_PROFILE="direct"
 *   $env:WV_CONFIRM="staging"
 *   k6 run --summary-export loadtest/k6/last-summary.json loadtest/k6/milesweb-staging.js
 */
import http from 'k6/http';
import exec from 'k6/execution';
import { check } from 'k6';
import { Counter } from 'k6/metrics';

const STAGING_HOST = 'test.wellnessvalley.in';

const BLOCKED_HOSTS = new Set([
  'wellnessvalley.in',
  'www.wellnessvalley.in',
  'wellness-valley.vercel.app',
  'wellness-buddy-pwa.vercel.app',
  'wellness-valley-pwa-backend-test.vercel.app',
  'app.wellnessvalley.app',
  'www.wellnessvalley.app',
  'wellnessvalley.app',
]);

const TARGETS = {
  clock: {
    path: '/api/misc/server-time',
    accept: function (body) {
      return !!body && typeof body.ts === 'number' && body.timezone === 'Asia/Kolkata';
    },
  },
  windows: {
    path: '/api/misc/time-windows',
    accept: function (body) {
      return !!body && body.success === true && !!body.windows;
    },
  },
};

const DIRECT_VUS = 1500;
const DIRECT_DURATION = '30s';

const SMOKE_STAGES = [
  { duration: '15s', target: 5 },
  { duration: '15s', target: 5 },
  { duration: '10s', target: 0 },
];

function failInit(message) {
  throw new Error(message + ' No requests were sent.');
}

function hostnameOf(raw) {
  const match = String(raw || '').match(/^https:\/\/([^/?#:]+)/i);
  return match ? match[1].toLowerCase() : '';
}

// One count per failed request. Nothing is printed per request.
// k6's built-in timing metrics are unchanged. --summary-export includes both.
const diagFailedStatus = new Counter('diag_failed_status');
const diagFailedError = new Counter('diag_failed_error');

const ERROR_REASONS = {
  1000: 'generic',
  1010: 'non_tcp',
  1020: 'invalid_url',
  1050: 'request_timeout',
  1100: 'dns',
  1101: 'dns_no_such_host',
  1110: 'blacklisted_ip',
  1111: 'blocked_hostname',
  1200: 'tcp',
  1201: 'broken_pipe',
  1202: 'unknown_errno',
  1210: 'dial',
  1211: 'dial_timeout',
  1212: 'connection_refused',
  1213: 'dial_unknown',
  1220: 'connection_reset',
  1300: 'tls',
  1301: 'tls_header',
  1310: 'tls_unknown_authority',
  1311: 'tls_hostname',
  1701: 'decompress',
};

function reasonFromText(message) {
  const raw = String(message || '').toLowerCase();
  if (!raw) return '';
  if (raw.indexOf('request timeout') !== -1) return 'request_timeout';
  if (raw.indexOf('i/o timeout') !== -1 || raw.indexOf('timeout') !== -1) return 'timeout';
  if (raw.indexOf('connection refused') !== -1) return 'connection_refused';
  if (raw.indexOf('connection reset') !== -1) return 'connection_reset';
  if (raw.indexOf('broken pipe') !== -1) return 'broken_pipe';
  if (raw.indexOf('no such host') !== -1) return 'dns_no_such_host';
  if (raw.indexOf('tls') !== -1 || raw.indexOf('x509') !== -1 || raw.indexOf('handshake') !== -1) return 'tls';
  if (raw.indexOf('dial') !== -1) return 'dial';
  return '';
}

function errorReason(res) {
  const code = res && res.error_code ? Number(res.error_code) : 0;
  const status = res && res.status ? Number(res.status) : 0;
  if (ERROR_REASONS[code]) return ERROR_REASONS[code];
  if (code >= 1610 && code < 1630) return 'http2_goaway';
  if (code >= 1630 && code < 1650) return 'http2_stream';
  if (code >= 1650 && code < 1670) return 'http2_connection';
  const fromText = reasonFromText(res && res.error);
  if (fromText) return fromText;
  if (code) return 'other';
  if (status >= 400) return 'http_' + status;
  return 'no_response';
}

function recordFailure(res) {
  const status = res && res.status ? Number(res.status) : 0;
  const code = res && res.error_code ? Number(res.error_code) : 0;
  const failed = status === 0 || status >= 400 || !!(res && res.error);
  if (!failed) return;
  diagFailedStatus.add(1, { status: String(status) });
  diagFailedError.add(1, {
    error_code: String(code),
    reason: errorReason(res),
  });
}

const profileName = String(__ENV.WV_PROFILE || 'smoke').trim().toLowerCase();
const targetName = String(__ENV.WV_TARGET || 'clock').trim().toLowerCase();
const baseUrl = String(__ENV.BASE_URL || '').trim().replace(/\/+$/, '');
const host = hostnameOf(baseUrl);
const target = TARGETS[targetName];

if (!baseUrl) {
  failInit('Set BASE_URL to https://test.wellnessvalley.in');
}
if (!host || baseUrl.slice(0, 8).toLowerCase() !== 'https://') {
  failInit('BASE_URL must be an https URL with no path.');
}
if (BLOCKED_HOSTS.has(host) || host === 'wellnessvalley.in') {
  failInit('Refusing production or retired Vercel host: ' + host);
}
if (host !== STAGING_HOST) {
  failInit('Only ' + STAGING_HOST + ' is accepted. Got ' + host);
}
if (baseUrl !== 'https://' + STAGING_HOST) {
  failInit('BASE_URL must be exactly https://test.wellnessvalley.in with no path.');
}
if (!target) {
  failInit('WV_TARGET must be clock or windows.');
}
if (profileName === 'capacity') {
  failInit('The stepped ramp has been removed. Set WV_PROFILE=direct to start 1,500 virtual users together.');
}
if (profileName !== 'smoke' && profileName !== 'direct') {
  failInit('WV_PROFILE must be smoke or direct.');
}
if (profileName === 'direct' && String(__ENV.WV_CONFIRM || '') !== 'staging') {
  failInit('The 1,500-user run is locked. Set WV_CONFIRM=staging to run it against test.wellnessvalley.in.');
}

const scenario = profileName === 'direct'
  ? {
      executor: 'constant-vus',
      vus: DIRECT_VUS,
      duration: DIRECT_DURATION,
      gracefulStop: '15s',
    }
  : {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: SMOKE_STAGES,
      gracefulRampDown: '15s',
    };

const requestUrl = baseUrl + target.path;

export const options = {
  scenarios: {
    milesweb: scenario,
  },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '10s' }],
    checks: [{ threshold: 'rate>0.95', abortOnFail: true, delayAbortEval: '10s' }],
  },
};

export function setup() {
  const probe = http.get(requestUrl, {
    redirects: 0,
    timeout: '10s',
    tags: { endpoint: target.path },
  });
  recordFailure(probe);
  if (hostnameOf(probe.url || requestUrl) !== STAGING_HOST) {
    exec.test.abort('Probe left the staging host. Stopping.');
  }
  if (probe.status !== 200) {
    exec.test.abort('Staging probe returned HTTP ' + probe.status + '. Stopping before virtual users start.');
  }
}

export default function () {
  const res = http.get(requestUrl, {
    redirects: 0,
    timeout: '15s',
    tags: { endpoint: target.path, profile: profileName },
    headers: { Accept: 'application/json' },
  });
  recordFailure(res);

  if (hostnameOf(res.url || requestUrl) !== STAGING_HOST) {
    exec.test.abort('A response left the staging host. Stopping.');
  }
  if (res.status >= 300 && res.status < 400) {
    exec.test.abort('Unexpected redirect. Stopping.');
  }

  let body = null;
  try {
    body = res.json();
  } catch (err) {
    body = null;
  }

  check(res, {
    'HTTP 200': function (r) { return r.status === 200; },
  });
  check(body, {
    'JSON shape matches': function (parsed) { return target.accept(parsed); },
  });
}
