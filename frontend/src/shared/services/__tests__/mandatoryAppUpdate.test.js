/**
 * Run: node --test frontend/src/shared/services/__tests__/mandatoryAppUpdate.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  shouldRunMandatoryUpdate,
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

  it('keeps play_flow on user cancel so native layer can retry', () => {
    assert.equal(nextPhaseFromNativeEvent('updateCanceled', 'play_flow'), 'play_flow');
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
