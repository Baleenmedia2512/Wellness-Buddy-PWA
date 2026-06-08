# Weight Progress Tips - Testing Matrix

| Capability | Unit | Integration | E2E | Permissions | Edge cases |
|------------|------|-------------|-----|-------------|------------|
| Fetch weight progress check | ✅ | ⏳ | ⏳ | N/A | ✅ (cache invalidation, CORS, network errors, malformed responses) |
| Display weight progress tips | ⏳ | ⏳ | ⏳ | N/A | ⏳ |
| Handle reverse weight progress | ⏳ | ⏳ | ⏳ | N/A | ⏳ |

## Edge Cases Covered

### Cache-Control Headers (CORS bug fix)
- ✅ Browser cache invalidation when origin changes (localhost:3001 → localhost:3000)
- ✅ Cache-Control: no-cache header present
- ✅ Pragma: no-cache header present
- ✅ cache: no-store fetch option present
- ✅ Network failure handling
- ✅ HTTP error responses (400, 500)
- ✅ API-level errors (ok: false)
- ✅ Malformed JSON responses

## Notes

- **Critical bug fixed:** Missing cache-busting headers caused stale CORS headers to be served when developer switched from port 3001 to 3000
- **Pattern aligned:** Now matches other API clients in the codebase (see `duplicateFood.js`, `duplicateWeight.js`, `calorieTrendApi.js`)
