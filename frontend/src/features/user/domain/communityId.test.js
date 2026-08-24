/**
 * Unit tests for Community ID input rules on Personal Details.
 * Run: node --test frontend/src/features/user/domain/communityId.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMUNITY_ID_MAX_LENGTH,
  normalizeCommunityId,
  sanitizeCommunityIdInput,
  validateCommunityId,
} from './communityId.js';

describe('normalizeCommunityId', () => {
  it('returns null for empty or whitespace-only values', () => {
    assert.equal(normalizeCommunityId(''), null);
    assert.equal(normalizeCommunityId('   '), null);
    assert.equal(normalizeCommunityId(null), null);
    assert.equal(normalizeCommunityId(undefined), null);
  });

  it('trims surrounding whitespace', () => {
    assert.equal(normalizeCommunityId('  WB12345  '), 'WB12345');
  });
});

describe('validateCommunityId', () => {
  it('accepts alphanumeric values', () => {
    const result = validateCommunityId('WB12345');
    assert.equal(result.valid, true);
    assert.equal(result.value, 'WB12345');
  });

  it('rejects values longer than max length', () => {
    const result = validateCommunityId('a'.repeat(COMMUNITY_ID_MAX_LENGTH + 1));
    assert.equal(result.valid, false);
    assert.match(result.message, /at most 100 characters/i);
  });

  it('rejects special characters', () => {
    const result = validateCommunityId('124-141');
    assert.equal(result.valid, false);
    assert.match(result.message, /letters and numbers/i);
  });

  it('treats cleared input as null', () => {
    const result = validateCommunityId('   ');
    assert.equal(result.valid, true);
    assert.equal(result.value, null);
  });
});

describe('sanitizeCommunityIdInput', () => {
  it('strips non-alphanumeric characters and caps length', () => {
    assert.equal(sanitizeCommunityIdInput('WB-12 345!'), 'WB12345');
    assert.equal(
      sanitizeCommunityIdInput('a'.repeat(COMMUNITY_ID_MAX_LENGTH + 5)).length,
      COMMUNITY_ID_MAX_LENGTH,
    );
  });
});
