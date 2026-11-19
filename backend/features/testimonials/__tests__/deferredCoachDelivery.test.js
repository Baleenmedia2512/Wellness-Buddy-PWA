/**
 * Run: node --test backend/features/testimonials/__tests__/deferredCoachDelivery.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { scheduleDeferredCoachDelivery } from '../deferredCoachDelivery.js';

describe('scheduleDeferredCoachDelivery', () => {
  it('runs the task without blocking the caller on success', async () => {
    let done = false;
    scheduleDeferredCoachDelivery('unit-ok', async () => {
      done = true;
    });
    // Caller returns immediately; task settles on the next microtasks.
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(done, true);
  });

  it('swallows task failures so OTP response stays unaffected', async () => {
    assert.doesNotThrow(() => {
      scheduleDeferredCoachDelivery('unit-fail', async () => {
        throw new Error('smtp down');
      });
    });
    await new Promise((resolve) => setImmediate(resolve));
    await new Promise((resolve) => setImmediate(resolve));
  });
});
