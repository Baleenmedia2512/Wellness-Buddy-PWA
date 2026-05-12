# Port Plan: `origin/MAD_Yasheer_IPA` → `MAD_DEV_VSA_2026`

> **Goal:** Bring all 54 commits from the non-VSA branch `origin/MAD_Yasheer_IPA`
> into the VSA-rebased `MAD_DEV_VSA_2026` branch, restructured to match the VSA
> feature layout (`backend/features/<domain>/`, `frontend/src/features/<domain>/`).

---

## Branch Setup

| Item | Value |
|---|---|
| Working branch | `merge/yasheer-ipa-into-vsa` |
| Forked from | `MAD_DEV_VSA_2026` @ `dd4c7af7` |
| Source tip | `origin/MAD_Yasheer_IPA` @ `53ef6fc5` |
| Common ancestor (3-way base) | `943423e8` |
| Initial ancestry merge | `9977d53d` (`-s ours`, VSA tree intact) |

---

## Strategy

For each non-VSA file changed in source:

- **Backend** — locate VSA counterpart in `backend/features/<domain>/*.service.js`
  (or `*.repository.js` / `*.validators.js`) and port the diff there.
  Do NOT modify thin proxies in `pages/api/`.
- **Frontend** — prefer porting into `frontend/src/features/<domain>/...`
  or `frontend/src/shared/...`; fall back to root paths if VSA move not done.

### Per-file workflow (proven)

```powershell
# 1. Extract pre/post/current versions
git show 943423e8:<old-path>          | Out-File -Encoding utf8 $env:TEMP\base
git show 53ef6fc5:<old-path>          | Out-File -Encoding utf8 $env:TEMP\post
git show HEAD:<vsa-path>              | Out-File -Encoding utf8 $env:TEMP\vsa

# 2. 3-way merge (UTF-8 critical, else "Cannot merge binary files")
git merge-file --diff3 -L VSA -L base -L origin $env:TEMP\vsa $env:TEMP\base $env:TEMP\post

# 3. Copy back, resolve conflicts (mostly import-path depth), validate
Copy-Item $env:TEMP\vsa <vsa-path> -Force
```

Then `get_errors` validate → `git add` → commit per phase.

---

## Phases (chronological commit grouping)

### Phase A — release / config ✅ DONE
- `e923ddfb` iOS plists (DistributionSummary, ExportOptions)
- `eb0547d2` oauth client in google-services.json
- `53ef6fc5` version bump 3.1 (package.json, capacitor, gradle, Info.plist)

**Commits:** `0cf80dae`, `c136f6df`, `1bcf3426`

### Phase B — auth / OTP / account-deletion ✅ DONE
- `34b72dd5` add NumericKeypad component
- `aca3f8bc` inline numeric keypad for OTP input
- `855e0cc5` enhance OTP input handling (native)
- `abb7d8f9` numeric keypad for OTP in account deletion
- `69979a4c` OTP restoration for account deletion flow

**Commit:** `2a5da03b`

### Phase C — weight ✅ DONE
- `104f3ec4` BathroomScaleIcon
- `977fa260` lazy scale images
- `bb22523e` IST date guards
- `bb66a88d` lazy weight images + on-demand image API
- `73436d92` pagination + infinite scroll
- `3979078d` separate image fetch
- `21442f17` auth-state guard
- `10560ca2` user-id var fix (also Phase F)
- `ecbc605e` console cleanup
- `56e973e7`+`f969c4b2` revert pair (collapsed)
- `f0728c95` refactor

**Commit:** `90aa8794`
**New endpoint:** `/api/weight/image` (lazy single-record image fetch)

### Phase D — education ✅ DONE
- `95a92b19` pagination + lazy loading
- `89c92dda` guard fetch until user loaded
- `1802f772` query-quote fix
- `43bf433f` share precapture (also Phase H)

**Commit:** `658172eb`

### Phase E — user profile / ideal weight / TeamMemberProfileModal 🔜 NEXT
- `d01f9020` + `57b08565` ideal weight calc + share card (App.js, +108 lines each)
- `d239e856` read-only ideal weight in UserProfileModal
- `1d487cb3` ideal weight in TeamMemberProfileModal
- `2b7b50eb` current vs ideal weight (+UserProfileModal, get-weight-history)
- `912b7d0d` ideal weight reflects BMI range (App.js, both modals)
- `426a044f` ideal weight display fix
- `8d8d4544` TeamMemberProfileModal across components (Dashboard, TeamMemberSearch)
- `741728b9` TeamMemberProfileModal in ActivityTimeReport / AttendanceReport / DisciplineReport / WellnessCounselling / WellnessUniversityReport / common/HierarchicalNode
- `dd87546b` profile completion checks + loading indicators (App.js, EducationDashboard)
- `ca017427` weight detection error handling (App.js)

**VSA paths needed:**
- `frontend/src/features/user/components/UserProfileModal.js`
- `frontend/src/features/user/components/TeamMemberProfileModal.js` *(may need to create)*
- `frontend/src/features/team/...` for TeamMemberSearch
- `frontend/src/shared/components/common/HierarchicalNode.js`

### Phase F — attendance / coach reports 🕐
- `10560ca2` user-id var (attendance) — partial overlap with Phase C
- `790c8126` attendance report download + file sharing
- `693c33cf` dedup + improved CSV
- `15d91c7e` co-coach dual entries
- `adcfb38e` sort by time + language support
- `bb361508` individual coach/co-coach activity reports

**Backend:** `features/coach/*`, `features/activity/*`

### Phase G — discipline / BMR / multi-team 🕐
- `c5afc843` BMR multi-team + calorie discipline
- `f2443fc8` include all dates in discipline reporting
- `f0728c95` refactor structure (overlap with Phase C)

**Backend:** `utils/disciplineCalculationsSupabase.js` → decomposed in `shared/services/`

### Phase H — nutrition / food corrections 🕐
- `06853746` + `a8e67fd5` liquid/shake autocorrection in foodCorrectionService
- `e14a431c` auto-correction reversals in EditableFoodItem
- `dc6c9304` disable step counter in NutritionDashboard + JSON parse fix
- `43bf433f` share precapture (already done in Phase D)

### Phase I — app-shell cleanup ✅ DONE
- `966badda` App.js import order (already in VSA)
- `ecbc605e` console log sweep
- Merge commits skipped: `acc047ee`, `1ddbde02`, `681f4c2c`, `627453bf`,
  `75acc169`, `bafba224`, `f4422d23`

**Commit:** `65efefe4`

---

## Skip List (already covered or not applicable in VSA)

- `backend/shared/lib/handler.js` — deletions intentional in VSA (file still
  used by some proxies; left as-is)
- All deletions of `pages/api/{water,weight,user,token}/*` legacy paths —
  already proxied in VSA at the new structure
- Debug-only console.log additions in `get-global-corrections` (855e0cc5)
- Net-zero revert pairs

---

## Final Steps (after Phase H)

1. `cd backend && npm run build`
2. `cd frontend && npm run build`
3. `node scripts/smoke-test.js`
4. **Confirm with user before** `git push origin merge/yasheer-ipa-into-vsa`

---

## Status Tracker

| Phase | Status | Commit |
|---|---|---|
| Init: ours-merge | ✅ | `9977d53d` |
| A — release/config | ✅ | `0cf80dae` `c136f6df` `1bcf3426` |
| B — auth/OTP | ✅ | `2a5da03b` |
| C — weight | ✅ | `90aa8794` |
| D — education | ✅ | `658172eb` |
| **E — user profile** | 🔜 **NEXT** | — |
| F — attendance | ⏳ | — |
| G — discipline/BMR | ⏳ | — |
| H — nutrition corrections | ⏳ | — |
| I — app-shell cleanup | ✅ | `65efefe4` |
| Final build + smoke | ⏳ | — |
| Push | ⏳ (needs confirmation) | — |

---

## Resume Instructions

To resume after the break, start with Phase E:

1. Inspect each Phase E commit:
   ```powershell
   git show <hash> --stat
   ```
2. For each touched file, locate VSA counterpart, run 3-way merge.
3. Resolve conflicts (most are just import-path depth differences).
4. `get_errors` to validate.
5. Commit as: `port(user-profile): ideal weight + TeamMemberProfileModal [from MAD_Yasheer_IPA: ...]`
6. Update this file's Status Tracker.
