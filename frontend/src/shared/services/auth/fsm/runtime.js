/**
 * shared/services/auth/fsm/runtime.js
 * ---------------------------------------------------------------------------
 * Minimal interpreter for the pure reducer in `machine.js`.
 *
 * Responsibilities:
 *   - Hold current state.
 *   - Dispatch events through `transition`.
 *   - Schedule delayed transitions ('after' effects).
 *   - Enforce epoch cancellation: `after` timers tag the current epoch and
 *     are dropped if the epoch has advanced before they fire.
 *   - Run invariant checks per transition.
 *   - Emit telemetry per event / transition.
 *
 * In shadow mode (Phase 3d-a) the runtime does NOT invoke any actors. The
 * `invoke` / `cancel` effect types are reserved for Phase 3d-b. All side
 * effects continue to live in App.js + helpers — the FSM merely observes the
 * resulting events.
 * ---------------------------------------------------------------------------
 */

import { initialState, transition } from "./machine";
import { checkInvariants } from "./invariants";
import {
  newTransitionId,
  recordEvent,
  recordTransition,
  recordStateDuration,
  recordTimerCancel,
} from "./telemetry";

function nowMs() {
  return typeof performance !== "undefined" && performance.now
    ? performance.now()
    : Date.now();
}

export function createRuntime() {
  let state = initialState;
  /** @type {Set<(state: object, event: object) => void>} */
  const subscribers = new Set();
  /** @type {Map<number, { handle: any, epoch: number }>} */
  const timers = new Map();
  let timerSeq = 0;
  let disposed = false;
  let stateEnteredAt = nowMs();

  function diffCtx(a, b) {
    const out = {};
    Object.keys(b).forEach((k) => {
      if (a[k] !== b[k]) out[k] = { from: a[k], to: b[k] };
    });
    return out;
  }

  function send(event) {
    if (disposed || !event || !event.type) return;
    try {
      recordEvent(event);
      const tid = newTransitionId();
      const t0 = nowMs();
      const { next, effects } = transition(state, event);
      const t1 = nowMs();
      const violations = checkInvariants(state, next, event);
      const transitioned = next.core !== state.core;
      recordTransition({
        transitionId: tid,
        from: state.core,
        to: next.core,
        event,
        epoch: next.ctx.epoch,
        durationMs: +(t1 - t0).toFixed(3),
        ctxDiff: diffCtx(state.ctx, next.ctx),
        violations,
      });
      const prevEpoch = state.ctx.epoch;
      const prevCore = state.core;
      state = next;

      // Cancel any pending timers whose epoch was just superseded.
      if (next.ctx.epoch > prevEpoch) cancelStaleTimers(prevEpoch, next.ctx.epoch);

      // Track time spent in the previous state on every real transition.
      if (transitioned) {
        const exitedAt = nowMs();
        recordStateDuration({
          state: prevCore,
          durationMs: +(exitedAt - stateEnteredAt).toFixed(3),
          exitEvent: event.type,
          epoch: prevEpoch,
        });
        stateEnteredAt = exitedAt;
      }

      // Schedule new effects.
      effects.forEach(scheduleEffect);

      if (transitioned) {
        subscribers.forEach((fn) => {
          try {
            fn(state, event);
          } catch {
            /* subscriber errors must not break the FSM */
          }
        });
      }
    } catch (err) {
      // Shadow-mode FSM must never throw into the host.
      // eslint-disable-next-line no-console // FSM / lifecycle code — must reach crash reporters before logger is ready // FSM/lifecycle code must reach crash reporters before logger is ready
      console.error("[AuthFSM:runtime] send threw", err);
    }
  }

  function scheduleEffect(eff) {
    if (!eff || eff.type !== "after") return;
    const id = ++timerSeq;
    const epochAtSchedule = state.ctx.epoch;
    const handle = setTimeout(() => {
      const entry = timers.get(id);
      timers.delete(id);
      // Drop if disposed or epoch advanced (cancellation by epoch bump).
      if (disposed) return;
      if (!entry) return;
      if (entry.epoch !== state.ctx.epoch) return;
      send(eff.event);
    }, eff.delayMs);
    timers.set(id, { handle, epoch: epochAtSchedule });
  }

  function cancelStaleTimers(prevEpoch, newEpoch) {
    timers.forEach((entry, id) => {
      if (entry.epoch <= prevEpoch) {
        try {
          clearTimeout(entry.handle);
        } catch {
          /* noop */
        }
        recordTimerCancel({
          timerId: id,
          scheduledEpoch: entry.epoch,
          currentEpoch: newEpoch,
          reason: "epoch_advanced",
        });
        timers.delete(id);
      }
    });
  }

  function subscribe(fn) {
    subscribers.add(fn);
    return () => subscribers.delete(fn);
  }

  function getSnapshot() {
    return state;
  }

  function dispose() {
    disposed = true;
    timers.forEach((entry, id) => {
      try {
        clearTimeout(entry.handle);
      } catch {
        /* noop */
      }
      recordTimerCancel({
        timerId: id,
        scheduledEpoch: entry.epoch,
        currentEpoch: state.ctx.epoch,
        reason: "disposed",
      });
    });
    timers.clear();
    subscribers.clear();
  }

  return { send, subscribe, getSnapshot, dispose };
}
