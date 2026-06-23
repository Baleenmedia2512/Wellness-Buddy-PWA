/**
 * backend/shared/lib/gemini/index.js
 * ---------------------------------------------------------------------------
 * Barrel export for all shared Gemini utilities.
 *
 * Usage:
 *   import { getModel, withRetry, safeParseJson, withTempFileCleanup } from '../../shared/lib/gemini/index.js';
 * ---------------------------------------------------------------------------
 */

export { getModel, imageInlinePart, SchemaType, MODEL_NAME, MODEL_CONFIGS } from './geminiClient.js';
export { withRetry } from './retryPolicy.js';
export { safeParseJson, validateShape, parseAndValidate } from './safeJson.js';
export { withTempFileCleanup, cleanupFiles } from './tempFileCleanup.js';
export { classifyAndAnalyse, CONFIDENCE } from './AIAnalysisOrchestrator.js';
