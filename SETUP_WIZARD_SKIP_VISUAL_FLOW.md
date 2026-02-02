# Setup Wizard - Corrected Skip Flow (Visual)

## ✅ FIXED: Skip Without OTP Generation

```
┌─────────────────────────────────────────────────────────────────────┐
│                    USER LOGS IN (EMAIL)                              │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────┐
│               SETUP WIZARD MODAL APPEARS                             │
│                                                                      │
│  ┌──────────────────────────────────────────────┐                  │
│  │  [Skip Setup] button (top-left corner)       │                  │
│  │  Click → Immediately skip entire process     │                  │
│  └──────────────────────────────────────────────┘                  │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
╔═════════════════════════════════════════════════════════════════════╗
║                      STEP 1: COACH SEARCH                            ║
╚═════════════════════════════════════════════════════════════════════╝
                                 │
                    ┌────────────┴────────────┐
                    │  User searches coach    │
                    │  Selects: "John Doe"    │
                    └────────────┬────────────┘
                                 │
                        (Click "Continue")
                                 │
                                 ▼
╔═════════════════════════════════════════════════════════════════════╗
║                      STEP 2: TEAM ID (OPTIONAL)                      ║
╚═════════════════════════════════════════════════════════════════════╝
                                 │
                    ┌────────────┴────────────┐
                    │  Selected Coach:         │
                    │  ✅ John Doe [Change]   │
                    └────────────┬────────────┘
                                 │
                    ┌────────────┴────────────────────┐
                    │  Team ID Input: [__________]    │
                    │  (User leaves EMPTY)            │
                    └────────────┬────────────────────┘
                                 │
                        (Click "Skip & Continue")
                                 │
                                 ▼
                    ┌─────────────────────────────────┐
                    │  Frontend Checks:               │
                    │  • teamId = "" (empty)          │
                    │  • selectedCoach exists         │
                    └────────────┬────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────────┐
                    │  ✅ EARLY RETURN (NEW FIX!)     │
                    │                                 │
                    │  API Call:                      │
                    │  POST /api/user/skip-setup      │
                    │  Body: { email }                │
                    │                                 │
                    │  Database Update:               │
                    │  team_table.SetupSkipped = true │
                    │                                 │
                    │  localStorage:                  │
                    │  setupSkipped = "true"          │
                    └────────────┬────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────────┐
                    │  ❌ NO APPROVAL REQUEST SENT    │
                    │  ❌ NO OTP EMAIL TO COACH       │
                    │  ❌ NO OTP VALIDATION NEEDED    │
                    └────────────┬────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────────┐
                    │  Success Message:               │
                    │  "Setup skipped! You can        │
                    │   continue using the app."      │
                    │  (Display 1.5 seconds)          │
                    └────────────┬────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────────┐
                    │  ✅ Wizard Closes               │
                    │  → User goes to Dashboard       │
                    └─────────────────────────────────┘
```

---

## 🔄 Refresh Behavior - FIXED

```
┌─────────────────────────────────────────────────────────────────────┐
│                      USER REFRESHES PAGE                             │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────────────┐
                    │  Frontend Auth Check:           │
                    │  1. Check localStorage          │
                    │     setupSkipped = "true" ?     │
                    └────────────┬────────────────────┘
                                 │
                        ┌────────┴────────┐
                        │                 │
                       YES               NO
                        │                 │
                        ▼                 ▼
            ┌───────────────────┐  ┌─────────────────────────┐
            │  Skip wizard      │  │  Call API:              │
            │  (Fast path)      │  │  GET /api/user/status   │
            └───────┬───────────┘  └─────────┬───────────────┘
                    │                        │
                    │                        ▼
                    │           ┌─────────────────────────────┐
                    │           │  Backend Checks Database:   │
                    │           │  team_table.SetupSkipped    │
                    │           └─────────┬───────────────────┘
                    │                     │
                    │            ┌────────┴────────┐
                    │            │                 │
                    │          TRUE             FALSE
                    │            │                 │
                    │            ▼                 ▼
                    │   ┌───────────────┐  ┌──────────────────┐
                    │   │ Return:       │  │ Return:          │
                    │   │ setupSkipped: │  │ setupComplete:   │
                    │   │ true          │  │ false            │
                    │   └───────┬───────┘  └────────┬─────────┘
                    │           │                   │
                    └───────────┴────────┬──────────┘
                                         │
                                         ▼
                            ┌────────────────────────┐
                            │ ✅ NO WIZARD SHOWN    │
                            │ User goes to Dashboard │
                            └────────────────────────┘
```

---

## 🔀 Comparison: Before vs After

### ❌ BEFORE (BUGGY BEHAVIOR)

```
Step 2: Empty Team ID
    │
    ├─► Click "Skip & Continue"
    │
    ├─► ❌ Send approval request to coach
    │   └─► Generate OTP email
    │   └─► Create approval_requests record
    │
    ├─► Set localStorage: setupSkipped = "true"
    │
    ├─► Navigate to OTP validation page
    │
    └─► Coach receives unwanted email ❌

On Refresh:
    │
    ├─► Check localStorage: setupSkipped = "true"
    │   └─► Skip wizard (Good ✅)
    │
    ├─► Backend doesn't know about skip
    │   └─► /api/user/status returns: setupComplete = false
    │
    └─► Inconsistent state ❌
```

### ✅ AFTER (FIXED BEHAVIOR)

```
Step 2: Empty Team ID
    │
    ├─► Click "Skip & Continue"
    │
    ├─► Check: teamId is empty?
    │   └─► YES → EARLY RETURN ✅
    │
    ├─► Call: POST /api/user/skip-setup
    │   └─► Database: SetupSkipped = true
    │   └─► localStorage: setupSkipped = "true"
    │
    ├─► ✅ NO approval request sent
    ├─► ✅ NO OTP email generated
    │
    └─► Close wizard, go to Dashboard

On Refresh:
    │
    ├─► Check localStorage: setupSkipped = "true"
    │   └─► Skip wizard (Fast path ✅)
    │
    ├─► OR Check backend: /api/user/status
    │   └─► Returns: setupSkipped = true
    │   └─► Skip wizard ✅
    │
    └─► Consistent state ✅
```

---

## 📊 Skip Flow Decision Tree

```
                    [User in Setup Wizard]
                            │
                ┌───────────┴───────────┐
                │                       │
        [Click "Skip Setup"]    [Complete Step 1]
         (top-left button)              │
                │                       │
                ▼                       ▼
     Skip entire setup         [Proceed to Step 2]
     No coach selected                 │
                │              ┌───────┴───────┐
                │              │               │
                │        [Enter ID]      [Leave Empty]
                │              │               │
                │              ▼               ▼
                │      [Complete Setup]  [Click Skip & Continue]
                │      With Team ID            │
                │      + Coach                 │
                │              │               │
                │              ▼               │
                │      Send approval     Skip with coach
                │      Generate OTP      selected but
                │      Navigate OTP      NO OTP
                │              │               │
                └──────────────┴───────────────┘
                               │
                               ▼
                    [POST /api/user/skip-setup]
                               │
                               ▼
                    [SetupSkipped = true in DB]
                               │
                               ▼
                    [setupSkipped = true in localStorage]
                               │
                               ▼
                    [✅ Wizard Closes]
                               │
                               ▼
                    [On Refresh: Wizard stays closed]
```

---

## 🎯 Key Points

1. **Two Skip Paths:**
   - Path A: "Skip Setup" button (no coach selection)
   - Path B: Select coach → Empty Team ID → "Skip & Continue"

2. **Both paths:**
   - Call `/api/user/skip-setup` API
   - Store in database AND localStorage
   - Do NOT send approval requests
   - Do NOT generate OTP emails

3. **Persistence:**
   - Skip status survives page refresh
   - Skip status synced across localStorage + database
   - Backend knows user skipped (not just frontend)

4. **User Experience:**
   - Can use app immediately after skip
   - No OTP validation required
   - Can still complete setup later if needed (optional future feature)
