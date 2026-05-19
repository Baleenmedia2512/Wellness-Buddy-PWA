# quick-share (backend)

## Purpose
Provides the server-side of the camera-first capture flow:
- Accepts a photo upload, mints a public share token, starts a background Gemini food analysis, and returns the view URL immediately.
- Serves a public endpoint for recipients to view the analysis result.

## Public API

### `POST /api/quick-share/captures`
Body: `{ imageBase64: string, mimeType: string, userId: string }`  
Response: `{ ok: true, data: { token: string, viewUrl: string, expiresAt: string } }`

### `GET /api/quick-share/public/[token]`
No auth required.  
Response: `{ ok: true, data: { status: 'pending' | 'ready', analysis?: object } }`

## Owners
@feature-team

## Dependencies
- `food_nutrition_data_table` (`PublicShareToken`, `ShareExpiresAt` columns — added by `add_quick_share_public_token.sql`)
- `backend/utils/supabaseClient.js`
- `@google/generative-ai` (background analysis)
- `backend/shared/lib/logger.js`

## Threat model
- Public endpoint `GET /public/[token]` returns no PII (no userId, email, or name).
- Tokens expire after 24h (`SHARE_LINK_TTL_HOURS`).
- `imageBase64` is size-limited at the validation layer (8 MB cap).
- Background Gemini call is fire-and-forget; failures are logged but do not affect the response.
