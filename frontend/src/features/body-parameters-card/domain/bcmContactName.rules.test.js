/**
 * bcmContactName.rules.test.js
 * Run: node --test frontend/src/features/body-parameters-card/domain/bcmContactName.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatBcmContactDate,
  abbreviateVenue,
  buildBcmContactDisplayName,
} from './bcmContactName.rules.js';

describe('formatBcmContactDate', () => {
  it('formats ISO date as yy/mm/dd', () => {
    assert.equal(formatBcmContactDate('2026-08-19'), '26/08/19');
  });
});

describe('abbreviateVenue', () => {
  it('builds initials for multi-word venues', () => {
    assert.equal(abbreviateVenue('St.louis church'), 'slc');
    assert.equal(abbreviateVenue('St louis church'), 'slc');
  });

  it('keeps a single token lowercased', () => {
    assert.equal(abbreviateVenue('adyar'), 'adyar');
    assert.equal(abbreviateVenue('SLC'), 'slc');
  });
});

describe('buildBcmContactDisplayName', () => {
  it('uses short venue initials', () => {
    assert.equal(
      buildBcmContactDisplayName({
        name: 'ADHITYA',
        venue: 'St.louis church',
        recordedDate: '2026-08-19',
      }),
      'ADHITYA slc 26/08/19',
    );
  });

  it('keeps single-word venue', () => {
    assert.equal(
      buildBcmContactDisplayName({
        name: 'ADHITYA',
        venue: 'adyar',
        recordedDate: '2026-08-19',
      }),
      'ADHITYA adyar 26/08/19',
    );
  });

  it('omits empty venue', () => {
    assert.equal(
      buildBcmContactDisplayName({
        name: 'ADHITYA',
        venue: '',
        recordedDate: '2026-08-19',
      }),
      'ADHITYA 26/08/19',
    );
  });
});
