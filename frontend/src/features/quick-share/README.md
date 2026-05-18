# quick-share — Frontend Feature

**Status:** Flagged (`REACT_APP_FF_QUICK_SHARE_CAMERA_FIRST`, default OFF)
**Owner:** @owner
**Feature folder:** `frontend/src/features/quick-share/`

---

## Purpose

Camera-first capture + direct WhatsApp share for member-role users.
On every app launch or resume-from-lock the camera opens immediately (feature-flagged).
After the shutter is tapped, the photo is shared directly via the existing
`shareImageDirectly` infrastructure — no backend, no upload, no public link.
After the share sheet is dismissed the app navigates Home.

---

## Public API

| Export | Type | Purpose |
|---|---|---|
| `QuickShareCamera` | Component | Full-screen camera + shutter UI |
| `useQuickShareEntry` | Hook | Camera-first routing logic (App.js integration) |
| `useShareCapture` | Hook | Capture + share via shareImageDirectly |

### App.js integration (minimal diff)

```jsx
// Imports:
import { QuickShareCamera, useQuickShareEntry } from './features/quick-share';

// Hook:
const _qsCameraFirst = process.env.REACT_APP_FF_QUICK_SHARE_CAMERA_FIRST === 'true';
const { showCamera: showQuickShareCamera, onCaptured: onQuickShareCaptured } =
  useQuickShareEntry({ userId: user?.uid || null, userRole, cameraFirstEnabled: _qsCameraFirst });

// Render gate (before deferred dashboard):
if (showQuickShareCamera) {
  return <QuickShareCamera onDone={() => { onQuickShareCaptured(); showMainPage(); }} />;
}
```

---

## Internal Layout

```
quick-share/
  domain/
    entry-route.rules.js      shouldShowCamera, isEligibleRole, resolveAppStateFromEvent
  hooks/
    useShareCapture.js        takePhoto -> shareImageDirectly -> onDone
    useQuickShareEntry.js     cold-start + resume routing
  components/
    QuickShareCamera.jsx      shutter-only camera screen
  __tests__/
    MATRIX.md                 coverage matrix
    entry-route.rules.test.js pure domain rules
    useShareCapture.test.js   hook unit tests
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
