/**
 * Tells the UI when the app is offline, a request is slow, or a call fails
 * because of the network. Feature screens can also reuse the same wording.
 */

export const NETWORK_OFFLINE_MESSAGE =
  'No internet connection. Check your network and try again.';

export const NETWORK_SLOW_MESSAGE =
  'Your connection is slow. Please wait.';

export const NETWORK_FAILURE_MESSAGE =
  'Couldn\'t reach the server. Check your network and try again.';

const SLOW_AFTER_MS = 8000;
const FAILURE_VISIBLE_MS = 6000;

export function isNetworkNoticeMessage(text) {
  const value = String(text || '');
  return value === NETWORK_OFFLINE_MESSAGE
    || value === NETWORK_SLOW_MESSAGE
    || value === NETWORK_FAILURE_MESSAGE;
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

  function trackApiRequest() {
    inflight += 1;
    if (slowTimer == null) {
      slowTimer = setTimer(() => {
        slowTimer = null;
        if (inflight > 0 && notice?.type !== 'failure') {
          publish({ type: 'slow', message: NETWORK_SLOW_MESSAGE });
        }
      }, slowAfterMs);
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
      if (notice?.type === 'slow') publish(null);
    };
  }

  function reportNetworkFailure() {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
    publish({ type: 'failure', message: NETWORK_FAILURE_MESSAGE });
    if (failureTimer != null) clearTimer(failureTimer);
    failureTimer = setTimer(() => {
      failureTimer = null;
      if (notice?.type === 'failure') publish(null);
    }, failureVisibleMs);
  }

  function dismissFailure() {
    if (failureTimer != null) {
      clearTimer(failureTimer);
      failureTimer = null;
    }
    if (notice?.type === 'failure') publish(null);
  }

  return {
    subscribe,
    trackApiRequest,
    reportNetworkFailure,
    dismissFailure,
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
 * @param {{ isApiRequest?: (url: string) => boolean, http?: object }} [opts]
 */
export function installNetworkMonitoring({ isApiRequest = () => false, http = null } = {}) {
  if (monitoringInstalled || typeof window === 'undefined') return;
  monitoringInstalled = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async function networkAwareFetch(input, init) {
    const tracked = isApiRequest(requestUrl(input)) === true;
    const done = tracked ? trackApiRequest() : () => {};
    try {
      return await originalFetch(input, init);
    } catch (err) {
      if (tracked && isLikelyNetworkError(err)) reportNetworkFailure();
      throw err;
    } finally {
      done();
    }
  };

  if (!http) return;
  ['get', 'post', 'put', 'patch', 'delete'].forEach((method) => {
    const original = http[method];
    if (typeof original !== 'function') return;
    http[method] = async function networkAwareHttp(options, ...rest) {
      const done = trackApiRequest();
      try {
        const response = await original.call(http, options, ...rest);
        const status = Number(response?.status) || 0;
        if (status === 0) reportNetworkFailure();
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
