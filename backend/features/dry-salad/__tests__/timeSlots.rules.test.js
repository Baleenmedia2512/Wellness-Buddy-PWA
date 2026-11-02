/**
 * timeSlots.rules.test.js
 * Run: node --test features/dry-salad/__tests__/timeSlots.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DRY_SALAD_SLOTS,
  normalizeDrySaladSlot,
  slotFromTimeOfDay,
} from '../domain/timeSlots.rules.js';

describe('timeSlots.rules', () => {
  it('normalizeDrySaladSlot accepts the four slots only', () => {
    assert.deepEqual(DRY_SALAD_SLOTS, ['morning', 'afternoon', 'evening', 'night']);
    assert.equal(normalizeDrySaladSlot('Morning'), 'morning');
    assert.equal(normalizeDrySaladSlot('night'), 'night');
    assert.equal(normalizeDrySaladSlot('breakfast'), null);
    assert.equal(normalizeDrySaladSlot(''), null);
  });

  it('slotFromTimeOfDay maps morning / afternoon / evening / night', () => {
    assert.equal(slotFromTimeOfDay('05:00:00'), 'morning');
    assert.equal(slotFromTimeOfDay('07:30:00'), 'morning');
    assert.equal(slotFromTimeOfDay('11:59:59'), 'morning');
    assert.equal(slotFromTimeOfDay('12:00:00'), 'afternoon');
    assert.equal(slotFromTimeOfDay('15:59:00'), 'afternoon');
    assert.equal(slotFromTimeOfDay('16:00:00'), 'evening');
    assert.equal(slotFromTimeOfDay('19:59:00'), 'evening');
    assert.equal(slotFromTimeOfDay('20:00:00'), 'night');
    assert.equal(slotFromTimeOfDay('23:45:00'), 'night');
    assert.equal(slotFromTimeOfDay('00:15:00'), 'night');
    assert.equal(slotFromTimeOfDay('04:59:00'), 'night');
  });

  it('slotFromTimeOfDay falls back to morning on invalid input', () => {
    assert.equal(slotFromTimeOfDay(''), 'morning');
    assert.equal(slotFromTimeOfDay('xx'), 'morning');
    assert.equal(slotFromTimeOfDay(null), 'morning');
  });
});
