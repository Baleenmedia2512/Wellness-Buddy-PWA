/**
 * Unit tests for AI credits domain rules.
 * Run: node --test backend/features/ai-credits/__tests__/credits.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStatus,
  canReserve,
  isSuccessfulFoodAnalysis,
  normalizeConfig,
  DEFAULT_DAILY_AI_CREDITS,
} from '../domain/credits.rules.js';

describe('buildStatus', () => {
  it('computes remaining from used and limit', () => {
    const s = buildStatus({
      enabled: true,
      dailyLimit: 3,
      used: 1,
      usageDate: '2026-07-27',
      timezoneIana: 'Asia/Kolkata',
    });
    assert.equal(s.enabled, true);
    assert.equal(s.dailyLimit, 3);
    assert.equal(s.used, 1);
    assert.equal(s.remaining, 2);
    assert.equal(s.usageDate, '2026-07-27');
  });

  it('disables when limit is 0', () => {
    const s = buildStatus({
      enabled: true,
      dailyLimit: 0,
      used: 0,
      usageDate: '2026-07-27',
      timezoneIana: 'Asia/Kolkata',
    });
    assert.equal(s.enabled, false);
    assert.equal(s.remaining, 0);
  });
});

describe('canReserve', () => {
  it('allows when used + pending < limit', () => {
    assert.deepEqual(
      canReserve({ enabled: true, dailyLimit: 3, used: 1, pendingReservations: 0 }),
      { allowed: true },
    );
  });

  it('blocks when limit reached including pending holds', () => {
    assert.deepEqual(
      canReserve({ enabled: true, dailyLimit: 3, used: 2, pendingReservations: 1 }),
      { allowed: false, reason: 'limit_reached' },
    );
  });

  it('blocks when AI mode disabled', () => {
    assert.deepEqual(
      canReserve({ enabled: false, dailyLimit: 3, used: 0, pendingReservations: 0 }),
      { allowed: false, reason: 'disabled' },
    );
  });
});

describe('isSuccessfulFoodAnalysis', () => {
  it('true for food with named items', () => {
    assert.equal(
      isSuccessfulFoodAnalysis({
        imageType: 'food',
        details: { foods: [{ name: 'Idli' }] },
      }),
      true,
    );
  });

  it('true for food with calories in fastNutrition', () => {
    assert.equal(
      isSuccessfulFoodAnalysis({
        imageType: 'food',
        details: {},
        fastNutrition: { calories: 220 },
      }),
      true,
    );
  });

  it('false for weight / education / other', () => {
    assert.equal(isSuccessfulFoodAnalysis({ imageType: 'weight', details: {} }), false);
    assert.equal(isSuccessfulFoodAnalysis({ imageType: 'education', details: {} }), false);
    assert.equal(isSuccessfulFoodAnalysis({ imageType: 'other', details: {} }), false);
  });

  it('false for food without recognised items', () => {
    assert.equal(
      isSuccessfulFoodAnalysis({ imageType: 'food', details: { foods: [] } }),
      false,
    );
  });
});

describe('normalizeConfig', () => {
  it('defaults and clamps', () => {
    assert.equal(normalizeConfig({}).dailyAiCredits, DEFAULT_DAILY_AI_CREDITS);
    assert.equal(normalizeConfig({ dailyAiCredits: -5 }).dailyAiCredits, 0);
    assert.equal(normalizeConfig({ dailyAiCredits: 5000 }).dailyAiCredits, 1000);
    assert.equal(normalizeConfig({ aiModeEnabled: false }).aiModeEnabled, false);
  });
});
