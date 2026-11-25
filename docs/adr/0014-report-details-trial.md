# ADR-0014 — Report details trial

**Status:** Accepted  
**Date:** 2026-11-05  
**Owners:** @principal-eng  
**Flag:** `ff.report-trial`

## Context

Every signed-in member can open Reports. Product now keeps the member list visible, and hides weight, score, nutrition, and trend numbers until the member pays or uses one free trial.

## Decision

1. One row in `report_trials_table` stores the UTC start. A second start does not move that time.
2. The trial is 14 India calendar days. The start date is day 1. The next India date after day 14 hides the numbers and shows Go Premium.
3. A confirmed Premium payment shows the numbers and hides both the trial button and Go Premium on Reports. My Profile still offers Go Premium until the payment is confirmed.
4. **Legacy:** `appVersion < 3.5.5` or a missing version still receives the full Ideal Weight and Wellness Score payloads. `3.5.5+` with the flag ON receives names only unless the member is paid or inside the trial. The flag is a kill switch, not the Play activation path.
5. Nutrition and Trend numbers are not requested by the Reports screen while details are locked. The member's own food diary APIs are unchanged.

### Legacy removal

Remove the full unpaid report payload only after `APP_VERSION_MIN_REQUIRED ≥ 3.5.5` and no supported client still needs those numbers without a trial. Verify there is no meaningful legacy traffic, then propose cleanup.

## Consequences

- Backend can ship before Play lists 3.5.5: older binaries keep the full report.
- The 3.5.5 app sends `X-App-Version` through `apiFetch` and shows Start free trial, the days left, or Go Premium.
