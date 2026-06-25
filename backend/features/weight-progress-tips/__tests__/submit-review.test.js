/**
 * submit-review.test.js
 * Unit tests for the submit-review validation schema and handler.
 *
 * Domain layer — pure inputs → outputs; no I/O.
 */
import { validateSubmitReview, VALID_PROOF_TYPES, VALID_REASONS } from '../validation/submit-review.schema.js';
import { submitReviewHandler } from '../api/submit-review.handler.js';

// ─── helpers ──────────────────────────────────────────────────────────────────

const YES_PAYLOAD = {
  userId: 1,
  weightRecordId: 42,
  goalMode: 'loss',
  weightChange: 0.8,
  followedPlan: true,
  proofType: 'Meal Photo',
  proofImageBase64: 'data:image/png;base64,abc123',
};

const NO_PAYLOAD = {
  userId: 1,
  weightRecordId: 42,
  goalMode: 'loss',
  weightChange: 0.8,
  followedPlan: false,
  reason: 'Missed Meals',
};

// ─── validateSubmitReview ─────────────────────────────────────────────────────
describe('validateSubmitReview', () => {
  describe('required base fields', () => {
    it('throws when userId is missing', () => {
      const { userId: _u, ...rest } = YES_PAYLOAD;
      expect(() => validateSubmitReview(rest)).toThrow('userId');
    });

    it('throws when weightRecordId is missing', () => {
      const { weightRecordId: _w, ...rest } = YES_PAYLOAD;
      expect(() => validateSubmitReview(rest)).toThrow('weightRecordId');
    });

    it('throws when weightRecordId is invalid', () => {
      expect(() => validateSubmitReview({ ...YES_PAYLOAD, weightRecordId: 'abc' })).toThrow('weightRecordId');
    });

    it('throws when goalMode is missing', () => {
      const { goalMode: _g, ...rest } = YES_PAYLOAD;
      expect(() => validateSubmitReview(rest)).toThrow('goalMode');
    });

    it('throws when goalMode is invalid', () => {
      expect(() => validateSubmitReview({ ...YES_PAYLOAD, goalMode: 'shrink' })).toThrow('goalMode');
    });

    it('throws when weightChange is missing', () => {
      const { weightChange: _w, ...rest } = YES_PAYLOAD;
      expect(() => validateSubmitReview(rest)).toThrow('weightChange');
    });

    it('throws when weightChange is NaN', () => {
      expect(() => validateSubmitReview({ ...YES_PAYLOAD, weightChange: 'abc' })).toThrow('weightChange');
    });

    it('throws when followedPlan is missing', () => {
      const { followedPlan: _f, ...rest } = YES_PAYLOAD;
      expect(() => validateSubmitReview(rest)).toThrow('followedPlan');
    });

    it('throws when followedPlan is a string instead of boolean', () => {
      expect(() => validateSubmitReview({ ...YES_PAYLOAD, followedPlan: 'yes' })).toThrow('followedPlan');
    });
  });

  describe('YES path — followedPlan = true', () => {
    it('accepts a valid YES payload', () => {
      const result = validateSubmitReview(YES_PAYLOAD);
      expect(result.weightRecordId).toBe(42);
      expect(result.followedPlan).toBe(true);
      expect(result.proofType).toBe('Meal Photo');
      expect(result.proofImageBase64).toBe('data:image/png;base64,abc123');
    });

    it('throws when proofType is missing', () => {
      const { proofType: _pt, ...rest } = YES_PAYLOAD;
      expect(() => validateSubmitReview(rest)).toThrow('proofType');
    });

    it('throws when proofType is not in the allowed list', () => {
      expect(() => validateSubmitReview({ ...YES_PAYLOAD, proofType: 'Selfie' })).toThrow('proofType');
    });

    it('throws when proofImageBase64 is missing', () => {
      const { proofImageBase64: _pi, ...rest } = YES_PAYLOAD;
      expect(() => validateSubmitReview(rest)).toThrow('proofImageBase64');
    });

    it('accepts every allowed proof type', () => {
      for (const type of VALID_PROOF_TYPES) {
        expect(() => validateSubmitReview({ ...YES_PAYLOAD, proofType: type })).not.toThrow();
      }
    });

    it('strips NO-path fields when followedPlan = true', () => {
      const result = validateSubmitReview({ ...YES_PAYLOAD, reason: 'Missed Meals' });
      expect(result.reason).toBeNull();
      expect(result.reasonOther).toBeNull();
    });
  });

  describe('NO path — followedPlan = false', () => {
    it('accepts a valid NO payload without reason', () => {
      const { reason: _r, ...rest } = NO_PAYLOAD;
      const result = validateSubmitReview(rest);
      expect(result.followedPlan).toBe(false);
      expect(result.reason).toBeNull();
      expect(result.proofType).toBeNull();
    });

    it('accepts a valid NO payload with reason', () => {
      const result = validateSubmitReview(NO_PAYLOAD);
      expect(result.followedPlan).toBe(false);
      expect(result.reason).toBe('Missed Meals');
      expect(result.proofType).toBeNull();
    });

    it('throws when reason is not in the allowed list', () => {
      expect(() => validateSubmitReview({ ...NO_PAYLOAD, reason: 'Bad Luck' })).toThrow('reason');
    });

    it('accepts every allowed reason', () => {
      for (const r of VALID_REASONS) {
        const payload = r === 'Other'
          ? { ...NO_PAYLOAD, reason: r, reasonOther: 'some text' }
          : { ...NO_PAYLOAD, reason: r };
        expect(() => validateSubmitReview(payload)).not.toThrow();
      }
    });

    it('throws when reason = "Other" and reasonOther is empty', () => {
      expect(() => validateSubmitReview({ ...NO_PAYLOAD, reason: 'Other', reasonOther: '  ' })).toThrow('reasonOther');
    });

    it('accepts reason = "Other" with non-empty reasonOther', () => {
      const result = validateSubmitReview({ ...NO_PAYLOAD, reason: 'Other', reasonOther: 'family emergency' });
      expect(result.reason).toBe('Other');
      expect(result.reasonOther).toBe('family emergency');
    });

    it('does NOT store reasonOther when reason is not "Other"', () => {
      const result = validateSubmitReview({ ...NO_PAYLOAD, reason: 'Travel', reasonOther: 'ignored' });
      expect(result.reasonOther).toBeNull();
    });

    it('strips YES-path fields when followedPlan = false', () => {
      const result = validateSubmitReview({ ...NO_PAYLOAD, proofType: 'Meal Photo', proofImageBase64: 'base64' });
      expect(result.proofType).toBeNull();
      expect(result.proofImageBase64).toBeNull();
    });
  });

  describe('type coercion', () => {
    it('coerces userId string to integer', () => {
      const result = validateSubmitReview({ ...YES_PAYLOAD, userId: '42' });
      expect(result.userId).toBe(42);
    });

    it('coerces weightChange string to float', () => {
      const result = validateSubmitReview({ ...YES_PAYLOAD, weightChange: '0.8' });
      expect(result.weightChange).toBeCloseTo(0.8);
    });

    it('passes nutritionSnapshot through unchanged', () => {
      const snapshot = { calories: 2100, protein: 60, carbs: 280, fat: 80, water: 1200, steps: 3000 };
      const result = validateSubmitReview({ ...YES_PAYLOAD, nutritionSnapshot: snapshot });
      expect(result.nutritionSnapshot).toEqual(snapshot);
    });

    it('defaults nutritionSnapshot to null when absent', () => {
      const result = validateSubmitReview(YES_PAYLOAD);
      expect(result.nutritionSnapshot).toBeNull();
    });
  });

  describe('goal modes', () => {
    it('accepts gain mode', () => {
      expect(() => validateSubmitReview({ ...YES_PAYLOAD, goalMode: 'gain' })).not.toThrow();
    });
    it('accepts maintain mode', () => {
      expect(() => validateSubmitReview({ ...YES_PAYLOAD, goalMode: 'maintain' })).not.toThrow();
    });
  });
});

// ─── submitReviewHandler ──────────────────────────────────────────────────────
describe('submitReviewHandler', () => {
  let mockSaveProgressReview;

  beforeEach(() => {
    jest.resetModules();
    mockSaveProgressReview = jest.fn().mockResolvedValue(99);
  });

  it('validates input and returns weightRecordId on success', async () => {
    jest.doMock('../data/weight-progress.repo.js', () => ({
      saveProgressReview: mockSaveProgressReview,
    }));
    const { submitReviewHandler: handler } = await import('../api/submit-review.handler.js');
    const result = await handler(YES_PAYLOAD);
    expect(result.ok).toBe(true);
    expect(result.data.weightRecordId).toBe(99);
  });

  it('propagates ValidationError when payload is invalid', async () => {
    await expect(
      submitReviewHandler({
        userId: 1,
        weightRecordId: 42,
        goalMode: 'loss',
        weightChange: 0.5,
        followedPlan: 'yes',
      }),
    ).rejects.toThrow('followedPlan');
  });
});
