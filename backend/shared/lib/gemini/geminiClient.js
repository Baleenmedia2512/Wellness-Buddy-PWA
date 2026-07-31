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
// MUST be first — SDK reads localStorage at import time (Node has none).

import './serverLocalStoragePolyfill.js';
import AIClient from "ai-token-monitor";
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import logger from '../logger.js';
import { getSupabaseClient } from '../../../utils/supabaseClient.js';

/** Short-lived cache so telemetry in one request doesn't double-hit DB. */
const _endUserCache = new Map();
const END_USER_CACHE_TTL_MS = 60_000;
/** Hard cap so a slow/unreachable monitor never holds a Vercel function open. */
const TELEMETRY_TIMEOUT_MS = 2_000;

/**
 * Resolve end-user name/email for ai-token-monitor from trace.userId.
 * Lightweight team_table lookup only — not used on the Gemini critical path.
 *
 * @param {string|null|undefined} userId
 * @returns {Promise<{ endUserName: string|null, endUserEmail: string|null }>}
 */
async function resolveEndUserForMonitor(userId) {
  if (userId == null || userId === '') {
    return { endUserName: null, endUserEmail: null };
  }
  const key = String(userId);
  const cached = _endUserCache.get(key);
  if (cached && Date.now() - cached.at < END_USER_CACHE_TTL_MS) {
    return { endUserName: cached.endUserName, endUserEmail: cached.endUserEmail };
  }

  try {
    const supabase = getSupabaseClient();
    const uid = Number.parseInt(key, 10);
    if (!Number.isFinite(uid) || uid <= 0) {
      return { endUserName: null, endUserEmail: null };
    }
    const { data, error } = await supabase
      .from('team_table')
      .select('"UserName", "Email"')
      .eq('"UserId"', uid)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const resolved = {
      endUserName: data?.UserName != null ? String(data.UserName) : null,
      endUserEmail: data?.Email != null ? String(data.Email) : null,
    };
    
    // Only cache if we actually found the user.
    // If they are mid-registration, they might not be in team_table yet.
    // Caching a "null" here would break telemetry for them for the next hour.
    if (resolved.endUserName !== null || resolved.endUserEmail !== null) {
      _endUserCache.set(key, { ...resolved, at: Date.now() });
    }
    
    return resolved;
  } catch (err) {
    logger.warn('geminiClient: failed to resolve end-user for token monitor', {
      userId: key,
      message: err?.message,
    });
    return { endUserName: null, endUserEmail: null };
  }
}

/**
 * Send monitor telemetry without blocking the AI response.
 * Identity lookup + SDK call run in the background with a hard timeout.
 *
 * @param {object} basePayload
 * @param {object|null} trace
 */
function enqueueMonitorTelemetry(basePayload, trace) {
  if (!process.env.AI_MONITOR_SDK_KEY) return;

  const run = async () => {
    const endUser = await resolveEndUserForMonitor(trace?.userId);

    await AIClient.sendTelemetry({
      ...basePayload,
      traceId: trace?.traceId ?? null,
      endUserId: trace?.userId ?? null,
      endUserEmail: endUser.endUserEmail,
      endUserName: endUser.endUserName,
    });
  };

  const timed = Promise.race([
    run(),
    new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error(`ai-token-monitor timed out after ${TELEMETRY_TIMEOUT_MS}ms`)),
        TELEMETRY_TIMEOUT_MS,
      );
    }),
  ]);

  void timed.catch((sdkErr) => {
    logger.warn('geminiClient: telemetry skipped', {
      status: basePayload?.status ?? null,
      message: sdkErr?.message,
    });
  });
}
// ── Model configuration catalogue ────────────────────────────────────────────
// Each entry defines the generation config for a specific task. Keeping them
// here ensures all endpoints share identical hyperparameters.

export const MODEL_NAME          = 'gemini-2.5-flash';
/** Fallback when the primary model is saturated (502 / 503 / 429 / high-demand). */
export const FALLBACK_MODEL_NAME = 'gemini-2.5-pro';

/**
 * NOTE: thinkingBudget is intentionally NOT set for gemini-2.5-flash.
 * Flash is a thinking model — disabling thinking (thinkingBudget: 0) causes
 * structured-output failures on complex 26-field nutrition schemas.
 * Flash uses its natural dynamic thinking for reliable JSON generation.
 * The fallback (gemini-2.5-pro) also uses full thinking via the same path.
 */
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
   * Profile face check — simple boolean JSON.
   * thinkingBudget: 0 is safe here (unlike unified nutrition): a yes/no face
   * question does not need model introspection, and leaving Flash's default
   * thinking on with a tiny maxOutputTokens budget often truncates output.
   */
  faceDetect: {
    temperature: 0,
    topK: 1,
    topP: 1.0,
    maxOutputTokens: 128,
    responseMimeType: 'application/json',
    thinkingConfig: {
      thinkingBudget: 0,
    },
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
   *
   * Token budget breakdown for gemini-2.5-flash (thinking model):
   *   maxOutputTokens includes BOTH thinking and actual output tokens.
   *   A complex food plate analysis uses ~2000 thinking tokens.
   *   A full 26-field × 3 food item response needs ~800–1500 output tokens.
   *   Previous budget of 2048 left only ~86 tokens for output → MAX_TOKENS
   *   truncation → incomplete JSON → parse failure → routes to "other".
   *
   *   thinkingBudget: 2048  — caps model introspection (enough for accuracy)
   *   maxOutputTokens: 8192 — 2048 thinking + up to 6144 for JSON output
   */
  unified: {
    temperature: 0,
    topK: 1,
    topP: 1.0,
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
    thinkingConfig: {
      thinkingBudget: 2048,
    },
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
    try {
  if (process.env.AI_MONITOR_SDK_KEY) {
    AIClient.initialize({
      baseURL:
        process.env.AI_MONITOR_BASE_URL ||
        "https://ai-token-monitor-backend.onrender.com/api",

      sdkKey: process.env.AI_MONITOR_SDK_KEY,

      token:
        process.env.AI_MONITOR_TOKEN || "",

      appName: "Wellness valley",

      environment:
        process.env.NODE_ENV || "development",
    });

    logger.info("AI Token Monitor SDK initialized");
  }
} catch (sdkInitErr) {
  logger.warn("geminiClient: AI monitor SDK init skipped", {
    message: sdkInitErr?.message,
  });
}
    logger.info('geminiClient: GoogleGenerativeAI instance created');
  }
  return _genAI;
}

/**
 * Return a cached Gemini model for the given configuration key.
 *
 * @param {'classify' | 'faceDetect' | 'nutrition' | 'weight' | 'unified'} configKey
 * @param {object} [responseSchema]  Optional structured response schema (SDK SchemaType).
 * @param {string} [modelOverride]   Override the default model name (e.g. FALLBACK_MODEL_NAME).
 * @returns {import('@google/generative-ai').GenerativeModel}
 */
export function getModel(configKey, responseSchema = null, modelOverride = null) {
  const modelName = modelOverride ?? MODEL_NAME;
  const cacheKey  = responseSchema
    ? `${modelName}:${configKey}:schema`
    : `${modelName}:${configKey}`;

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
      model: modelName,
      generationConfig,
    });

    _modelCache.set(cacheKey, model);
    logger.debug('geminiClient: model cached', { cacheKey, modelName });
  }

  return _modelCache.get(cacheKey);
}

/**
 * Clear all cached model instances.
 * Call this in development when MODEL_CONFIGS is changed at runtime.
 * Not needed in production (Vercel serverless — each cold start is fresh).
 */
export function clearModelCache() {
  _modelCache.clear();
  logger.debug('geminiClient: model cache cleared');
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
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('imageInlinePart: image buffer is missing or empty');
  }
  return {
    inlineData: {
      mimeType: mimeType || 'image/jpeg',
      // Always encode from a real Buffer — String#toString('base64') is a no-op
      // and would forward raw values like "data:," straight to Gemini.
      data: buffer.toString('base64'),
    },
  };
}

export async function generateContent(
  configKey,
  parts,
  responseSchema = null,
  modelOverride = null,
  trace = null
) {
  const model = getModel(
    configKey,
    responseSchema,
    modelOverride
  );

  const start = Date.now();

  try {
    const result = await model.generateContent(parts);
    const latency = Date.now() - start;

    // Never await monitor I/O on the request path (Vercel concurrency / timeouts).
    enqueueMonitorTelemetry({
      provider: 'Gemini',
      model: modelOverride ?? MODEL_NAME,
      usage: result.response.usageMetadata,
      latency,
      status: 'SUCCESS',
    }, trace);

    return result;
  } catch (err) {
    const latency = Date.now() - start;

    enqueueMonitorTelemetry({
      provider: 'Gemini',
      model: modelOverride ?? MODEL_NAME,
      usage: {},
      latency,
      status: 'FAILED',
      errorMessage: err.message,
    }, trace);

    throw err;
  }
}

// Export SchemaType so callers don't need to re-import @google/generative-ai
export { SchemaType };
