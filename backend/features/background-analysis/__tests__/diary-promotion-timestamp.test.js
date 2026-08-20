/**
 * Manual Log / unknown→food promotion must preserve the original upload time.
 * Run: node --test backend/features/background-analysis/__tests__/diary-promotion-timestamp.test.js
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePromotionClientTimestamp,
  toDiaryEntry,
} from '../diary.service.js';
import { IANA_IST } from '../../../shared/lib/datetime/index.js';

describe('resolvePromotionClientTimestamp', () => {
  it('normalizes captures_table timestamptz (UTC Z) for food row insert', () => {
    // 6:11 AM IST on 2026-07-22 = 00:41 UTC
    const utc = resolvePromotionClientTimestamp('2026-07-22T00:41:29.000Z');
    assert.equal(utc, '2026-07-22T00:41:29.000Z');
  });

  it('prefers capture CreatedAt over diary fallback', () => {
    const utc = resolvePromotionClientTimestamp(
      '2026-07-22T00:41:29.000Z',
      '2026-07-22T03:00:00.000Z',
    );
    assert.equal(utc, '2026-07-22T00:41:29.000Z');
  });

  it('uses diary capturedAt fallback when capture CreatedAt is missing', () => {
    const utc = resolvePromotionClientTimestamp(
      null,
      '2026-07-22T00:41:29.000Z',
    );
    assert.equal(utc, '2026-07-22T00:41:29.000Z');
  });

  it('returns null when no timestamp is available', () => {
    assert.equal(resolvePromotionClientTimestamp(null, null), null);
    assert.equal(resolvePromotionClientTimestamp('', ''), null);
  });
});

describe('toDiaryEntry food row displays preserved upload time', () => {
  it('uses food CreatedAt normalized for display (not Manual Log save time)', () => {
    const entry = toDiaryEntry('food', {
      ID: 1,
      CreatedAt: '2026-07-22 06:11:29.000',
      AnalysisData: '{"foods":[]}',
      TotalCalories: 100,
      TotalProtein: 0,
      TotalCarbs: 0,
      TotalFat: 0,
      TotalFiber: 0,
      CaptureID: 'cap-1',
    }, { timezoneIana: IANA_IST });

    assert.equal(entry.capturedAt, '2026-07-22T00:41:29.000Z');
    // 00:41 UTC = 6:11 AM IST
    const istTime = new Date(entry.capturedAt).toLocaleString('en-US', {
      timeZone: IANA_IST,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    assert.match(istTime, /6:11\s*AM/i);
  });
});

describe('toDiaryEntry education matches unknown capture time', () => {
  it('shows 7:45 AM IST when legacy row stores IST wall (not UTC digits)', () => {
    const captureUtc = '2026-07-22T02:15:28.287Z';
    const unknownEntry = toDiaryEntry('unknown', {
      ID: 2362,
      ImageType: 'unknown',
      CreatedAt: captureUtc,
      ImageBase64: null,
      ImagePath: null,
      PublicShareToken: 'tok',
    }, { timezoneIana: IANA_IST });

    const educationEntry = toDiaryEntry('education', {
      Id: 1136,
      CreatedAt: '2026-07-22 07:45:28.287',
      Platform: 'zoom',
      Topic: 'Session',
      Confidence: 0.9,
      ImageBase64: null,
    }, { timezoneIana: IANA_IST });

    assert.equal(unknownEntry.capturedAt, captureUtc);
    assert.equal(educationEntry.capturedAt, captureUtc);
  });

  it('weight legacy IST wall storage matches capture timestamptz', () => {
    const captureUtc = '2026-07-22T00:41:29.000Z';
    const unknownEntry = toDiaryEntry('unknown', {
      ID: 100,
      ImageType: 'unknown',
      CreatedAt: captureUtc,
      ImageBase64: null,
      ImagePath: null,
      PublicShareToken: 'tok',
    }, { timezoneIana: IANA_IST });

    const weightEntry = toDiaryEntry('weight', {
      ID: 3028,
      CreatedAt: '2026-07-22 06:11:29.000',
      Weight: 70,
      Bmi: null,
      BodyFat: null,
      MuscleMass: null,
      Bmr: null,
      WeightImageBase64: null,
    }, { timezoneIana: IANA_IST });

    assert.equal(unknownEntry.capturedAt, captureUtc);
    assert.equal(weightEntry.capturedAt, captureUtc);
  });
});

describe('toDiaryEntry good-habit', () => {
  it('projects notes and habit type', () => {
    const entry = toDiaryEntry('good-habit', {
      ID: 12,
      HabitType: 'before_after',
      Notes: 'Walked 20 min',
      CaptureID: 'cap-9',
      CreatedAt: '2026-08-16 08:00:00.000',
    }, { timezoneIana: IANA_IST });
    assert.equal(entry.kind, 'good-habit');
    assert.equal(entry.payload.habitType, 'before_after');
    assert.equal(entry.payload.notes, 'Walked 20 min');
    assert.equal(entry.payload.hasImage, true);
  });
});
