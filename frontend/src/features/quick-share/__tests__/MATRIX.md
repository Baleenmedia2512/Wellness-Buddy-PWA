# Test Matrix — frontend/src/features/quick-share

Per claude.md §9.3.

| Capability | Unit | Integration | E2E | Permissions | Edge cases |
|---|---|---|---|---|---|
| entry-route: shouldShowCamera (member + flag ON) | ✅ entry-route.rules.test.js | — | ✅ cold-start-launches-camera.spec.js | — | ✅ coach role blocked |
| entry-route: camera skipped for in-app nav | ✅ entry-route.rules.test.js | — | — | — | ✅ active flow not hijacked |
| useShareCapture: capture + upload + shareToken | ✅ useShareCapture.test.js | — | ✅ capture-then-share.spec.js | — | ✅ double-tap debounce |
| useShareCapture: upload failure → share without caption | ✅ useShareCapture.test.js | — | — | — | ✅ network down, missing userId |
| share-caption.rules: buildShareCaption | ✅ share-caption.rules.test.js | — | — | — | ✅ empty / null / non-string |
| useShareCapture: share sheet open (native) | — | — | ✅ capture-then-share.spec.js | — | ✅ offline state |
| useShareCapture: navigate Home after share | ✅ | — | ✅ | — | ✅ share dismissed |
| useShareCapture: camera permission denied | ✅ | — | — | — | ✅ permission denied flow |
| useQuickShareEntry: cold-start routing | ✅ | — | ✅ | — | — |
| useQuickShareEntry: appStateChange routing | ✅ | — | ✅ resume-from-background.spec.js | — | ✅ mid-flow resume blocked |
| QuickShareCamera: renders shutter only | ✅ | — | — | — | ✅ no confirm UI rendered |
| QuickShareCamera: close without capture → Home | ✅ | — | ✅ close-camera-no-photo.spec.js | — | — |
| PublicShareView: food nutrition render | ✅ | — | ✅ public-link-food.spec.js | — | ✅ null macros, no items |
| PublicShareView: weight insights render | ✅ | — | ✅ public-link-weight.spec.js | — | ✅ no history |
| PublicShareView: analysis pending / auto-refresh | ✅ | — | — | — | ✅ poll stops after max retries |
| PublicShareView: expired / revoked link | ✅ | — | ✅ expired-or-revoked-link.spec.js | — | — |
| quick-share.client: capture POST | ✅ | — | — | — | ✅ network error |
| quick-share.client: public-view GET | ✅ | — | — | — | ✅ 404 |
| quick-share.client: revoke POST | ✅ | — | — | — | — |
| quick-share.client: analysis PATCH | ✅ | — | — | — | — |

## Coverage targets

| Layer | Line floor | Branch floor |
|---|---|---|
| domain/ | 95% | 90% |
| hooks/ | 85% | 75% |
| components/ | 70% | 60% |
| api/ (client) | 85% | 75% |
