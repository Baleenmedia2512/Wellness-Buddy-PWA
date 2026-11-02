/**
 * Unit tests for profile body metrics mapping / merge.
 * Run: node --test backend/features/user/__tests__/profileBodyMetrics.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyProfileBodyMetrics,
  hasAnyProfileBodyMetric,
  hasCoachRecordedBodyMetrics,
  isBodyMetricEmpty,
  mapCardToProfileBodyMetrics,
  mapTeamRowToProfileBodyMetrics,
  mergeProfileBodyMetrics,
  parseOptionalBodyMetric,
} from '../domain/profileBodyMetrics.rules.js';

describe('profileBodyMetrics.rules', () => {
  describe('isBodyMetricEmpty', () => {
    it('treats null, undefined, and empty string as empty', () => {
      assert.equal(isBodyMetricEmpty(null), true);
      assert.equal(isBodyMetricEmpty(undefined), true);
      assert.equal(isBodyMetricEmpty(''), true);
      assert.equal(isBodyMetricEmpty(0), false);
    });
  });

  describe('emptyProfileBodyMetrics', () => {
    it('returns all keys as null', () => {
      const empty = emptyProfileBodyMetrics();
      assert.equal(empty.age, null);
      assert.equal(empty.fatPercent, null);
      assert.equal(empty.visceralFat, null);
      assert.equal(empty.bmi, null);
      assert.equal(empty.bodyAge, null);
      assert.equal(empty.chestCm, null);
      assert.equal(empty.waistCm, null);
      assert.equal(empty.hipCm, null);
      assert.equal(empty.gender, null);
    });
  });

  describe('mapCardToProfileBodyMetrics', () => {
    it('maps card columns to flat read-only fields', () => {
      const mapped = mapCardToProfileBodyMetrics({
        age: 32,
        gender: 'Male',
        fat_percent: 18.5,
        visceral_fat: null,
        bmi: 24.1,
        body_age: 30,
        chest_cm: 95,
        waist_cm: 82,
        hip_cm: 98,
      });

      assert.deepEqual(mapped, {
        age: 32,
        gender: 'Male',
        fatPercent: 18.5,
        visceralFat: null,
        bmi: 24.1,
        bodyAge: 30,
        chestCm: 95,
        waistCm: 82,
        hipCm: 98,
      });
    });

    it('returns null when card is missing', () => {
      assert.equal(mapCardToProfileBodyMetrics(null), null);
    });
  });

  describe('mapTeamRowToProfileBodyMetrics', () => {
    it('maps PascalCase team_table columns', () => {
      const mapped = mapTeamRowToProfileBodyMetrics({
        Age: 28,
        VisceralFat: 7,
        BodyAge: 26,
        ChestCm: 90,
        WaistCm: 75,
        HipCm: 95,
        Gender: 'Female',
      });
      assert.equal(mapped.age, 28);
      assert.equal(mapped.visceralFat, 7);
      assert.equal(mapped.bodyAge, 26);
      assert.equal(mapped.chestCm, 90);
      assert.equal(mapped.waistCm, 75);
      assert.equal(mapped.hipCm, 95);
      assert.equal(mapped.gender, 'Female');
      assert.equal(mapped.fatPercent, null);
    });

    it('returns empty metrics when user is missing', () => {
      assert.deepEqual(mapTeamRowToProfileBodyMetrics(null), emptyProfileBodyMetrics());
    });
  });

  describe('mergeProfileBodyMetrics', () => {
    it('always returns a full key set even when sources are empty', () => {
      const merged = mergeProfileBodyMetrics({});
      assert.deepEqual(merged, emptyProfileBodyMetrics());
    });

    it('prefers BCM card values over team_table', () => {
      const merged = mergeProfileBodyMetrics({
        cardMetrics: { ...emptyProfileBodyMetrics(), age: 40, visceralFat: 9 },
        teamMetrics: { ...emptyProfileBodyMetrics(), age: 28, visceralFat: 5, chestCm: 92 },
      });
      assert.equal(merged.age, 40);
      assert.equal(merged.visceralFat, 9);
      assert.equal(merged.chestCm, 92);
    });

    it('falls back to team_table when card field is empty', () => {
      const merged = mergeProfileBodyMetrics({
        cardMetrics: { ...emptyProfileBodyMetrics(), age: null },
        teamMetrics: { ...emptyProfileBodyMetrics(), age: 33, bodyAge: 30 },
      });
      assert.equal(merged.age, 33);
      assert.equal(merged.bodyAge, 30);
    });

    it('fills fatPercent and bmi from weight when still empty', () => {
      const merged = mergeProfileBodyMetrics({
        teamMetrics: { ...emptyProfileBodyMetrics(), age: 25 },
        weightFatPercent: 18.2,
        weightBmi: 22.4,
      });
      assert.equal(merged.age, 25);
      assert.equal(merged.fatPercent, 18.2);
      assert.equal(merged.bmi, 22.4);
    });

    it('does not override card fat/BMI with weight', () => {
      const merged = mergeProfileBodyMetrics({
        cardMetrics: { ...emptyProfileBodyMetrics(), fatPercent: 15, bmi: 21 },
        weightFatPercent: 30,
        weightBmi: 28,
      });
      assert.equal(merged.fatPercent, 15);
      assert.equal(merged.bmi, 21);
    });
  });

  describe('hasCoachRecordedBodyMetrics', () => {
    it('returns true only when coach-entered fields exist', () => {
      assert.equal(hasCoachRecordedBodyMetrics({ age: 30, bmi: 22 }), true);
      assert.equal(hasCoachRecordedBodyMetrics({ bmi: 22, fatPercent: 18 }), false);
      assert.equal(hasCoachRecordedBodyMetrics(null), false);
    });
  });

  describe('hasAnyProfileBodyMetric', () => {
    it('detects any non-empty metric', () => {
      assert.equal(hasAnyProfileBodyMetric(emptyProfileBodyMetrics()), false);
      assert.equal(hasAnyProfileBodyMetric({ ...emptyProfileBodyMetrics(), waistCm: 80 }), true);
    });
  });

  describe('parseOptionalBodyMetric', () => {
    it('omits when undefined', () => {
      assert.deepEqual(parseOptionalBodyMetric(undefined), { ok: true, value: undefined });
    });

    it('clears on null or empty string', () => {
      assert.deepEqual(parseOptionalBodyMetric(null), { ok: true, value: null });
      assert.deepEqual(parseOptionalBodyMetric(''), { ok: true, value: null });
    });

    it('parses valid numbers within bounds', () => {
      assert.deepEqual(parseOptionalBodyMetric('32', { min: 1, max: 120, integer: true }), {
        ok: true,
        value: 32,
      });
      assert.deepEqual(parseOptionalBodyMetric('7.5', { min: 1, max: 59 }), {
        ok: true,
        value: 7.5,
      });
    });

    it('rejects out-of-range values', () => {
      const bad = parseOptionalBodyMetric('999', { min: 1, max: 120 });
      assert.equal(bad.ok, false);
    });
  });
});
