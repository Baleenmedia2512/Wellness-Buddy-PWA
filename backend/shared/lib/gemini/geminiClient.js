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
import { waitUntil } from '@vercel/functions';
// Do not fs.readFileSync / resolve package.json via __dirname — on Vercel the
// bundled chunk lives under .next/server/chunks, so that path becomes
// /vercel/path0/package.json and throws ENOENT. Keep fallback in sync with
// backend/package.json "version".
const APP_VERSION = process.env.npm_package_version || '3.4.8';

// Hardcoded enum since the SDK doesn't export it
const ANALYSIS_MODULES = {
  FOOD_IMAGE_ANALYSIS: 'Food Image Analysis',
  FACE_DETECTION: 'Face Detection',
  PROFILE_IMAGE_UPDATE: 'Profile Image Update',
  PROFILE_IMAGE_SET: 'Profile Image Set'
};
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import logger from '../logger.js';
import { getSupabaseClient } from '../../../utils/supabaseClient.js';
import sharp from 'sharp';

/** Short-lived cache so telemetry in one request doesn't double-hit DB. */
const _endUserCache = new Map();
const END_USER_CACHE_TTL_MS = 60_000;
/** Hard cap so a slow/unreachable monitor never holds a Vercel function open. */
const TELEMETRY_TIMEOUT_MS = 2_000;

/** Production AI token-monitor API (not this Wellness Next.js app). */
const DEFAULT_AI_MONITOR_BASE_URL =
  'https://e2-w-ai-token-monitor.vercel.app/api';

/**
 * Resolve the token-monitor base URL.
 * If AI_MONITOR_BASE_URL points at this Wellness app (:3000), ignore it and
 * use the production monitor — otherwise POST /api/sdk/log 404s here.
 */
function resolveAiMonitorBaseUrl() {
  const raw = (process.env.AI_MONITOR_BASE_URL || '').trim();
  if (!raw) return DEFAULT_AI_MONITOR_BASE_URL;

  if (/localhost:3000/i.test(raw) || /127\.0\.0\.1:3000/i.test(raw)) {
    logger.warn(
      'geminiClient: AI_MONITOR_BASE_URL points at this Next.js app — '
      + 'ignoring and using token-monitor service URL',
      { configured: raw, using: DEFAULT_AI_MONITOR_BASE_URL },
    );
    return DEFAULT_AI_MONITOR_BASE_URL;
  }

  return raw;
}

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
 * Send monitor telemetry to ai-token-monitor.
 * Runs identity lookup + SDK call with a hard timeout.
 * Called by reportAiCallTelemetry (outside the model timeout budget).
 *
 * @param {object} basePayload
 * @param {object|null} trace
 */
async function sendMonitorTelemetry(basePayload, trace) {
  if (!process.env.AI_MONITOR_SDK_KEY) {
    logger.warn('geminiClient: telemetry skipped — AI_MONITOR_SDK_KEY is not set', {
      status: basePayload?.status ?? null,
      model: basePayload?.model ?? null,
      latency: basePayload?.latency ?? null,
    });
    return;
  }

  // Ensure SDK initialize() has run (happens inside getGenAI on first model use).
  try {
    getGenAI();
  } catch (_) {
    /* GEMINI key missing — still attempt monitor if SDK was inited elsewhere */
  }

  logger.info('geminiClient: sending token-monitor telemetry', {
    status: basePayload?.status ?? null,
    model: basePayload?.model ?? null,
    latency: basePayload?.latency ?? null,
    baseURL: resolveAiMonitorBaseUrl(),
  });

  const run = async () => {
    let endUserName = trace?.userName ?? null;
    let endUserEmail = trace?.userEmail ?? null;

    if (!endUserName && !endUserEmail && trace?.userId) {
      const endUser = await resolveEndUserForMonitor(trace.userId);
      endUserName = endUser.endUserName;
      endUserEmail = endUser.endUserEmail;
    }

    await AIClient.sendTelemetry({
      ...basePayload,
      traceId: trace?.traceId ?? null,
      endUserId: trace?.userId ?? null,
      endUserEmail,
      endUserName,
      appVersion: trace?.appVersion ?? APP_VERSION,
      // Image-analysis attribution is carried by the request trace. Default
      // food calls for compatibility with legacy callers that predate modules.
      module: trace?.module ?? ANALYSIS_MODULES.FOOD_IMAGE_ANALYSIS,
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

  try {
    await timed;
    logger.info('geminiClient: token-monitor telemetry sent', {
      status: basePayload?.status ?? null,
    });
  } catch (sdkErr) {
    logger.warn('geminiClient: telemetry skipped or failed', {
      status: basePayload?.status ?? null,
      message: sdkErr?.message,
    });
  }
}
// ── Model configuration catalogue ────────────────────────────────────────────
// Each entry defines the generation config for a specific task. Keeping them
// here ensures all endpoints share identical hyperparameters.
//
// MODEL PINNING (mandatory):
// - We call ONLY the model IDs declared below. Google releasing Gemini 3.x
//   (or any newer family) must NEVER change what we call.
// - Do NOT use floating aliases: `*-latest`, `gemini-flash`, `gemini-pro`, etc.
// - Gemini 2.5 stable codes (`gemini-2.5-flash` / `gemini-2.5-pro`) are the
//   production pins for the Developer API (not auto-updated to 3.x).
// - Optional env overrides (GEMINI_PRIMARY_MODEL / GEMINI_FALLBACK_MODEL) are
//   accepted ONLY when the value is in ALLOWED_GEMINI_MODELS — otherwise we
//   keep the pin and log a warning. Upgrades require a deliberate code change
//   (and allowlist update), never a silent Google alias rotation.

/** Declared production pins — change only via intentional PR. */
export const PINNED_PRIMARY_MODEL = 'gemini-2.5-flash';
export const PINNED_FALLBACK_MODEL = 'gemini-2.5-pro';

/**
 * Exact model IDs we are willing to call. Add a new ID here only when product
 * explicitly approves adopting that version.
 */
export const ALLOWED_GEMINI_MODELS = Object.freeze([
  PINNED_PRIMARY_MODEL,
  PINNED_FALLBACK_MODEL,
]);

const FLOATING_MODEL_RE = /(?:^gemini-(?:flash|pro)$|-latest$)/i;

/**
 * Resolve a model id against the allowlist. Never returns a floating alias.
 * @param {string|null|undefined} requested
 * @param {string} pinnedDefault
 * @param {string} [label]
 * @returns {string}
 */
export function resolvePinnedGeminiModel(requested, pinnedDefault, label = 'model') {
  const fallback = ALLOWED_GEMINI_MODELS.includes(pinnedDefault)
    ? pinnedDefault
    : PINNED_PRIMARY_MODEL;
  const raw = requested == null ? '' : String(requested).trim();
  if (!raw) return fallback;

  if (FLOATING_MODEL_RE.test(raw)) {
    logger.warn('geminiClient: rejected floating Gemini model alias — keeping pin', {
      label,
      requested: raw,
      using: fallback,
    });
    return fallback;
  }

  if (!ALLOWED_GEMINI_MODELS.includes(raw)) {
    logger.warn('geminiClient: rejected undeclared Gemini model — keeping pin', {
      label,
      requested: raw,
      allowed: ALLOWED_GEMINI_MODELS,
      using: fallback,
    });
    return fallback;
  }

  return raw;
}

export const MODEL_NAME = resolvePinnedGeminiModel(
  process.env.GEMINI_PRIMARY_MODEL,
  PINNED_PRIMARY_MODEL,
  'primary',
);
/** Fallback when the primary model is saturated (502 / 503 / 429 / high-demand). */
export const FALLBACK_MODEL_NAME = resolvePinnedGeminiModel(
  process.env.GEMINI_FALLBACK_MODEL,
  PINNED_FALLBACK_MODEL,
  'fallback',
);

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
      baseURL: resolveAiMonitorBaseUrl(),

      sdkKey: process.env.AI_MONITOR_SDK_KEY,

      token:
        process.env.AI_MONITOR_TOKEN || "",

      appName: "Wellness valley",

      appVersion: APP_VERSION,

      environment:
        process.env.AI_MONITOR_ENV || 
        (process.env.VERCEL_ENV === 'preview' ? 'test' : 
         process.env.VERCEL_ENV === 'production' ? 'production' : 
         process.env.NODE_ENV === 'production' ? 'production' : 'localhost'),
    });

    logger.info("AI Token Monitor SDK initialized", {
      baseURL: resolveAiMonitorBaseUrl(),
    });
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
  const modelName = resolvePinnedGeminiModel(
    modelOverride ?? MODEL_NAME,
    MODEL_NAME,
    'getModel',
  );
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

/**
 * Report one Gemini call to ai-token-monitor.
 * Call this OUTSIDE the RetryPolicy timeout so monitor I/O never steals
 * budget from the model call (and so SUCCESS is recorded before the HTTP response).
 *
 * @param {object} opts
 * @param {'SUCCESS'|'FAILED'} opts.status
 * @param {string|null} [opts.modelOverride]
 * @param {object|null} [opts.usage]
 * @param {number} opts.latency
 * @param {string|null} [opts.errorMessage]
 * @param {object|null} [opts.trace]
 * @param {Array|null} [opts.parts]
 */
export async function reportAiCallTelemetry({
  status,
  modelOverride = null,
  usage = {},
  latency,
  errorMessage = null,
  trace = null,
  parts = null,
}) {
  waitUntil(
    (async () => {
      let telemetryPrompt = '[Complex Prompt]';
      let telemetryImage = trace?.imageUrl;

      if (parts) {
        try {
          telemetryPrompt = JSON.stringify(parts).replace(
            /"data":"[^"]+"/g, 
            '"data":"[BASE64_IMAGE_REMOVED_FOR_LOGGING]"'
          );
        } catch (e) {
          logger.error("geminiClient: Telemetry prompt sanitization error", { error: e.message });
        }

        if (!telemetryImage) {
          const inlineData = parts.find(p => p.inlineData)?.inlineData;
          if (inlineData?.data) {
            try {
              const buffer = Buffer.from(inlineData.data, 'base64');
              const compressedBuffer = await sharp(buffer)
                .resize({ width: 256, withoutEnlargement: true })
                .jpeg({ quality: 60 })
                .toBuffer();
              telemetryImage = `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`;
            } catch (e) {
              telemetryImage = trace?.captureId ? `capture_${trace.captureId}` : null;
            }
          } else {
            telemetryImage = trace?.captureId ? `capture_${trace.captureId}` : null;
          }
        }
      }

      await sendMonitorTelemetry({
        provider: 'Gemini',
        model: resolvePinnedGeminiModel(modelOverride ?? MODEL_NAME, MODEL_NAME, 'telemetry'),
        usage: usage ?? {},
        latency,
        status,
        errorMessage,
        prompt: telemetryPrompt,
        imageName: telemetryImage,
      }, trace).catch(err => logger.error("geminiClient: Telemetry error", { error: err.message }));
    })()
  );
}

/**
 * Run a Gemini generateContent call only (no telemetry).
 * Telemetry must be reported by the caller after the timed retry wrapper.
 *
 * @returns {Promise<{ result: object, latencyMs: number }>}
 */
export async function generateContent(
  configKey,
  parts,
  responseSchema = null,
  modelOverride = null,
  _trace = null,
) {
  const model = getModel(
    configKey,
    responseSchema,
    modelOverride
  );

  const start = Date.now();
  try {
    const result = await model.generateContent(parts);
    return { result, latencyMs: Date.now() - start };
  } catch (err) {
    err.latencyMs = Date.now() - start;
    throw err;
  }
}

// Export SchemaType so callers don't need to re-import @google/generative-ai
export { SchemaType };
