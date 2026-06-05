/**
 * Tests for diary.service.js :: listDiaryEntries + toDiaryEntry.
 *
 * PR-B / ADR-0003 — Diary feed read-model.
 *
 * Mocks the diary repository + analysis repository (for getCoachChain)
 * at the module boundary. The retry permission policy is exercised by
 * its real implementation so a regression in the gate is caught here.
 * Feature-flag behaviour is verified by flipping `process.env.FF_DIARY_FEED`.
 */

import * as service from '../diary.service.js';

// Per-vertical reads.
jest.mock('../diary.repository.js', () => ({
  fetchFoodForDay:             jest.fn(),
  fetchWeightForDay:           jest.fn(),
  fetchEducationForDay:        jest.fn(),
  fetchWatchForDay:            jest.fn(),
  fetchUnknownCapturesForDay:  jest.fn(),
}));

// Coach-chain walk lives on the existing analysis.repository.js.
jest.mock('../analysis.repository.js', () => ({
  getCoachChain: jest.fn(),
}));

// Silence logger; assert call counts where they matter.
jest.mock('../../../shared/lib/logger.js', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

import * as diaryRepo from '../diary.repository.js';
import * as repo from '../analysis.repository.js';
import logger from '../../../shared/lib/logger.js';

const OWNER    = '42';
const COACH    = '99';
const STRANGER = '500';
const DATE     = '2026-06-05';

const foodRow = (id, createdAt, kcal = 320) => ({
  ID: id, ImagePath: `/f${id}.jpg`, ImageBase64: 'b64',
  AnalysisData: '{"foods":[]}', ConfidenceScore: 0.9,
  TotalCalories: kcal, TotalProtein: 10, TotalCarbs: 40, TotalFat: 8, TotalFiber: 2,
  CaptureID: 1000 + id, ProcessedBy: 'manual_app', DeviceInfo: 'web',
  CreatedAt: createdAt,
});
const weightRow = (id, createdAt, weight = 72.5) => ({
  ID: id, UserId: OWNER, Weight: weight, Bmi: 24, BodyFat: 18, MuscleMass: 30,
  Bmr: 1700, WeightImageBase64: 'b64', CreatedAt: createdAt,
});
const educationRow = (id, createdAt, topic = 'Mind & Body Module 1') => ({
  Id: id, Platform: 'wellness-uni', Topic: topic, Confidence: 'high',
  ImageBase64: 'b64', CreatedAt: createdAt,
});
const watchRow = (id, createdAt, kcalString = 'Calories Burned: 245 kcal') => ({
  Id: id, Topic: kcalString, CreatedAt: createdAt,
});
const unknownRow = (id, createdAt) => ({
  ID: id, UserID: OWNER, ImageType: 'unknown',
  ImageBase64: 'b64', ImagePath: `/u${id}.jpg`,
  PublicShareToken: `tok-${id}`, CreatedAt: createdAt,
});

beforeEach(() => {
  jest.clearAllMocks();
  // Default: viewer is the owner; coach chain length-1 (owner only).
  repo.getCoachChain.mockResolvedValue([OWNER]);
  diaryRepo.fetchFoodForDay.mockResolvedValue([]);
  diaryRepo.fetchWeightForDay.mockResolvedValue([]);
  diaryRepo.fetchEducationForDay.mockResolvedValue([]);
  diaryRepo.fetchWatchForDay.mockResolvedValue([]);
  diaryRepo.fetchUnknownCapturesForDay.mockResolvedValue([]);
  delete process.env.FF_DIARY_FEED;
});

afterEach(() => {
  delete process.env.FF_DIARY_FEED;
});

describe('listDiaryEntries — permission gate', () => {
  it('allows the OWNER reading their own diary (isSelf:true)', async () => {
    const out = await service.listDiaryEntries({
      ownerUserId: OWNER, viewerUserId: OWNER, date: DATE,
    });
    expect(out.httpStatus).toBe(200);
    expect(out.body.data.isSelf).toBe(true);
    expect(out.body.data.ownerUserId).toBe(OWNER);
    expect(logger.info).not.toHaveBeenCalled(); // owner-on-self not audited
  });

  it('allows a COACH-of-owner reading the member diary AND audit-logs the read', async () => {
    repo.getCoachChain.mockResolvedValueOnce([OWNER, COACH]);
    const out = await service.listDiaryEntries({
      ownerUserId: OWNER, viewerUserId: COACH, date: DATE,
    });
    expect(out.httpStatus).toBe(200);
    expect(out.body.data.isSelf).toBe(false);
    expect(logger.info).toHaveBeenCalledWith(
      'listDiaryEntries: coach reading member diary',
      expect.objectContaining({ actorId: COACH, ownerId: OWNER, date: DATE }),
    );
  });

  it('throws 403 FORBIDDEN_DIARY for a stranger', async () => {
    repo.getCoachChain.mockResolvedValueOnce([OWNER]); // STRANGER not in chain
    await expect(service.listDiaryEntries({
      ownerUserId: OWNER, viewerUserId: STRANGER, date: DATE,
    })).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN_DIARY' });
    expect(diaryRepo.fetchFoodForDay).not.toHaveBeenCalled();
  });

  it('throws 401 UNAUTHENTICATED when viewerUserId is missing', async () => {
    await expect(service.listDiaryEntries({
      ownerUserId: OWNER, viewerUserId: null, date: DATE,
    })).rejects.toMatchObject({ status: 401, code: 'UNAUTHENTICATED' });
    expect(diaryRepo.fetchFoodForDay).not.toHaveBeenCalled();
  });
});

describe('listDiaryEntries — composition + ordering', () => {
  it('joins all four streams and sorts entries newest-first', async () => {
    diaryRepo.fetchFoodForDay.mockResolvedValueOnce([
      foodRow(1, '2026-06-05T10:00:00+05:30'),
    ]);
    diaryRepo.fetchWeightForDay.mockResolvedValueOnce([
      weightRow(2, '2026-06-05T12:00:00+05:30'),
    ]);
    diaryRepo.fetchEducationForDay.mockResolvedValueOnce([
      educationRow(3, '2026-06-05T08:00:00+05:30'),
    ]);
    diaryRepo.fetchWatchForDay.mockResolvedValueOnce([
      watchRow(4, '2026-06-05T15:00:00+05:30'),
    ]);

    const { body } = await service.listDiaryEntries({
      ownerUserId: OWNER, viewerUserId: OWNER, date: DATE,
    });

    const kinds = body.data.entries.map((e) => e.kind);
    // Sort order: 15:00 watch, 12:00 weight, 10:00 food, 08:00 education.
    expect(kinds).toEqual(['watch', 'weight', 'food', 'education']);
  });

  it('does NOT include unknown captures when ff.diary-feed is OFF (default)', async () => {
    diaryRepo.fetchUnknownCapturesForDay.mockResolvedValueOnce([
      unknownRow(7, '2026-06-05T20:00:00+05:30'),
    ]);
    const { body } = await service.listDiaryEntries({
      ownerUserId: OWNER, viewerUserId: OWNER, date: DATE,
    });
    expect(body.data.includesUnknown).toBe(false);
    // The repo function MUST NOT have been called when the flag is off
    // (otherwise we'd be paying for a query we don't render).
    expect(diaryRepo.fetchUnknownCapturesForDay).not.toHaveBeenCalled();
    expect(body.data.entries.some((e) => e.kind === 'unknown')).toBe(false);
  });

  it('includes unknown captures when ff.diary-feed=true', async () => {
    process.env.FF_DIARY_FEED = 'true';
    diaryRepo.fetchUnknownCapturesForDay.mockResolvedValueOnce([
      unknownRow(7, '2026-06-05T20:00:00+05:30'),
    ]);
    diaryRepo.fetchFoodForDay.mockResolvedValueOnce([
      foodRow(1, '2026-06-05T10:00:00+05:30'),
    ]);

    const { body } = await service.listDiaryEntries({
      ownerUserId: OWNER, viewerUserId: OWNER, date: DATE,
    });

    expect(body.data.includesUnknown).toBe(true);
    expect(body.data.entries.map((e) => e.kind)).toEqual(['unknown', 'food']);
    expect(body.data.entries[0]).toMatchObject({
      kind: 'unknown',
      capture: expect.objectContaining({ id: 7, type: 'unknown' }),
    });
  });

  it('returns an empty entries array on a day with no data (no 500)', async () => {
    const { body } = await service.listDiaryEntries({
      ownerUserId: OWNER, viewerUserId: OWNER, date: DATE,
    });
    expect(body.data.entries).toEqual([]);
    expect(body.data.date).toBe(DATE);
  });

  it('degrades gracefully when ONE per-vertical read throws (other rows still render)', async () => {
    diaryRepo.fetchFoodForDay.mockResolvedValueOnce([
      foodRow(1, '2026-06-05T10:00:00+05:30'),
    ]);
    diaryRepo.fetchWeightForDay.mockRejectedValueOnce(new Error('connection refused'));
    diaryRepo.fetchEducationForDay.mockResolvedValueOnce([
      educationRow(3, '2026-06-05T08:00:00+05:30'),
    ]);

    const { body } = await service.listDiaryEntries({
      ownerUserId: OWNER, viewerUserId: OWNER, date: DATE,
    });

    expect(body.data.entries.map((e) => e.kind)).toEqual(['food', 'education']);
    expect(logger.warn).toHaveBeenCalledWith(
      'listDiaryEntries: per-vertical read failed',
      expect.objectContaining({ kind: 'weight' }),
    );
  });
});

describe('toDiaryEntry — projection shape (pure)', () => {
  it('projects a food row to { kind, capturedAt, capture, payload }', () => {
    const row = foodRow(1, '2026-06-05T10:00:00+05:30', 555);
    const entry = service.toDiaryEntry('food', row);
    expect(entry).toEqual({
      kind: 'food',
      capturedAt: '2026-06-05T10:00:00+05:30',
      capture: { id: 1001 },
      payload: expect.objectContaining({
        id: 1,
        totals: { calories: 555, protein: 10, carbs: 40, fat: 8, fiber: 2 },
      }),
    });
  });

  it('projects a food row with no CaptureID to capture:null', () => {
    const row = { ...foodRow(1, '2026-06-05T10:00:00+05:30'), CaptureID: null };
    expect(service.toDiaryEntry('food', row).capture).toBeNull();
  });

  it('projects a weight row (no capture link)', () => {
    const entry = service.toDiaryEntry('weight', weightRow(2, '2026-06-05T12:00:00+05:30', 71.2));
    expect(entry.kind).toBe('weight');
    expect(entry.capture).toBeNull();
    expect(entry.payload.weight).toBe(71.2);
    expect(entry.payload.bmr).toBe(1700);
  });

  it('projects an education row', () => {
    const entry = service.toDiaryEntry('education', educationRow(3, '2026-06-05T08:00:00+05:30', 'Module 4'));
    expect(entry.kind).toBe('education');
    expect(entry.payload.topic).toBe('Module 4');
    expect(entry.payload.platform).toBe('wellness-uni');
  });

  it('parses kcal out of a watch Topic string', () => {
    const entry = service.toDiaryEntry('watch', watchRow(4, '2026-06-05T15:00:00+05:30'));
    expect(entry.kind).toBe('watch');
    expect(entry.payload.kcal).toBe(245);
  });

  it('parses kcal as 0 when the Topic does not match the expected pattern', () => {
    const entry = service.toDiaryEntry('watch', watchRow(5, '2026-06-05T15:00:00+05:30', 'Garbage topic'));
    expect(entry.payload.kcal).toBe(0);
  });

  it('projects an unknown capture row with its share token preserved', () => {
    const entry = service.toDiaryEntry('unknown', unknownRow(7, '2026-06-05T20:00:00+05:30'));
    expect(entry.kind).toBe('unknown');
    expect(entry.capture.publicShareToken).toBe('tok-7');
  });

  it('throws UNKNOWN_DIARY_KIND for an unsupported kind (defensive)', () => {
    expect(() => service.toDiaryEntry('rocket-ship', {})).toThrow(/UNKNOWN_DIARY_KIND|unknown kind/);
  });
});
