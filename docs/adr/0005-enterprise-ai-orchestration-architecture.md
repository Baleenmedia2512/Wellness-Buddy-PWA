# ADR-0005 — Enterprise AI Orchestration Architecture

| Field       | Value                                                                  |
|-------------|------------------------------------------------------------------------|
| **Status**  | Accepted                                                               |
| **Date**    | 2026-06-23                                                             |
| **Scope**   | `backend/shared/lib/ai-orchestration/` + three new `/api/ai/` routes  |
| **Authors** | @principal-eng (required — domain change per claude.md §8)            |
| **Replaces**| Inline classify→nutrition two-call chain in capture routes             |

---

## 1. Context

### 1.1 Problem Statement

The previous image analysis path performed **two sequential Gemini API calls** per food capture:

1. `POST /api/ai/detect-image-type` — classify the image (Gemini call #1)
2. `POST /api/ai/analyze-nutrition` — extract 26 nutrition fields (Gemini call #2)

Both calls uploaded the same image and processed it independently. This created four compounding problems:

| Problem | Impact |
|---|---|
| Double image upload | 2× network round-trip before any response |
| 4 096-token output budget on every call | High latency + token cost even for non-food images |
| 26-field schema in the critical path | `analyze-nutrition` took 3–6 s for complex meals |
| No retry / circuit-breaker | A single Gemini 429 / 500 surfaced as a failed capture |
| Frontend orchestration | Race conditions when the network or save step failed between the two AI calls |

### 1.2 Goals

- **Perceived latency ≤ 2 s** — user sees type + macros before micronutrients arrive.
- **≤ 1 024 output tokens** in the critical path — dramatic cost and latency reduction.
- **Single image upload per analysis** — no duplicate Base64 transfer.
- **Background enrichment** — vitamins & minerals computed asynchronously after the user has the result they need.
- **Production-grade reliability** — exponential back-off, per-attempt timeout, circuit breaker, idempotency guard.
- **Zero breaking changes** — legacy endpoints (`detect-image-type`, `analyze-nutrition`, `detect-weight`) continue to work unchanged.

---

## 2. Decision

Introduce a new **AI Orchestration Layer** at `backend/shared/lib/ai-orchestration/` that is the single entry point for all image analysis.

### 2.1 New components

```
backend/shared/lib/ai-orchestration/
  AIAnalysisOrchestrator.js   ← Public API: analyse(), classifyAndAnalyse()
  AIGateway.js                ← Model abstraction: analyzeUnified(), enrichNutrition(), …
  JobQueue.js                 ← Async job queue (in-memory + Supabase durable store)
  JobWorker.js                ← Enrichment job processor (drainQueue / processNextJob)
  CircuitBreaker.js           ← Three-state breaker (CLOSED → OPEN → HALF_OPEN)
  RetryPolicy.js              ← Enterprise retry: backoff, timeout, breaker, 429 honour
  ObservabilityTracer.js      ← Trace context: traceId, stages, token usage, retries
  IdempotencyGuard.js         ← Duplicate-capture protection (in-memory map, TTL-based)
  AnalysisStatus.js           ← PENDING→ANALYZING→FAST_COMPLETE→ENRICHING→COMPLETE|FAILED
  index.js                    ← Barrel export
```

Three new API routes:

```
backend/pages/api/ai/
  orchestrate.js    ← New unified entry point (replaces two-call chain for new clients)
  job-status.js     ← Enrichment job polling (GET /api/ai/job-status?jobId=…)
  worker.js         ← Cron worker trigger (POST /api/ai/worker, Bearer-authenticated)
```

### 2.2 Single Gemini call — `analyzeUnified()`

Replaces the classify + nutrition two-call chain with one multimodal inference:

**Request:**
- Model config key: `unified`  
- `maxOutputTokens`: 1 024 (down from 4 096)
- Schema: `imageType`, `confidence`, plus a single typed field populated for the matched category

**Response fields (fast path, ≤ 2 s):**

```json
{
  "imageType":     "food | weight | education | smartwatch | other",
  "confidence":    0.95,
  "fastNutrition": { "calories": 350, "protein": 20, "carbs": 40, "fat": 10, "fiber": 5 },
  "weightReading": null,
  "smartwatchData": null,
  "educationData": null
}
```

Only the field matching `imageType` is populated. All others are empty objects/null. This ensures Gemini's output token usage scales with the actual content type — not the worst case.

### 2.3 Background enrichment — `enrichNutrition()`

For food captures only, a second Gemini call (model key: `nutrition`) runs asynchronously via `JobQueue` + `JobWorker`:

- Prompt includes fast-macro context (`calories=N, protein=N, …`) to prevent re-analysis.
- Returns 21 micronutrient fields (vitamins + minerals), not macros.
- Results written back to `food_nutrition_data_table` via `EnrichmentStatus` column.
- Client polls `/api/ai/job-status?jobId=…` or subscribes to Supabase Realtime.

### 2.4 Analysis state machine

```
PENDING
  ↓  (Gemini call starts)
ANALYZING
  ↓  (fast result returned; domain row persisted via confirmPersisted())
FAST_COMPLETE
  ↓  (for food: enrichment job enqueued)
ENRICHING
  ↓  (enrichment write-back succeeded; confirmEnrichmentComplete())
COMPLETE
```

`FAILED` is reachable from any state. `FAST_COMPLETE` MUST NOT be set before the corresponding domain row exists in the database (see `confirmPersisted()` contract in `AIAnalysisOrchestrator.js`).

### 2.5 Backward compatibility

Legacy endpoints delegate internally but their external contracts are **unchanged**:

| Endpoint | Behaviour |
|---|---|
| `POST /api/ai/detect-image-type` | Unchanged — still calls geminiClient directly |
| `POST /api/ai/analyze-nutrition` | Unchanged — still calls geminiClient directly |
| `POST /api/ai/detect-weight`     | Unchanged — still calls geminiClient directly |
| `classifyAndAnalyse()` (gemini/index.js) | Delegates to orchestrator; returns legacy shape |

New clients SHOULD migrate to `POST /api/ai/orchestrate`.

---

## 3. Consequences

### 3.1 Positive

- **Latency**: food path drops from ~4–6 s to **≤ 2 s perceived** (macros returned before vitamins).
- **Token cost**: critical path reduced from 4 096 → **1 024** output tokens (≈ 75 % reduction).
- **Reliability**: 3-attempt retry with jittered exponential back-off + circuit breaker; `CIRCUIT_OPEN` errors fail fast rather than hanging.
- **Idempotency**: duplicate `captureId` submissions within 5 min return a cached result, preventing double Gemini spend.
- **Observability**: every pipeline run emits a single structured log entry (`ai.pipeline.complete`) containing traceId, latency, token usage, retry count, and model version.
- **Testability**: orchestration, retry, circuit-breaker, and queue logic are independently unit-testable without any Gemini credentials.

### 3.2 Negative / Risks

| Risk | Mitigation |
|---|---|
| In-memory JobQueue lost on cold start | Supabase `ai_analysis_jobs_table` is the durable store; cron worker picks up on restart |
| Vercel Cron fires at most once per minute | Acceptable — micronutrients appear within 1–2 min of capture save |
| IdempotencyGuard is per-instance | Acceptable for Vercel (serverless, single warm instance per request) |
| `FAST_COMPLETE` set before DB row exists | Prevented by `confirmPersisted()` contract; never called speculatively |

### 3.3 Dependencies added

None. The orchestration layer uses only modules already in the dependency graph (`@google/generative-ai`, `crypto`, Supabase client).

---

## 4. Alternatives considered

| Alternative | Reason rejected |
|---|---|
| Keep two-call chain, add retry only | Does not solve double-upload or latency; deferred macros still require architecture change |
| Use a dedicated background job service (BullMQ / Redis) | Adds an infra dependency not in the current stack; Supabase-backed in-memory queue achieves the same result at zero infra cost for current scale |
| Run enrichment in the same request (parallel calls) | Still blocks the HTTP response for the slowest Gemini call; violates the ≤ 2 s target |

---

## 5. Migration steps

1. **Deploy** `ai-orchestration/` library and three new API routes.
2. **Run migration** `docs/migrations/ai_analysis_jobs_table.sql` on the Supabase production database.
3. **Run migration** `docs/migrations/food_nutrition_enrichment_status.sql` to add `EnrichmentStatus` column.
4. **Add** `/api/ai/worker` cron entry to `vercel.json` (schedule: `* * * * *`).
5. **Set** `WORKER_SECRET` environment variable in Vercel.
6. **Verify** legacy endpoints (`detect-image-type`, `analyze-nutrition`, `detect-weight`) still return correct responses via smoke tests.
7. **Monitor** `ai.pipeline.complete` structured logs for latency and token usage.
8. **Update** frontend to call `/api/ai/orchestrate` and poll `/api/ai/job-status`.

### 5.1 Rollback

All legacy endpoints are unchanged. Rollback = redeploy the previous Vercel deployment (< 2 min). The new routes and DB migration are additive; no rollback migration is needed.

---

## 6. Security notes

- `GEMINI_API_KEY` is server-side only; never returned in responses.
- `/api/ai/worker` requires `Authorization: Bearer <WORKER_SECRET>` — constant-time comparison prevents timing attacks.
- `ai_analysis_jobs_table` has RLS enabled; users may only read their own job records. Workers use the service-role key.
- `imageBase64` is NOT stored in Supabase to prevent inadvertent PII exposure via the jobs table.

---

## 7. References

- [`backend/shared/lib/ai-orchestration/MIGRATION_PLAN.md`](../../backend/shared/lib/ai-orchestration/MIGRATION_PLAN.md)
- [`claude.md §10`](../../claude.md) — AI-Assisted Development Policy
- [`claude.md §13`](../../claude.md) — Security Policy (OWASP-aligned)
- ADR-0004 — Body Parameters Card (prior cross-feature precedent)
