/**
 * Confirmed profile OTP values survive a stale Profile read.
 * Run: node --test frontend/src/features/user/domain/profileOtpHold.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  overlayProfileOtpConfirmation,
  rememberProfileOtpConfirmation,
} from './profileOtpHold.js';

function memoryStorage() {
  const bag = new Map();
  return {
    getItem: (key) => (bag.has(key) ? bag.get(key) : null),
    setItem: (key, value) => { bag.set(key, String(value)); },
    removeItem: (key) => { bag.delete(key); },
  };
}

describe('profile OTP confirmation hold', () => {
  it('keeps the Community ID just confirmed when Profile still has the previous one', () => {
    const storage = memoryStorage();
    rememberProfileOtpConfirmation(12, {
      communityId: 'W112SX',
      teamSeat: 'sponsor',
    }, storage);

    const painted = overlayProfileOtpConfirmation({
      communityId: 'WAAADAA',
      teamSeat: null,
      communityIdRequest: { communityId: 'W112SX', status: 'pending' },
    }, 12, storage);

    assert.equal(painted.communityId, 'W112SX');
    assert.equal(painted.teamSeat, 'sponsor');
    assert.equal(painted.communityIdRequest, null);
  });

  it('drops the hold once Profile returns that Community ID', () => {
    const storage = memoryStorage();
    rememberProfileOtpConfirmation(12, { communityId: 'W112SX', teamSeat: 'sponsor' }, storage);

    const painted = overlayProfileOtpConfirmation({
      communityId: 'W112SX',
      teamSeat: 'sponsor',
      communityIdRequest: null,
    }, 12, storage);

    assert.equal(painted.communityId, 'W112SX');
    assert.equal(storage.getItem('wv.profileOtpHold.12'), null);
  });

  it('keeps a new height and email when Profile still has the old ones', () => {
    const storage = memoryStorage();
    rememberProfileOtpConfirmation(4, { height: '168', email: 'new@example.com' }, storage);

    const painted = overlayProfileOtpConfirmation({
      height: 170,
      email: 'old@example.com',
    }, 4, storage);

    assert.equal(painted.height, '168');
    assert.equal(painted.email, 'new@example.com');
  });

  it('keeps the role just confirmed when Profile still has the previous role', () => {
    const storage = memoryStorage();
    rememberProfileOtpConfirmation(9, { eventLevel: 'SV' }, storage);

    const painted = overlayProfileOtpConfirmation({
      eventLevel: 'PC',
      communityPositionRequest: { status: 'pending', positionCode: 'SV' },
    }, 9, storage);

    assert.equal(painted.eventLevel, 'SV');
    assert.equal(painted.communityPositionRequest, null);
  });
});
