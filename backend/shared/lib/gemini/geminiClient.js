/**
 * backend/shared/lib/gemini/geminiClient.js
 * ---------------------------------------------------------------------------
 * Singleton Gemini model factory.
 *
 * Provides pre-configured model instances for each use-case (classification,
 * nutrition, weight). Caches instances per configuration key so we do not
 * re-initialise `GoogleGenerativeAI` on every request.
 *
 * All callers should import getModel() rather than constructing their own
 * GoogleGenerativeAI instance.
 * ---------------------------------------------------------------------------
 */

import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import logger from '../logger.js';

// ── Model configuration catalogue ────────────────────────────────────────────
// Each entry defines the generation config for a specific task. Keeping them
// here ensures all endpoints share identical hyperparameters.

export const MODEL_NAME = 'gemini-2.5-flash-lite';

export const MODEL_CONFIGS = {
  /**
   * Fast, low-token classification. No structured schema enforcement here
   * because we embed the JSON shape in the prompt and parse manually — the
   * detect-image-type endpoint schema is too simple to warrant a full SDK
   * response schema. Keeping maxOutputTokens low keeps latency down.
   */
  classify: {
    temperature: 0,
    topK: 1,
    topP: 1.0,
    maxOutputTokens: 256,
    responseMimeType: 'application/json',
  },

  /**
   * Full nutrition analysis. Structured response schema is applied by the
   * caller (analyze-nutrition endpoint) since it requires SchemaType imports.
   * We keep token budget generous for large food plates.
   */
  nutrition: {
    temperature: 0,
    topK: 1,
    topP: 1.0,
    maxOutputTokens: 4096,
    responseMimeType: 'application/json',
  },

  /**
   * Weight scale reading. Low token budget — we only need one number.
   */
  weight: {
    temperature: 0,
    topK: 1,
    topP: 1.0,
    maxOutputTokens: 256,
    responseMimeType: 'application/json',
  },

  /**
   * Unified single-call inference (AIGateway.analyzeUnified).
   * Replaces the old classify→nutrition two-call chain.
   * Food plates rarely exceed 800 tokens; 2048 gives 2.5× headroom while
   * halving the previous 4096 allocation → less memory pre-reserved per call.
   */
  unified: {
    temperature: 0,
    topK: 1,
    topP: 1.0,
    maxOutputTokens: 2048,
    responseMimeType: 'application/json',
  },
};

// ── Singleton factory ─────────────────────────────────────────────────────────

/** @type {GoogleGenerativeAI | null} */
let _genAI = null;

/** @type {Map<string, import('@google/generative-ai').GenerativeModel>} */
const _modelCache = new Map();

/**
 * Initialise (or return cached) the GoogleGenerativeAI root instance.
 * Throws if GEMINI_API_KEY is not set.
 */
function getGenAI() {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      const err = new Error('GEMINI_API_KEY environment variable is not set');
      err.code = 'SERVER_CONFIG_ERROR';
      throw err;
    }
    _genAI = new GoogleGenerativeAI(apiKey);
    logger.info('geminiClient: GoogleGenerativeAI instance created');
  }
  return _genAI;
}

/**
 * Return a cached Gemini model for the given configuration key.
 *
 * @param {'classify' | 'nutrition' | 'weight'} configKey
 * @param {object} [responseSchema]  Optional structured response schema (SDK SchemaType).
 * @returns {import('@google/generative-ai').GenerativeModel}
 */
export function getModel(configKey, responseSchema = null) {
  const cacheKey = responseSchema ? `${configKey}:schema` : configKey;

  if (!_modelCache.has(cacheKey)) {
    const genAI = getGenAI();
    const baseConfig = MODEL_CONFIGS[configKey];
    if (!baseConfig) {
      throw new Error(`geminiClient: unknown configKey '${configKey}'`);
    }

    const generationConfig = responseSchema
      ? { ...baseConfig, responseSchema }
      : baseConfig;

    const model = genAI.getGenerativeModel({
      model: MODEL_NAME,
      generationConfig,
    });

    _modelCache.set(cacheKey, model);
    logger.debug('geminiClient: model cached', { cacheKey });
  }

  return _modelCache.get(cacheKey);
}

/**
 * Build an inline-data part from a buffer + MIME type.
 * Avoids re-encoding in every endpoint.
 *
 * @param {Buffer} buffer
 * @param {string} mimeType
 * @returns {{ inlineData: { mimeType: string, data: string } }}
 */
export function imageInlinePart(buffer, mimeType) {
  return {
    inlineData: {
      mimeType: mimeType || 'image/jpeg',
      data: buffer.toString('base64'),
    },
  };
}

// Export SchemaType so callers don't need to re-import @google/generative-ai
export { SchemaType };
