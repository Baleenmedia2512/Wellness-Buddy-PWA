/**
 * backend/shared/lib/gemini/index.js
 * ---------------------------------------------------------------------------
 * Barrel export for shared Gemini utilities.
 *
 * Active files:
 *   geminiClient.js     — Gemini SDK singleton + model cache
 *   safeJson.js         — safe JSON parsing for Gemini responses
 *   tempFileCleanup.js  — formidable temp-file cleanup helper
 *
 * The full AI pipeline lives in ../ai-orchestration/.
 * Import from there for orchestration, retry, circuit-breaking, and tracing.
 * ---------------------------------------------------------------------------
 */

export { getModel, imageInlinePart, SchemaType, MODEL_NAME, FALLBACK_MODEL_NAME, MODEL_CONFIGS } from './geminiClient.js';
export { safeParseJson, validateShape, parseAndValidate } from './safeJson.js';
export { withTempFileCleanup, cleanupFiles } from './tempFileCleanup.js';

// classifyAndAnalyse — delegates to the enterprise orchestrator.
export { classifyAndAnalyse, CONFIDENCE_THRESHOLD as CONFIDENCE } from '../ai-orchestration/AIAnalysisOrchestrator.js';
