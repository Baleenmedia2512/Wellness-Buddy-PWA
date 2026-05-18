# quick-share — Backend Feature

**Status:** Phase 1 (food only) · gated by env `QUICK_SHARE_PUBLIC_BASE_URL`
**Owner:** @owner
**Folder:** `backend/features/quick-share/`

## Purpose
Persists a "quick capture" food image so the frontend can:
1. share an image immediately (no waiting on Gemini),
2. embed a public, recipient-viewable URL in the WhatsApp caption,
3. let the Gemini analysis populate in the background.

No new table — the existing `food_nutrition_data_table` gets two nullable
columns added via [add_quick_share_public_token.sql](../../migrations/add_quick_share_public_token.sql):
`PublicShareToken uuid unique`, `ShareExpiresAt timestamptz`.

## Public API
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/quick-share/captures` | required | Insert pending row, kick off background Gemini, return `{ token, viewUrl }` |
| GET  | `/api/quick-share/public/[token]` | **none** | Public JSON of analysis (or `pending`/`expired`/`not_found`) |
| GET  | `/s/[token]` (page, not /api) | **none** | Public HTML page rendering the JSON |

## Layout
```
quick-share/
  api/
    create-capture.handler.js
    get-public.handler.js
    analyze-in-background.js   ← fire-and-forget Gemini
  data/
    quick-share.repo.js        ← reuses food_nutrition_data_table
  domain/
    token.rules.js             ← UUID + 30-day expiry
    public-payload.rules.js    ← PII-redacted projection
  validation/
    quick-share.validators.js
  __tests__/
    MATRIX.md
    quick-share.validators.test.js
    token.rules.test.js
    public-payload.rules.test.js
```

## Privacy / threat model
- Public payload contains only image-derived fields. No userId, no email,
  no name, no team/coach data — enforced by `toPublicPayload`.
- Tokens are RFC-4122 v4 UUIDs (122 bits entropy) ⇒ unguessable in practice.
- Links expire 30 days after creation. Expired tokens return `410 Gone`.
- The owner can soft-delete the row via the existing
  `DELETE /api/background-analysis` path (IsDeleted=1) ⇒ public read returns `404`.

## Phase 1 limits
- `kind` accepts only `'food'`. Weight stays on the existing manual flow.
- No rate-limit decorator yet (mandatory per claude.md §8.4) — tracked as
  follow-up. Phase 1 is feature-flagged off in production.
- Fire-and-forget analysis means a serverless cold-shutdown could leave a
  row at `pending` forever. A future cron sweeps stuck rows.

## Env vars
- `GEMINI_API_KEY` (reused from misc/detect-face)
- `QUICK_SHARE_PUBLIC_BASE_URL` (e.g. `https://api.wellnessvalley.in`) —
  falls back to `NEXT_PUBLIC_APP_URL` then empty string.
