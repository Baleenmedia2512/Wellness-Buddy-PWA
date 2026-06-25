/**
 * shared/services/auth/fsm/invariants.js
 * ---------------------------------------------------------------------------
 * Runtime invariant checks. Run on every transition. Violations are recorded
 * via telemetry but NEVER throw — shadow mode must not destabilize the host
 * application.
 * ---------------------------------------------------------------------------
 */

import { S, READY_STATES, GATE_STATES, BLOCKED_STATES } from "./states";
import { recordInvariant, recordStaleEpoch } from "./telemetry";

/**
 * @param {{ core: string, ctx: object }} prev
 * @param {{ core: string, ctx: object }} next
 * @param {{ type: string }} event
 * @returns {string[]} violation messages (empty array = OK)
 */
export function checkInvariants(prev, next, event) {
  const v = [];

  // 1. Mutually exclusive state classes
  if (READY_STATES.has(next.core) && GATE_STATES.has(next.core)) {
    v.push(`READY+GATE simultaneously: ${next.core}`);
  }
  if (READY_STATES.has(next.core) && BLOCKED_STATES.has(next.core)) {
    v.push(`READY+BLOCKED simultaneously: ${next.core}`);
  }

  // 2. signingIn ⊕ signingOut
  if (next.core === S.SIGNING_IN && next.ctx.signingOut) {
    v.push("signingIn AND signingOut flag set");
  }
  if (next.core === S.SIGNING_OUT && !next.ctx.signingOut) {
    v.push("signingOut state but signingOut flag not set");
  }

  // 3. ready and signingOut
  if (READY_STATES.has(next.core) && next.ctx.signingOut) {
    v.push("ready AND signingOut");
  }

  // 4. Epoch monotonicity (must never decrease)
  if (next.ctx.epoch < prev.ctx.epoch) {
    v.push(`epoch decreased: ${prev.ctx.epoch} -> ${next.ctx.epoch}`);
  }

  // 5. terminalLoggedOut must not carry a user
  if (next.core === S.TERMINAL_LOGGED_OUT && next.ctx.user) {
    v.push("terminalLoggedOut with non-null user");
  }

  // 6. Stale completion: late event arriving with mismatched epoch
  // (event.epoch is optional; only check when actor explicitly tags it)
  if (
    typeof event.epoch === "number" &&
    event.epoch !== prev.ctx.epoch &&
    event.type !== "AUTH_CHANGED" // AUTH_CHANGED is push-style, no epoch
  ) {
    v.push(
      `stale event ${event.type}: event.epoch=${event.epoch}, ctx.epoch=${prev.ctx.epoch}`,
    );
    // Also tracked separately for aggregation / counters.
    recordStaleEpoch({
      event: event.type,
      eventEpoch: event.epoch,
      ctxEpoch: prev.ctx.epoch,
    });
  }

  // 7. unauthenticated must not carry user
  if (next.core === S.UNAUTHENTICATED && next.ctx.user) {
    v.push("unauthenticated with non-null user");
  }

  if (v.length) {
    recordInvariant({
      violations: v,
      event: event?.type,
      from: prev.core,
      to: next.core,
      epoch: next.ctx.epoch,
    });
  }
  return v;
}
