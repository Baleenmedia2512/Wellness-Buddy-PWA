/**
 * reverseProgressTips.test.js
 *
 * Unit tests for the pure domain module that decides whether and what wellness
 * tips are shown when a user's weight increases significantly.
 *
 * Domain mocking strategy (claude.md §9.6): NO mocks — pure input → output.
 */

import {
  selectTips,
  REVERSE_PROGRESS_THRESHOLD_KG,
} from "../domain/reverseProgressTips";

describe("reverseProgressTips — selectTips()", () => {
  // ── Happy path ─────────────────────────────────────────────────────────────

  it("returns an array of tips when change equals the threshold", () => {
    const result = selectTips(REVERSE_PROGRESS_THRESHOLD_KG);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("returns tips when change is above the threshold", () => {
    const result = selectTips(5);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it("every tip is a non-empty string", () => {
    const result = selectTips(REVERSE_PROGRESS_THRESHOLD_KG);
    result.forEach((tip) => {
      expect(typeof tip).toBe("string");
      expect(tip.trim().length).toBeGreaterThan(0);
    });
  });

  // ── No-popup cases ─────────────────────────────────────────────────────────

  it("returns null when change is just below the threshold", () => {
    expect(selectTips(REVERSE_PROGRESS_THRESHOLD_KG - 0.01)).toBeNull();
  });

  it("returns null when change is zero (no movement)", () => {
    expect(selectTips(0)).toBeNull();
  });

  it("returns null when change is negative (weight loss — good progress)", () => {
    expect(selectTips(-2)).toBeNull();
  });

  // ── Guard rails ────────────────────────────────────────────────────────────

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

  // ── Threshold constant ─────────────────────────────────────────────────────

  it("REVERSE_PROGRESS_THRESHOLD_KG is exactly 4", () => {
    expect(REVERSE_PROGRESS_THRESHOLD_KG).toBe(4);
  });
});
