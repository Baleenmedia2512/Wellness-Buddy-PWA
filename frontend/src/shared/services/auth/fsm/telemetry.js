/**
 * shared/services/auth/fsm/telemetry.js
 * ---------------------------------------------------------------------------
 * Ring buffer + structured logger for the shadow FSM.
 *
 * Ring entries have one of these shapes:
 *   { kind: 'transition', transitionId, from, to, event, epoch, ctxDiff,
 *     durationMs, violations, ts }
 *   { kind: 'event',           event, ts }
 *   { kind: 'drift',           diff, ts }
 *   { kind: 'invariant',       violation, ts }
 *   { kind: 'actor',           actor, phase, input?, outcome?, ts }
 *   { kind: 'state_duration',  state, durationMs, exitEvent, epoch, ts }
 *   { kind: 'timer_cancel',    timerId, scheduledEpoch, currentEpoch,
 *                              reason, ts }
 *   { kind: 'stale_epoch',     event, eventEpoch, ctxEpoch, ts }
 *
 * Buffer is bounded to RING_SIZE; flushed via getRingBuffer() for support /
 * test introspection.
 * ---------------------------------------------------------------------------
 */

const RING_SIZE = 500;
/** @type {Array<object>} */
const ring = [];
let nextTransitionId = 1;
let logVerbose = process.env.NODE_ENV !== "production";

let counters = {
  events: 0,
  transitions: 0,
  drifts: 0,
  invariants: 0,
  actors: 0,
  staleEpochDrops: 0,
  timerCancellations: 0,
  stateDurations: 0,
};

export function setVerbose(flag) {
  logVerbose = !!flag;
}

export function newTransitionId() {
  return `t${nextTransitionId++}`;
}

function push(entry) {
  ring.push({ ts: Date.now(), ...entry });
  if (ring.length > RING_SIZE) ring.shift();
}

export function recordEvent(event) {
  counters.events++;
  push({ kind: "event", event });
  if (logVerbose) {
    // eslint-disable-next-line no-console -- FSM / lifecycle code — must reach crash reporters before logger is ready
    console.debug("[AuthFSM:event]", event?.type, event);
  }
}

export function recordTransition(entry) {
  counters.transitions++;
  push({ kind: "transition", ...entry });
  if (logVerbose) {
    const arrow = entry.from === entry.to ? "·" : "→";
    // eslint-disable-next-line no-console -- FSM / lifecycle code — must reach crash reporters before logger is ready
    console.debug(
      `[AuthFSM:${entry.transitionId}] ${entry.from} ${arrow} ${entry.to}`,
      { event: entry.event?.type, ctxDiff: entry.ctxDiff, durationMs: entry.durationMs },
    );
  }
}

export function recordActor(entry) {
  counters.actors++;
  push({ kind: "actor", ...entry });
  if (logVerbose) {
    // eslint-disable-next-line no-console -- FSM / lifecycle code — must reach crash reporters before logger is ready
    console.debug(`[AuthFSM:actor] ${entry.actor} ${entry.phase}`, entry);
  }
}

export function recordDrift(diff) {
  counters.drifts++;
  push({ kind: "drift", diff });
  // Drift is always logged (this is the whole point of shadow mode).
  // eslint-disable-next-line no-console -- FSM / lifecycle code — must reach crash reporters before logger is ready
  console.warn("[AuthFSM:drift]", diff);
}

export function recordInvariant(violation) {
  counters.invariants++;
  push({ kind: "invariant", violation });
  // Invariant violations are always logged at error level.
  // eslint-disable-next-line no-console -- FSM / lifecycle code — must reach crash reporters before logger is ready
  console.error("[AuthFSM:invariant]", violation);
}

export function recordStateDuration(entry) {
  counters.stateDurations++;
  push({ kind: "state_duration", ...entry });
}

export function recordTimerCancel(entry) {
  counters.timerCancellations++;
  push({ kind: "timer_cancel", ...entry });
}

export function recordStaleEpoch(entry) {
  counters.staleEpochDrops++;
  push({ kind: "stale_epoch", ...entry });
}

export function getCounters() {
  return { ...counters };
}

export function resetCounters() {
  counters = {
    events: 0,
    transitions: 0,
    drifts: 0,
    invariants: 0,
    actors: 0,
    staleEpochDrops: 0,
    timerCancellations: 0,
    stateDurations: 0,
  };
}

export function getRingBuffer() {
  return ring.slice();
}

export function clearRingBuffer() {
  ring.length = 0;
  resetCounters();
}

