/**
 * validateUpdateProfile accepts email or userId (phone / BCM photo save).
 * Run: node --test backend/features/user/__tests__/updateProfileIdentity.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateUpdateProfile } from '../user.validators.js';
import { ValidationError } from '../../../shared/lib/ValidationError.js';

describe('validateUpdateProfile identity', () => {
  it('accepts email only (legacy)', () => {
    const parsed = validateUpdateProfile({ email: 'User@Example.com', name: 'Ada' });
    assert.equal(parsed.email, 'user@example.com');
    assert.equal(parsed.userId, null);
  });

  it('accepts userId only (phone / BCM)', () => {
    const parsed = validateUpdateProfile({
      userId: 42,
      transformationPhotos: { left: 'data:image/jpeg;base64,abc' },
    });
    assert.equal(parsed.email, null);
    assert.equal(parsed.userId, 42);
    assert.equal(parsed.transformationPhotos.left, 'data:image/jpeg;base64,abc');
  });

  it('rejects when both email and userId are missing', () => {
    assert.throws(
      () => validateUpdateProfile({ name: 'Ada' }),
      (err) => err instanceof ValidationError && err.status === 400,
    );
  });
});
