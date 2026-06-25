/**
 * shared/services/auth/fsm/actors/firebaseActor.js
 * Phase 3d-a: declared, not invoked. See userStatusActor.js header.
 *
 * Wraps `onAuthStateChange` + `handleRedirectResult` from the existing
 * Firebase service. Emits AUTH_CHANGED / REDIRECT_RESULT_RESOLVED only.
 */

import {
  onAuthStateChange,
  handleRedirectResult,
} from "../../../firebase";
import { E } from "../events";

/**
 * Long-lived actor. Returns a disposer.
 *
 * @param {object} _input (currently unused)
 * @param {(event: object) => void} send
 * @returns {() => void}
 */
export function firebaseActor(_input, send) {
  const unsubscribe = onAuthStateChange((user) => {
    send({ type: E.AUTH_CHANGED, user });
  });

  // Redirect result is a one-shot promise.
  handleRedirectResult()
    .then((user) => send({ type: E.REDIRECT_RESULT_RESOLVED, user }))
    .catch((error) =>
      send({ type: E.REDIRECT_RESULT_RESOLVED, user: null, error }),
    );

  return () => {
    try {
      if (typeof unsubscribe === "function") unsubscribe();
    } catch {
      /* noop */
    }
  };
}
