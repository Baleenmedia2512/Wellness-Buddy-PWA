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
  it('formats ISO date as yymmdd', () => {
    assert.equal(formatBcmContactDate('2026-08-20'), '260820');
  });

  it('formats DD/MM/YYYY as yymmdd', () => {
    assert.equal(formatBcmContactDate('20/08/2026'), '260820');
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
  it('joins name + venueShort + yymmdd with no space before date', () => {
    assert.equal(
      buildBcmContactDisplayName({
        name: 'praveen',
        venue: 'st.louis church',
        recordedDate: '2026-08-20',
      }),
      'praveen slc260820',
    );
  });

  it('keeps single-word venue glued to date', () => {
    assert.equal(
      buildBcmContactDisplayName({
        name: 'ADHITYA',
        venue: 'adyar',
        recordedDate: '2026-08-19',
      }),
      'ADHITYA adyar260819',
    );
  });

  it('omits empty venue but keeps date', () => {
    assert.equal(
      buildBcmContactDisplayName({
        name: 'praveen',
        venue: '',
        recordedDate: '2026-08-20',
      }),
      'praveen 260820',
    );
  });
});
