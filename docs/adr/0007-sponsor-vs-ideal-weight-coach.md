# ADR-0007 — Sponsor vs Ideal-Weight Coach

**Status:** Accepted  
**Date:** 2026-08-03  
**Owners:** @principal-eng  
**Flag:** none (label + resolution change)

## Context

The app stored the member’s direct parent as `team_table.CoachId` and labelled that person **Coach** in member-facing UI. Product now needs two distinct people:

1. **Sponsor** — the direct parent (`CoachId`). Always shown when present.
2. **Coach** — the nearest ancestor on the `CoachId` chain (starting at the sponsor) whose latest weight is inside the ideal BMI band **19–23**. Shown only when someone qualifies.

Example: Kabilan’s sponsor is Adithya (out of range); Yasheer (Adithya’s upline) is in range → Sponsor: Adithya, Coach: Yasheer. If the sponsor is in range, both labels show the same person.

Platform role badges (`Role = coach`) stay **Coach** — they are not the assigned-parent label.

## Decision

1. UI spelling: **Sponsor** (not “sponser”).
2. Ideal range: `computeIdealWeightRange` (BMI 19–23 × height²). Missing height or weight → skip that ancestor and keep walking.
3. If no ancestor qualifies → omit Coach label and name entirely (no “—” placeholder).
4. API: add `sponsorName`, `idealCoachId`, `idealCoachName`. Keep `coachId` as the DB FK. Keep `coachName` = `sponsorName` for one release (backward compatible).
5. Implementation lives in `backend/utils/sponsorCoachResolution.js` — reuses chain walk patterns and `weightValidation.js`; does not fork `hierarchyHelpers` tree traversal.
6. **Queries:** ancestor height/weight load in bulk (`.in(UserId)`). Ideal check uses **latest** weight by `CreatedAt`, never `max(Weight)`. List endpoints BFS-batch CoachId hops (≤10 rounds), not one query per ancestor × member.

## Consequences

- Profile, leaderboards, activity report, and member-facing “your coach” copy update in the same ship so labels stay consistent.
- Leaderboards batch by unique sponsor (ideal coach is a function of the sponsor’s upline, not of each member).
- Follow-up may drop the `coachName` alias once clients only read `sponsorName`.
