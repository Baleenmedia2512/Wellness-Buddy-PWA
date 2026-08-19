# App version policy

Server-driven minimum / recommended app versions, plus optional **server lock** for old store apps.

## Two layers

| Layer | What it does | Who it affects |
|-------|----------------|----------------|
| **In-app gate** | `GET /api/app/version-policy` → soft banner / hard “Update required” UI | Only apps that ship this client code |
| **API enforce** | Critical login/session APIs return **426** if version missing or too old | **All** clients, including old Play Store APKs |

Old APKs never call the policy API. To force them to update, turn on **API enforce**.

## Policy API

`GET /api/app/version-policy?version=3.4.3&platform=android&versionCode=62`

| `data.status` | Meaning |
|---------------|---------|
| `ok` | Client may use the app |
| `update_recommended` | Soft banner (dismissible) |
| `update_required` | Hard block — open store |

## Environment (Vercel / backend)

```env
APP_VERSION_POLICY_ENABLED=true
APP_VERSION_LATEST=3.4.3
APP_VERSION_MIN_REQUIRED=3.4.0
APP_VERSION_RECOMMENDED=3.4.3
APP_VERSION_FORCE_MESSAGE=Please update Wellness Valley to continue.
APP_VERSION_STORE_ANDROID=https://play.google.com/store/apps/details?id=com.wellnessvalley.app
APP_VERSION_ENFORCE_WEB=false

# Server lock for old apps (default OFF — turn on when ready to force everyone)
APP_VERSION_ENFORCE_API=false

# Optional grace (lowers effective min until date)
# APP_VERSION_GRACE_MIN=3.3.0
# APP_VERSION_GRACE_UNTIL=2026-08-31
# APP_VERSION_MIN_ANDROID_CODE=60
```

### `APP_VERSION_ENFORCE_API=true`

When ON, these routes reject with **HTTP 426** + `code: APP_UPDATE_REQUIRED` if:

- no `X-App-Version` (typical old store APK), or
- version &lt; effective `MIN_REQUIRED` (and grace if set)

Wired routes:

- `/api/auth/send-otp`, `/api/auth/verify-otp`
- `/api/user/google`, `/api/user/verify-session`, `/api/user/profile`
- `/api/user/lookup`, `/api/user/context`, `/api/user/status`

`/api/app/version-policy` is **not** locked (new apps must still be able to ask).

New apps that use `apiFetch` send the version header and show the update screen on 426.

## Rollout playbook

1. Deploy backend with `ENFORCE_API=false`.
2. Ship Play Store build that has the in-app gate + `X-App-Version`.
3. Soft nudge: raise `RECOMMENDED`; keep `MIN_REQUIRED` lenient.
4. When ready to force **everyone** (including old APKs):
   - set `APP_VERSION_MIN_REQUIRED` to the current store version
   - set `APP_VERSION_ENFORCE_API=true`
   - redeploy
5. Old apps can no longer login / load session; users must update from the store.

## Feature flags (behaviour old apps cannot handle)

Version policy decides **whether the app may run**. Version-based dual paths decide **which backend behaviour each allowed version gets**.

**Primary rule (`CLAUDE.md` §5.1 / `.cursor/rules/mobile-backend-api-compatibility.mdc`):**

```
Breaking API change
  → keep legacy + add new path in one backend deploy
  → route by client app version (< NEW → legacy; ≥ NEW → new; missing → legacy while supported)
  → deploy BEFORE Play lists the new app (no “turn flag ON after Play approval” step)
  → grace: old still allowed on legacy path; soft RECOMMENDED OK
  → force: raise MIN_REQUIRED + ENFORCE_API
  → then remove legacy after old is unsupported
```

Feature flags may be **emergency kill switches** or non-breaking WIP gates — they must **not** be required for normal Play activation of breaking behaviour.

Optional helper when a kill switch is desired:

```js
import { isEnabledForAppVersion } from '../../../shared/lib/feature-flags.js';
import { getClientAppVersion } from '../../../shared/lib/client-app-version.js';

if (!isEnabledForAppVersion('ff.example', getClientAppVersion(req))) {
  // keep legacy behaviour
}
```

Do **not** turn a breaking behaviour ON for all clients with plain `isEnabled()` while older versions remain in the supported window.

## Tests

```bash
node --test backend/features/app-version/__tests__/version.rules.test.js
node --test backend/features/app-version/__tests__/enforce-api.rules.test.js
node --test backend/shared/lib/__tests__/feature-flags-version.test.js
node --test backend/shared/lib/__tests__/client-app-version.test.js
```
