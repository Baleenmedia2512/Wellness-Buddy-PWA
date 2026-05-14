/**
 * shared/utils/fetchWithAbort.js
 * ---------------------------------------------------------------------------
 * Tiny abort-discipline helper for in-flight fetches that may outlive
 * their effect / component.
 *
 * Why this exists:
 *   App.js issues 22 fetches across hooks/effects, several of which can
 *   resolve after the user has signed out or navigated away. Without an
 *   AbortController, the .then() callback writes into stale state setters
 *   (causing React warnings, occasional UI flicker, or — after future
 *   refactors that move these into unmountable hooks — real bugs).
 *
 * Hygiene-phase usage:
 *   - Call `createAbortGroup()` inside an effect.
 *   - Pass `group.signal` to fetch as `{ signal: group.signal }`.
 *   - Return `group.cancel` from the effect cleanup.
 *   - In .catch, ignore AbortError specifically.
 *
 * Example:
 *   useEffect(() => {
 *     const group = createAbortGroup();
 *     fetch(url, { signal: group.signal })
 *       .then(...)
 *       .catch((err) => { if (!isAbortError(err)) console.warn(err); });
 *     return group.cancel;
 *   }, [url]);
 *
 * Notes:
 *   - This intentionally does NOT wrap fetch itself. We want the caller
 *     to remain in control of fetch semantics (headers, body, etc.) —
 *     this just standardizes the cancellation pattern.
 *   - Native iOS WebView supports AbortController since iOS 11.3.
 * ---------------------------------------------------------------------------
 */

export const createAbortGroup = () => {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    cancel: () => {
      try {
        controller.abort();
      } catch {
        /* already aborted — ignore */
      }
    },
  };
};

export const isAbortError = (err) =>
  !!err && (err.name === "AbortError" || err.code === 20);
