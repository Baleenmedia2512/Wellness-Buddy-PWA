/**
 * captureFlowBusy — pause non-critical Home / visibility refetches while
 * Gallery/Camera → Manual Log → POST /captures is in flight.
 *
 * Browser connection limits (~6/host) mean a visibilitychange storm after the
 * picker closes can starve the capture upload and leave "Saving photo…" hanging.
 *
 * Subscribers are notified when busy flips so deferred Home refreshes can retry
 * once the capture upload connection budget is free again.
 */

let busy = false;
const listeners = new Set();

export function setCaptureFlowBusy(next) {
  const nextBusy = Boolean(next);
  if (nextBusy === busy) return;
  busy = nextBusy;
  listeners.forEach((listener) => {
    try {
      listener(busy);
    } catch {
      /* subscriber errors must not break capture flow */
    }
  });
}

export function isCaptureFlowBusy() {
  return busy;
}

/**
 * @param {(busy: boolean) => void} listener
 * @returns {() => void} unsubscribe
 */
export function subscribeCaptureFlowBusy(listener) {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** @internal test helper */
export function __resetCaptureFlowBusyForTests() {
  busy = false;
  listeners.clear();
}
