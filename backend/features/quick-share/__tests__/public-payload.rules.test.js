import { toPublicPayload } from '../domain/public-payload.rules.js';

const future = new Date(Date.now() + 60_000).toISOString();
const past = new Date(Date.now() - 60_000).toISOString();

const readyAnalysis = JSON.stringify({
  foods: [{ name: 'Idli', nutrition: { calories: 60, protein: 2 } }],
  total: { calories: 60, protein: 2, carbs: 12, fat: 0.5, fiber: 1 },
  confidence: 'high',
});

describe('quick-share public-payload.rules', () => {
  it('returns not_found when row is null', () => {
    expect(toPublicPayload({ row: null })).toEqual({
      status: 'not_found', kind: 'food', createdAt: null, nutrition: null, foods: null, confidence: null,
    });
  });

  it('returns expired when ShareExpiresAt is past', () => {
    const out = toPublicPayload({ row: { ShareExpiresAt: past, AnalysisData: readyAnalysis } });
    expect(out.status).toBe('expired');
    expect(out.nutrition).toBeNull();
  });

  it('returns not_found when IsDeleted=1 (soft-deleted by owner)', () => {
    const out = toPublicPayload({
      row: { ShareExpiresAt: future, IsDeleted: 1, AnalysisData: readyAnalysis },
    });
    expect(out.status).toBe('not_found');
  });

  it('returns pending when AnalysisData is null', () => {
    const out = toPublicPayload({
      row: { ShareExpiresAt: future, AnalysisData: null, CreatedAt: '2026-05-18T00:00:00Z' },
    });
    expect(out.status).toBe('pending');
    expect(out.createdAt).toBe('2026-05-18T00:00:00Z');
    expect(out.nutrition).toBeNull();
  });

  it('returns ready with nutrition when AnalysisData is populated', () => {
    const out = toPublicPayload({
      row: {
        ShareExpiresAt: future,
        AnalysisData: readyAnalysis,
        ConfidenceScore: 0.9,
        CreatedAt: '2026-05-18T00:00:00Z',
      },
    });
    expect(out.status).toBe('ready');
    expect(out.nutrition).toEqual({ calories: 60, protein: 2, carbs: 12, fat: 0.5, fiber: 1 });
    expect(out.foods).toHaveLength(1);
    expect(out.confidence).toBe(0.9);
  });

  it('treats malformed AnalysisData as pending (fail-soft to recipient)', () => {
    const out = toPublicPayload({
      row: { ShareExpiresAt: future, AnalysisData: 'not-json{' },
    });
    expect(out.status).toBe('pending');
  });

  it('omits all PII fields even when they are present on the row', () => {
    const out = toPublicPayload({
      row: {
        ShareExpiresAt: future,
        AnalysisData: readyAnalysis,
        UserID: '42',
        UserEmail: 'leak@example.com',
        UserName: 'Alice',
      },
    });
    expect(JSON.stringify(out)).not.toMatch(/42|leak|Alice/);
  });

  it('accepts AnalysisData that is already an object', () => {
    const out = toPublicPayload({
      row: {
        ShareExpiresAt: future,
        AnalysisData: { total: { calories: 100 }, foods: [] },
      },
    });
    expect(out.status).toBe('ready');
    expect(out.nutrition.calories).toBe(100);
  });
});
