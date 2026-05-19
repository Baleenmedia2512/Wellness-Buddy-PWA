# ADR 0001 — Quick Share: Camera-First Capture + AI Analysis + WhatsApp Share

**Status:** Accepted  
**Date:** 2026-05  
**Author:** [ai-assisted] tool=copilot

---

## Context

Users want to capture a photo immediately when opening the app, have it analysed by AI, and share the result to WhatsApp with one tap. The feature must work as the app's primary entry point — camera launches automatically on cold start and on resume from background/lock.

Two different flows are needed based on whether it is the user's first photo of the day:
- **First photo:** Synchronous AI type detection (weight vs food). WhatsApp share visible immediately after photo is taken.
- **Subsequent photos:** Background AI analysis kicks off while WhatsApp share is presented immediately, with the analysis result URL included in the share message.

## Decision

1. Create `frontend/src/features/quick-share/` and `backend/features/quick-share/` as a new vertical slice.
2. Use the existing `imageTypeDetector.detectImageType()` for first-photo type detection.
3. Use `@capacitor/camera`'s `Camera.getPhoto()` for native capture; `<input capture>` fallback on web.
4. Store the per-day photo counter using the existing `Session` helper (IST date key).
5. Reuse the `PublicShareToken` / `ShareExpiresAt` columns already added by migration `add_quick_share_public_token.sql`.
6. Backend endpoint `POST /api/quick-share/captures` stores the image path, launches background Gemini analysis, and returns a public token + view URL.
7. Use `shareImageDirectly()` / `shareCachedDataUrl()` from `shared/utils/shareUtils.js` for WhatsApp share.
8. On app start (after auth) and on `appStateChange` resume, open the camera automatically.
9. After share completes or camera is dismissed without a photo, navigate to the Home screen via `showMainPage()`.

## Consequences

- Users always land on camera rather than the dashboard — this is the intended UX.
- The backend gains a new route pair (`/api/quick-share/captures`, `/api/quick-share/public/[token]`).
- The `food_nutrition_data_table` already has the required columns; no new migration is needed.
- Existing image-upload flow (`ImageUpload` + main analysis pipeline) is untouched; quick-share is a separate, parallel entry point.
