/**
 * Run: node --test backend/features/user/__tests__/communityPosition.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  COMMUNITY_POSITION_OTP_MIN_APP_VERSION,
  LEGACY_COMMUNITY_POSITION_CODES,
  POSITION_ALREADY_HELD,
  POSITION_REQUEST,
  POSITION_UNKNOWN,
  canAttemptCommunityPositionOtp,
  classifyCommunityPositionRequest,
  communityPositionOtpExpiresAt,
  isCommunityPositionOtpExpired,
  normalizeCommunityPositionDraft,
  normalizeFeatureKey,
  positionMatchesFeature,
  shouldDeferCommunityPositionToOtp,
} from '../domain/communityPosition.rules.js';

describe('shouldDeferCommunityPositionToOtp', () => {
  it('stays on profile save when the flag is off', () => {
    assert.equal(
      shouldDeferCommunityPositionToOtp({ flagEnabled: false, appVersion: '3.5.6' }),
      false,
    );
  });

  it('keeps legacy save for 3.5.5 and missing versions', () => {
    assert.equal(
      shouldDeferCommunityPositionToOtp({ flagEnabled: true, appVersion: '3.5.5' }),
      false,
    );
    assert.equal(
      shouldDeferCommunityPositionToOtp({ flagEnabled: true, appVersion: null }),
      false,
    );
  });

  it('uses coach OTP from 3.5.6', () => {
    assert.equal(COMMUNITY_POSITION_OTP_MIN_APP_VERSION, '3.5.6');
    assert.equal(
      shouldDeferCommunityPositionToOtp({ flagEnabled: true, appVersion: '3.5.6' }),
      true,
    );
  });
});

describe('classifyCommunityPositionRequest', () => {
  const activeCodes = ['PC', 'ASSOCIATE', 'MILL TEAM'];

  it('asks the coach when the role is in the catalog and not already held', () => {
    const result = classifyCommunityPositionRequest({
      requestedCode: 'mill team',
      confirmedCode: 'PC',
      activeCodes,
    });
    assert.equal(result.ok, true);
    assert.equal(result.status, POSITION_REQUEST);
    assert.equal(result.code, 'MILL TEAM');
  });

  it('does not send another code when the member already holds the role', () => {
    const result = classifyCommunityPositionRequest({
      requestedCode: 'PC',
      confirmedCode: 'pc',
      activeCodes,
    });
    assert.equal(result.ok, false);
    assert.equal(result.status, POSITION_ALREADY_HELD);
  });

  it('rejects a role that is not in the catalog', () => {
    const result = classifyCommunityPositionRequest({
      requestedCode: 'WORLD TEAM',
      confirmedCode: '',
      activeCodes,
    });
    assert.equal(result.status, POSITION_UNKNOWN);
  });
});

describe('normalizeCommunityPositionDraft', () => {
  it('accepts a new role with its own feature key', () => {
    const result = normalizeCommunityPositionDraft({
      code: 'world team',
      label: 'World Team',
      featureKey: 'World_Team',
      usageNote: 'Opens the world-team report.',
      sortOrder: 100,
    });
    assert.equal(result.ok, true);
    assert.equal(result.value.code, 'WORLD TEAM');
    assert.equal(result.value.featureKey, 'world-team');
    assert.equal(result.value.usageNote, 'Opens the world-team report.');
  });

  it('requires a usage note so the role is not an unlabeled dropdown value', () => {
    const result = normalizeCommunityPositionDraft({
      code: 'QT',
      featureKey: 'qt',
      usageNote: '   ',
    });
    assert.equal(result.ok, false);
  });
});

describe('positionMatchesFeature', () => {
  it('matches on feature key, not the display label', () => {
    assert.equal(
      positionMatchesFeature({ featureKey: 'mill-team', label: 'MILL TEAM' }, 'mill-team'),
      true,
    );
    assert.equal(positionMatchesFeature({ featureKey: 'pc' }, 'mill-team'), false);
  });
});

describe('OTP window', () => {
  it('expires after the stated hour count', () => {
    const start = new Date('2026-11-11T00:00:00.000Z');
    const exp = communityPositionOtpExpiresAt(start, 24);
    assert.equal(isCommunityPositionOtpExpired(exp, new Date('2026-11-12T00:00:01.000Z')), true);
    assert.equal(isCommunityPositionOtpExpired(exp, new Date('2026-11-11T12:00:00.000Z')), false);
  });

  it('stops after five tries', () => {
    assert.equal(canAttemptCommunityPositionOtp(4), true);
    assert.equal(canAttemptCommunityPositionOtp(5), false);
  });
});

describe('legacy codes', () => {
  it('keeps the roles already shipped on profile save', () => {
    assert.ok(LEGACY_COMMUNITY_POSITION_CODES.includes('2500 GET TEAM'));
    assert.equal(normalizeFeatureKey('2500 GET TEAM'), '2500-get-team');
  });
});
