# App version policy (Phase 1)

Server-driven minimum / recommended app versions with grace window.

## API

`GET /api/app/version-policy?version=3.4.3&platform=android&versionCode=62`

Response `data.status`:

| Status | Meaning |
|--------|---------|
| `ok` | Client may use the app |
| `update_recommended` | Soft banner (dismissible per recommended version) |
| `update_required` | Hard block — open store |

## Environment (Vercel / backend)

```env
APP_VERSION_POLICY_ENABLED=true
APP_VERSION_LATEST=3.4.3
APP_VERSION_MIN_REQUIRED=3.4.0
APP_VERSION_RECOMMENDED=3.4.3
APP_VERSION_GRACE_MIN=3.3.0
APP_VERSION_GRACE_UNTIL=2026-08-31
APP_VERSION_FORCE_MESSAGE=Please update Wellness Valley to continue.
APP_VERSION_STORE_ANDROID=https://play.google.com/store/apps/details?id=com.wellnessvalley.app
APP_VERSION_MIN_ANDROID_CODE=60
APP_VERSION_ENFORCE_WEB=false
```

## Rollout playbook

1. Deploy **backward-compatible** backend first.
2. Set `APP_VERSION_*` but keep `MIN_REQUIRED` / `GRACE_MIN` low so old apps still pass.
3. Submit Play Store build; when live, raise `RECOMMENDED`.
4. After grace period, raise `MIN_REQUIRED` to force remaining users to update.

## Feature flags (required for behaviour that old apps cannot handle)

Version policy decides **whether the app may run**. Feature flags decide **which backend behaviour each allowed version gets**.

```
New backend behaviour
  → ship behind flag, default OFF
  → deploy backend (old apps unchanged)
  → new AAB live on Play Store
  → enable flag + set minAppVersion (or FF_<FLAG>_MIN_APP_VERSION) to that build
  → never enable new behaviour globally while older supported apps cannot handle it
  → after APP_VERSION_MIN_REQUIRED raised past old clients → remove flag and dead code
```

### How to gate a flag by app version

1. Register optional `minAppVersion` on the flag (or set `FF_<NAME>_MIN_APP_VERSION` in env).
2. In the handler/service, use:

```js
import { isEnabledForAppVersion } from '../../../shared/lib/feature-flags.js';
import { getClientAppVersion } from '../../../shared/lib/client-app-version.js';

const clientVersion = getClientAppVersion(req);
if (!isEnabledForAppVersion('ff.example', clientVersion)) {
  // old / missing client → keep legacy behaviour
}
```

3. Client should send `X-App-Version` via `apiFetch` from `frontend/src/shared/services/apiFetch.js`.

Do **not** turn a breaking behaviour ON with plain `isEnabled()` alone while older versions remain in the supported window.

## Tests

```bash
node --test backend/features/app-version/__tests__/version.rules.test.js
node --test backend/shared/lib/__tests__/feature-flags-version.test.js
node --test backend/shared/lib/__tests__/client-app-version.test.js
```
