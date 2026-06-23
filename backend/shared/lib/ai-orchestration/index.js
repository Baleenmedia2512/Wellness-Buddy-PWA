/**
 * backend/shared/lib/ai-orchestration/index.js
 * ---------------------------------------------------------------------------
 * Barrel export for the AI Orchestration layer.
 *
 * Import path: '../../shared/lib/ai-orchestration/index.js'
 *
 * Public surface:
 *   Orchestrator  → analyse(), classifyAndAnalyse(), CONFIDENCE_THRESHOLD
 *   AI Gateway    → analyzeUnified(), classifyImage(), analyzeNutrition(),
 *                   enrichNutrition(), detectWeight(), detectMeeting()
 *   Job Queue     → jobQueue (singleton), JOB_STATUS
 *   Job Worker    → processNextJob(), drainQueue()
 *   Retry         → withEnterpriseRetry(), getBreakerStates()
 *   Observability → TraceContext
 *   Idempotency   → idempotencyGuard
 * ---------------------------------------------------------------------------
 */

// ── Orchestrator ──────────────────────────────────────────────────────────────
export {
  analyse,
  classifyAndAnalyse,
  CONFIDENCE_THRESHOLD,
} from './AIAnalysisOrchestrator.js';

// ── AI Gateway ────────────────────────────────────────────────────────────────
export {
  analyzeUnified,
  classifyImage,
  analyzeNutrition,
  enrichNutrition,
  detectWeight,
  detectMeeting,
} from './AIGateway.js';

// ── Job Queue ─────────────────────────────────────────────────────────────────
export { jobQueue, JOB_STATUS } from './JobQueue.js';

// ── Job Worker ────────────────────────────────────────────────────────────────
export { processNextJob, drainQueue } from './JobWorker.js';

// ── Retry Policy ──────────────────────────────────────────────────────────────
export { withEnterpriseRetry, getBreakerStates } from './RetryPolicy.js';

// ── Observability ─────────────────────────────────────────────────────────────
export { TraceContext } from './ObservabilityTracer.js';

// ── Idempotency ───────────────────────────────────────────────────────────────
export { idempotencyGuard } from './IdempotencyGuard.js';

// ── Circuit Breaker ───────────────────────────────────────────────────────────
export { getBreaker, allBreakerStates, CircuitBreaker } from './CircuitBreaker.js';
