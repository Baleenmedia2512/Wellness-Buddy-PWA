/**
 * searchSuggestions.test.js
 * Run: node --test frontend/src/features/body-parameters-card/domain/searchSuggestions.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildBpcSearchSuggestions,
  normalizeBpcSearchQuery,
} from './searchSuggestions.js';

describe('normalizeBpcSearchQuery', () => {
  it('trims and lowercases', () => {
    assert.equal(normalizeBpcSearchQuery('  Yo '), 'yo');
  });

  it('handles empty input', () => {
    assert.equal(normalizeBpcSearchQuery(''), '');
    assert.equal(normalizeBpcSearchQuery(null), '');
  });
});

describe('buildBpcSearchSuggestions', () => {
  const cards = [
    { id: 1, name: 'YASHEER', phoneNumber: '9000000001', locationName: 'Madurai' },
    { id: 2, name: 'Yogesh', phoneNumber: '9000000002', locationName: 'Chennai' },
    { id: 3, name: 'KABLIAN', phoneNumber: '9632587415', locationName: 'Tirunelveli' },
    { id: 4, name: 'RAMESH', phoneNumber: '1234567897', locationName: 'Coimbatore' },
    { id: 5, name: 'Bobby', phoneNumber: '9888777666', locationName: null },
    { id: 6, name: 'Abbey', phoneNumber: '9111222333', locationName: 'Salem' },
  ];

  it('returns empty when query is blank', () => {
    assert.deepEqual(buildBpcSearchSuggestions(cards, '  '), []);
  });

  it('is case-insensitive for single letter Y', () => {
    const lower = buildBpcSearchSuggestions(cards, 'y').map((s) => s.term);
    const upper = buildBpcSearchSuggestions(cards, 'Y').map((s) => s.term);
    assert.deepEqual(lower, upper);
    assert.ok(lower.includes('YASHEER'));
    assert.ok(lower.includes('Yogesh'));
  });

  it('lists prefix matches first for B', () => {
    const terms = buildBpcSearchSuggestions(cards, 'B').map((s) => s.term);
    assert.equal(terms[0], 'Bobby');
    assert.ok(terms.includes('KABLIAN') || terms.includes('Abbey'));
    assert.ok(terms.indexOf('Bobby') < terms.indexOf('Abbey'));
  });

  it('narrows as more characters are typed', () => {
    const y = buildBpcSearchSuggestions(cards, 'Y').map((s) => s.term);
    const yo = buildBpcSearchSuggestions(cards, 'Yo').map((s) => s.term);
    assert.ok(y.includes('YASHEER'));
    assert.ok(y.includes('Yogesh'));
    assert.deepEqual(yo, ['Yogesh']);
  });

  it('matches phone prefix', () => {
    const terms = buildBpcSearchSuggestions(cards, '963').map((s) => s.term);
    assert.deepEqual(terms, ['9632587415']);
  });

  it('matches venue prefix', () => {
    const terms = buildBpcSearchSuggestions(cards, 'Mad').map((s) => s.term);
    assert.ok(terms.includes('Madurai'));
  });

  it('respects limit', () => {
    assert.equal(buildBpcSearchSuggestions(cards, 'a', 1).length, 1);
  });
});
