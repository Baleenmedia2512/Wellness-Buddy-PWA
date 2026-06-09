# ADR 0004 — Body Parameters Card Feature Slice

| Field | Value |
|---|---|
| **Status** | Accepted |
| **Date** | 2026-06-09 |
| **Author** | [ai-assisted] tool=copilot |
| **Approvers needed** | `@principal-eng` (domain change), `@dba` (migration) |

---

## Context

Coaches on the Wellness Counselling page need to:
1. Fill a "Your Body Parameters" card for a member.
2. Share it as a WhatsApp link preview (Image-1 layout).
3. Allow the link recipient (new or existing user) to have the card data pre-fill / override their profile.

No existing feature slice covers this end-to-end flow. The closest slices are:
- `counselling/` — health assessments (different domain, different DB table, no share flow).
- `weight/` — scale logs (different trigger, different ownership model).
- `user/` — profile read/write (needed as a helper, not as a host).

## Decision

Create a new VSA slice: **`body-parameters-card`**

```
backend/features/body-parameters-card/
  validation/card.schema.js
  domain/card.rules.js
  domain/permissions/card.policy.js
  data/card.repo.js
  api/create.handler.js
  api/public.handler.js
  __tests__/

frontend/src/features/body-parameters-card/
  domain/platform-store.rules.js
  hooks/useBodyParamsCard.js
  hooks/useBodyParamsShare.js
  components/BodyParamsForm.jsx
  components/BodyParamsCardPreview.jsx
  components/BodyParamsShareSheet.jsx
  services/bodyParamsCardApi.js
  __tests__/
```

**New DB table:** `body_parameters_cards` (migration `0010_create_body_parameters_cards.sql`).

## Consequences

### Positive
- Clean boundary: no pollution of `counselling/`, `weight/`, or `user/` internals.
- Share token pattern reuses the existing UUID + expiry convention from `captures_table`.
- `html2canvas` is already a frontend dependency — no new package needed.
- `@capacitor/share` is already installed — no new native plugin needed.

### Negative / Risks
- New migration requires `@principal-eng` + `@dba` sign-off.
- Pre-fill into `team_table` (height, BMR) and `weight_records_table` (weight, BMI, fat%) touches the `user/` and `weight/` feature boundaries — cross-feature write is handled via the existing `updateUserById` and `insertEntry` repository functions, accessed through a dedicated `profile-sync.handler.js` in this slice's `api/` layer, NOT by importing `user/` or `weight/` internals directly.

## Alternatives Rejected

| Alternative | Reason rejected |
|---|---|
| Add to `counselling/` | Different domain, different DB table, different share flow |
| Add to `weight/` | Weight is self-logged; this card is coach-authored |
| Add to `user/` | User feature owns profile CRUD, not card creation + share |
| Use `@vercel/og` for card image | Requires infra change; `html2canvas` already in deps and proven in the app |
