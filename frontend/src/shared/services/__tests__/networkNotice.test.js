/**
 * Run: node --test frontend/src/shared/services/__tests__/networkNotice.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  connectionQualityFromProbe,
  connectionQualityFromRadio,
  createNetworkTracker,
  isLikelyNetworkError,
  isNetworkNoticeMessage,
  isServerErrorStatus,
  userFacingNetworkMessage,
  NETWORK_FAILURE_MESSAGE,
  NETWORK_SERVER_MESSAGE,
  NETWORK_SLOW_MESSAGE,
  NETWORK_WAITING_MESSAGE,
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

describe('connection quality', () => {
  it('treats a weak radio as a slow link and a fast radio as fine', () => {
    assert.equal(connectionQualityFromRadio({ effectiveType: '2g' }), 'slow');
    assert.equal(connectionQualityFromRadio({ effectiveType: '4g', rtt: 80 }), 'ok');
    assert.equal(connectionQualityFromRadio(null), 'unknown');
  });

  it('treats a fast tiny response as a fine link and a 5xx as the server', () => {
    assert.equal(connectionQualityFromProbe({ elapsedMs: 200, status: 200 }), 'ok');
    assert.equal(connectionQualityFromProbe({ elapsedMs: 2200, status: 200 }), 'slow');
    assert.equal(connectionQualityFromProbe({ elapsedMs: 400, status: 503 }), 'ok');
    assert.equal(connectionQualityFromProbe({ elapsedMs: 4000, status: 0 }), 'slow');
    assert.equal(isServerErrorStatus(500), true);
    assert.equal(isServerErrorStatus(404), false);
  });
});

describe('createNetworkTracker', () => {
  function trackerWithTimers() {
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
    return { pending, tracker };
  }

  it('does not blame the network when the link is fine', () => {
    const { pending, tracker } = trackerWithTimers();
    const seen = [];
    tracker.subscribe((notice) => seen.push(notice));
    tracker.setConnectionQuality('ok');

    const done = tracker.trackApiRequest();
    assert.equal(tracker.getNotice(), null);
    pending[0]();
    assert.equal(tracker.getNotice()?.type, 'waiting');
    assert.equal(tracker.getNotice()?.message, NETWORK_WAITING_MESSAGE);
    done();
    assert.equal(tracker.getNotice(), null);
    assert.deepEqual(seen.map((n) => n?.type), ['waiting', undefined]);
  });

  it('shows a slow-connection banner only after the link measures slow', () => {
    const { pending, tracker } = trackerWithTimers();
    const done = tracker.trackApiRequest();
    pending[0]();
    assert.equal(tracker.getNotice(), null);
    tracker.setConnectionQuality('slow');
    assert.equal(tracker.getNotice()?.type, 'degraded');
    assert.equal(tracker.getNotice()?.message, NETWORK_SLOW_MESSAGE);
    done();
    assert.equal(tracker.getNotice(), null);
  });

  it('shows a failure message and does not let a finished request hide it', () => {
    const { tracker } = trackerWithTimers();
    const done = tracker.trackApiRequest();
    tracker.reportNetworkFailure();
    assert.equal(tracker.getNotice()?.message, NETWORK_FAILURE_MESSAGE);
    done();
    assert.equal(tracker.getNotice()?.type, 'failure');
    tracker.dismissFailure();
    assert.equal(tracker.getNotice(), null);
  });

  it('shows a server problem separately from a connection failure', () => {
    const { tracker } = trackerWithTimers();
    tracker.reportServerFailure();
    assert.equal(tracker.getNotice()?.type, 'server');
    assert.equal(tracker.getNotice()?.message, NETWORK_SERVER_MESSAGE);
    assert.equal(isNetworkNoticeMessage(NETWORK_SERVER_MESSAGE), true);
    tracker.dismissFailure();
    assert.equal(tracker.getNotice(), null);
  });
});
