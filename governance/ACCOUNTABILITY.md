# Developer Accountability

Reference: [claude.md §13](../claude.md#13-developer-accountability).

## Ownership

- Every folder under `features/` MUST be listed in [.github/CODEOWNERS](../.github/CODEOWNERS).
- Orphan folders trigger a weekly bot reminder in `#eng`.
- Owners are auto-requested on PR; they have 2 business days to respond.

## Audit trail

- Signed commits enforced on `main` (branch protection).
- AI-authored commits tagged with `[ai-assisted]` + tool name in footer.
- Quarterly architecture review uses `git log` + `npm run vsa:check` → `governance/ARCH_REPORT_<date>.md`.

## Blame analysis (blameless on people)

When an incident occurs:
1. Identify the commits in the regression window.
2. Open a post-mortem in `governance/postmortems/<date>-<slug>.md` using the template below.
3. Action items must be tracked as issues, not buried in the doc.

```markdown
# Post-mortem: <title>
Date: <YYYY-MM-DD>
Severity: P0/P1/P2
Authors: @

## Summary
## Timeline (UTC)
## Impact
## Root cause
## Contributing factors
## What went well
## What went poorly
## Action items
| # | Action | Owner | Due |
```

## Violation response (claude.md §13.3)

| Violation | Response |
|---|---|
| Minor (style, naming) | Reviewer comment + fix |
| Repeated minor | Pairing session with feature owner |
| Major (arch, security, business logic) | Revert + post-mortem |
| Repeated major | Merge rights paused; re-onboarding |
