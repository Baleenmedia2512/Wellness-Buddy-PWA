/**
 * Unit tests for sponsor visibility rules.
 * Run: node --test backend/features/user/domain/sponsorVisibility.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  hasVerifiedSponsorEmail,
  hasSponsorCommunityId,
  isEligibleSponsor,
} from './sponsorVisibility.rules.js';

describe('hasVerifiedSponsorEmail', () => {
  it('accepts a real email on Email or email', () => {
    assert.equal(hasVerifiedSponsorEmail({ Email: 'a@b.com' }), true);
    assert.equal(hasVerifiedSponsorEmail({ email: 'a@b.com' }), true);
  });

  it('rejects missing or empty email', () => {
    assert.equal(hasVerifiedSponsorEmail({}), false);
    assert.equal(hasVerifiedSponsorEmail({ Email: null }), false);
    assert.equal(hasVerifiedSponsorEmail({ Email: '' }), false);
    assert.equal(hasVerifiedSponsorEmail({ Email: '   ' }), false);
  });

  it('rejects values without @', () => {
    assert.equal(hasVerifiedSponsorEmail({ Email: 'not-an-email' }), false);
  });
});

describe('isEligibleSponsor', () => {
  it('accepts user with verified email (with or without Community ID)', () => {
    assert.equal(isEligibleSponsor({
      Email: 'a@b.com',
      CommunityId: 'W112072XXX',
    }), true);
    assert.equal(isEligibleSponsor({
      email: 'a@b.com',
      communityId: ' W112 ',
    }), true);
    assert.equal(isEligibleSponsor({ Email: 'a@b.com' }), true);
    assert.equal(isEligibleSponsor({ Email: 'a@b.com', CommunityId: null }), true);
    assert.equal(isEligibleSponsor({ Email: 'a@b.com', CommunityId: '   ' }), true);
  });

  it('rejects user without a verified email', () => {
    assert.equal(isEligibleSponsor({}), false);
    assert.equal(isEligibleSponsor({ Email: null }), false);
    assert.equal(isEligibleSponsor({ Email: '' }), false);
    assert.equal(isEligibleSponsor({ CommunityId: 'W112072XXX' }), false);
    assert.equal(isEligibleSponsor({ Email: 'not-an-email', CommunityId: 'W112072XXX' }), false);
  });

  it('hasSponsorCommunityId ignores blank values', () => {
    assert.equal(hasSponsorCommunityId({ CommunityId: 'AB12' }), true);
    assert.equal(hasSponsorCommunityId({ communityId: '' }), false);
    assert.equal(hasSponsorCommunityId({}), false);
  });
});
