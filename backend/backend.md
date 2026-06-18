# `backend/backend.md` — Backend Engineering Reference

> **Scope:** everything under `backend/`. Binding for humans + AI.
> **Parent:** [`/claude.md`](../claude.md) holds cross-cutting rules. This file holds backend specifics.
> **Status:** describes the codebase **as it actually is**, and marks the **target** pattern for new code.
> **Version:** 1.0.0

---

## 1. Stack

- **Next.js 15.3** (API routes only — no SSR pages for app UI), **React 18**, JavaScript (no TS), `jsconfig.json` paths.
- **Data:** Supabase JS client (`@supabase/supabase-js`) **and** `pg` Pool. `mysql2` is still in deps (legacy, being removed).
- **Validation:** `joi@18` is installed but most validators are hand-written. See §6.
- **Other:** `bcryptjs`, `date-fns`, `@google/generative-ai`, `firebase-admin`, `nodemailer`.

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
Reference slice: [features/water](features/water) (`api/intake.handler.js`, `domain/intake.rules.js`, `data/water.repo.js`, `validation/intake.schema.js`). Other Pattern-A slices: `tasks`, `body-parameters-card`, `weight-progress-tips`, `captures`, `idle-cleanup`, `background-analysis` (diary).

### Pattern B — flat service files (LEGACY, do not extend)
```
features/<domain>/
  <domain>.service.js
  <domain>.repository.js
  <domain>.validators.js
  __tests__/
```
Used by: `weight`, `activity`, `nutrition-centers`, `screen`, `education`, `food-corrections`, `misc`, `user`, `token`. `auth` is hybrid (flat files + `domain/` + `data/`).

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
- Existing folder is inconsistent (some unnumbered, one `0011_*` collision) — do **not** reuse a taken number; continue from the highest.
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
- [feature-flags.js](shared/lib/feature-flags.js) — `ff.<domain>.<feature>` registry + `findStaleFlags`.
- [auth-helpers.js](shared/lib/auth-helpers.js), [ValidationError.js](shared/lib/ValidationError.js), [userActivity.js](shared/lib/userActivity.js).
- `shared/services/pushNotificationService.js`.

> Do **not** assume these exist (referenced in old docs but **absent**): `rate-limit.js`, `notifications/`, `public-routes.js`, `storage.js`.

`backend/utils/` central helpers:
- [disciplineCalculations.js](utils/disciplineCalculations.js) — discipline %, MySQL-connection style.
- [disciplineCalculationsSupabase.js](utils/disciplineCalculationsSupabase.js) — Supabase variant (second source — confirm which one the feature uses).
- [timezoneConverter.js](utils/timezoneConverter.js) — IST (UTC+5:30) ↔ user-local. Use for "today"; never raw `new Date()`.
- [hierarchyHelpers.js](utils/hierarchyHelpers.js) — recursive team-stat aggregation. See [HIERARCHY_HELPERS_GUIDE.md](utils/HIERARCHY_HELPERS_GUIDE.md).
- [weightValidation.js](utils/weightValidation.js) — corrects AI/OCR weight misreads.
- [foodTypeDetection.js](utils/foodTypeDetection.js) — liquid/solid food classification.
- [apiConfig.js](utils/apiConfig.js) — `largeBodyConfig` (10mb body parser for image routes).

> Changing `disciplineCalculations*`, `timezoneConverter`, or `hierarchyHelpers` requires a `@principal-eng` mention.

---

## 8. Logging

- Use the shared `logger`. **Target:** no `console.*` in shipped code.
- Reality: `console.*` is still widespread (`supabaseClient.js`, `handler.js`, `weight-progress-tips`, `background-analysis`). Do not add more; migrate when you touch the file.
- Never log full request bodies, secrets, or PII (emails/phones/tokens).

---

## 9. Testing

- [jest.config.js](jest.config.js): `testEnvironment: 'node'`, roots `features/`, `shared/`, `utils/`, `testMatch: **/__tests__/**/*.test.js`, transform via `babel-jest` (`babel.jest.config.js`).
- Tests co-located in each feature's `__tests__/`, named `*.test.js`.
- **Coverage:** global thresholds are currently `0`; only specific paths enforce floors (e.g. `features/water/domain/` 95/90, `*.validators.js` 95/90, `water/api/` 85/75, `water/data/` 70/60). When adding a Pattern-A slice, add matching per-path thresholds.
- Tooling: `jest`, `supertest`, `nock` (mock outbound HTTP), `pg-mem` (DB boundary).
- Domain tests: no mocks. Integration: mock HTTP + DB boundary only.

---

## 10. Scripts (`backend/package.json`)

- `npm run dev` — IPv4 DNS + `next dev`.
- `npm run build` / `npm start`.
- `npm test` / `test:watch` / `test:coverage` / `test:ci` (`jest --ci --runInBand --coverage`).

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
