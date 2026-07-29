/**
 * Unit tests for read-only profile body metrics mapping.
 * Run: node --test backend/features/user/__tests__/profileBodyMetrics.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasAnyProfileBodyMetric,
  hasCoachRecordedBodyMetrics,
  isBodyMetricEmpty,
  mapCardToProfileBodyMetrics,
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

  describe('hasCoachRecordedBodyMetrics', () => {
    it('returns true only when coach-entered fields exist', () => {
      assert.equal(hasCoachRecordedBodyMetrics({ age: 30, bmi: 22 }), true);
      assert.equal(hasCoachRecordedBodyMetrics({ bmi: 22, fatPercent: 18 }), false);
      assert.equal(hasCoachRecordedBodyMetrics(null), false);
    });
  });
});
