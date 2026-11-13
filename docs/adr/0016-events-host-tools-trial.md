# ADR-0016 — Events host tools trial (centralized with Reports)

**Status:** Accepted  
**Date:** 2026-11-12  
**Owners:** @principal-eng  
**Flag:** `ff.events-trial` (default **ON**; UI/API gate). Trial **data** = shared Reports trial.

## Context

Create Event, Check-in, and Paid Features should follow the same monetization UX as Reports (ADR-0014). Product wants **one** centralized 14-day free trial: if a member already started Reports and still has days left (e.g. 7), those days continue for Create Event / Check-in / Paid Features — no second clock.

## Decision

1. **Single trial store:** `report_trials_table` only. Do **not** require `events_trials_table` for access.
2. Events access APIs (`/api/payments/events-access`, `start-events-trial`) call the same `getReportAccess` / `startReportTrial` handlers and map `canSeeDetails` → `canUseHostTools`.
3. Trial length is **14** India calendar days (Reports rules). Start date is day 1; one start per member; second start does not move the window.
4. Confirmed Premium (`hasPaidPremium`) unlocks Reports details **and** Create Event / Check-in / Paid Features.
5. **UI gates:** Create Event, Check-in, Paid Features when `ff.events-trial` ON. **Version:** app **≥ 3.5.7** for host API enforcement; older/missing version keeps free host mutations. Reports detail gate remains **≥ 3.5.5** via `ff.report-trial`.
6. Browse open events and wallet ticket registration stay free.

### Create table?

- **`report_trials_table`** — yes, if not already present (Reports trial).
- **`events_trials_table`** — **not required** for this centralized design.

### Legacy removal

Same as ADR-0014 for the shared trial row. Host API ungated path removable after `APP_VERSION_MIN_REQUIRED ≥ 3.5.7` and no legacy traffic.

## Consequences

- One journey: Start free trial → remaining days apply everywhere → ended → Go Premium → paid unlocks all.
- A member mid-Reports trial (e.g. 7 days left) opens Create Event and still has those 7 days — trial does not restart.
