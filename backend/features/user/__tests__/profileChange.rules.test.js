/**
 * Unit tests — unified profile-change sponsor OTP domain rules (§5.1).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFILE_CHANGE_OTP_MIN_APP_VERSION,
  classifyProfileGatedChanges,
  isUnifiedProfileChangeOtpActive,
  stripGatedChangesFromInput,
} from '../domain/profileChange.rules.js';

describe('profileChange.rules', () => {
  it('activates only for flag + app >= 3.5.8', () => {
    assert.equal(isUnifiedProfileChangeOtpActive({
      flagEnabled: true,
      appVersion: '3.5.8',
    }), true);
    assert.equal(isUnifiedProfileChangeOtpActive({
      flagEnabled: true,
      appVersion: '3.5.7',
    }), false);
    assert.equal(isUnifiedProfileChangeOtpActive({
      flagEnabled: true,
      appVersion: null,
    }), false);
    assert.equal(isUnifiedProfileChangeOtpActive({
      flagEnabled: false,
      appVersion: '3.5.8',
    }), false);
  });

  it('treats first fill as free and later change as OTP', () => {
    const first = classifyProfileGatedChanges({
      existing: { phoneNumber: null, height: null },
      incoming: { phoneNumber: '9876543210', height: 170 },
    });
    assert.equal(first.needsOtp, false);
    assert.deepEqual(Object.keys(first.firstFills).sort(), ['height', 'phoneNumber']);

    const change = classifyProfileGatedChanges({
      existing: { phoneNumber: '9876543210', height: 170 },
      incoming: { phoneNumber: '9999999999', height: 172 },
    });
    assert.equal(change.needsOtp, true);
    assert.deepEqual(change.changedKeys.sort(), ['height', 'phoneNumber']);
  });

  it('batches multiple gated changes into one OTP set', () => {
    const result = classifyProfileGatedChanges({
      existing: {
        phoneNumber: '111',
        aboutMe: 'old',
        professionalTitle: 'Coach',
        profileImage: true,
      },
      incoming: {
        phoneNumber: '222',
        aboutMe: 'new',
        professionalTitle: 'Coach',
        profileImage: 'data:image/jpeg;base64,abc',
      },
    });
    assert.equal(result.needsOtp, true);
    assert.deepEqual(result.changedKeys.sort(), ['aboutMe', 'phoneNumber', 'profileImage']);
    assert.equal('professionalTitle' in result.changes, false);
  });

  it('strips only change keys from an update input', () => {
    const stripped = stripGatedChangesFromInput({
      phoneNumber: '222',
      height: 172,
      name: 'Keep me',
      profileIntro: { aboutMe: 'new', qualification: 'keep' },
    }, ['phoneNumber', 'aboutMe']);
    assert.equal(stripped.phoneNumber, undefined);
    assert.equal(stripped.height, 172);
    assert.equal(stripped.name, 'Keep me');
    assert.equal(stripped.profileIntro.aboutMe, undefined);
    assert.equal(stripped.profileIntro.qualification, 'keep');
  });

  it('documents min app version for legacy dual-path', () => {
    assert.equal(PROFILE_CHANGE_OTP_MIN_APP_VERSION, '3.5.8');
  });
});
