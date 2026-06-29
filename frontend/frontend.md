# `frontend/frontend.md` — Frontend Engineering Reference

> **Scope:** everything under `frontend/`. Binding for humans + AI.
> **Parent:** [`/claude.md`](../claude.md) holds cross-cutting rules. This file holds frontend specifics.
> **Status:** describes the codebase **as it actually is**, and marks the **target** pattern for new code.
> **Version:** 1.0.0

---

## 1. Stack

- **CRA (`react-scripts` 5)** + **React 18.3**, JavaScript (no TS), `jsconfig.json` paths.
- **Mobile:** Capacitor (Android + iOS). App id `com.wellnessvalley.app`, `webDir: build`.
- **Styling:** Tailwind CSS (primary) + some plain CSS. No CSS Modules.
- **HTTP:** `axios` + raw `fetch` + a custom fetch class coexist (see §5).
- **UI libs:** `@ionic/react`, `lucide-react`, `framer-motion`, `recharts`, `react-leaflet`, `tesseract.js`.

---

## 2. Folder layout (`frontend/src/features/<domain>/`)

The split varies. **Target for new code:**
```
features/<domain>/
  components/   PascalCase.jsx — presentational React
  hooks/        useCamelCase.js — server state + side effects
  services/     network / IO (the real convention — NOT api/)
  domain/       pure client-side rules (when needed)
  __tests__/    *.test.{js,jsx} (+ MATRIX.md)
  index.js      barrel — public surface; never deep-import a feature
  README.md
```
- **Network folder is `services/`**, not `api/`, in most slices (a few new ones use `api/`: `diary`, `captures`). Prefer `services/` for consistency unless extending an `api/` slice.
- `domain/` and `hooks/` are optional and frequently absent — add them when logic warrants.
- Always export the public surface via `index.js`; import features through their barrel.

Features: activity, admin, auth, background-analysis, body-parameters-card, captures, counselling, diary, education, food-corrections, leaderboard, misc, nutrition, nutrition-centers, screen, tasks, team, token, user, water, weight, weight-progress-tips.

---

## 3. Shared (`frontend/src/shared/`)

- `shared/components/` — ~18 reusable components (`Header.js`, `ImageUpload.js`, `LoadingSpinner.js`, `CustomAlertModal.js`, …) + `common/`, `icons/`.
- `shared/lib/` — [storage.js](src/shared/lib/storage.js), `is-low-confidence-food.js`, `reverseGeocode.js`, `tab-by-image-type.js`.
- `shared/utils/` — **[logger.js](src/shared/utils/logger.js) lives here** (not `lib/`), plus `fetchWithAbort.js`, `imageValidator.js`, `mobileInit.js`, `timezoneUtils.js`, `backButtonHandler.js`, `shareUtils.js`.
- `shared/services/` — [apiClient.js](src/shared/services/apiClient.js), `cacheManager.js`, `cameraService.js`, `firebase.js`, `geminiService.js`, `getUserId.js`, `userIdentity.js`, plus `auth/`, `nativeLifecycle/`, `tokenCost/` subfolders.
- `shared/context/` — only `NutritionRefreshContext.js`.
- `shared/plugins/` — Capacitor native plugin JS wrappers: `galleryMonitorPlugin`, `stepCounterPlugin`, `keepAwakePlugin`, `inAppUpdatePlugin`, `foodImageAnalysis`.

**Graduation to `shared/`:** used in ≥2 features, no feature-specific props, has its own tests.

---

## 4. Config (`frontend/src/config/`)

- [api.config.js](src/config/api.config.js) — `getApiBaseUrl()` reads `process.env.REACT_APP_API_BASE_URL` (fallback `http://localhost:3000`). **Only place** allowed to read env for API base URL.
- [featureFlags.js](src/config/featureFlags.js) — `isFlagEnabled(name)`; resolution: localStorage override → `REACT_APP_FF_*` → registry default. Flags named `ff.<name>`.
- `leaderboardConfig.js`, `version.js`.

Never hard-code base URLs, currency, dates, or magic numbers — use `config/`.

---

## 5. Network / API calls

Three patterns exist today:
1. Raw `fetch` in feature `services/` using `getApiBaseUrl()` (e.g. [water/services/water.api.js](src/features/water/services/water.api.js)).
2. Direct `axios` import (e.g. [diary/api/diaryClient.js](src/features/diary/api/diaryClient.js), `shared/services/teamHierarchyService.js`).
3. Custom fetch class [shared/services/apiClient.js](src/shared/services/apiClient.js) — dedup, retry+backoff, timeout, optional cache.

**For new code:** prefer `shared/services/apiClient.js` (or a feature `services/` module that uses it) so retry/timeout/dedup behaviour is consistent. Always build URLs from `getApiBaseUrl()`.

---

## 6. State management

- **Server state:** custom hooks in `features/*/hooks/` calling the feature's `services/`. No Redux (not installed).
- **UI state:** local `useState` / `useReducer`.
- **Cross-page state:** React Context, one provider per concern in `shared/context/` (currently only `NutritionRefreshContext`).
- **Note:** [App.js](src/App.js) is a large "god component" with a homemade flag-based router (24 `show*` booleans mirrored to `localStorage`). Do **not** add new flags here for new features — prefer a contained component/route.

---

## 7. Storage

- Use [shared/lib/storage.js](src/shared/lib/storage.js) (`get/set/remove`) instead of `localStorage` directly.
- **Reality:** it currently wraps only `window.localStorage` (Capacitor Preferences is a future swap; `@capacitor/preferences` not yet a dep), and ~74 direct `localStorage.*` calls bypass it. Do **not** add new direct `localStorage` calls — route through the wrapper so the future Preferences swap is centralized.

---

## 8. Logging

- Logger: [shared/utils/logger.js](src/shared/utils/logger.js) — `debugLog` / `debugInfo`, no-ops in production.
- **Target:** no `console.log` in shipped code. Reality: ~63 `console.log` remain (heavily in `App.js`); a prod monkey-patch in [index.js](src/index.js) no-ops `console.log/warn/info/debug` (keeps `console.error`). Don't add new `console.log`; use the logger.

---

## 9. Routing

- No central react-router tree for the main app — navigation is the flag-based router in `App.js`.
- `react-router-dom` v6 used only for standalone pages in `src/pages/` (`PrivacyPage`, `TermsPage`, …).
- `@ionic/react` + `useIonRouter()` used for hardware back-button handling.

---

## 10. Styling

- Tailwind: [tailwind.config.js](tailwind.config.js) scans `src/**/*.{js,jsx,ts,tsx}`, custom `xs–2xl` breakpoints + extended green palette. PostCSS + autoprefixer.
- Plain CSS: `src/index.css`, `src/LazyLoadStyles.css`.

---

## 11. Capacitor / native

- [capacitor.config.js](capacitor.config.js): plugins GoogleAuth, GalleryMonitor, CameraMonitor, Share, Filesystem, SplashScreen, Keyboard; `server.allowNavigation` allow-list.
- Note: Capacitor package majors are mixed (core ^8, android ^7, ios ^8) — verify before upgrading.
- Custom native plugins wrapped in `shared/plugins/`.

---

## 12. Testing

- Standalone [jest.config.js](jest.config.js): jsdom, `babel-jest`, css/image mocks in `src/__mocks__/`, `setupFilesAfterEnv` → `src/setupTests.js`.
- React Testing Library v13 + `jest-dom` + `user-event`.
- Tests co-located in `__tests__/`, `testMatch: **/__tests__/**/*.test.{js,jsx}`.
- Coverage thresholds currently `0` in the standalone config — raise per-path when adding well-structured slices.

---

## 13. PWA / build

- Scripts: `start` / `build` / `test` (react-scripts), `postbuild` → `node update-sw-version.js`, `deploy` (gh-pages), Android Gradle helpers.
- SW at [public/service-worker.js](public), manually registered in [index.js](src/index.js) in production only. [update-sw-version.js](update-sw-version.js) stamps `BUILD_TIMESTAMP` to bust caches.

---

## 14. Do / Don't quick list

**Do**
- New slices: `components/ hooks/ services/ domain/ __tests__/ index.js`.
- Import features via their `index.js` barrel.
- Build URLs from `getApiBaseUrl()`; gate WIP behind `featureFlags`.
- Route storage through `shared/lib/storage.js`; use the logger.

**Don't**
- Add new `show*` flags or logic into `App.js`.
- Add direct `localStorage` or `console.log` calls.
- Deep-import another feature's internals.
- Hard-code base URLs, currency, dates, or magic numbers.
