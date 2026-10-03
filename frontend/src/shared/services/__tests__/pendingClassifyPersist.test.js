/**
 * Deferred pendingClassifyCapture must not rewrite after Cancel.
 * Run: node --test frontend/src/shared/services/__tests__/pendingClassifyPersist.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  isClassifyCaptureNavLocked,
  shouldPersistPendingClassifyCapture,
} from '../sessionStorage.js';

describe('isClassifyCaptureNavLocked', () => {
  it('locks while Manual Entry / Classify UI is open (race before pending write)', () => {
    assert.equal(isClassifyCaptureNavLocked(true), true);
  });

  it('does not lock when UI is closed and no pending capture', () => {
    assert.equal(isClassifyCaptureNavLocked(false), false);
  });
});

describe('shouldPersistPendingClassifyCapture', () => {
  it('allows write while classify session is still active', () => {
    assert.equal(
      shouldPersistPendingClassifyCapture(
        { clientKey: 'tok-1', abandoned: false },
        'tok-1',
      ),
      true,
    );
  });

  it('skips write after Cancel/leave for the same session', () => {
    assert.equal(
      shouldPersistPendingClassifyCapture(
        { clientKey: 'tok-1', abandoned: true },
        'tok-1',
      ),
      false,
    );
  });

  it('allows write when abandoned flag is for a different session', () => {
    assert.equal(
      shouldPersistPendingClassifyCapture(
        { clientKey: 'old-tok', abandoned: true },
        'tok-2',
      ),
      true,
    );
  });

  it('rejects missing client key', () => {
    assert.equal(shouldPersistPendingClassifyCapture(null, null), false);
    assert.equal(shouldPersistPendingClassifyCapture(null, ''), false);
  });
});
