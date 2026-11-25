/**
 * Run: node --test backend/features/nutrition-centers/domain/__tests__/centreListing.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  defaultOpeningHours,
  prepareCentreListing,
} from '../centreListing.rules.js';

const facilities = ['parking', 'ac'];
const features = ['weight_check', 'wellness_activity'];

describe('prepareCentreListing', () => {
  it('accepts split hours, a closed day, parking, and AC without features', () => {
    const result = prepareCentreListing({
      openingHours: defaultOpeningHours(),
      facilities,
      appVersion: '3.5.6',
      mode: 'register',
    });
    assert.equal(result.error, undefined);
    assert.equal(result.openingHours.sunday.closed, true);
    assert.equal(result.openingHours.thursday.slots.length, 2);
    assert.deepEqual(result.facilities, facilities);
    assert.equal(result.features, null);
  });

  it('lets an older app register without hours or facilities', () => {
    const result = prepareCentreListing({ appVersion: '3.5.6', mode: 'register' });
    assert.equal(result.openingHours, null);
    assert.equal(result.facilities, null);
    assert.equal(result.features, null);
  });

  it('does not clear stored hours when an older update omits them', () => {
    const result = prepareCentreListing({ mode: 'update' });
    assert.equal(result.openingHours, undefined);
  });

  it('requires hours from 3.5.7', () => {
    const result = prepareCentreListing({
      appVersion: '3.5.7',
      mode: 'register',
    });
    assert.match(result.error, /Opening hours are required/);
  });

  it('rejects a close time that is not after open', () => {
    const hours = defaultOpeningHours();
    hours.monday = { closed: false, slots: [{ open: '13:00', close: '09:00' }] };
    const result = prepareCentreListing({
      openingHours: hours,
      facilities,
      features,
      appVersion: null,
      mode: 'register',
    });
    assert.match(result.error, /Monday close time/);
  });

  it('rejects an unknown facility', () => {
    const result = prepareCentreListing({
      openingHours: defaultOpeningHours(),
      facilities: ['parking', 'pool'],
      features,
      appVersion: null,
      mode: 'register',
    });
    assert.match(result.error, /Unknown facility/);
  });
});
