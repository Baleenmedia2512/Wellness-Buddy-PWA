/**
 * Run: node --test backend/features/nutrition-centers/domain/__tests__/centreCompleteness.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isCentreProfileComplete,
  missingCentreProfileFields,
} from '../centreCompleteness.rules.js';
import { defaultOpeningHours } from '../centreListing.rules.js';

const hours = defaultOpeningHours();
const facilities = ['parking', 'wifi'];
const photos = ['entrance', 'interior', 'wellness_activity'];

describe('missingCentreProfileFields', () => {
  it('returns empty when code, hours, facilities, and photos are present', () => {
    assert.deepEqual(missingCentreProfileFields({
      centerCode: 'RS1024',
      openingHours: hours,
      facilities,
      photoCategories: photos,
    }), []);
    assert.equal(isCentreProfileComplete({
      centerCode: 'RS1024',
      openingHours: hours,
      facilities,
      photoCategories: photos,
    }), true);
  });

  it('lists every required gap for a legacy empty club', () => {
    const missing = missingCentreProfileFields({
      centerCode: null,
      openingHours: null,
      facilities: [],
      photoCategories: [],
    });
    assert.deepEqual(missing.map((item) => item.key), [
      'centerCode',
      'openingHours',
      'facilities',
      'photos.entrance',
      'photos.interior',
      'photos.wellness_activity',
    ]);
    assert.equal(isCentreProfileComplete({
      centerCode: null,
      openingHours: null,
      facilities: [],
      photoCategories: [],
    }), false);
  });

  it('only reports the missing photo slots', () => {
    const missing = missingCentreProfileFields({
      centerCode: 'RS9',
      openingHours: hours,
      facilities,
      photoCategories: ['entrance'],
    });
    assert.deepEqual(missing.map((item) => item.key), [
      'photos.interior',
      'photos.wellness_activity',
    ]);
  });
});
