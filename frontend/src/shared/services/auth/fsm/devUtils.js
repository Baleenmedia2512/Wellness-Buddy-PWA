/**
 * shared/services/auth/fsm/devUtils.js
 * ---------------------------------------------------------------------------
 * Developer-facing visualization helpers. Exposed on `window.__authFsm` for
 * console inspection. Zero production cost (no listeners attached).
 * ---------------------------------------------------------------------------
 */

import { getRingBuffer, clearRingBuffer, getCounters } from "./telemetry";
import { getFlags } from "./featureFlags";

export function getTimeline(limit = 50) {
  const all = getRingBuffer();
  return all.slice(-limit);
}

export function printTimeline(limit = 30) {
  const items = getTimeline(limit).map((it) => {
    if (it.kind === "transition") {
      return {
        ts: new Date(it.ts).toISOString().substr(11, 12),
        kind: "transition",
        from: it.from,
        to: it.to,
        event: it.event && it.event.type,
        ctxDiff: Object.keys(it.ctxDiff || {}).join(","),
        v: (it.violations || []).length,
      };
    }
    if (it.kind === "drift") {
      return {
        ts: new Date(it.ts).toISOString().substr(11, 12),
        kind: "drift",
        expected: it.diff.expected,
        actual: it.diff.actual,
      };
    }
    if (it.kind === "invariant") {
      return {
        ts: new Date(it.ts).toISOString().substr(11, 12),
        kind: "invariant",
        msg: (it.violation && it.violation.violations || []).join("; "),
      };
    }
    if (it.kind === "actor") {
      return {
        ts: new Date(it.ts).toISOString().substr(11, 12),
        kind: "actor",
        actor: it.actor,
        phase: it.phase,
      };
    }
    if (it.kind === "state_duration") {
      return {
        ts: new Date(it.ts).toISOString().substr(11, 12),
        kind: "state_duration",
        state: it.state,
        ms: it.durationMs,
        exit: it.exitEvent,
      };
    }
    if (it.kind === "timer_cancel") {
      return {
        ts: new Date(it.ts).toISOString().substr(11, 12),
        kind: "timer_cancel",
        reason: it.reason,
        epoch: `${it.scheduledEpoch}->${it.currentEpoch}`,
      };
    }
    if (it.kind === "stale_epoch") {
      return {
        ts: new Date(it.ts).toISOString().substr(11, 12),
        kind: "stale_epoch",
        event: it.event,
        epoch: `${it.eventEpoch}!=${it.ctxEpoch}`,
      };
    }
    return {
      ts: new Date(it.ts).toISOString().substr(11, 12),
      kind: it.kind || "event",
      event: it.event && it.event.type,
    };
  });
  // eslint-disable-next-line no-console
  console.table(items);
}

export function summarize() {
  const counters = getCounters();
  return {
    events: counters.events,
    transitions: counters.transitions,
    drifts: counters.drifts,
    invariants: counters.invariants,
    actors: counters.actors,
    stateDurations: counters.stateDurations,
    timerCancellations: counters.timerCancellations,
    staleEpochDrops: counters.staleEpochDrops,
  };
}

/**
 * Bucketize a list of numbers into simple stats.
 */
function stats(samples) {
  if (!samples || !samples.length) return null;
  const sorted = samples.slice().sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((a, b) => a + b, 0);
  const pct = (p) => sorted[Math.min(n - 1, Math.floor((p / 100) * n))];
  return {
    n,
    min: +sorted[0].toFixed(2),
    max: +sorted[n - 1].toFixed(2),
    mean: +(sum / n).toFixed(2),
    p50: +pct(50).toFixed(2),
    p95: +pct(95).toFixed(2),
    p99: +pct(99).toFixed(2),
  };
}

/**
 * Walk the ring buffer and produce structured aggregates suitable for the
 * burn-in telemetry report. Pure read; safe to call any time.
 *
 * Returns:
 *   {
 *     counters: {...},
 *     driftByState:    { [state]:    count },     // actual FSM state at drift
 *     driftByExpected: { [state]:    count },     // legacy-derived expected
 *     driftByEvent:    { [eventType]: count },
 *     invariantsByType:{ [violation]: count },
 *     timerCancelByReason: { [reason]: count },
 *     staleEpochByEvent:   { [eventType]: count },
 *     stateDurations:  { [state]: stats },        // ms per occupancy
 *     semanticDurations: {
 *        bootMs?:           number,               // BOOT recv -> first non-BOOTING
 *        signInMs?:         number[],             // each SIGNING_IN occupancy
 *        signOutMs?:        number[],             // each SIGNING_OUT occupancy
 *        setupCheckMs?:     number[],             // each CHECKING_SETUP_STATUS
 *        profileCheckMs?:   number[],             // each CHECKING_PROFILE
 *     },
 *   }
 */
export function getAggregates() {
  const all = getRingBuffer();
  const driftByState = {};
  const driftByExpected = {};
  const driftByEvent = {};
  const invariantsByType = {};
  const timerCancelByReason = {};
  const staleEpochByEvent = {};
  /** @type {Record<string, number[]>} */
  const stateDurationSamples = {};
  const signInMs = [];
  const signOutMs = [];
  const setupCheckMs = [];
  const profileCheckMs = [];
  let bootStartTs = null;
  let bootMs = null;

  all.forEach((e) => {
    if (e.kind === "drift") {
      const d = e.diff || {};
      driftByState[d.actual] = (driftByState[d.actual] || 0) + 1;
      driftByExpected[d.expected] = (driftByExpected[d.expected] || 0) + 1;
      const ev = d.eventType || "(none)";
      driftByEvent[ev] = (driftByEvent[ev] || 0) + 1;
    } else if (e.kind === "invariant") {
      const list = (e.violation && e.violation.violations) || [];
      list.forEach((msg) => {
        // Normalize "stale event X: ..." to "stale event" for grouping.
        const key = msg.replace(/:.*$/, "").replace(/\d+/g, "N");
        invariantsByType[key] = (invariantsByType[key] || 0) + 1;
      });
    } else if (e.kind === "timer_cancel") {
      const r = e.reason || "unknown";
      timerCancelByReason[r] = (timerCancelByReason[r] || 0) + 1;
    } else if (e.kind === "stale_epoch") {
      const ev = e.event || "(unknown)";
      staleEpochByEvent[ev] = (staleEpochByEvent[ev] || 0) + 1;
    } else if (e.kind === "state_duration") {
      const s = e.state;
      if (!stateDurationSamples[s]) stateDurationSamples[s] = [];
      stateDurationSamples[s].push(e.durationMs);
      if (s === "signingIn") signInMs.push(e.durationMs);
      else if (s === "signingOut") signOutMs.push(e.durationMs);
      else if (s === "checkingSetupStatus") setupCheckMs.push(e.durationMs);
      else if (s === "checkingProfile") profileCheckMs.push(e.durationMs);
      else if (s === "booting" && bootMs == null) bootMs = e.durationMs;
    } else if (e.kind === "event" && e.event && e.event.type === "BOOT") {
      bootStartTs = e.ts;
    } else if (
      e.kind === "transition" &&
      bootStartTs != null &&
      bootMs == null &&
      e.from === "booting" &&
      e.to !== "booting"
    ) {
      bootMs = e.ts - bootStartTs;
    }
  });

  const stateDurations = {};
  Object.keys(stateDurationSamples).forEach((k) => {
    stateDurations[k] = stats(stateDurationSamples[k]);
  });

  return {
    counters: getCounters(),
    driftByState,
    driftByExpected,
    driftByEvent,
    invariantsByType,
    timerCancelByReason,
    staleEpochByEvent,
    stateDurations,
    semanticDurations: {
      bootMs,
      signIn: stats(signInMs),
      signOut: stats(signOutMs),
      setupCheck: stats(setupCheckMs),
      profileCheck: stats(profileCheckMs),
    },
  };
}

/**
 * Build a JSON-serializable session replay. Suitable for `JSON.stringify` and
 * paste into a bug report. Safe to call any time.
 */
export function exportSession(runtime) {
  const ring = getRingBuffer();
  const snapshot = runtime ? runtime.getSnapshot() : null;
  return {
    schema: "authFsm.session.v1",
    generatedAt: new Date().toISOString(),
    flags: getFlags(),
    snapshot: snapshot
      ? {
          core: snapshot.core,
          ctx: snapshot.ctx,
        }
      : null,
    counters: getCounters(),
    aggregates: getAggregates(),
    timeline: ring,
    sequences: {
      events: ring.filter((e) => e.kind === "event").map((e) => ({
        ts: e.ts,
        type: e.event && e.event.type,
      })),
      transitions: ring
        .filter((e) => e.kind === "transition")
        .map((e) => ({
          ts: e.ts,
          tid: e.transitionId,
          from: e.from,
          to: e.to,
          event: e.event && e.event.type,
          epoch: e.epoch,
          durationMs: e.durationMs,
          violations: e.violations,
        })),
      invariants: ring
        .filter((e) => e.kind === "invariant")
        .map((e) => ({
          ts: e.ts,
          ...e.violation,
        })),
      drifts: ring
        .filter((e) => e.kind === "drift")
        .map((e) => ({ ts: e.ts, ...e.diff })),
      actors: ring
        .filter((e) => e.kind === "actor")
        .map((e) => ({ ts: e.ts, actor: e.actor, phase: e.phase, outcome: e.outcome })),
      epochs: ring
        .filter(
          (e) =>
            e.kind === "transition" &&
            e.ctxDiff &&
            e.ctxDiff.epoch &&
            e.ctxDiff.epoch.from !== e.ctxDiff.epoch.to,
        )
        .map((e) => ({
          ts: e.ts,
          tid: e.transitionId,
          from: e.ctxDiff.epoch.from,
          to: e.ctxDiff.epoch.to,
          event: e.event && e.event.type,
        })),
    },
  };
}

export function exposeOnWindow(runtime) {
  if (typeof window === "undefined") return;
  // eslint-disable-next-line no-underscore-dangle
  window.__authFsm = {
    snapshot: () => runtime.getSnapshot(),
    timeline: getTimeline,
    print: printTimeline,
    summary: summarize,
    aggregates: getAggregates,
    flags: getFlags,
    export: () => exportSession(runtime),
    /**
     * Copy the export() payload to the clipboard as JSON. Convenience for
     * QA when filing a burn-in report. Returns true on success.
     */
    copyExport: async () => {
      try {
        const payload = JSON.stringify(exportSession(runtime), null, 2);
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(payload);
          return true;
        }
      } catch {
        /* fallthrough */
      }
      return false;
    },
    clear: clearRingBuffer,
  };
}

