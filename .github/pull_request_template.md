<!--
MANDATORY — Do not delete sections. The PR Validator workflow will reject PRs with empty sections.
Refer to `claude.md` sections 6.1 and 6.2.
-->

## Summary
<!-- 1-3 sentences. What does this PR do and why? -->

## Ticket / Issue
Closes #

## Type
- [ ] feat
- [ ] fix
- [ ] refactor
- [ ] perf
- [ ] test
- [ ] docs
- [ ] chore
- [ ] sec
- [ ] infra

## Scope (feature folder)
<!-- e.g. backend/features/water, frontend/src/features/attendance -->

---

## Pre-Edit Checklist (claude.md §4.1)
- [ ] I read the entire target file(s) end-to-end.
- [ ] I reviewed `git log -p` for the last 5 changes to the touched files.
- [ ] I found all callers of every modified export.
- [ ] I confirmed no equivalent helper already exists (`scripts/find-duplicates.js`).
- [ ] I stated the minimum change that satisfies the requirement.

## A.R.E.R.V.T Workflow (claude.md §4.2)
- **Analyze:** <current behaviour in 3 sentences>
- **Reuse:** <existing functions considered; why rejected if new code written>
- **Extend / new:** <what was extended vs. created>
- **Refactor:** <none, or justified + behaviour-preserving>
- **Validate:** <local lint + tests run, paste result>
- **Test:** <new tests added — link paths>

---

## Business Logic Impact (REQUIRED if `domain/` touched — claude.md §3.3)
<!-- Delete this block ONLY if no domain/ file was touched. CI checks. -->
- **Why changed:**
- **Rules changed:**
- **Side effects:**
- **Modules impacted:**
- **Backward compatibility:** [ ] Yes / [ ] No → migration plan:
- **Edge cases considered (min 5):**
  1.
  2.
  3.
  4.
  5.
- **Tests added:**

---

## Architecture Impact (claude.md §2)
- [ ] No new top-level folder, OR an ADR is linked: docs/adr/____
- [ ] No new cross-feature import.
- [ ] No new circular dependency (verified by `dependency-cruiser`).
- [ ] No file exceeds 400 LOC.
- [ ] Naming conventions followed (§2.9).

## API Impact
- [ ] No API change
- [ ] Backward-compatible additive change
- [ ] Breaking change — new `/v2` route added AND `v1` retained for ≥ 1 release
- Endpoints touched:

## Database / Migration Impact
- [ ] No migration
- [ ] New migration: `backend/migrations/____.sql`
- [ ] Forward-only? (must be Yes)
- [ ] Dry-run output on staging clone attached
- [ ] RLS policy included for any new table
- [ ] Compensating migration plan documented:

## Security Impact (claude.md §8)
- [ ] No auth/authz change
- [ ] Auth/authz change — `@security` requested
- [ ] No new secrets
- [ ] No PII logged
- [ ] Rate limit applied to new public mutating endpoints
- [ ] Inputs validated with schema

## Dependency Impact
- [ ] No new dependency
- [ ] New dependency justified: name, why, license, maintenance status
- [ ] `npm audit` clean

## Regression Risk
- **Risk level:** Low / Medium / High
- **Mitigations:**
- **Impacted features re-tested:**

---

## Testing Evidence (claude.md §9)
- [ ] Unit tests pass locally
- [ ] Integration tests pass locally
- [ ] Coverage for changed files ≥ floor (§9.1)
- [ ] `__tests__/MATRIX.md` updated for the feature
- [ ] E2E impact: <list journeys re-run or N/A>
- Paste coverage delta:

```
<coverage report excerpt>
```

---

## AI Assistance Disclosure (claude.md §5)
- [ ] No AI used
- [ ] AI-assisted — tool(s): `claude` / `copilot` / `cursor` / `other:____`
- [ ] Hallucination checklist completed (§5.2)
- [ ] Confidence score per file: <list>
- [ ] Files flagged "unsafe edit" (§5.4)? If yes, human pairing recorded:

## Reviewer Routing (claude.md §6.3)
- Feature owner:
- Additional required approvers (security/dba/devops/principal-eng):

## Post-Merge Actions
- [ ] CHANGELOG entry will be the squash-commit subject
- [ ] Feature flag removal scheduled (if applicable):
- [ ] Docs updated:
- [ ] Smoke test will be run on the deploy
