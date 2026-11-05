/**
 * Run: node --test backend/features/user/domain/__tests__/eventProfilePrefs.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEventProfilePrefs } from '../eventProfilePrefs.rules.js';

describe('normalizeEventProfilePrefs', () => {
  it('normalises listed options and clears blanks', () => {
    assert.deepEqual(
      normalizeEventProfilePrefs({
        eventTranslation: 'tamil',
        eventYourCity: 'chennai',
        eventLevel: 'associate',
      }),
      {
        eventTranslation: 'TAMIL',
        eventYourCity: 'CHENNAI',
        eventLevel: 'ASSOCIATE',
      },
    );
    assert.deepEqual(
      normalizeEventProfilePrefs({
        eventTranslation: '',
        eventYourCity: 'NOT A CITY',
        eventLevel: undefined,
      }),
      {
        eventTranslation: null,
        eventYourCity: null,
        eventLevel: undefined,
      },
    );
  });
});
