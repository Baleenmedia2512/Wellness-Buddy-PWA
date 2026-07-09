# `backend/backend.md` — Backend Engineering Reference

> **Scope:** everything under `backend/`. Binding for humans + AI.
> **Parent:** [`/claude.md`](../claude.md) holds cross-cutting rules. This file holds backend specifics.
> **Status:** describes the codebase **as it actually is**, and marks the **target** pattern for new code.
> **Version:** 3.3.0

---

## 1. Stack

- **Next.js 15.3.6** (API routes only — no SSR pages for app UI), **React 18.3**, JavaScript (no TS), `jsconfig.json` paths.
- **Data:** Supabase JS client (`@supabase/supabase-js` ^2.90) **and** `pg` Pool (^8.16). `mysql2` has been fully removed.
- **Validation:** `joi@18` is installed but most validators are hand-written. See §6.
- **Other deps:** `bcryptjs`, `@google/generative-ai`, `nodemailer`, `formidable` (multipart uploads). Dev: `cross-env`, `eslint`. No `date-fns`, `firebase-admin`, or Jest in backend deps.

---

## 2. Folder layout (`backend/features/<domain>/`)

Two patterns coexist. Pick **Pattern A for all new code**; do not add to Pattern B.

### Pattern A — VSA split (TARGET, use for new work)
```
features/<domain>/
  api/         <action>.handler.js     # thin orchestration
  domain/      <thing>.rules.js        # pure logic, no I/O
  data/        <thing>.repo.js         # DB access only
  validation/  <thing>.schema.js       # input validation
  __tests__/   *.test.js  (+ MATRIX.md)
  README.md
```
Reference slice: [features/water](features/water) (`api/intake.handler.js`, `domain/intake.rules.js`, `data/water.repo.js`, `validation/intake.schema.js`). Other Pattern-A slices: `body-parameters-card`, `weight-progress-tips`, `captures`, `idle-cleanup`, `background-analysis` (diary), `wellness-score`.

### Pattern B — flat service files (LEGACY, do not extend)
```
features/<domain>/
  <domain>.service.js
  <domain>.repository.js
  <domain>.validators.js
  __tests__/
```
Used by: `weight`, `activity`, `nutrition-centers`, `education`, `food-corrections`, `misc`, `user`, `reports`, `testimonials`. `auth` is hybrid (flat files + `domain/` + `data/`).

> **Full feature list:** `activity`, `auth`, `background-analysis`, `body-parameters-card`, `captures`, `education`, `food-corrections`, `idle-cleanup`, `misc`, `nutrition-centers`, `reports`, `testimonials`, `user`, `water`, `weight`, `weight-progress-tips`, `wellness-score`. (There are no longer standalone `token`, `screen`, or `tasks` feature folders.)

> When you touch a Pattern-B feature substantially, prefer extracting changed logic into `domain/` rather than growing the service file. Full rewrites need a separate refactor PR.

---

## 3. Layer rules

| Layer | May do | May NOT import |
|---|---|---|
| `api/` (handler) | orchestrate: validate → call domain → call data → shape response | `pg`, `supabase` directly |
| `domain/` | pure functions only | `axios`, `fetch`, `pg`, `supabase`, `next/*`, `process.env`, `Date.now()` (inject a clock) |
| `data/` | the **only** place that talks to Supabase / `pg` | another feature's internals |
| `validation/` | shape/type/range checks | I/O |

- A feature may import its own layers + `shared/*` + `utils/*`. It may **not** import another `features/*` internals.
- No deep relative paths (`../../../`). Use `jsconfig.json` aliases.

---

## 4. API routes (`backend/pages/api/`)

- One folder per domain; route files are lowercase verb/action names: [pages/api/water/intake.js](pages/api/water/intake.js), [pages/api/weight/save.js](pages/api/weight/save.js).
- Route-domain folders today: `activity`, `admin`, `ai`, `auth`, `background-analysis`, `body-parameters-card`, `captures`, `coach`, `counselling`, `cron`, `diary`, `education`, `food-corrections`, `leaderboard`, `misc`, `nutrition-centers`, `reports`, `share`, `team`, `testimonials`, `upline`, `user`, `users`, `water`, `weight`, `weight-progress-tips`, `wellness-score`, `wellness-university`.
- Handlers are **thin**: apply CORS, check method, delegate to the feature via `runService`.
- Use the shared helpers in [shared/lib/handler.js](shared/lib/handler.js): `applyCors`, `methodNotAllowed`, `runService`.
- Set explicit status codes (200/201/400/401/403/404/409/422/500).

### Response envelope
Three shapes exist today. **For new code use one consistent shape per feature:**
- **Preferred (new slices):** `{ ok: true, data }` / `{ ok: false, error: { code, message } }`.
- `runService` contract: a service returns `{ httpStatus, body, headers? }`; on thrown error it emits `{ success: false, message }`.
- Legacy payloads use `{ success: true, ... }`.

Do not return a bare string. Always JSON.

---

## 5. Database access

- `pg` Pool via [utils/dbPool.js](utils/dbPool.js) — `getPool()` / `dbPool()`. Exposes a MySQL-compatible API (`execute`, `?`→`$1` conversion, IPv4-forced DNS). Used in `tasks`, `water`.
- Supabase via [utils/supabaseClient.js](utils/supabaseClient.js) — `getSupabaseClient().from('table')`. Used in `activity`, `background-analysis`, `weight-progress-tips`, etc. Also exports IST helpers `getISTTimestamp`, `convertToIST`.
- **Always parameterise.** No string-built SQL in feature code.
- Tables are `snake_case` (e.g. `weight_records_table`, `team_table`, `daily_step_activity`).
- Pick `pg` **or** Supabase per feature and keep it consistent within that feature.

### Migrations (`backend/migrations/`)
- New files: `NNNN_description.sql`, forward-only. To revert, write a new migration.
- The folder currently holds only the testimonials migrations (`create_testimonials_table.sql`, `add_video_columns_to_testimonials.sql`); most schema lives directly in Supabase. Do **not** reuse a taken name; keep new files descriptive and forward-only.
- Add RLS policies for every new table. Never edit a merged migration.

---

## 6. Validation

- `ValidationError` from [shared/lib/ValidationError.js](shared/lib/ValidationError.js): `throw new ValidationError(status, message)`.
- Current validators are hand-written imperative checks + regex (see [features/weight/weight.validators.js](features/weight/weight.validators.js), [features/water/validation/intake.schema.js](features/water/validation/intake.schema.js)).
- `joi` is available if a schema is genuinely clearer — but match the surrounding file's style. No `zod` (not installed).

---

## 7. Shared & utils (use these — do not reinvent)

`backend/shared/lib/` (these **exist**):
- [logger.js](shared/lib/logger.js) — default export `logger` (`debug/info/warn/error`; `debug` no-op in prod).
- [handler.js](shared/lib/handler.js) — `applyCors`, `methodNotAllowed`, `runService`.
- [feature-flags.js](shared/lib/feature-flags.js) — `ff.<name>` registry + `isEnabled` / `findStaleFlags` / `getSpec`.
- [auth-helpers.js](shared/lib/auth-helpers.js), [ValidationError.js](shared/lib/ValidationError.js), [userActivity.js](shared/lib/userActivity.js).
- `shared/lib/ai-orchestration/` — AI pipeline: `AIAnalysisOrchestrator`, `AIGateway`, `JobQueue`, `JobWorker`, `CircuitBreaker`, `RetryPolicy`, `IdempotencyGuard`, `ObservabilityTracer` (+ `cache/`, `interfaces/`, `migrations/`).
- `shared/lib/gemini/` — `geminiClient.js`, `safeJson.js`, `tempFileCleanup.js`, `prompts/`.
- `shared/services/pushNotificationService.js`.

> Do **not** assume these exist (referenced in old docs but **absent**): `rate-limit.js`, `notifications/`, `public-routes.js`, `storage.js`.

`backend/utils/` central helpers:
- [disciplineCalculations.js](utils/disciplineCalculations.js) — discipline %, MySQL-connection style.
- [disciplineCalculationsSupabase.js](utils/disciplineCalculationsSupabase.js) — Supabase variant (second source — confirm which one the feature uses).
- [disciplineHelpers.js](utils/disciplineHelpers.js) — shared discipline helper functions.
- [timezoneConverter.js](utils/timezoneConverter.js) — IST (UTC+5:30) ↔ user-local. Use for "today"; never raw `new Date()`.
- [timestampUtils.js](utils/timestampUtils.js) — timestamp formatting helpers.
- [hierarchyHelpers.js](utils/hierarchyHelpers.js) — recursive team-stat aggregation. See [HIERARCHY_HELPERS_GUIDE.md](utils/HIERARCHY_HELPERS_GUIDE.md).
- [teamHierarchyBuilder.js](utils/teamHierarchyBuilder.js) — builds the team tree consumed by hierarchy helpers.
- [weightValidation.js](utils/weightValidation.js) — corrects AI/OCR weight misreads.
- [foodTypeDetection.js](utils/foodTypeDetection.js) — liquid/solid food classification.
- [bmrCalculations.js](utils/bmrCalculations.js), [tdeeCalculations.js](utils/tdeeCalculations.js) — BMR / TDEE energy math (unit-tested).
- [timeReportHelpers.js](utils/timeReportHelpers.js) — activity/time-report aggregation helpers.
- [cache.js](utils/cache.js) — in-process cache helper.
- [apiConfig.js](utils/apiConfig.js) — `largeBodyConfig` (10mb body parser for image routes).

> Changing `disciplineCalculations*`, `timezoneConverter`, or `hierarchyHelpers` requires a `@principal-eng` mention.

---

## 8. Logging

- Use the shared `logger`. **Target:** no `console.*` in shipped code.
- Reality: `console.*` is still widespread (`supabaseClient.js`, `handler.js`, `weight-progress-tips`, `background-analysis`). Do not add more; migrate when you touch the file.
- Never log full request bodies, secrets, or PII (emails/phones/tokens).

---

## 9. Testing

- There is **no** `jest.config.js` and no test runner wired into `backend/package.json` scripts today; Jest/supertest/nock/pg-mem are **not** in deps.
- A handful of co-located unit tests still exist under `__tests__/` and describe the intended pattern: [utils/__tests__/bmrCalculations.test.js](utils/__tests__/bmrCalculations.test.js), [utils/__tests__/tdeeCalculations.test.js](utils/__tests__/tdeeCalculations.test.js), [features/wellness-score/__tests__/score.rules.test.js](features/wellness-score/__tests__/score.rules.test.js).
- **Target for new work:** co-locate `*.test.js` in the feature's `__tests__/`; pure `domain/`/`utils` functions get direct unit tests with no mocks. If you add a suite, also add the runner + config back in the same PR rather than assuming it exists.

---

## 10. Scripts (`backend/package.json`)

- `npm run dev` — IPv4 DNS + `next dev`. `npm run dev:local` pins port 3000.
- `npm run build` — `next build`.
- `npm start` — `next start`. `npm run start:local` pins port 3000.
- No `test` scripts are defined (see §9).

---

## 11. Do / Don't quick list

**Do**
- New features → Pattern A (`api/domain/data/validation`).
- Reuse the central `utils/` helpers and `shared/lib/`.
- Parameterise every query; add RLS for new tables.
- Use `logger`; inject a clock into domain code.

**Don't**
- Add to Pattern-B flat files when a domain extraction is cheap.
- Import another feature's internals or use `../../../` paths.
- Re-implement discipline / timezone / hierarchy logic.
- Edit merged migrations or reuse a migration number.
- Add `console.*`, hard-coded URLs, or secrets.
