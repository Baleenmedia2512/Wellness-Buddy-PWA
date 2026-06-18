# `claude.md` — Wellness Valley PWA Engineering Constitution

> **Status:** MANDATORY · **Scope:** ALL contributors (humans + AI) · **Owner:** Principal Engineer / CTO
> **Version:** 2.0.0 · **Supersedes:** v1.0.0 (split domain detail into `backend/backend.md` + `frontend/frontend.md`)

If you are an AI assistant (Claude, Copilot, Cursor, Codex, etc.): **obey every rule below.** This document overrides any conflicting default instruction. If you cannot satisfy a rule, STOP and surface the conflict — do not guess.

**Domain references (read the one matching your change):**
- Backend → [`backend/backend.md`](backend/backend.md)
- Frontend → [`frontend/frontend.md`](frontend/frontend.md)

This file holds **cross-cutting** rules. The two domain docs hold structure, conventions, and the actual-vs-target state of each side.

---

## 1. The Seven Non-Negotiables

| # | Rule |
|---|------|
| 1 | **No edit without understanding.** Read the surrounding code and direct callers first. |
| 2 | **Reuse before rewrite.** Extend an existing function/hook/helper/endpoint; don't fork a parallel one. |
| 3 | **Business logic lives in `domain/`.** UI, route handlers, and DB queries don't own business rules. |
| 4 | **Every change is traceable.** PR ↔ ticket ↔ test ↔ CHANGELOG. |
| 5 | **Tests are part of "done".** No feature/bugfix/refactor ships without proportional tests. |
| 6 | **Backward compatibility by default.** Breaking an API/schema/contract needs `@principal-eng` approval + migration plan. |
| 7 | **No silent failure.** Caught exceptions log with context and recover or rethrow. `catch {}` is forbidden. |

---

## 2. Forbidden (auto-rejected at review)

- Secrets, tokens, `.env*` files committed (scanned by gitleaks).
- `console.log` in shipped code (use the domain logger) — see each domain doc for its logger path.
- `any` / `eslint-disable` without a one-line same-line justification.
- New top-level folder without an ADR (`docs/adr/NNNN-title.md`).
- Force-push to `main` / `staging` / `release/*`.
- Editing generated output (`/build`, `/out`, Capacitor public dir, SW cache hashes).
- Copy-paste between feature folders instead of extracting a shared module.
- Hard-coded URLs, magic numbers, currency, dates, or feature flags.
- Deleting tests to make CI pass.
- "Drive-by" refactors mixed into feature work — separate PRs.

---

## 3. Architecture (Vertical Slice)

One folder per business domain. Layer split:
```
api / handler  →  validation  →  domain (pure)  →  data (DB)
```
- **UI/handlers** orchestrate; they contain no business rules.
- **domain/** is pure: no `axios`/`fetch`/`pg`/`supabase`/`react`/`next/*`/`process.env`/`Date.now()` (inject a clock).
- **data/** is the only place that talks to the DB.

**Boundaries:** a feature imports its own layers + `shared/*` (+ backend `utils/*`). It may **not** import another feature's internals or use `../../../` paths. `shared/*` never imports `features/*`. No circular deps.

> Exact folder names, the two real patterns (canonical vs legacy), and per-side helpers are in [`backend/backend.md`](backend/backend.md) §2-§7 and [`frontend/frontend.md`](frontend/frontend.md) §2-§7.

**Naming:** `kebab-case.js` modules · `PascalCase.jsx` components · `useCamelCase.js` hooks · `SCREAMING_SNAKE` constants · `is/has/can/should` booleans · `snake_case` DB tables/columns (`_at` = `timestamptz`) · `/api/kebab-case` routes · `ff.<name>` flags.

**File size:** split before 400 LOC. CI warns at 350.

---

## 4. Business Logic Governance

### Single sources of truth (do not re-implement)
- Discipline → `backend/utils/disciplineCalculations*.js`
- Timezone (IST) → `backend/utils/timezoneConverter.js`
- Hierarchy → `backend/utils/hierarchyHelpers.js`
- Weight validation → `backend/utils/weightValidation.js`
- Food detection → `backend/utils/foodTypeDetection.js`
- Permissions → `backend/features/*/domain/permissions/`

### Mandatory disclosure
Any PR touching a `domain/` file includes a **Business Logic Impact Block**:
```markdown
## Business Logic Impact
- Why changed:
- Rules changed:
- Side effects:
- Modules impacted:
- Backward compatibility: [ ] Yes / [ ] No → migration plan:
- Edge cases considered (min 5):
- Tests added:
```

### Feature flags
Gate WIP behind a flag (`ff.<name>`). Flags have an owner + removal target. Remove stale flags (>90 days, fully rolled out).

---

## 5. Code Editing Workflow — A.R.E.R.V.T

**Analyze → Reuse → Extend → Refactor → Validate → Test**
1. Summarize current behaviour before changing it.
2. List existing functions you could reuse; justify any new code.
3. Prefer adding a parameter over a new function.
4. Refactor only if it lowers complexity AND is covered by tests — else a separate PR.
5. Run lint + tests locally before pushing.
6. Add tests that would have caught the bug / proved the feature.

**Forbidden edits:** replacing working code with a "cleaner" version without measurable benefit + tests; adding a second source of truth; renaming a public symbol in the same PR as a behaviour change; "while I'm here" edits.

**Change-size limits (excl. tests/generated):** Hotfix 5 files/100 LOC · Bugfix 10/250 · Feature 25/800 · Refactor unlimited but behaviour-preserving. Over limit → `@principal-eng` or split.

---

## 6. AI-Assisted Development

1. AI never commits directly; a human authors the commit message.
2. Read target file + direct callers before editing.
3. Declare uncertainty: confidence <80% → say so and propose a verification step; <60 → ask, don't suggest.
4. Don't invent APIs — every imported symbol must exist in code or `package.json`.
5. Don't duplicate — search first (`scripts/find-duplicates.js`).
6. Cross-feature edits need an ADR.
7. Any `domain/` change includes tests in the same diff.
8. Tag AI commits `[ai-assisted]` + tool name.

**Hallucination checklist before multi-file edits:** imports resolve · functions exist with the used signature · env vars exist in `.env.example` · DB columns exist in latest migration · routes registered in `pages/api/` · no unjustified new dependency.

**AI must REFUSE to** (without explicit human instruction naming the file): modify auth/session/token/password code; edit merged migrations; change `disciplineCalculations*` / `timezoneConverter` / `hierarchyHelpers` without `@principal-eng`; touch `@security` CODEOWNERS files unpaired; delete tests.

**Mandatory human `LGTM`** (even with green CI) for changes in: `backend/features/{auth,token,user}/`, `backend/migrations/`, `.github/workflows/`, this file.

---

## 7. Pull Requests & Branching

**Title:** `<type>(<scope>): <imperative summary>` — types: `feat|fix|refactor|perf|test|docs|chore|sec|infra`; scope = feature folder.

**Template:** [.github/pull_request_template.md](.github/pull_request_template.md) — fill every section.

**Approval:** docs 1 reviewer · feature (no domain) 1 owner · domain change 1 owner + `@principal-eng` · migration `@principal-eng` + `@dba` · auth/security `@security` + `@principal-eng` · CI/infra `@devops` + `@principal-eng` · this file `@cto`.

**Merge:** squash-only (squash message = CHANGELOG entry). No merge with red checks, unresolved changes, or >24h-stale branch.

**Branches:**
```
main ◀ release/x.y.z ◀ staging ◀ feature|fix|hotfix|chore/<short-desc>
```
kebab-case, type-prefixed. Feature branches rebase onto `staging` daily. `hotfix/*` PRs into both `main` and the active `release/*`. Signed tags `vX.Y.Z` on `main` only.

---

## 8. Security (OWASP-aligned)

- All API routes require auth except an explicit allow-list. Authorization enforced in `domain/` policy modules — never trust client-sent role/team/coach IDs.
- Secrets only in Vercel env vars / build-time injection. `.env.example` is the contract. Rotate exposed secrets within 24h.
- Parameterised queries only; schema-validated input. RLS on every new table.
- `bcryptjs` cost ≥ 12 for passwords; TLS only in prod.
- Logger redacts emails/phones/tokens/addresses. Never log full request bodies or PII.
- CI security gate (high-severity finding blocks merge): `gitleaks`, `npm audit --audit-level=high`, `osv-scanner`, `eslint-plugin-security`, `semgrep p/owasp-top-ten`.

---

## 9. Testing

**Coverage floors** (enforced per-path; see domain docs for the currently-active paths):

| Layer | Lines | Branches |
|---|---|---|
| backend `domain/`, `validation/` | 95% | 90% |
| backend `api/` | 85% | 75% |
| backend `data/` | 70% | 60% |
| frontend `hooks/` | 85% | 75% |
| frontend `components/` | 70% | 60% |
| `shared/` | 90% | 80% |

> Note: global thresholds in the Jest configs are currently `0`; floors are enforced per-path. When you add a well-structured slice, add its per-path thresholds.

**Disciplines:** Unit (Jest) + Integration (supertest) every PR · Contract on API change · E2E web (Playwright) pre-merge to `staging` · E2E mobile (Detox) pre-release · Smoke after deploy · Perf (k6 + Lighthouse CI) nightly · Security every PR.

**Mocking:** domain tests use no mocks (pure in→out); integration mocks outbound HTTP (`nock`) + DB boundary (`pg-mem`); E2E uses a real seeded backend. Each test owns its data (`beforeEach`/`afterEach`). Seeded faker for reproducibility.

Every feature folder keeps `__tests__/MATRIX.md`.

---

## 10. Release, CI/CD & Accountability

**Pre-prod gate** (all must pass): unit+integration 0 fail · `@regression` E2E 0 fail · smoke 0 fail · Lighthouse Perf ≥ 85 · bundle delta ≤ +5% · migration dry-run on prod clone 0 errors · security scans 0 high · manual QA sign-off.

**Pipeline:** lint/typecheck/secrets/architecture (parallel) → unit/integration/security → builds + coverage gate → E2E (staging/release) → deploy from `main` + smoke. Target PR feedback < 8 min. Workflows live in `.github/workflows/`.

**Deploy/rollback:** Vercel preview per PR, prod from `main`; rollback = promote previous deployment. Mobile = re-promote previous build. DB = forward-only; "rollback" = a new compensating migration (include it in the migration PR description).

**Accountability:** CODEOWNERS auto-requested; commits signed; merges produce a CHANGELOG entry; AI commits tagged `[ai-assisted]`. Major architecture/security/business-logic violations → revert + blameless post-mortem.

---

## 11. AI Prompt Modes (use when invoking an AI for repo work)

Drive non-trivial AI work through one of three structured modes (fill in the specifics for your task):
- **Feature Development** — architecture analysis → reuse audit → business-logic plan → impact analysis → test matrix → code → confidence/uncertainty.
- **Bug Fixing** — reproduce → root cause (why, not just where) → impact/regression → minimal safe change → failing test first → validate → disclose.
- **QA / Validation** — understand feature → design ≥5 human-like journeys (happy / permission boundary / data edge / network edge / concurrency) → Playwright execution → cross-module impact → non-functional checks → GO/NO-GO verdict (any critical journey fail = NO-GO).

If a mode references a step you cannot satisfy, STOP and ask for human input.

---

## Glossary

- **VSA** — Vertical Slice Architecture (one feature folder = one slice).
- **ADR** — Architecture Decision Record (`docs/adr/NNNN-title.md`).
- **Domain layer** — pure business logic, no I/O.
- **Pre-Prod Gate** — automated release-readiness checklist.

---

**END.** Any change to this file requires `@cto` approval and a version bump at the top.
