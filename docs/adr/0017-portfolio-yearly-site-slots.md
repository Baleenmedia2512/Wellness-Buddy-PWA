# ADR-0017 — Digital Portfolio per-site ₹399/year slots

## Status

Accepted — 2026-11-20

## Context

Digital Portfolio was gated by the shared Reports 14-day trial / Go Premium (`ff.events-trial`, apps ≥ 3.5.7). Product needs:

- Hub visible to everyone (not Premium-gated)
- Each website costs ₹399 for one year; a second center website needs another payment
- Club-linked pages show that club’s live photos/location
- App profile about / title / photo update the public page without re-publish

## Decision

1. **Per-site yearly entitlement** (`coach_portfolio_site_entitlements_table`), not account Premium.
2. Cashfree SKU `portfolio_site_<userId>_<ts>` — create credit or renew bound submission.
3. **§5.1 version routing**
   - `PORTFOLIO_SITE_SLOTS_MIN` = next-release `APP_VERSION` (**3.5.7** for this ship)
   - `appVersion >= min` → hub open; create/publish/renew need active entitlement
   - `appVersion < min` or missing → legacy `assertEventsHostToolsAllowed` (trial/Premium)
4. Public SSR: if the submission has entitlement rows, require active expiry; zero rows = legacy allow.
5. Live overlays: club (name/photos/maps/hours/phone) + profile intro (title/about) + existing name/photo.
6. `ff.portfolio-site-checkout` is an emergency kill switch for Cashfree only — not Play activation.

## Legacy removal

Remove events-trial portfolio gate + dual path only after:

- `APP_VERSION_MIN_REQUIRED >= PORTFOLIO_SITE_SLOTS_MIN`
- No supported client still depends on trial unlock for Digital Portfolio
- Meaningful legacy traffic is gone

Do not auto-delete on a calendar date.

## Consequences

- Go Premium no longer unlocks unlimited Digital Portfolio sites on new apps.
- Existing published sites receive a one-year backfill entitlement on first table ensure.
- Create Event / Check-in remain ungated by this ADR.
