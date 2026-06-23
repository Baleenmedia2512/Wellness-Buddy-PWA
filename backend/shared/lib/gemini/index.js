/**
 * backend/shared/lib/gemini/index.js
 * ---------------------------------------------------------------------------
 * Barrel export for all shared Gemini utilities.
 *
 * Usage:
 *   import { getModel, withRetry, safeParseJson, withTempFileCleanup } from '../../shared/lib/gemini/index.js';
 *
 * Note: classifyAndAnalyse is now re-exported from the enterprise
 * ai-orchestration layer, which provides idempotency, circuit breaking,
 * structured observability, and async enrichment queuing.
 * The legacy AIAnalysisOrchestrator.js in this folder is kept for reference
 * but all new code should import from ai-orchestration/.
 * ---------------------------------------------------------------------------
 */

export { getModel, imageInlinePart, SchemaType, MODEL_NAME, MODEL_CONFIGS } from './geminiClient.js';
export { withRetry } from './retryPolicy.js';
export { safeParseJson, validateShape, parseAndValidate } from './safeJson.js';
export { withTempFileCleanup, cleanupFiles } from './tempFileCleanup.js';

// classifyAndAnalyse now delegates to the enterprise orchestrator.
// Legacy callers remain unchanged; new callers should use
// '../ai-orchestration/index.js' directly for the full OrchestratorResult shape.
export { classifyAndAnalyse, CONFIDENCE_THRESHOLD as CONFIDENCE } from '../ai-orchestration/AIAnalysisOrchestrator.js';
