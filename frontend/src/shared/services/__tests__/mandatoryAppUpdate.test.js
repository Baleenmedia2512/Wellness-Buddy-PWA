/**
 * Run: node --test frontend/src/shared/services/__tests__/mandatoryAppUpdate.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldRunMandatoryUpdate,
  shouldAutoStartPlayOnForeground,
  nextPhaseFromNativeEvent,
  startMandatoryUpdateFlow,
} from '../mandatoryAppUpdate.js';

describe('shouldRunMandatoryUpdate', () => {
  it('returns false when not blocked', () => {
    assert.equal(shouldRunMandatoryUpdate({ blocked: false, status: 'update_required' }), false);
  });

  it('returns false for optional recommended updates', () => {
    assert.equal(shouldRunMandatoryUpdate({ blocked: false, status: 'update_recommended' }), false);
  });

  it('returns false on web even when update_required', () => {
    // Capacitor.isNativePlatform() is false in Node test runtime
    assert.equal(shouldRunMandatoryUpdate({ blocked: true, status: 'update_required' }), false);
  });
});

describe('shouldAutoStartPlayOnForeground', () => {
  it('returns true only when still required and idle-like', () => {
    assert.equal(
      shouldAutoStartPlayOnForeground({ status: 'update_required', phase: 'idle' }),
      true,
    );
  });

  it('returns false after cancel so Play does not loop', () => {
    assert.equal(
      shouldAutoStartPlayOnForeground({ status: 'update_required', phase: 'awaiting_retry' }),
      false,
    );
  });

  it('returns false while Play flow is already open', () => {
    assert.equal(
      shouldAutoStartPlayOnForeground({ status: 'update_required', phase: 'play_flow' }),
      false,
    );
    assert.equal(
      shouldAutoStartPlayOnForeground({ status: 'update_required', phase: 'starting' }),
      false,
    );
  });

  it('returns false when Play fallback is shown', () => {
    assert.equal(
      shouldAutoStartPlayOnForeground({ status: 'update_required', phase: 'play_unavailable' }),
      false,
    );
  });

  it('returns false when policy is ok', () => {
    assert.equal(
      shouldAutoStartPlayOnForeground({ status: 'ok', phase: 'idle' }),
      false,
    );
  });
});

describe('nextPhaseFromNativeEvent', () => {
  it('moves to play_flow when update is available', () => {
    assert.equal(nextPhaseFromNativeEvent('updateAvailable', 'idle'), 'play_flow');
  });

  it('marks play unavailable when Play has no update', () => {
    assert.equal(nextPhaseFromNativeEvent('updateNotAvailable', 'starting'), 'play_unavailable');
  });

  it('returns installed after successful install', () => {
    assert.equal(nextPhaseFromNativeEvent('updateInstalled', 'play_flow'), 'installed');
  });

  it('waits for explicit retry after user cancel', () => {
    assert.equal(nextPhaseFromNativeEvent('updateCanceled', 'play_flow'), 'awaiting_retry');
  });

  it('marks play unavailable after update failure', () => {
    assert.equal(nextPhaseFromNativeEvent('updateFailed', 'play_flow'), 'play_unavailable');
  });
});

describe('startMandatoryUpdateFlow', () => {
  it('starts Android mandatory update via injected dependency', async () => {
    let called = false;
    const result = await startMandatoryUpdateFlow({
      platform: 'android',
      startMandatoryUpdate: async () => {
        called = true;
      },
    });
    assert.equal(result, 'play_started');
    assert.equal(called, true);
  });

  it('returns ios_store_only for iOS', async () => {
    const result = await startMandatoryUpdateFlow({ platform: 'ios' });
    assert.equal(result, 'ios_store_only');
  });

  it('skips unknown platforms', async () => {
    const result = await startMandatoryUpdateFlow({ platform: null });
    assert.equal(result, 'skipped');
  });
});
