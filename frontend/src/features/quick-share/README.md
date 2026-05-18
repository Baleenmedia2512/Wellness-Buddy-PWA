# quick-share — Frontend Feature

**Status:** Flagged (`REACT_APP_FF_QUICK_SHARE_CAMERA_FIRST`, default **ON**; set `=false` to disable)
**Owner:** @owner
**Feature folder:** `frontend/src/features/quick-share/`

---

## Purpose

Camera-first capture + direct WhatsApp share with a public link for member-role users.
On every app launch or resume-from-lock the camera opens immediately.
After the shutter is tapped:

1. The photo is uploaded (`POST /api/quick-share/captures`) with the user id.
2. The server returns `{ token, viewUrl, expiresAt }` and runs Gemini analysis in the background.
3. The share sheet opens immediately — the WhatsApp caption embeds `viewUrl`.
4. After dismiss (or upload failure, or no photo) the app navigates Home.

The recipient opens `viewUrl` (no login) and sees the nutrition report. While analysis is
pending the page polls until ready (max 30 attempts) or shows a pending state.

---

## Public API

| Export | Type | Purpose |
|---|---|---|
| `QuickShareCamera` | Component | Full-screen camera + shutter UI |
| `useQuickShareEntry` | Hook | Camera-first routing logic (App.js integration) |
| `useShareCapture` | Hook | Capture → upload → share via shareImageDirectly |
| `createCapture` | API client | `POST /api/quick-share/captures` |
| `buildShareCaption` | Pure domain | Builds WhatsApp caption containing `viewUrl` |

### App.js integration (minimal diff)

```jsx
// Imports:
import { QuickShareCamera, useQuickShareEntry } from './features/quick-share';

// Hook (default ON; opt out with =false):
const _qsCameraFirst = process.env.REACT_APP_FF_QUICK_SHARE_CAMERA_FIRST !== 'false';
const { showCamera: showQuickShareCamera, onCaptured: onQuickShareCaptured } =
  useQuickShareEntry({ userId: user?.uid || null, userRole, cameraFirstEnabled: _qsCameraFirst });

// Render gate (before deferred dashboard):
if (showQuickShareCamera) {
  return (
    <QuickShareCamera
      userId={user?.id || null}
      onDone={() => { onQuickShareCaptured(); showMainPage(); }}
    />
  );
}
```

---

## Internal Layout

```
quick-share/
  domain/
    entry-route.rules.js      shouldShowCamera, isEligibleRole, resolveAppStateFromEvent
  hooks/
    useShareCapture.js        takePhoto -> createCapture -> shareImageDirectly -> onDone
    useQuickShareEntry.js     cold-start + resume routing
  api/
    captures.client.js        POST /api/quick-share/captures
  domain/
    share-caption.rules.js    pure caption builder
  components/
    QuickShareCamera.jsx      shutter-only camera screen
  __tests__/
    MATRIX.md                 coverage matrix
    entry-route.rules.test.js   pure domain rules
    share-caption.rules.test.js pure caption builder
    captures.client.test.js     HTTP client tests
  index.js                    public exports
  README.md                   (this file)
```

---

## Dependencies

| Dependency | Why |
|---|---|
| `shared/services/cameraService` | Opens native camera, returns base64 JPEG |
| `shared/utils/shareUtils#shareImageDirectly` | Shares base64 image via OS share sheet / WhatsApp plugin |
| `@capacitor/app` | `appStateChange` listener for resume-from-lock |

---

## Threat model

- No data leaves the device except via the user-initiated OS share sheet.
- No backend calls, no Supabase, no PII uploaded.
- Feature is OFF by default; enabling requires `REACT_APP_FF_QUICK_SHARE_CAMERA_FIRST=true`.
