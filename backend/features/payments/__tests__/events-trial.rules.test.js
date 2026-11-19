/**
 * Run: node --test backend/features/payments/__tests__/events-trial.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  eventsTrialWindow,
  resolveEventsAccess,
  canUseEventsHostTools,
  shouldGateEventsHostTools,
  EVENTS_TRIAL_LENGTH_DAYS,
} from '../domain/events-trial.rules.js';
import { REPORT_TRIAL_LENGTH_DAYS } from '../domain/report-trial.rules.js';

describe('events trial shares Reports window', () => {
  it('uses the same 14-day length as Reports', () => {
    assert.equal(EVENTS_TRIAL_LENGTH_DAYS, 14);
    assert.equal(EVENTS_TRIAL_LENGTH_DAYS, REPORT_TRIAL_LENGTH_DAYS);
  });

  it('continues remaining days from an already-started trial', () => {
    assert.deepEqual(eventsTrialWindow('2026-11-05', '2026-11-12'), {
      active: true,
      daysLeft: 7,
      ended: false,
    });
    assert.equal(
      resolveEventsAccess({
        premium: false,
        startYmd: '2026-11-05',
        todayYmd: '2026-11-12',
      }).daysLeft,
      7,
    );
    assert.equal(canUseEventsHostTools('trial'), true);
  });

  it('locks when the shared 14-day window ends', () => {
    assert.deepEqual(eventsTrialWindow('2026-11-05', '2026-11-19'), {
      active: false,
      daysLeft: 0,
      ended: true,
    });
    assert.equal(canUseEventsHostTools('ended'), false);
  });
});

describe('events host version gate', () => {
  it('leaves older and missing versions with Digital Portfolio open', () => {
    assert.equal(shouldGateEventsHostTools({ flagEnabled: true, appVersion: '3.5.6' }), false);
    assert.equal(shouldGateEventsHostTools({ flagEnabled: true, appVersion: null }), false);
  });

  it('gates Digital Portfolio on 3.5.7 and newer while the flag is on', () => {
    assert.equal(shouldGateEventsHostTools({ flagEnabled: true, appVersion: '3.5.7' }), true);
  });

  it('stays open when the kill switch is off', () => {
    assert.equal(shouldGateEventsHostTools({ flagEnabled: false, appVersion: '3.5.7' }), false);
  });
});
