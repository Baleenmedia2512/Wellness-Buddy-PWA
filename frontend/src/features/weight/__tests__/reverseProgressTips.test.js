/**
 * reverseProgressTips.test.js
 *
 * Unit tests for the pure domain module that decides whether and what wellness
 * tips are shown when a user's weight changes significantly.
 *
 * Domain mocking strategy (claude.md §9.6): NO mocks — pure input → output.
 *
 * Note: selectTips() uses Math.random() for tip selection, so tests check
 * shape and bounds rather than exact tip content.
 */

import {
  selectTips,
  REVERSE_PROGRESS_THRESHOLD_KG,
} from "../domain/reverseProgressTips";

/** Helper — asserts a result has the right shape and expected tip count range. */
function expectValidResult(result, expectedDirection, minTips, maxTips) {
  expect(result).not.toBeNull();
  expect(result.direction).toBe(expectedDirection);
  expect(result.color).toBe(expectedDirection === "gain" ? "warning" : "success");
  expect(Array.isArray(result.tips)).toBe(true);
  expect(result.tips.length).toBeGreaterThanOrEqual(minTips);
  expect(result.tips.length).toBeLessThanOrEqual(maxTips);
  result.tips.forEach((tip) => {
    expect(typeof tip).toBe("string");
    expect(tip.trim().length).toBeGreaterThan(0);
  });
}

describe("reverseProgressTips — selectTips()", () => {
  // ── GAIN path → 1 tip, yellow (warning) ────────────────────────────────────

  it("returns 1 gain tip with warning color for a tiny 100 g increase (0.1 kg)", () => {
    expectValidResult(selectTips(0.1), "gain", 1, 1);
  });

  it("returns 1 gain tip for a small 500 g increase", () => {
    expectValidResult(selectTips(0.5), "gain", 1, 1);
  });

  it("returns 1 gain tip for a 1 kg increase", () => {
    expectValidResult(selectTips(1), "gain", 1, 1);
  });

  it("returns 1 gain tip for a large 15.3 kg increase (real-world screenshot value)", () => {
    expectValidResult(selectTips(15.3), "gain", 1, 1);
  });

  // ── LOSS path → 2–3 tips, green (success) ───────────────────────────────────

  it("returns 2–3 loss tips with success color for any negative change", () => {
    expectValidResult(selectTips(-1), "loss", 2, 3);
  });

  it("returns 2–3 loss tips for a small loss like -0.5 kg", () => {
    expectValidResult(selectTips(-0.5), "loss", 2, 3);
  });

  it("returns 2–3 loss tips for a large loss like -5 kg", () => {
    expectValidResult(selectTips(-5), "loss", 2, 3);
  });

  // ── No-popup cases ──────────────────────────────────────────────────────────

  it("returns null when change is exactly zero (no movement)", () => {
    expect(selectTips(0)).toBeNull();
  });

  // ── Guard rails ─────────────────────────────────────────────────────────────

  it("returns null for NaN input", () => {
    expect(selectTips(NaN)).toBeNull();
  });

  it("returns null for null input", () => {
    expect(selectTips(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(selectTips(undefined)).toBeNull();
  });

  it("returns null for Infinity (defensive — not a real weight delta)", () => {
    expect(selectTips(Infinity)).toBeNull();
  });

  it("returns null for -Infinity", () => {
    expect(selectTips(-Infinity)).toBeNull();
  });

  // ── Threshold constant ──────────────────────────────────────────────────────

  it("REVERSE_PROGRESS_THRESHOLD_KG is exactly 0 (any gain triggers popup)", () => {
    expect(REVERSE_PROGRESS_THRESHOLD_KG).toBe(0);
  });
});
