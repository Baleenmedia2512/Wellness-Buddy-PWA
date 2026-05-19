# quick-share (frontend)

## Purpose
Camera-first capture entry point. Opens the native camera on app start and on every app resume (from lock/background). Guides the user through photo → AI detection → WhatsApp share → Home.

## Flow

```
App opens / resumes
       │
       ▼
  QuickShareCamera overlay shown
       │
  User taps "Take Photo"
       │
  Camera.getPhoto() (native) or <input capture> (web)
       │
  ┌────┴────────────────────────┐
  │ First photo of day?         │
  │   Yes → sync imageTypeDetector.detectImageType()
  │            ├─ weight → share_ready immediately
  │            └─ food/other → POST to backend → share_ready + viewUrl
  │   No  → POST to backend immediately → share_ready + viewUrl
  └─────────────────────────────┘
       │
  User taps "Share on WhatsApp"
       │
  shareImageDirectly(dataUrl, { text: caption })
       │
  onDismiss() → App.showMainPage()
```

## Public API

```js
import { useQuickShareEntry, QuickShareCamera } from './features/quick-share';
```

## Owners
@feature-team

## Dependencies
- `@capacitor/camera` — native camera
- `imageTypeDetector` (shared/services) — weight/food AI detection
- `shareImageDirectly` (shared/utils/shareUtils) — WhatsApp share
- `nativeLifecycle` (shared/services) — appStateChange for resume-to-camera
- `backend/features/quick-share` — background analysis + public link

## Threat model
- `imageBase64` is never persisted beyond the in-flight API call.
- `viewUrl` contains no PII — only a random 10-char token.
- Daily counter stored in `localStorage` under key `qs_daily_captures`; cleared automatically at IST midnight.
