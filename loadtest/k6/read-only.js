import http from 'k6/http';
import exec from 'k6/execution';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

function refusePlan(message) {
  throw new Error(message + ' No requests were sent.');
}

function loadPlan() {
  const raw = __ENV.WV_PLAN_JSON;
  if (raw == null || String(raw).trim() === '') {
    refusePlan('WV_PLAN_JSON is missing. Refusing to build k6 thresholds.');
  }
  let plan;
  try {
    plan = JSON.parse(raw);
  } catch (err) {
    refusePlan('WV_PLAN_JSON is not valid JSON. Refusing to build k6 thresholds.');
  }
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    refusePlan('WV_PLAN_JSON must be a JSON object. Refusing to build k6 thresholds.');
  }
  const maxFailureRate = Number(plan.maxFailureRate);
  if (!Number.isFinite(maxFailureRate) || maxFailureRate < 0 || maxFailureRate > 1) {
    refusePlan('maxFailureRate must be a number from 0 through 1. Refusing to build k6 thresholds.');
  }
  if (!Number.isInteger(plan.max5xxCount) || plan.max5xxCount < 1) {
    refusePlan('max5xxCount must be a positive integer. Refusing to build k6 thresholds.');
  }
  if (!Number.isInteger(plan.maxUnexpectedStatus) || plan.maxUnexpectedStatus < 1) {
    refusePlan('maxUnexpectedStatus must be a positive integer. Refusing to build k6 thresholds.');
  }
  plan.maxFailureRate = maxFailureRate;
  return plan;
}

const plan = loadPlan();
const serverErrors = new Counter('server_errors');

export const options = {
  vus: Number(__ENV.WV_VUS || 1),
  duration: __ENV.WV_DURATION || '30s',
  thresholds: {
    http_req_failed: [
      { threshold: 'rate<=' + String(plan.maxFailureRate), abortOnFail: true },
    ],
    server_errors: [
      { threshold: 'count<' + String(plan.max5xxCount), abortOnFail: true },
    ],
  },
};

function hostOf(url) {
  const match = String(url || '').match(/^https:\/\/([^/?#]+)/i);
  return match ? match[1].toLowerCase() : '';
}

let unexpected = 0;
let consecutive5xx = 0;

export default function () {
  const maxFailureRate = Number(plan.maxFailureRate);
  if (!Number.isFinite(maxFailureRate) || maxFailureRate < 0 || maxFailureRate > 1) {
    exec.test.abort('maxFailureRate is missing or invalid');
  }
  if (!Number.isInteger(plan.max5xxCount) || plan.max5xxCount < 1) {
    exec.test.abort('max5xxCount is missing or invalid');
  }
  if (!Number.isInteger(plan.maxUnexpectedStatus) || plan.maxUnexpectedStatus < 1) {
    exec.test.abort('maxUnexpectedStatus is missing or invalid');
  }

  if (plan.issuedBy !== 'loadtest-runner') {
    exec.test.abort('plan was not issued by loadtest/runner.js. Direct k6 execution cannot send requests.');
  }

  const list = plan.endpoints || [];
  if (!list.length) {
    exec.test.abort('no endpoints in plan');
  }

  const ep = list[__ITER % list.length];
  const query = ep.query || {};
  const params = Object.keys(query).map(function (key) {
    return encodeURIComponent(key) + '=' + encodeURIComponent(query[key]);
  });
  const url = plan.baseUrl + ep.path + (params.length ? '?' + params.join('&') : '');
  const allowedHost = String(plan.allowedHost || '').toLowerCase();

  if (hostOf(url) !== allowedHost) {
    exec.test.abort('request host is not the configured staging host');
  }

  const res = http.get(url, {
    redirects: 0,
    timeout: '10s',
    tags: { name: ep.path },
  });

  const seenHost = hostOf(res.url || url);
  if (seenHost && seenHost !== allowedHost) {
    exec.test.abort('response host is not the configured staging host');
  }

  if (res.status >= 300 && res.status < 400) {
    exec.test.abort('unexpected redirect on ' + ep.path);
  }

  if (res.status >= 500 && res.status <= 599) {
    serverErrors.add(1);
    consecutive5xx += 1;
    if (consecutive5xx >= plan.max5xxCount) {
      exec.test.abort('repeated server errors on ' + ep.path);
    }
  } else {
    consecutive5xx = 0;
  }

  const expect = ep.expect || { status: 200 };
  const statusOk = check(res, {
    'status matches': function (r) { return r.status === expect.status; },
  });

  let body = null;
  if (expect.jsonHas || expect.jsonEquals) {
    try {
      body = res.json();
    } catch (err) {
      body = null;
    }
  }

  if (expect.jsonHas) {
    check(body, {
      'required fields present': function (parsed) {
        return !!parsed && expect.jsonHas.every(function (key) {
          return Object.prototype.hasOwnProperty.call(parsed, key);
        });
      },
    });
  }

  if (expect.jsonEquals) {
    check(body, {
      'expected fields match': function (parsed) {
        return !!parsed && Object.keys(expect.jsonEquals).every(function (key) {
          return parsed[key] === expect.jsonEquals[key];
        });
      },
    });
  }

  if (!statusOk) {
    unexpected += 1;
    if (unexpected >= plan.maxUnexpectedStatus) {
      exec.test.abort('too many unexpected statuses on ' + ep.path);
    }
  }

  sleep(1);
}
