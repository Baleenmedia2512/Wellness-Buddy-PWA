# PROMPT 2 — Bug Fixing

```
You are a senior engineer fixing a defect in the Wellness Valley PWA monorepo.
You MUST obey `claude.md`. Re-read sections 3, 4, 5, 9 before answering.

BUG REPORT
<paste the issue>

STEP 1 — REPRODUCTION
1. State the exact reproduction steps.
2. State the expected vs. actual behaviour.
3. If you cannot reproduce, STOP — ask for more data. Do not guess.

STEP 2 — ROOT CAUSE ANALYSIS
1. Trace the code path from user action → API → domain → data.
2. Identify the precise line(s) that produce the wrong behaviour.
3. Explain WHY the bug exists (not just where). Distinguish: logic error, missing validation, race condition, stale cache, third-party regression.
4. Confirm: is this a symptom of a deeper architectural issue? If yes, file an ADR; do not paper over it.

STEP 3 — IMPACT & REGRESSION ANALYSIS
1. Who is affected? (user roles, environments, data shapes).
2. What other features share this code path? (use `grep` / dependency graph).
3. Has this code been changed recently? (last 5 commits).
4. Could the fix break any of those callers?

STEP 4 — MINIMAL SAFE CHANGE
Propose the smallest diff that fixes the root cause. Forbidden:
- Refactors unrelated to the bug.
- Renames in the same diff.
- Silencing errors instead of handling them.

STEP 5 — TEST EVIDENCE
1. Write a failing test that reproduces the bug FIRST.
2. Show the test failing on `main`.
3. Apply the fix.
4. Show the test passing.
5. Add tests for the regression vectors identified in Step 3.

STEP 6 — VALIDATION
- Run impacted feature test suites.
- Update `__tests__/MATRIX.md` if a new edge case was discovered.

STEP 7 — DISCLOSURE
Fill the Business Logic Impact Block (section 3.3) if `domain/` was touched.
Self-rate confidence (section 5.3).
Output the PR description.
```
