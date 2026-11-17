/**
 * Run: node --test frontend/src/features/payments/domain/entitlementSnapshot.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyEntitlementFreshness,
  blankEntitlement,
  reduceEntitlement,
  snapshotFromStored,
} from './entitlementSnapshot.js';

const PREMIUM = {
  premium: true,
  daysLeft: 31,
  expiresAt: '2026-12-17',
  expiresAtDisplay: '17 Dec 2026, 5:29 AM',
  showExpiryWarning: false,
};

describe('entitlement snapshot', () => {
  it('starts empty when nothing is cached', () => {
    const blank = blankEntitlement();
    assert.equal(blank.premium, false);
    assert.equal(blank.reportLoaded, false);
    assert.equal(reduceEntitlement(null, null).write, false);
  });

  it('keeps a saved Premium row that has no trial fields', () => {
    const snap = snapshotFromStored(PREMIUM);
    assert.equal(snap.premium, true);
    assert.equal(snap.daysLeft, 31);
    assert.equal(snap.access, 'premium');
    assert.equal(snap.canSeeReportDetails, true);
    assert.equal(snap.canUseHostTools, true);
  });

  it('keeps Premium when the server lookup is not confirmed', () => {
    const next = reduceEntitlement(PREMIUM, {
      entitlementPacket: true,
      premiumConfirmed: false,
      reportConfirmed: false,
    });
    assert.equal(next.write, false);
    assert.equal(next.status.premium, true);
    assert.equal(next.status.daysLeft, 31);
  });

  it('drops Premium when the server confirms expiry', () => {
    const next = reduceEntitlement(PREMIUM, {
      entitlementPacket: true,
      premiumConfirmed: true,
      premium: {
        premium: false,
        daysLeft: 0,
        expiresAt: '2026-11-01',
        expiresAtDisplay: '1 Nov 2026, 11:59 PM',
        showExpiryWarning: false,
      },
      reportConfirmed: true,
      report: { access: 'ended', daysLeft: 0, canSeeDetails: false },
    });
    assert.equal(next.write, true);
    assert.equal(next.status.premium, false);
    assert.equal(next.status.expiresAt, '2026-11-01');
    assert.equal(next.status.access, 'ended');
    assert.equal(next.status.canSeeReportDetails, false);
    assert.equal(next.status.canUseHostTools, false);
  });

  it('keeps a trial when the report check cannot be reached', () => {
    const trial = reduceEntitlement(blankEntitlement(), {
      entitlementPacket: true,
      premiumConfirmed: true,
      premium: { premium: false, daysLeft: null, expiresAt: null, showExpiryWarning: false },
      reportConfirmed: true,
      report: {
        access: 'trial',
        daysLeft: 12,
        canSeeDetails: true,
        expiresAtDisplay: '28 Nov 2026, 12:00 AM',
      },
    }).status;
    const kept = reduceEntitlement(trial, {
      entitlementPacket: true,
      premiumConfirmed: false,
      reportConfirmed: false,
    });
    assert.equal(kept.write, false);
    assert.equal(kept.status.access, 'trial');
    assert.equal(kept.status.trialDaysLeft, 12);
    assert.equal(kept.status.canUseHostTools, true);
  });

  it('does not let one member snapshot replace another', () => {
    const member = snapshotFromStored(PREMIUM);
    const other = snapshotFromStored(null);
    assert.equal(member.premium, true);
    assert.equal(other.premium, false);
  });

  it('hides Premium after the server expiry without deleting the stored row', () => {
    const stored = {
      ...PREMIUM,
      expiresAt: '2026-11-17',
      confirmedAt: Date.parse('2026-11-17T08:00:00+05:30'),
      reportLoaded: true,
      access: 'premium',
    };
    const before = applyEntitlementFreshness(stored, Date.parse('2026-11-17T12:00:00+05:30'));
    const after = applyEntitlementFreshness(stored, Date.parse('2026-11-18T00:00:00+05:30'));
    assert.equal(before.premium, true);
    assert.equal(after.premium, false);
    assert.equal(after.stale, true);
    assert.equal(stored.premium, true);
  });

  it('lets a confirmed Premium answer unlock both gated features', () => {
    const next = reduceEntitlement(blankEntitlement(), {
      entitlementPacket: true,
      premiumConfirmed: true,
      premium: PREMIUM,
      reportConfirmed: true,
      report: { access: 'none', daysLeft: null, canSeeDetails: false },
    });
    assert.equal(next.status.access, 'premium');
    assert.equal(next.status.canSeeReportDetails, true);
    assert.equal(next.status.canUseHostTools, true);
  });
});
