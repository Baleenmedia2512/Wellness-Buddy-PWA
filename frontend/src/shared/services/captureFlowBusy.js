/**
 * captureFlowBusy — pause non-critical Home / visibility refetches while
 * Gallery/Camera → Manual Log → POST /captures is in flight.
 *
 * Browser connection limits (~6/host) mean a visibilitychange storm after the
 * picker closes can starve the capture upload and leave "Saving photo…" hanging.
 */

let busy = false;

export function setCaptureFlowBusy(next) {
  busy = Boolean(next);
}

export function isCaptureFlowBusy() {
  return busy;
}
