/**
 * Run: node --test backend/features/payments/__tests__/report-trial.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarDaysBetween,
  reportTrialWindow,
  resolveReportAccess,
  canSeeReportDetails,
  shouldGateReportDetails,
  trialStartIstYmd,
  REPORT_TRIAL_LENGTH_DAYS,
} from '../domain/report-trial.rules.js';

describe('report trial window', () => {
  it('counts the start date as day 1 with 14 days left', () => {
    assert.equal(REPORT_TRIAL_LENGTH_DAYS, 14);
    assert.equal(calendarDaysBetween('2026-11-05', '2026-11-05'), 0);
    assert.deepEqual(reportTrialWindow('2026-11-05', '2026-11-05'), {
      active: true,
      daysLeft: 14,
      ended: false,
    });
  });

  it('keeps details through day 14 and locks on the next India date', () => {
    assert.deepEqual(reportTrialWindow('2026-11-05', '2026-11-18'), {
      active: true,
      daysLeft: 1,
      ended: false,
    });
    assert.deepEqual(reportTrialWindow('2026-11-05', '2026-11-19'), {
      active: false,
      daysLeft: 0,
      ended: true,
    });
  });

  it('does not restart when the saved start is already in the past', () => {
    const access = resolveReportAccess({
      premium: false,
      startYmd: '2026-11-05',
      todayYmd: '2026-11-19',
    });
    assert.deepEqual(access, { access: 'ended', daysLeft: 0 });
    assert.equal(canSeeReportDetails(access.access), false);
  });

  it('opens details for a paid member and for an active trial', () => {
    assert.equal(canSeeReportDetails('premium'), true);
    assert.equal(canSeeReportDetails('trial'), true);
    assert.equal(canSeeReportDetails('none'), false);
    assert.deepEqual(
      resolveReportAccess({ premium: true, startYmd: null, todayYmd: '2026-11-05' }),
      { access: 'premium', daysLeft: null },
    );
    assert.equal(
      resolveReportAccess({ premium: false, startYmd: null, todayYmd: '2026-11-05' }).access,
      'none',
    );
  });

  it('after Premium expires never offers free trial again', () => {
    assert.deepEqual(
      resolveReportAccess({
        premium: false,
        everPaid: true,
        startYmd: null,
        todayYmd: '2026-11-13',
      }),
      { access: 'ended', daysLeft: 0 },
    );
    assert.equal(
      resolveReportAccess({
        premium: false,
        everPaid: true,
        startYmd: '2026-11-01',
        todayYmd: '2026-11-13',
      }).access,
      'ended',
    );
  });
});

describe('report detail version gate', () => {
  it('leaves older and missing versions on the full report', () => {
    assert.equal(shouldGateReportDetails({ flagEnabled: true, appVersion: '3.5.4' }), false);
    assert.equal(shouldGateReportDetails({ flagEnabled: true, appVersion: null }), false);
    assert.equal(shouldGateReportDetails({ flagEnabled: true, appVersion: '' }), false);
    assert.equal(shouldGateReportDetails({ flagEnabled: true, appVersion: 'not-a-version' }), false);
  });

  it('gates 3.5.5 and newer while the flag is on', () => {
    assert.equal(shouldGateReportDetails({ flagEnabled: true, appVersion: '3.5.5' }), true);
    assert.equal(shouldGateReportDetails({ flagEnabled: true, appVersion: '3.6.0' }), true);
  });

  it('stays open when the kill switch is off', () => {
    assert.equal(shouldGateReportDetails({ flagEnabled: false, appVersion: '3.5.5' }), false);
  });
});

describe('trial start instant', () => {
  it('uses the India date of a UTC instant', () => {
    assert.equal(trialStartIstYmd('2026-11-05T18:29:00.000Z'), '2026-11-05');
    assert.equal(trialStartIstYmd('2026-11-05T18:30:00.000Z'), '2026-11-06');
    assert.equal(trialStartIstYmd(new Date('2026-11-05T18:30:00.000Z')), '2026-11-06');
  });
});
