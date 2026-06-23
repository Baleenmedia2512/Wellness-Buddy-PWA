/**
 * Unit tests — AIAnalysisOrchestrator
 *
 * AIGateway and JobQueue are fully mocked so this suite tests ONLY the
 * orchestrator's coordination logic: idempotency, status transitions,
 * enrichment job queuing, fallback on failure, confirmPersisted /
 * confirmFailed / confirmEnrichmentComplete callbacks.
 */

// ── Mock AIGateway ─────────────────────────────────────────────────────────────
jest.mock('../../lib/ai-orchestration/AIGateway.js', () => ({
  analyzeUnified: jest.fn(),
}));

// ── Mock JobQueue singleton ────────────────────────────────────────────────────
jest.mock('../../lib/ai-orchestration/JobQueue.js', () => {
  const enqueue = jest.fn().mockResolvedValue({ jobId: 'job-uuid-1' });
  return {
    JOB_STATUS: { PROCESSING: 'processing', COMPLETED: 'completed', FAILED: 'failed', PENDING: 'pending' },
    jobQueue:   { enqueue },
    __enqueue:  enqueue,
  };
});

import { analyzeUnified } from '../../lib/ai-orchestration/AIGateway.js';
import {
  analyse,
  confirmPersisted,
  confirmFailed,
  confirmEnrichmentComplete,
  getAnalysisStatus,
} from '../../lib/ai-orchestration/AIAnalysisOrchestrator.js';
import { ANALYSIS_STATUS } from '../../lib/ai-orchestration/AnalysisStatus.js';
import logger from '../../lib/logger.js';

// ── Silence logger ─────────────────────────────────────────────────────────────
beforeEach(() => {
  jest.spyOn(logger, 'info').mockImplementation(() => {});
  jest.spyOn(logger, 'warn').mockImplementation(() => {});
  jest.spyOn(logger, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockUnifiedFood(overrides = {}) {
  analyzeUnified.mockResolvedValue({
    imageType:     'food',
    confidence:    0.95,
    details:       {},
    fastNutrition: { calories: 350, protein: 20, carbs: 40, fat: 10, fiber: 5 },
    weightReading:  null,
    smartwatchData: null,
    educationData:  null,
    latencyMs:     800,
    attempts:      1,
    ...overrides,
  });
}

function mockUnifiedWeight() {
  analyzeUnified.mockResolvedValue({
    imageType:     'weight',
    confidence:    0.92,
    details:       {},
    fastNutrition: null,
    weightReading: { value: 72.5, unit: 'kg' },
    smartwatchData: null,
    educationData:  null,
    latencyMs:     600,
    attempts:      1,
  });
}

function mockUnifiedOther() {
  analyzeUnified.mockResolvedValue({
    imageType:     'other',
    confidence:    0.30,
    details:       {},
    fastNutrition: null,
    weightReading: null,
    smartwatchData: null,
    educationData:  null,
    latencyMs:     400,
    attempts:      1,
  });
}

const IMAGE_BUFFER = Buffer.from('fake-image');
const MIME_TYPE    = 'image/jpeg';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('analyse() — food image', () => {
  it('returns imageType=food with fastNutrition', async () => {
    mockUnifiedFood();
    const result = await analyse({ imageBuffer: IMAGE_BUFFER, mimeType: MIME_TYPE, captureId: 'cap-food-1' });
    expect(result.imageType).toBe('food');
    expect(result.fastNutrition).toMatchObject({ calories: 350 });
    expect(result.confidence).toBe(0.95);
  });

  it('enqueues an enrichment job when imageBase64 is provided', async () => {
    const { __enqueue: enqueue } = require('../../lib/ai-orchestration/JobQueue.js');
    mockUnifiedFood();
    const result = await analyse({
      imageBuffer: IMAGE_BUFFER,
      mimeType:    MIME_TYPE,
      captureId:   'cap-food-2',
      imageBase64: 'base64data',
      foodRowId:   99,
    });
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ captureId: 'cap-food-2', foodRowId: 99 }));
    expect(result.enrichmentJobId).toBe('job-uuid-1');
    expect(result.enrichmentStatus).toBe('processing');
  });

  it('does NOT enqueue when imageBase64 is absent', async () => {
    const { __enqueue: enqueue } = require('../../lib/ai-orchestration/JobQueue.js');
    enqueue.mockClear();
    mockUnifiedFood();
    const result = await analyse({ imageBuffer: IMAGE_BUFFER, mimeType: MIME_TYPE });
    expect(enqueue).not.toHaveBeenCalled();
    expect(result.enrichmentJobId).toBeNull();
  });
});

describe('analyse() — weight image', () => {
  it('returns imageType=weight with weightReading, no enrichment job', async () => {
    const { __enqueue: enqueue } = require('../../lib/ai-orchestration/JobQueue.js');
    enqueue.mockClear();
    mockUnifiedWeight();

    const result = await analyse({ imageBuffer: IMAGE_BUFFER, mimeType: MIME_TYPE, captureId: 'cap-w-1' });
    expect(result.imageType).toBe('weight');
    expect(result.weightReading).toMatchObject({ value: 72.5, unit: 'kg' });
    expect(result.fastNutrition).toBeNull();
    expect(enqueue).not.toHaveBeenCalled();
    expect(result.enrichmentJobId).toBeNull();
  });
});

describe('analyse() — other/low-confidence image', () => {
  it('returns imageType=other and no nutrition', async () => {
    mockUnifiedOther();
    const result = await analyse({ imageBuffer: IMAGE_BUFFER, mimeType: MIME_TYPE });
    expect(result.imageType).toBe('other');
    expect(result.fastNutrition).toBeNull();
  });
});

describe('analyse() — Gemini failure fallback', () => {
  it('returns defaulted=true without throwing', async () => {
    analyzeUnified.mockRejectedValue(Object.assign(new Error('Gemini down'), { code: 'SERVICE_UNAVAILABLE' }));
    const result = await analyse({ imageBuffer: IMAGE_BUFFER, mimeType: MIME_TYPE, captureId: 'cap-fail-1' });
    expect(result.imageType).toBe('other');
    expect(result.defaulted).toBe(true);
    expect(result.error).toBeDefined();
  });
});

describe('analyse() — idempotency', () => {
  it('returns a duplicate flag for the same captureId within the window', async () => {
    mockUnifiedFood();
    const captureId = `idem-${Date.now()}`;

    // First call registers the capture
    await analyse({ imageBuffer: IMAGE_BUFFER, mimeType: MIME_TYPE, captureId, imageBase64: 'b64' });

    // Second call with same captureId should return duplicate
    mockUnifiedFood(); // ensure mock is still primed
    const second = await analyse({ imageBuffer: IMAGE_BUFFER, mimeType: MIME_TYPE, captureId, imageBase64: 'b64' });
    expect(second.duplicate).toBe(true);
  });
});

describe('analyse() — observability', () => {
  it('includes a traceId in the response', async () => {
    mockUnifiedFood();
    const result = await analyse({ imageBuffer: IMAGE_BUFFER, mimeType: MIME_TYPE });
    expect(result.traceId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});

describe('confirmPersisted()', () => {
  it('transitions analysisStatus to FAST_COMPLETE', async () => {
    mockUnifiedFood();
    const captureId = `confirm-${Date.now()}`;
    await analyse({ imageBuffer: IMAGE_BUFFER, mimeType: MIME_TYPE, captureId });

    confirmPersisted(captureId, { foodRowId: 77 });

    const status = getAnalysisStatus(captureId);
    expect(status?.status).toBe(ANALYSIS_STATUS.FAST_COMPLETE);
  });

  it('is a no-op for null captureId', () => {
    expect(() => confirmPersisted(null)).not.toThrow();
  });
});

describe('confirmFailed()', () => {
  it('transitions analysisStatus to FAILED', async () => {
    mockUnifiedFood();
    const captureId = `conf-fail-${Date.now()}`;
    await analyse({ imageBuffer: IMAGE_BUFFER, mimeType: MIME_TYPE, captureId });

    confirmFailed(captureId, 'DB_WRITE_FAILED');

    const status = getAnalysisStatus(captureId);
    expect(status?.status).toBe(ANALYSIS_STATUS.FAILED);
  });
});

describe('confirmEnrichmentComplete()', () => {
  it('transitions analysisStatus to COMPLETE', async () => {
    mockUnifiedFood();
    const captureId = `enrich-done-${Date.now()}`;
    await analyse({ imageBuffer: IMAGE_BUFFER, mimeType: MIME_TYPE, captureId });

    confirmPersisted(captureId);
    confirmEnrichmentComplete(captureId);

    const status = getAnalysisStatus(captureId);
    expect(status?.status).toBe(ANALYSIS_STATUS.COMPLETE);
  });
});

describe('getAnalysisStatus()', () => {
  it('returns null for unknown captureId', () => {
    expect(getAnalysisStatus('no-such-capture')).toBeNull();
  });

  it('returns null for falsy captureId', () => {
    expect(getAnalysisStatus(null)).toBeNull();
    expect(getAnalysisStatus(undefined)).toBeNull();
  });
});
