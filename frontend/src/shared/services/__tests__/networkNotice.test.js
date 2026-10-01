/**
 * Run: node --test frontend/src/shared/services/__tests__/networkNotice.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createNetworkTracker,
  isLikelyNetworkError,
  isNetworkNoticeMessage,
  userFacingNetworkMessage,
  NETWORK_FAILURE_MESSAGE,
  NETWORK_SLOW_MESSAGE,
} from '../networkNotice.js';

describe('isLikelyNetworkError', () => {
  it('recognises transport failures and ignores screen aborts', () => {
    assert.equal(isLikelyNetworkError(new TypeError('Failed to fetch')), true);
    assert.equal(isLikelyNetworkError(new Error('Phone status check failed (0)')), true);
    assert.equal(isLikelyNetworkError(new Error('Request timeout - please check your internet connection')), true);
    const abort = new Error('The operation was aborted');
    abort.name = 'AbortError';
    assert.equal(isLikelyNetworkError(abort), false);
    assert.equal(isLikelyNetworkError(new Error('Name is required')), false);
  });
});

describe('userFacingNetworkMessage', () => {
  it('returns the network sentence only for network failures', () => {
    assert.equal(
      userFacingNetworkMessage(new Error('Network Error')),
      NETWORK_FAILURE_MESSAGE,
    );
    assert.equal(userFacingNetworkMessage(new Error('User already exists')), '');
    assert.equal(isNetworkNoticeMessage(NETWORK_FAILURE_MESSAGE), true);
    assert.equal(isNetworkNoticeMessage('Name is required'), false);
  });
});

describe('createNetworkTracker', () => {
  it('tells the user when a request stays open, then clears when it finishes', () => {
    const pending = [];
    const tracker = createNetworkTracker({
      slowAfterMs: 50,
      setTimer: (fn) => {
        pending.push(fn);
        return pending.length;
      },
      clearTimer: () => {},
    });
    const seen = [];
    tracker.subscribe((notice) => seen.push(notice));

    const done = tracker.trackApiRequest();
    assert.equal(tracker.getNotice(), null);
    pending[0]();
    assert.equal(tracker.getNotice()?.message, NETWORK_SLOW_MESSAGE);
    done();
    assert.equal(tracker.getNotice(), null);
    assert.deepEqual(seen.map((n) => n?.type), ['slow', undefined]);
  });

  it('shows a failure message and does not let a finished request hide it', () => {
    const pending = [];
    const tracker = createNetworkTracker({
      slowAfterMs: 50,
      failureVisibleMs: 100,
      setTimer: (fn) => {
        pending.push(fn);
        return pending.length;
      },
      clearTimer: () => {},
    });
    const done = tracker.trackApiRequest();
    tracker.reportNetworkFailure();
    assert.equal(tracker.getNotice()?.message, NETWORK_FAILURE_MESSAGE);
    done();
    assert.equal(tracker.getNotice()?.type, 'failure');
    tracker.dismissFailure();
    assert.equal(tracker.getNotice(), null);
  });
});
