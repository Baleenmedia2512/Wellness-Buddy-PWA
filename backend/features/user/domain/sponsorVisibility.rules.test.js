/**
 * Unit tests for sponsor visibility rules.
 * Run: node --test backend/features/user/domain/sponsorVisibility.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { hasVerifiedSponsorEmail } from './sponsorVisibility.rules.js';

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
