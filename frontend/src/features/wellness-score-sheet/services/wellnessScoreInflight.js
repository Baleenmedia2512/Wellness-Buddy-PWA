/**
 * In-flight request sharing for wellness score HTTP.
 * Callers pass the activity watermark so a food-save starts a new fetch
 * instead of joining a pre-save request.
 */

/** @type {Map<string, Promise<unknown>>} */
const inFlight = new Map();

export function wellnessScoreInflightKey(kind, parts, activityLogId) {
  return `${kind}|${parts.join('|')}|${activityLogId}`;
}

export function dedupeWellnessScoreInflight(key, run) {
  const pending = inFlight.get(key);
  if (pending) return pending;
  const promise = run().finally(() => {
    if (inFlight.get(key) === promise) inFlight.delete(key);
  });
  inFlight.set(key, promise);
  return promise;
}

/** @internal */
export function __resetWellnessScoreApiInFlightForTests() {
  inFlight.clear();
}
