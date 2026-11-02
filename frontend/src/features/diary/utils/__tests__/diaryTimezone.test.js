/**
 * Run: node --test frontend/src/features/diary/utils/__tests__/diaryTimezone.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveDiaryTimezone, toYmd } from '../diaryTimezone.js';

describe('resolveDiaryTimezone', () => {
  it('uses the diary owner zone (Qatar / USA) instead of India default', () => {
    assert.equal(resolveDiaryTimezone({ timezone: 'Asia/Qatar' }), 'Asia/Qatar');
    assert.equal(resolveDiaryTimezone({ timezoneIana: 'America/New_York' }), 'America/New_York');
  });

  it('defaults to India when the owner profile has no zone', () => {
    assert.equal(resolveDiaryTimezone(null), 'Asia/Kolkata');
    assert.equal(resolveDiaryTimezone({ email: 'a@b.com' }), 'Asia/Kolkata');
  });
});

describe('toYmd — calendar Date vs owner timezone', () => {
  it('keeps YYYY-MM-DD strings', () => {
    assert.equal(toYmd('2026-08-18', 'Asia/Qatar'), '2026-08-18');
  });

  it('does not shift a local-midnight picker Date into yesterday for Qatar or USA', () => {
    const picked = new Date(2026, 7, 18);
    assert.equal(toYmd(picked, 'Asia/Kolkata'), '2026-08-18');
    assert.equal(toYmd(picked, 'Asia/Qatar'), '2026-08-18');
    assert.equal(toYmd(picked, 'America/New_York'), '2026-08-18');
  });

  it('rejects invalid input', () => {
    assert.equal(toYmd('18-08-2026'), null);
    assert.equal(toYmd(new Date('invalid')), null);
  });
});
