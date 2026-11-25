/**
 * Run: node --test frontend/src/features/leaderboard/domain/__tests__/leaderboardDateFilter.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  LB_DATE_PRESETS,
  inclusiveYmdSpanDays,
  resolveLbDateFilter,
} from '../leaderboardDateFilter.js';

describe('inclusiveYmdSpanDays', () => {
  it('counts inclusive days', () => {
    assert.equal(inclusiveYmdSpanDays('2026-11-11', '2026-11-12'), 2);
    assert.equal(inclusiveYmdSpanDays('2026-11-09', '2026-11-18'), 10);
  });

  it('returns 0 for inverted or invalid ranges', () => {
    assert.equal(inclusiveYmdSpanDays('2026-11-18', '2026-11-10'), 0);
    assert.equal(inclusiveYmdSpanDays('nope', '2026-11-10'), 0);
  });
});

describe('resolveLbDateFilter', () => {
  const now = new Date('2026-11-18T14:13:00+05:30');

  it('resolves Today on IST business date', () => {
    const resolved = resolveLbDateFilter(LB_DATE_PRESETS.TODAY, null, null, now);
    assert.equal(resolved.ok, true);
    assert.equal(resolved.days, 1);
    assert.equal(resolved.dateYmd, null);
    assert.equal(resolved.buttonLabel, 'Today');
    assert.equal(resolved.endYmd, '2026-11-18');
  });

  it('resolves Yesterday as a single IST date', () => {
    const resolved = resolveLbDateFilter(LB_DATE_PRESETS.YESTERDAY, null, null, now);
    assert.equal(resolved.ok, true);
    assert.equal(resolved.days, 1);
    assert.equal(resolved.dateYmd, '2026-11-17');
  });

  it('resolves Last 10 ending today IST and has no Last 5 preset', () => {
    const last10 = resolveLbDateFilter(LB_DATE_PRESETS.LAST_10, null, null, now);
    assert.equal(last10.ok, true);
    assert.equal(last10.days, 10);
    assert.equal(last10.startYmd, '2026-11-09');
    assert.equal(last10.endYmd, '2026-11-18');
    assert.equal(LB_DATE_PRESETS.LAST_5, undefined);
  });

  it('allows a custom range up to 30 days and rejects longer spans', () => {
    const ok30 = resolveLbDateFilter(
      LB_DATE_PRESETS.CUSTOM,
      new Date(2026, 9, 20),
      new Date(2026, 10, 18),
      now,
    );
    assert.equal(ok30.ok, true);
    assert.equal(ok30.days, 30);

    const tooLong = resolveLbDateFilter(
      LB_DATE_PRESETS.CUSTOM,
      new Date(2026, 9, 19),
      new Date(2026, 10, 18),
      now,
    );
    assert.equal(tooLong.ok, false);
    assert.equal(tooLong.error, 'range_too_long');
  });

  it('supports weight Today subtitle override', () => {
    const resolved = resolveLbDateFilter(
      LB_DATE_PRESETS.TODAY,
      null,
      null,
      now,
      undefined,
      { todaySubtitle: 'Today vs Yesterday', todayButtonLabel: 'Today' },
    );
    assert.equal(resolved.subtitle, 'Today vs Yesterday');
    assert.equal(resolved.buttonLabel, 'Today');
  });
});
