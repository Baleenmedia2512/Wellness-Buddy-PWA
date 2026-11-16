/**
 * Run: node --test frontend/src/features/payments/domain/homePlanStatus.rules.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildHomePlanStatus } from './homePlanStatus.rules.js';

describe('home plan status card', () => {
  it('builds the free-trial card from the design', () => {
    assert.deepEqual(
      buildHomePlanStatus({
        trial: true,
        daysLeft: 12,
        expiresAtDisplay: '28 Nov 2026, 12:00 AM',
      }),
      {
        title: 'Free Trial Active',
        badge: 'Trial Active',
        daysLabel: '12 days left',
        endsOn: '28 Nov 2026, 12:00 AM (IST)',
        progressPercent: 86,
        urgent: false,
      },
    );
  });

  it('uses the same card for Premium', () => {
    assert.deepEqual(
      buildHomePlanStatus({
        premium: true,
        daysLeft: 18,
        expiresAtDisplay: '13 Dec 2026, 11:59 PM',
      }),
      {
        title: 'Premium Active',
        badge: 'Premium Active',
        daysLabel: '18 days left',
        endsOn: '13 Dec 2026, 11:59 PM (IST)',
        progressPercent: 60,
        urgent: false,
      },
    );
  });

  it('says today when Premium ends today', () => {
    const card = buildHomePlanStatus({
      premium: true,
      daysLeft: 0,
      expiresAtDisplay: '13 Nov 2026, 11:59 PM (IST)',
    });
    assert.equal(card.daysLabel, 'Ends today');
    assert.equal(card.endsOn, '13 Nov 2026, 11:59 PM (IST)');
    assert.equal(card.progressPercent, 0);
    assert.equal(card.urgent, true);
  });

  it('turns red for the last two days and stays calm on day three', () => {
    assert.equal(buildHomePlanStatus({ premium: true, daysLeft: 2, expiresAtDisplay: '18 Nov 2026, 11:59 PM' }).urgent, true);
    assert.equal(buildHomePlanStatus({ trial: true, daysLeft: 2, expiresAtDisplay: '18 Nov 2026, 12:00 AM' }).urgent, true);
    assert.equal(buildHomePlanStatus({ premium: true, daysLeft: 3, expiresAtDisplay: '19 Nov 2026, 11:59 PM' }).urgent, false);
  });

  it('keeps the trial card when the end time is missing', () => {
    const card = buildHomePlanStatus({ trial: true, daysLeft: 1 });
    assert.equal(card.title, 'Free Trial Active');
    assert.equal(card.daysLabel, '1 day left');
    assert.equal(card.endsOn, '');
    assert.equal(card.progressPercent, 7);
    assert.equal(card.urgent, true);
  });

  it('stays hidden when there is no plan', () => {
    assert.equal(buildHomePlanStatus({ daysLeft: 4 }), null);
    assert.equal(buildHomePlanStatus({ premium: true }), null);
  });

  it('lets Premium win when both flags are set', () => {
    const card = buildHomePlanStatus({
      premium: true,
      trial: true,
      daysLeft: 12,
      expiresAtDisplay: '1 Dec 2026, 11:59 PM',
    });
    assert.equal(card.title, 'Premium Active');
    assert.equal(card.progressPercent, 40);
  });
});
