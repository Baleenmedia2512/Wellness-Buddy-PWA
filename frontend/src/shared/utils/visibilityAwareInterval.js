/**
 * setInterval that pauses while the document is hidden (tab backgrounded /
 * app minimized). Fires immediately when the tab becomes visible again only
 * if `runOnVisible` is true and the interval would have elapsed.
 *
 * @param {() => void} callback
 * @param {number} ms
 * @param {{ runOnVisible?: boolean }} [options]
 * @returns {() => void} cleanup
 */
export function setVisibilityAwareInterval(callback, ms, { runOnVisible = true } = {}) {
  let intervalId = null;
  let lastRun = Date.now();

  const tick = () => {
    lastRun = Date.now();
    callback();
  };

  const start = () => {
    if (intervalId != null) return;
    intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      tick();
    }, ms);
  };

  const stop = () => {
    if (intervalId == null) return;
    clearInterval(intervalId);
    intervalId = null;
  };

  const onVisibility = () => {
    if (typeof document === 'undefined') return;
    if (document.hidden) {
      stop();
      return;
    }
    start();
    if (runOnVisible && Date.now() - lastRun >= ms) {
      tick();
    }
  };

  if (typeof document === 'undefined' || !document.hidden) {
    start();
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibility);
  }

  return () => {
    stop();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibility);
    }
  };
}
