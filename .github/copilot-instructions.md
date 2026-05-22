# GitHub Copilot — Repository Instructions

> Copilot reads this file automatically when active in this repo.
> It is binding. The full rulebook is [`claude.md`](../claude.md).
> If anything below conflicts with `claude.md`, `claude.md` wins.

## Project shape
- Monorepo: Next.js API (`backend/`) + CRA web + Capacitor iOS/Android (`frontend/`).
- Architecture: Vertical Slice. One folder per business domain.
- Persistence: Supabase / Postgres via `backend/utils/dbPool.js` and `supabaseClient.js`.
- No TypeScript today; JavaScript with `jsconfig.json` paths.

## What Copilot MUST do
1. Re-read [`claude.md`](../claude.md) §2-§5 before any non-trivial suggestion.
2. Place backend code under `backend/features/<domain>/{api,domain,validation,data}/`.
3. Place frontend code under `frontend/src/features/<domain>/{components,hooks,api,domain}/`.
4. Keep `domain/` pure: no I/O, no `axios`, no `pg`, no `process.env`.
5. Use the central helpers:
   - timezone → `backend/utils/timezoneConverter.js`
   - hierarchy → `backend/utils/hierarchyHelpers.js`
   - discipline → `backend/utils/disciplineCalculations.js`
   - weight validation → `backend/utils/weightValidation.js`
   - food detection → `backend/utils/foodTypeDetection.js`
6. Use the shared logger (`backend/shared/lib/logger.js` / `frontend/src/shared/lib/logger.js`). Never `console.log` in shipped code.
7. Use the shared storage wrapper (`frontend/src/shared/lib/storage.js`) — never call `localStorage` directly.
8. Add tests in the same diff. Coverage floors per claude.md §9.1.

## What Copilot MUST NEVER do
- Edit `backend/migrations/`, `backend/features/auth/`, `backend/features/token/`, or anything under `.github/workflows/` without explicit human instruction naming the file.
- Modify `backend/utils/disciplineCalculations*.js`, `timezoneConverter.js`, or `hierarchyHelpers.js` without a `@principal-eng` mention in the prompt.
- Introduce a new top-level folder without proposing an ADR under `docs/adr/`.
- Duplicate logic — first search for an existing helper.
- Use `any` (when TS is added later), or suppress lint without an inline justification.
- Hard-code URLs, env-specific values, currency, or dates.

## Output conventions
- Suggest diffs, not whole files.
- Keep files < 350 LOC.
- Use named exports for helpers; one default export per React component file.
- Use the PR template at `.github/pull_request_template.md` when summarising a change.

## Confidence
- If your confidence in a suggestion is below 80%, say so and propose a verification step. Do not stream code as if certain.
