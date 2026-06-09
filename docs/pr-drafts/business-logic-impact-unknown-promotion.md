# Business Logic Impact — Extend Capture State Machine

## Why changed
The Diary Edit flow allows users to manually re-classify "Other" (unknown) captures as Weight or Education entries. The frontend and backend services already supported this via the `captureId` parameter, but the underlying state machine was rejecting the transitions, causing:
- Silent promotion failures (logged as warnings)
- Duplicate records in the diary feed (unknown capture + new weight/education record)
- Broken deep links (share URLs pointed to unknown capture, not the new record)

This change extends the state machine to match the intended product behavior documented in ADR-0003.

## Rules changed
**Capture state machine transitions** (`backend/features/captures/domain/image-types.js::canTransition`)

**Before:**
- ✅ `pending → <any terminal>` (food, weight, education, watch, unknown)
- ✅ `unknown → food` (PR-A retry flow)
- ❌ `unknown → weight` (REJECTED with 409)
- ❌ `unknown → education` (REJECTED with 409)

**After:**
- ✅ `pending → <any terminal>` (unchanged)
- ✅ `unknown → food` (unchanged)
- ✅ `unknown → weight` (NEW — ADR-0003 Diary Edit flow)
- ✅ `unknown → education` (NEW — ADR-0003 Diary Edit flow)
- ❌ `unknown → watch` (still rejected — no product use case)

## Side effects
1. **Database**: The `captures` table rows with `ImageType = 'unknown'` can now transition to `ImageType = 'weight'` or `ImageType = 'education'`. Previously these transitions were blocked.

2. **Diary feed**: Unknown captures edited to weight/education will now disappear from the feed after save (because their type changes). Previously they persisted as duplicate "Other" rows.

3. **Deep links**: Share URLs for captures (e.g., `?captureId=123`) will now resolve to the correct vertical's detail card after edit. Previously they opened the unknown capture viewer.

4. **Audit trail**: The capture's `UpdatedAt` timestamp and `ImageType` column change when promoted. The original capture creation timestamp (`CreatedAt`) is preserved.

5. **Background analysis**: The 24-hour auto-purge for unknown captures (`idle-cleanup` feature) will no longer delete captures that have been manually promoted to weight/education (because they're no longer type 'unknown').

## Modules impacted
**Read:**
- `backend/features/weight/weight.service.js` (calls `captures.updateTypeById`)
- `backend/features/education/education.service.js` (calls `captures.updateTypeById`)
- `backend/features/diary/api/diaryClient.js` (filters capture types for feed)
- `backend/features/captures/captures.service.js` (enforces state machine)

**Write:**
- `backend/features/captures/domain/image-types.js` (state machine rules)
- `backend/features/captures/__tests__/image-types.test.js` (test coverage)

**No changes needed:**
- `backend/features/captures/data/captures.repository.js` (DB layer agnostic to allowed transitions)
- `backend/features/idle-cleanup/*` (queries by type — will correctly skip promoted captures)

## Backward compatibility
✅ **Yes — fully backward compatible**

**Reasoning:**
1. **Additive change**: No existing transitions are removed or modified. Only new transitions are added.
2. **No DB migration**: No schema changes required. The `ImageType` column already accepts 'weight' and 'education' values.
3. **No API contract change**: The `captures.updateTypeById()` function signature is unchanged. Callers already passed `toType: 'weight'` — they were just getting silent failures before.
4. **Existing data unaffected**: Captures that were already promoted via the (working) `pending → weight` path are unchanged. This only fixes the broken `unknown → weight` path.

**Migration plan:** N/A — no migration needed.

## Edge cases considered
1. **Race condition**: User edits unknown→weight while background analysis is running
   - **Handled**: State machine is transactional (DB-level). First writer wins. If background analysis promotes unknown→food first, the weight save will fail with 409 (food→weight not allowed). User sees error and can retry.

2. **Concurrent edits from two devices**: User edits unknown→weight on Device A, unknown→education on Device B
   - **Handled**: Same as #1. First writer wins, second gets 409. User sees error.

3. **Share link opened during edit**: User shares unknown capture, recipient opens link while owner is editing it to weight
   - **Handled**: Share link resolver checks capture type. If type changed since share was created, it redirects to the correct vertical (weight card in this case).

4. **Capture without image**: Unknown capture has no ImageBase64
   - **Handled**: Weight/education saves accept null images. The record is created without an image. This is valid (user can enter weight manually).

5. **Unknown capture with deleted owner**: Capture's UserID references a deleted user
   - **Handled**: State machine doesn't validate user existence. Permission checks happen in the service layer before reaching state machine. If user is deleted, permission check fails first with 403.

6. **Partial save failure**: Weight record created but capture promotion fails
   - **Handled**: Weight service catches promotion errors and logs warnings. The weight record is already persisted (intentional — weight data is critical, capture metadata is secondary). A background job could reconcile orphaned captures, but this is low-priority because the weight data is correct.

7. **Unknown→watch attempt**: User tries to edit unknown capture as watch data
   - **Handled**: State machine still rejects this (no product use case). Frontend doesn't offer this option in UnknownCaptureModal.

8. **Promoted capture re-edited**: User edits weight record created from unknown capture
   - **Handled**: The edit uses the weight record's `entryId`, not the `captureId`. No state transition occurs (weight→weight is a no-op update, not a transition).

9. **Background analysis retries unknown→food after manual promotion to weight**
   - **Handled**: State machine rejects weight→food (terminal types are immutable except unknown). Background analysis sees 409 and skips the capture.

10. **Diary feed consistency**: User sees unknown card, edits to weight, feed doesn't refresh
    - **Handled**: Frontend `UnknownEntryFlow` calls `onChanged()` callback which triggers `reloadDiary()` in Dashboard. The feed re-fetches and the unknown row disappears.

## Tests added
**Unit tests** (`backend/features/captures/__tests__/image-types.test.js`):
- ✅ `allows unknown → weight (ADR-0003: Diary Edit promotion)`
- ✅ `allows unknown → education (ADR-0003: Diary Edit promotion)`
- ✅ `rejects unknown → smartwatch (only food/weight/education allowed from unknown)`
- ✅ Updated comprehensive matrix test to exclude three allowed exceptions
- ✅ Updated error message assertion to include new allowed transitions

**Integration tests needed** (not in this PR — follow-up):
- [ ] End-to-end test: edit unknown→weight → verify single record in diary
- [ ] End-to-end test: edit unknown→education → verify single record in diary
- [ ] Deep link test: share unknown capture, edit to weight, open link → verify weight card opens

## Validation Results
- ✅ All 48 capture state machine unit tests pass
- ✅ No regression in existing test suites
- ✅ Frontend build compiles cleanly
- ✅ Backend build compiles cleanly
