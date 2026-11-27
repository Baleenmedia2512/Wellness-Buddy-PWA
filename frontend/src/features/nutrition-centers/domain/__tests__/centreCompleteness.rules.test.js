/**
 * Run: node --test frontend/src/features/nutrition-centers/domain/__tests__/centreCompleteness.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  firstIncompleteOwnedCentre,
  isCentreProfileComplete,
  missingCentreProfileFields,
} from '../centreCompleteness.rules.js';
import { defaultOpeningHours, simpleFormToOpeningHours } from '../centreListing.rules.js';

const hours = simpleFormToOpeningHours({
  workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'],
  openingTime: '05:30',
  closingTime: '21:30',
});
const facilities = ['parking'];
const photos = ['entrance', 'interior', 'wellness_activity'];

describe('isCentreProfileComplete', () => {
  it('trusts the list API profileComplete flag', () => {
    assert.equal(isCentreProfileComplete({ profileComplete: true }), true);
    assert.equal(isCentreProfileComplete({ profileComplete: false }), false);
  });

  it('computes completeness from fields when no flag is set', () => {
    assert.equal(isCentreProfileComplete({
      center_code: 'RS1',
      openingHours: hours,
      facilities,
      photoCategories: photos,
    }), true);
    assert.equal(isCentreProfileComplete({
      center_code: null,
      openingHours: defaultOpeningHours(),
      facilities: [],
      photoCategories: [],
    }), false);
  });
});

describe('firstIncompleteOwnedCentre', () => {
  it('returns the first owned incomplete centre only', () => {
    const centers = [
      { id: 1, owner_user_id: 9, profileComplete: true },
      { id: 2, owner_user_id: 8, profileComplete: false },
      { id: 3, owner_user_id: 9, profileComplete: false },
    ];
    assert.equal(firstIncompleteOwnedCentre(centers, 9)?.id, 3);
    assert.equal(firstIncompleteOwnedCentre(centers, 7), null);
  });
});

describe('missingCentreProfileFields', () => {
  it('reports photo gaps when categories are supplied', () => {
    const missing = missingCentreProfileFields({
      center_code: 'RS2',
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
