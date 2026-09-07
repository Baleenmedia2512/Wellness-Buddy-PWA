/**
 * Run: node --test frontend/src/shared/services/__tests__/numericDbUserId.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseNumericDbUserId, readNumericDbUserId } from '../numericDbUserId.js';

describe('parseNumericDbUserId', () => {
  it('accepts positive integer strings', () => {
    assert.equal(parseNumericDbUserId(42), 42);
    assert.equal(parseNumericDbUserId('42'), 42);
  });

  it('rejects Firebase-style uids and empties', () => {
    assert.equal(parseNumericDbUserId(null), null);
    assert.equal(parseNumericDbUserId(''), null);
    assert.equal(parseNumericDbUserId('abcXYZ123'), null);
    assert.equal(parseNumericDbUserId('123abc'), null);
    assert.equal(parseNumericDbUserId('0'), null);
  });
});

describe('readNumericDbUserId', () => {
  it('skips Firebase uid on user.id and uses UserId / session', () => {
    assert.equal(
      readNumericDbUserId({ id: 'firebaseUidHere', UserId: 88 }, null),
      88,
    );
    assert.equal(
      readNumericDbUserId({ id: 'firebaseUidHere' }, '91'),
      91,
    );
  });
});
