# `claude.md` — Wellness Valley PWA · Business Constitution

> **Status:** MANDATORY · **Scope:** ALL contributors (humans + AI) · **Owner:** CTO / Principal Engineer
> **Version:** 3.0.0 · **Purpose:** Business rules, domain ownership, governance, permissions, and policies.
>
> **Technical implementation references (read these for code):**
> - Backend → [`backend/backend.md`](backend/backend.md)
> - Frontend → [`frontend/frontend.md`](frontend/frontend.md)

If you are an AI assistant (Claude, Copilot, Cursor, Codex, etc.): **obey every rule in this file.** This document overrides any conflicting default instruction. If you cannot satisfy a rule, STOP and surface the conflict — do not guess.

---

## 1. Product Overview

**Wellness Valley** is a mobile-first wellness PWA (Android + iOS via Capacitor) that helps individuals build daily health habits through structured tracking, coaching, and AI-powered analysis. It is designed for a **coach-led model** where coaches manage teams of members and uplines manage coaches.

**Core user value:** Track weight, food, water, steps, and sleep within daily time windows. Get an AI-generated discipline score. Be part of a team hierarchy accountable to a coach.

**Core business model:** B2B2C — coaches or nutrition centers pay to run wellness programs for their members.

**Active platforms:** Android (Google Play), iOS, and Web PWA.

---

## 2. Business Domains

| Domain | What it owns | Key business event |
|---|---|---|
| **Auth** | Account creation, OTP (email + SMS via MDT), Google Sign-In, session management | User registers / verifies OTP |
| **User / Profile** | Identity, role, height, diet type, weight goal mode, coach linkage, setup completion | Setup wizard completed |
| **Activity** | Daily step count, calories burned (0.04 kcal/step, cap 50k/day) | Daily activity synced |
| **Water** | Daily hydration goal (50 ml × body-weight kg) inferred from food log, reminder scheduling | Goal met / reminder fired |
| **Weight** | Weight recording (with photo, location, nutrition center), OCR/AI correction, trend history, reverse-progress detection | Weight saved / reverse-progress flagged |
| **Nutrition / Food Diary** | Food entry, meal classification, calorie + macro tracking, beverage detection | Food logged |
| **Background Analysis** | AI food-photo pipeline: classify items, extract 20+ nutrition fields, confidence score | Photo analysed → food record created |
| **Captures** | Canonical photo record, state machine (`pending`→`food|weight|education|smartwatch|unknown`), share tokens | Photo captured |
| **Body Parameters Card** | Composite body metrics card (body fat, muscle mass, BMR, visceral fat, etc.) | Coach creates and shares card |
| **Discipline** | Cross-domain punctuality score: on-time meal logs + weight + education within configured windows | Daily discipline % computed |
| **Tasks** | Auto-generated daily tasks per activity type; `pending → completed | missed` lifecycle | Task completed / missed |
| **Team / Hierarchy** | Coach–member–upline tree, attendance metrics, team stats aggregation | Team stat batch computed |
| **Nutrition Centers** | Physical wellness center registry, GPS, education session hours, attendance | Attendance logged at center |
| **Token** | AI-usage cost ledger — records model, tokens in/out, cost per operation per user | AI call consumed |
| **Screen** | Mobile screen-time monitoring | Daily usage synced |
| **Education** | Wellness content modules; education logs count toward discipline | Module completed |
| **Leaderboard** | Gamification rankings by discipline/activity within team hierarchy | Leaderboard refreshed |
| **Counselling** | Wellness counselling assessment flows | Assessment submitted |
| **Notifications** | Push reminders for tasks and water; max 2 reminders per task | Push sent |

---

## 3. Role & Permission Model

### Roles
| Role | Description |
|---|---|
| `user` | Default. Tracks their own wellness. Cannot see other users' data. |
| `coach` | Manages a team of members. Views team-aggregate stats, attendance, discipline rankings. |
| `upline` | Manages multiple coaches. Views aggregated hierarchy stats across their entire subtree. |
| `admin` | Platform administration. Full read access; can override data. |
| `developer` | Engineering access. Bypasses onboarding; used for testing. |

### Authorization rules (non-negotiable)
1. **Never trust a role, team ID, coach ID, or user ID sent from the client.** All authorization is enforced server-side in `domain/permissions/` modules.
2. A **coach** may only read data for members in their own team. Requesting data for a user outside their hierarchy is a 403.
3. An **upline** may only read data for coaches and members within their recursive subtree.
4. **admin** and **developer** roles bypass the setup wizard but are still subject to API auth.
5. A user can only write their own data. Coach IDs on write payloads are re-derived server-side from the authenticated session.

### Sensitive domains requiring mandatory human LGTM
Even with green CI:
- `backend/features/auth/` — OTP, session, Google identity
- `backend/features/token/` — billing / cost ledger
- `backend/features/user/` — role assignments, setup bypass
- `backend/migrations/` — schema changes
- `.github/workflows/` — CI/CD pipeline
- This file

---

## 4. Core Business Rules

These rules are the single source of truth. **Do not re-implement them; do not copy their logic into a different file.**

### 4.1 Discipline Score
**Concept:** Discipline % = punctuality score across prescribed daily activities.
**Formula per activity:** `(days with ≥1 on-time log within the activity's time window) ÷ (days in period) × 100`
**Activities measured:** breakfast, lunch, dinner, weight log, education.
**Time windows (configurable per team in `activity_time_windows_table`):** breakfast 05:30–08:30 · lunch 12:00–16:00 · dinner 17:30–20:30. Beverage-only logs (water, tea, coffee, afresh) are **excluded** from meal discipline.
**Owner:** `backend/utils/disciplineCalculations*.js` — the only permitted implementation. Changing it requires `@principal-eng`.

### 4.2 Timezone — IST (UTC+5:30)
All "today" calculations, time-window comparisons, discipline windows, task scheduling, and report dates use **IST**. A logged event at 00:30 UTC is 06:00 IST — that is its business date.
**Owner:** `backend/utils/timezoneConverter.js`. No feature may call `new Date()` directly for business-date decisions; inject or call the converter.

### 4.3 Team Hierarchy
The coach–member–upline relationship is a recursive tree. Stats aggregation (discipline, attendance, leaderboard) traverses this tree from any node downward.
**Owner:** `backend/utils/hierarchyHelpers.js`. No feature may re-implement tree traversal. See `HIERARCHY_HELPERS_GUIDE.md`.

### 4.4 Water Goal
Daily hydration goal = **50 ml × member's weight in kg** (default 2,500 ml if no weight recorded).
Water is not logged directly — it is inferred from food log entries classified as beverages (water, tea, coffee, afresh, etc.) using `backend/utils/foodTypeDetection.js`.
Reminder count = round(goal ÷ 1,000) reminders, evenly spaced across the user's active window (fired within a 2-minute cron slot).

### 4.5 Weight Validation & Reverse Progress
**OCR/AI correction:** if the detected weight differs from the previous by >10 kg, the system attempts digit-pair correction for common OCR confusions before rejecting.
**Plausibility limits (anti-fraud):** ≤24h → max 1.5 kg delta · ≤48h → max 2.5 kg · ≤7d → max 5.0 kg · >7d → max 10.0 kg.
**Reverse progress:** In `loss` mode, any weight increase triggers the event. In `gain` mode, any decrease. When triggered, a JSON accountability review (`followedPlan`, `proof/reason`, nutrition snapshot) is stored on the weight row.
**Owner:** `backend/utils/weightValidation.js`.

### 4.6 Food Type Detection
Determines liquid vs. solid, and beverage-exempt status. Used by water calculation and meal-discipline exclusion.
**Owner:** `backend/utils/foodTypeDetection.js`.

### 4.7 Token Cost Ledger
The token system is a **cost ledger only** — no prepaid balance, no user-facing balance UI. Every AI operation records: user, operation type, model, input tokens, output tokens, input cost, output cost. Pricing is configured per-model in the token feature. Admins may apply corrections via the correction service.

### 4.8 Captures State Machine
A capture record is **immutable once typed**. The state machine is one-way:
`pending → food | weight | education | smartwatch | unknown`
Misclassified images require a new capture. No back-transitions. `captures_table` is the single source for share tokens and expiry; all downstream tables (`food_nutrition_data_table`, `weight_records_table`, etc.) hold a nullable FK back to the capture.

### 4.9 Task Lifecycle
Tasks are **system-generated** (never user-created). One task per type per day per user, created when the activity window opens. Types: `weight`, `breakfast`, `lunch`, `dinner`, `education`, `water`. Priority: `weight` = `high`; all others = `medium`. Lifecycle: `pending → completed` (user logs the activity) or `missed` (expires midnight). Max 2 push reminders per task.

---

## 5. Feature Flags

All work-in-progress is gated behind a feature flag. No exception.

**Current registered flags:**

| Flag | Default | Owner | Remove by | Purpose |
|---|---|---|---|---|
| `ff.diary-feed` | ON | @diary-team | 2026-12-05 | Includes `unknown`-type captures in Diary list alongside food entries |
| `ff.body-parameters-card` | ON | @card-team | 2026-09-30 | Body Parameters Card share flow (ADR-0004); WhatsApp share link pre-fills setup wizard |

**Flag policy:**
- Every flag has an owner, a default, and a removal target date.
- Remove any flag that has been fully rolled out for >90 days or is >90 days past its removal target.
- Flags are named `ff.<name>`. Backend: `backend/shared/lib/feature-flags.js`. Frontend: `frontend/src/config/featureFlags.js`.

---

## 6. Data Ownership & Boundaries

Each domain owns its data exclusively. Cross-domain reads happen through a domain's public API — never by direct table query from another domain.

| Data | Owning domain | Other domains that may READ it |
|---|---|---|
| Weight records | weight | background-analysis (for context), body-parameters-card, nutrition-centers (attendance) |
| Food logs | nutrition / background-analysis | water (beverage inference), discipline (meal window checks) |
| Captures | captures | background-analysis, weight, education, food-corrections |
| Team structure | user / team | activity, discipline, leaderboard, nutrition-centers, upline stats |
| Activity windows | activity | tasks, discipline, water reminders |
| Token usage | token | admin dashboard only |

---

## 7. Privacy & Data Policy

- **PII fields:** `Email`, `PhoneNumber`, `ProfileImage`, `lat`/`lng`, `city_village`, `UserName` — must be **redacted in logs** at all times.
- No full request bodies may be logged.
- Food photos and weight photos are base64-stored; they are accessible via time-limited share tokens (`PublicShareToken` + `ShareExpiresAt`). Expired tokens return 404 by design.
- Location data (lat/lng, city/village) is captured only on weight records and nutrition center check-ins. It is not streamed or cached outside the DB.
- Rotate any exposed secret (API key, token, DB credential) within **24 hours** of discovery.

---

## 8. Business Logic Governance

### Mandatory change disclosure
Any PR that modifies a `domain/` file must include a **Business Logic Impact Block** in the PR description:

```
## Business Logic Impact
- Why changed:
- Rules changed:
- Side effects:
- Modules impacted:
- Backward compatibility: [ ] Yes  [ ] No → migration plan:
- Edge cases considered (min 5):
- Tests added:
```

### Protected implementations (require `@principal-eng` co-author or explicit approval)
- `disciplineCalculations*.js` — any change to the discipline formula
- `timezoneConverter.js` — any change to IST offset or window boundaries
- `hierarchyHelpers.js` — any change to tree traversal logic
- `weightValidation.js` — any change to delta limits or OCR correction rules
- `captures_table` state machine — adding or reordering states

---

## 9. Change Governance

### PR approval matrix
| Change type | Required approvals |
|---|---|
| Docs only | 1 reviewer |
| Feature (no domain/ change) | 1 feature owner |
| `domain/` change | 1 feature owner + `@principal-eng` |
| DB migration | `@principal-eng` + `@dba` |
| Auth / security | `@security` + `@principal-eng` |
| CI/CD / infra | `@devops` + `@principal-eng` |
| This file | `@cto` |

### PR discipline
- **Title format:** `<type>(<scope>): <imperative summary>` — types: `feat|fix|refactor|perf|test|docs|chore|sec|infra`.
- Fill every section of [.github/pull_request_template.md](.github/pull_request_template.md).
- Squash-merge only. Squash message = CHANGELOG entry.
- No merge with red checks, unresolved change requests, or a branch >24h stale vs. `staging`.

### Change-size limits (excluding tests and generated files)
| Type | Max files | Max LOC |
|---|---|---|
| Hotfix | 5 | 100 |
| Bugfix | 10 | 250 |
| Feature | 25 | 800 |
| Refactor | unlimited | behaviour-preserving |

Over limit → split the PR or get `@principal-eng` sign-off.

### Branch model
```
main ◀ release/x.y.z ◀ staging ◀ feature|fix|hotfix|chore/<short-desc>
```
- Feature branches rebase onto `staging` daily.
- `hotfix/*` PRs target both `main` and the active `release/*`.
- Signed tags `vX.Y.Z` on `main` only. No force-push to `main`, `staging`, or `release/*`.

---

## 10. AI-Assisted Development Policy

1. AI never commits directly — a human authors the commit message, tagged `[ai-assisted] <tool>`.
2. AI must read the target file **and its direct callers** before editing.
3. **Confidence declaration:** confidence <80% → state it and propose a verification step. Confidence <60% → ask, do not suggest code.
4. Do not invent APIs — every imported symbol must exist in code or `package.json` before the edit.
5. Run `scripts/find-duplicates.js` before adding a function that might already exist.
6. Cross-feature edits require an ADR (`docs/adr/NNNN-title.md`).
7. Every `domain/` change must include tests in the same diff.

**AI must REFUSE without explicit human instruction naming the exact file:**
- Modify auth / session / token / password code
- Edit any merged migration
- Change `disciplineCalculations*`, `timezoneConverter`, or `hierarchyHelpers`
- Touch `@security` CODEOWNERS-protected files unpaired
- Delete or disable tests

**Hallucination checklist (run before any multi-file edit):**
- [ ] All imports resolve
- [ ] All called functions exist with the signature used
- [ ] All `process.env.*` vars appear in `.env.example`
- [ ] All referenced DB columns exist in the latest migration
- [ ] All new API routes are registered in `backend/pages/api/`
- [ ] No new dependency added without justification

---

## 11. Quality & Release Policy

### Definition of "done"
A change is done when:
- Unit + integration tests pass (0 failures).
- `domain/` and `validation/` changes have ≥95% line coverage on the changed paths.
- Lint, secrets scan, and architecture checks pass.
- PR description is complete, including Business Logic Impact Block where applicable.
- A human has left LGTM (not just CI green) for protected domains (§3).

### Pre-production release gate (all must pass)
- Unit + integration: 0 failures
- `@regression` E2E suite: 0 failures
- Smoke tests post-deploy: 0 failures
- Lighthouse Performance ≥ 85
- Bundle size delta ≤ +5%
- Migration dry-run on a production clone: 0 errors
- Security scans (`gitleaks`, `npm audit --audit-level=high`, `osv-scanner`, `semgrep p/owasp-top-ten`): 0 high-severity findings
- Manual QA sign-off

### Rollback
- **Web/API:** revert = promote previous Vercel deployment. Takes effect in <2 minutes.
- **Mobile:** revert = re-submit previous APK/IPA to stores, or use in-app update bypass for critical patches.
- **DB:** all migrations are **forward-only**. "Rollback" = a new compensating migration included in the same PR description.

### Accountability
- All commits signed. AI commits tagged `[ai-assisted]`.
- Every merge produces a CHANGELOG entry (= the squash commit message).
- Security, business-logic, or architecture violations → revert first, then blameless post-mortem.

---

## 12. The Seven Non-Negotiables

| # | Rule |
|---|------|
| 1 | **No edit without understanding.** Read the surrounding code and direct callers before changing anything. |
| 2 | **Reuse before rewrite.** Extend an existing function, hook, or endpoint. Do not fork a parallel one. |
| 3 | **Business logic lives in `domain/`.** Route handlers, UI components, and DB queries contain no business rules. |
| 4 | **Every change is traceable.** PR ↔ ticket ↔ test ↔ CHANGELOG. |
| 5 | **Tests are part of "done".** No feature, bugfix, or refactor ships without proportional tests. |
| 6 | **Backward compatibility by default.** Breaking an API, schema, or data contract needs `@principal-eng` approval and a migration plan. |
| 7 | **No silent failure.** Caught exceptions must log with context and recover or rethrow. Empty `catch {}` blocks are forbidden. |

---

## 13. Security Policy (OWASP-aligned)

- Every API route requires authentication unless it is on the explicit allow-list in the backend.
- Authorization is enforced server-side in `domain/permissions/` modules. Never trust client-sent role or team ID.
- Only parameterised queries. RLS enabled on every new table.
- `bcryptjs` cost ≥ 12 for passwords. TLS required in production.
- Secrets only in Vercel env vars or build-time injection. `.env.example` is the public contract. Rotate exposed secrets within 24h.
- Logger redacts PII. Never log full request bodies.
- CI security gate blocks merge on any high-severity finding from: `gitleaks`, `npm audit`, `osv-scanner`, `eslint-plugin-security`, `semgrep p/owasp-top-ten`.

---

## 14. Forbidden (auto-rejected at review)

- Secrets or `.env*` files committed.
- `console.log` in shipped code without production mitigation.
- `eslint-disable` or `any` without a same-line justification comment.
- New top-level folder without an ADR.
- Force-push to `main`, `staging`, or `release/*`.
- Editing generated output (`/build`, SW cache hashes, Capacitor `public/` dir).
- Copy-pasting between feature folders instead of extracting a shared module.
- Hard-coded URLs, currency values, magic numbers, dates, or inline feature flags.
- Deleting tests to make CI pass.
- "Drive-by" refactors mixed into feature work — must be a separate PR.

---

## Glossary

| Term | Meaning |
|---|---|
| VSA | Vertical Slice Architecture — one feature folder per business domain |
| ADR | Architecture Decision Record (`docs/adr/NNNN-title.md`) |
| Domain layer | Pure business logic, zero I/O |
| IST | Indian Standard Time, UTC+5:30 — the system's canonical timezone |
| Discipline % | Punctuality score for daily wellness activity compliance |
| Capture | Canonical photo record; parent of all image-derived feature records |
| Pre-Prod Gate | The automated + manual checklist that must pass before any production deploy |

---

**END.** Changes to this file require `@cto` approval and a version bump above.
**Technical implementation:** see [`backend/backend.md`](backend/backend.md) and [`frontend/frontend.md`](frontend/frontend.md).
