/**
 * Unit tests for Community ID validation on profile updates.
 * Run: node --test backend/features/user/__tests__/communityId.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMUNITY_ID_MAX_LENGTH,
  normalizeCommunityId,
  validateCommunityId,
  validateUpdateProfile,
} from '../user.validators.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';

describe('normalizeCommunityId', () => {
  it('returns null for empty or whitespace-only values', () => {
    assert.equal(normalizeCommunityId(''), null);
    assert.equal(normalizeCommunityId('   '), null);
    assert.equal(normalizeCommunityId(null), null);
    assert.equal(normalizeCommunityId(undefined), null);
  });

  it('trims surrounding whitespace', () => {
    assert.equal(normalizeCommunityId('  124141244  '), '124141244');
  });
});

describe('validateCommunityId', () => {
  it('accepts alphanumeric values up to max length', () => {
    const result = validateCommunityId('124141244');
    assert.equal(result.valid, true);
    assert.equal(result.value, '124141244');
  });

  it('accepts letters and numbers mixed', () => {
    const result = validateCommunityId('ABC123xyz');
    assert.equal(result.valid, true);
    assert.equal(result.value, 'ABC123xyz');
  });

  it('rejects values longer than max length', () => {
    const tooLong = 'a'.repeat(COMMUNITY_ID_MAX_LENGTH + 1);
    const result = validateCommunityId(tooLong);
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

describe('validateUpdateProfile communityId', () => {
  const baseBody = {
    email: 'user@example.com',
    name: 'Test User',
  };

  it('passes through valid communityId', () => {
    const parsed = validateUpdateProfile({ ...baseBody, communityId: '124141244' });
    assert.equal(parsed.communityId, '124141244');
  });

  it('accepts community_id alias', () => {
    const parsed = validateUpdateProfile({ ...baseBody, community_id: 'ABC999' });
    assert.equal(parsed.communityId, 'ABC999');
  });

  it('normalizes null to clear communityId', () => {
    const parsed = validateUpdateProfile({ ...baseBody, communityId: null });
    assert.equal(parsed.communityId, null);
  });

  it('throws ValidationError for invalid communityId', () => {
    assert.throws(
      () => validateUpdateProfile({ ...baseBody, communityId: 'bad id!' }),
      (err) => err instanceof ValidationError && err.status === 400,
    );
  });

  it('omits communityId when not provided', () => {
    const parsed = validateUpdateProfile(baseBody);
    assert.equal(parsed.communityId, undefined);
  });
});
