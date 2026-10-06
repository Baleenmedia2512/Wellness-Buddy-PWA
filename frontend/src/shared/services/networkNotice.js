/**
 * Tells the UI when the app is offline, a request is slow, or a call fails
 * because of the network. Feature screens can also reuse the same wording.
 */

export const NETWORK_OFFLINE_MESSAGE =
  'No internet connection. Check your network and try again.';

/** Shown only after the link itself measures slow — not when an API call is slow. */
export const NETWORK_SLOW_MESSAGE =
  'Your connection looks slow.';

/** API call is still running and the link measured fine. */
export const NETWORK_WAITING_MESSAGE =
  'Taking longer than usual.';

export const NETWORK_FAILURE_MESSAGE =
  'Can\'t connect right now. Check your connection and try again.';

export const NETWORK_SERVER_MESSAGE =
  'Something went wrong on our side. Please try again.';

const SLOW_AFTER_MS = 8000;
const FAILURE_VISIBLE_MS = 6000;
const QUALITY_TTL_MS = 30_000;
/** Round-trip above this on the tiny server-time check counts as a slow link. */
const LINK_SLOW_MS = 1500;
const PROBE_TIMEOUT_MS = 4000;

export function isNetworkNoticeMessage(text) {
  const value = String(text || '');
  return value === NETWORK_OFFLINE_MESSAGE
    || value === NETWORK_SLOW_MESSAGE
    || value === NETWORK_WAITING_MESSAGE
    || value === NETWORK_FAILURE_MESSAGE
    || value === NETWORK_SERVER_MESSAGE;
}

/**
 * Browser Network Information API → whether the radio itself looks slow.
 * Missing data stays unknown so a slow API is not blamed on the network.
 * @param {{ effectiveType?: string, rtt?: number, downlink?: number }|null|undefined} conn
 * @returns {'slow'|'ok'|'unknown'}
 */
export function connectionQualityFromRadio(conn) {
  if (!conn || typeof conn !== 'object') return 'unknown';
  const type = String(conn.effectiveType || '').toLowerCase();
  if (type === 'slow-2g' || type === '2g') return 'slow';
  const rtt = Number(conn.rtt);
  if (Number.isFinite(rtt) && rtt >= LINK_SLOW_MS) return 'slow';
  const down = Number(conn.downlink);
  if (Number.isFinite(down) && down > 0 && down < 0.35) return 'slow';
  if (type === '3g' || type === '4g' || type === '5g') return 'ok';
  if (Number.isFinite(rtt) && rtt > 0 && rtt < LINK_SLOW_MS) return 'ok';
  return 'unknown';
}

/**
 * Result of the small server-time probe.
 * A 5xx still means the link reached the server.
 * @param {{ elapsedMs?: number, status?: number }} sample
 * @returns {'slow'|'ok'|'unknown'}
 */
export function connectionQualityFromProbe(sample) {
  const code = Number(sample?.status) || 0;
  if (code >= 500) return 'ok';
  if (code === 0) return 'slow';
  if (code >= 200 && code < 500) {
    return Number(sample?.elapsedMs) >= LINK_SLOW_MS ? 'slow' : 'ok';
  }
  return 'unknown';
}

export function isServerErrorStatus(status) {
  const code = Number(status) || 0;
  return code >= 500 && code <= 599;
}

/**
 * True for transport failures (offline, DNS, timeout, status 0).
 * Aborts from leaving a screen are not treated as a network failure.
 * @param {unknown} err
 * @returns {boolean}
 */
export function isLikelyNetworkError(err) {
  if (!err) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const name = String(err.name || '');
  if (name === 'AbortError') return false;
  const msg = String(err.message || err || '').toLowerCase();
  return msg.includes('failed to fetch')
    || msg.includes('network error')
    || msg.includes('network request failed')
    || msg.includes('internet connection')
    || msg.includes('timeout')
    || msg.includes('failed (0)')
    || msg.includes('load failed')
    || msg.includes('err_internet')
    || msg.includes('econn');
}

/**
 * User-facing sentence when `err` is a network problem, otherwise ''.
 * @param {unknown} err
 * @returns {string}
 */
export function userFacingNetworkMessage(err) {
  return isLikelyNetworkError(err) ? NETWORK_FAILURE_MESSAGE : '';
}

/**
 * @param {{ slowAfterMs?: number, failureVisibleMs?: number, setTimer?: Function, clearTimer?: Function }} [opts]
 */
export function createNetworkTracker({
  slowAfterMs = SLOW_AFTER_MS,
  failureVisibleMs = FAILURE_VISIBLE_MS,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
} = {}) {
  let inflight = 0;
  let notice = null;
  let slowTimer = null;
  let failureTimer = null;
  let slowDeadlineReached = false;
  /** @type {'slow'|'ok'|'unknown'} */
  let connectionQuality = 'unknown';
  let qualityAt = 0;
  /** @type {null|(() => Promise<'slow'|'ok'|'unknown'>)} */
  let probeConnection = null;
  const listeners = new Set();

  function publish(next) {
    notice = next;
    listeners.forEach((fn) => {
      try {
        fn(notice);
      } catch (listenerErr) {
        console.warn('[network-notice] listener failed', listenerErr?.message || listenerErr);
      }
    });
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function qualityIsFresh() {
    return connectionQuality !== 'unknown' && (Date.now() - qualityAt) < QUALITY_TTL_MS;
  }

  function applySlowNotice() {
    if (!slowDeadlineReached || inflight === 0) return;
    if (notice?.type === 'failure' || notice?.type === 'server') return;
    if (connectionQuality === 'slow') {
      publish({ type: 'degraded', message: NETWORK_SLOW_MESSAGE });
      return;
    }
    if (connectionQuality === 'ok') {
      publish({ type: 'waiting', message: NETWORK_WAITING_MESSAGE });
    }
  }

  function setConnectionQuality(quality) {
    if (quality !== 'ok' && quality !== 'slow') return;
    connectionQuality = quality;
    qualityAt = Date.now();
    applySlowNotice();
  }

  function setProbe(fn) {
    probeConnection = typeof fn === 'function' ? fn : null;
  }

  function onSlowDeadline() {
    slowTimer = null;
    if (inflight === 0 || notice?.type === 'failure' || notice?.type === 'server') return;
    slowDeadlineReached = true;
    if (!qualityIsFresh() && probeConnection) {
      Promise.resolve()
        .then(() => probeConnection())
        .then((quality) => {
          if (quality === 'ok' || quality === 'slow') setConnectionQuality(quality);
        })
        .catch(() => {
          /* leave unknown — do not blame the network */
        });
      return;
    }
    applySlowNotice();
  }

  function trackApiRequest() {
    inflight += 1;
    if (inflight === 1) {
      slowDeadlineReached = false;
    }
    if (slowTimer == null && !slowDeadlineReached) {
      slowTimer = setTimer(onSlowDeadline, slowAfterMs);
    }
    let settled = false;
    return () => {
      if (settled) return;
      settled = true;
      inflight = Math.max(0, inflight - 1);
      if (inflight > 0) return;
      if (slowTimer != null) {
        clearTimer(slowTimer);
        slowTimer = null;
      }
      slowDeadlineReached = false;
      if (notice?.type === 'degraded' || notice?.type === 'waiting') publish(null);
    };
  }

  function holdFailure(type, message) {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    publish({ type, message });
    if (failureTimer != null) clearTimer(failureTimer);
    failureTimer = setTimer(() => {
      failureTimer = null;
      if (notice?.type === type) publish(null);
    }, failureVisibleMs);
  }

  function reportNetworkFailure() {
    holdFailure('failure', NETWORK_FAILURE_MESSAGE);
  }

  function reportServerFailure() {
    holdFailure('server', NETWORK_SERVER_MESSAGE);
  }

  function dismissFailure() {
    if (failureTimer != null) {
      clearTimer(failureTimer);
      failureTimer = null;
    }
    if (notice?.type === 'failure' || notice?.type === 'server') publish(null);
  }

  return {
    subscribe,
    trackApiRequest,
    reportNetworkFailure,
    reportServerFailure,
    dismissFailure,
    setConnectionQuality,
    setProbe,
    getNotice: () => notice,
  };
}

const sharedTracker = createNetworkTracker();

export function subscribeNetworkNotice(listener) {
  return sharedTracker.subscribe(listener);
}

export function trackApiRequest() {
  return sharedTracker.trackApiRequest();
}

export function reportNetworkFailure() {
  sharedTracker.reportNetworkFailure();
}

export function reportServerFailure() {
  sharedTracker.reportServerFailure();
}

export function dismissNetworkFailure() {
  sharedTracker.dismissFailure();
}

function requestUrl(input) {
  if (typeof input === 'string') return input;
  if (input && typeof input.url === 'string') return input.url;
  return '';
}

let monitoringInstalled = false;

/**
 * Watch API fetch and Capacitor HTTP so slow or failed calls notify the UI.
 * Safe to call more than once.
 *
 * @param {{ isApiRequest?: (url: string) => boolean, http?: object, probeUrl?: string }} [opts]
 */
export function installNetworkMonitoring({
  isApiRequest = () => false,
  http = null,
  probeUrl = '',
} = {}) {
  if (monitoringInstalled || typeof window === 'undefined') return;
  monitoringInstalled = true;

  const originalFetch = window.fetch.bind(window);
  const originalHttp = {};
  if (http) {
    ['get', 'post', 'put', 'patch', 'delete'].forEach((method) => {
      if (typeof http[method] === 'function') originalHttp[method] = http[method].bind(http);
    });
  }

  sharedTracker.setProbe(() => probeLinkQuality(originalFetch, originalHttp.get, probeUrl));

  const radio = typeof navigator !== 'undefined'
    ? (navigator.connection || navigator.mozConnection || navigator.webkitConnection)
    : null;
  if (radio) {
    const applyRadio = () => {
      const quality = connectionQualityFromRadio(radio);
      if (quality === 'ok' || quality === 'slow') sharedTracker.setConnectionQuality(quality);
    };
    applyRadio();
    if (typeof radio.addEventListener === 'function') {
      radio.addEventListener('change', applyRadio);
    }
  }

  window.fetch = async function networkAwareFetch(input, init) {
    const tracked = isApiRequest(requestUrl(input)) === true;
    const done = tracked ? trackApiRequest() : () => {};
    try {
      const response = await originalFetch(input, init);
      if (tracked && isServerErrorStatus(response?.status)) reportServerFailure();
      return response;
    } catch (err) {
      if (tracked && isLikelyNetworkError(err)) reportNetworkFailure();
      throw err;
    } finally {
      done();
    }
  };

  if (!http) return;
  ['get', 'post', 'put', 'patch', 'delete'].forEach((method) => {
    const original = originalHttp[method];
    if (typeof original !== 'function') return;
    http[method] = async function networkAwareHttp(options, ...rest) {
      const done = trackApiRequest();
      try {
        const response = await original.call(http, options, ...rest);
        const status = Number(response?.status) || 0;
        if (status === 0) reportNetworkFailure();
        else if (isServerErrorStatus(status)) reportServerFailure();
        return response;
      } catch (err) {
        if (isLikelyNetworkError(err)) reportNetworkFailure();
        throw err;
      } finally {
        done();
      }
    };
  });
}

function probeLinkQuality(originalFetch, originalGet, probeUrl) {
  const url = String(probeUrl || '');
  if (!url) return Promise.resolve('unknown');
  const started = Date.now();
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('timeout')), PROBE_TIMEOUT_MS);
  });
  const request = typeof originalGet === 'function'
    ? originalGet({ url, headers: { 'Cache-Control': 'no-store' } })
    : originalFetch(url, { cache: 'no-store' });
  return Promise.race([request, timeout])
    .then((response) => connectionQualityFromProbe({
      elapsedMs: Date.now() - started,
      status: response?.status,
    }))
    .catch(() => connectionQualityFromProbe({ elapsedMs: Date.now() - started, status: 0 }));
}
