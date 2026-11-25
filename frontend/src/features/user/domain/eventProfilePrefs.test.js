/**
 * Run: node --test frontend/src/features/user/domain/eventProfilePrefs.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickEventProfilePrefs } from './eventProfilePrefs.js';

describe('pickEventProfilePrefs', () => {
  it('reads profile event prefs for registration defaults', () => {
    assert.deepEqual(
      pickEventProfilePrefs({
        eventTranslation: 'tamil',
        eventYourCity: 'CHENNAI',
        eventLevel: 'PC',
      }),
      {
        eventTranslation: 'TAMIL',
        eventYourCity: 'CHENNAI',
        eventLevel: 'PC',
      },
    );
  });

  it('keeps a catalog role that was not in the old fixed list', () => {
    assert.equal(
      pickEventProfilePrefs({ eventLevel: 'world team' }).eventLevel,
      'WORLD TEAM',
    );
  });
});
