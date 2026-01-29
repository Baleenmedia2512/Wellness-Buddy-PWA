# 🎯 Setup Wizard - Complete User Flow

## 🚀 Quick Flow (Simple Version)

```
User Opens App (After Email Login)
    ↓
Setup Wizard Modal Appears
    ↓
STEP 1: Find Your Coach
    ↓
User Types Name/Email in Search Box (min 2 characters)
    ↓
System Shows Matching Coaches (with 500ms delay)
    ↓
User Clicks on a Coach Card to Select
    ↓
Coach Card Turns Green with Checkmark ✓
    ↓
User Clicks "Continue" Button
    ↓
STEP 2: Create Team ID
    ↓
User Sees Selected Coach Summary Card (with "Change" option)
    ↓
User Types Team ID (10 characters, auto-uppercase)
    ↓
System Auto-Checks Availability (after 500ms)
    ↓
System Shows Status:
    • 🆕 NEW (Blue) → Can proceed
    • ✅ AVAILABLE (Green) → Can proceed
    • ❌ FULL (Red) → Cannot proceed
    • ℹ️ YOURS (Yellow) → Cannot proceed
    ↓
User Clicks "Complete Setup" (if status is NEW or AVAILABLE)
    ↓
Backend Claims Team ID (API: /api/team/claim-id)
    ↓
Backend Sends Approval Request to Coach (API: /api/upline/request)
    ↓
Success Message: "Request sent!" (1.5 seconds)
    ↓
Navigate to OTP Validation Page
    ↓
User Verifies Phone Number
    ↓
Account Activated (Waiting for Coach Approval)
```

---

## Overview
New users complete a 2-step onboarding process to join their team and activate their account.

---

## 📊 Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     USER OPENS APP                               │
│                  (After Email Login)                             │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              SETUP WIZARD MODAL APPEARS                          │
│        "Welcome to Wellness Valley"                              │
│   Complete 2 simple steps to activate account                   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌═════════════════════════════════════════════════════════════════┐
║                    STEP 1: FIND YOUR COACH                       ║
╚═════════════════════════════════════════════════════════════════╝
│
├─► User sees: Search input field
│   Placeholder: "Search by name or email..."
│
├─► User types: Minimum 2 characters
│   
├─► System: 
│   │   • Waits 500ms (debounce)
│   │   • Calls GET /api/users/search?q={query}&email={userEmail}
│   │   • Shows loading spinner
│   │
│   └─► Returns coach list or empty state
│
├─► User sees: List of matching coaches
│   │
│   ├─► Each coach card shows:
│   │   • Avatar circle with first letter
│   │   • Full name
│   │   • Masked email (abc***@domain.com)
│   │   • Selection checkmark (if selected)
│   │
│   └─► States:
│       • Gray card: Not selected
│       • Green card: Selected
│
├─► User clicks: Select a coach
│   System: Highlights selected coach card
│
├─► User clicks: "Continue" button
│   │
│   └─► Validation:
│       • ✅ Coach selected → Proceed to Step 2
│       • ❌ No coach → Button disabled (gray)
│
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌═════════════════════════════════════════════════════════════════┐
║                  STEP 2: CREATE TEAM ID                          ║
╚═════════════════════════════════════════════════════════════════╝
│
├─► User sees: 
│   • Selected coach summary card (green background)
│   • "Change" button to go back to Step 1
│   • Large centered Team ID input field
│   • Character counter (0/10)
│
├─► User types: Team ID
│   │
│   └─► System automatically:
│       • Converts to UPPERCASE
│       • Removes special characters
│       • Limits to 10 characters
│       • Only allows A-Z, 0-9
│
├─► System: Auto-validates after 500ms
│   │
│   └─► Calls GET /api/team/check-availability?teamId={id}&email={user}
│
├─► System returns status:
│   │
│   ├─► 🆕 NEW (Blue)
│   │   │   • This is a new Team ID
│   │   │   • You'll be the first coach
│   │   │   • ✅ Can proceed
│   │   │
│   ├─► ✅ AVAILABLE (Green)
│   │   │   • Team has 1 coach already
│   │   │   • Join as co-coach
│   │   │   • Shows existing coach name
│   │   │   • ✅ Can proceed
│   │   │
│   ├─► ❌ FULL (Red)
│   │   │   • Team already has 2 coaches
│   │   │   • Maximum limit reached
│   │   │   • ❌ Cannot proceed
│   │   │
│   └─► ℹ️ TAKEN BY YOU (Yellow)
│       │   • You already own this ID
│       │   • This is your current ID
│       │   • ⚠️ Cannot use same ID again
│
├─► User clicks: "Complete Setup" button
│   │
│   └─► Validation:
│       • Status must be NEW or AVAILABLE
│       • Coach must be selected
│       • Team ID must be 10 characters
│
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌═════════════════════════════════════════════════════════════════┐
║               BACKEND PROCESSING (2 API CALLS)                   ║
╚═════════════════════════════════════════════════════════════════╝
│
├─► API Call 1: Claim Team ID
│   │   POST /api/team/claim-id
│   │   Body: { teamId, email }
│   │   
│   └─► Database Action:
│       • Inserts user into CoachTeams table
│       • Associates user with Team ID
│       • Records timestamp
│
├─► API Call 2: Send Approval Request
│   │   POST /api/upline/request
│   │   Body: { coachId, email }
│   │   
│   └─► Database Action:
│       • Creates approval_requests record
│       • Status: 'pending'
│       • Links requester → selected coach
│       • Sends notification to coach
│
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              SUCCESS MESSAGE DISPLAYED                           │
│               "Request sent!"                                    │
│         (Shows for 1.5 seconds)                                  │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│           NAVIGATE TO OTP VALIDATION PAGE                        │
│     User must verify phone number to activate account           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Alternative Flows

### Flow 1: User Changes Mind on Coach
```
Step 1 → Select Coach → Continue → Step 2 → Click "Change" → Back to Step 1
```

### Flow 2: Team ID Already Taken
```
Step 2 → Enter ID → System checks → "FULL" status → User must enter different ID
```

### Flow 3: User Logs Out
```
Any Step → Click Logout (top-right) → Confirmation → Returns to Login Screen
```

### Flow 4: Session Expired
```
Any Step → API call fails → Error: "Session expired" → Redirect to Login
```

---

## 📱 UI States & Interactions

### Step 1 States:
| State | Trigger | UI Response |
|-------|---------|-------------|
| **Empty** | Initial load | Shows "Start typing to search..." |
| **Searching** | Typing > 2 chars | Loading spinner in input field |
| **Results** | API returns coaches | List of coach cards |
| **No Results** | API returns empty | "No coaches found" message |
| **Selected** | Click coach card | Green highlight + checkmark |
| **Ready** | Coach selected | "Continue" button turns green |

### Step 2 States:
| State | Team ID Status | Color | Action Button |
|-------|---------------|-------|---------------|
| **Typing** | Incomplete | Gray | Disabled |
| **Checking** | Validating | Gray | Disabled (spinner) |
| **New** | Available | Blue | Enabled |
| **Available** | 1 coach exists | Green | Enabled |
| **Full** | 2 coaches exist | Red | Disabled |
| **Yours** | Already owned | Yellow | Disabled |

---

## 🎨 Visual Design Elements

### Colors:
- **Green (#10B981)**: Success, selected, available
- **Blue (#3B82F6)**: New Team ID
- **Red (#EF4444)**: Error, full, blocked
- **Yellow (#F59E0B)**: Warning, already owned
- **Gray (#6B7280)**: Inactive, disabled

### Animations:
- **Fade in**: Modal appears with scale effect
- **Slide transition**: Step 1 ↔ Step 2 horizontal slide
- **Pulse**: Loading states and spinners
- **Checkmark**: Success confirmation

### Icons:
- 🔍 Search (magnifying glass)
- ✓ Selected (checkmark)
- → Next/Continue (right arrow)
- ← Back (left arrow)
- 🚪 Logout (exit door)

---

## 🛡️ Validation Rules

### Coach Search:
- ✅ Minimum 2 characters to search
- ✅ 500ms debounce delay
- ✅ Must select exactly 1 coach
- ✅ Cannot proceed without selection

### Team ID:
- ✅ Exactly 10 characters (no more, no less)
- ✅ Only alphanumeric: A-Z, 0-9
- ✅ Auto-converts to UPPERCASE
- ✅ Must be NEW or AVAILABLE status
- ✅ Cannot use Team ID you already own
- ✅ Cannot join FULL teams (2 coach limit)

---

## 📊 Data Flow

### User Email (Stored in localStorage):
```
Login → localStorage.setItem('userEmail', email) → Used in all API calls
```

### Selected Coach (Stored in state):
```javascript
{
  userId: "123",
  userName: "John Doe",
  email: "john@example.com"
}
```

### Team ID Check Response:
```javascript
{
  status: "new" | "available" | "taken" | "taken-by-you",
  existingCoach: {
    name: "Jane Smith"
  } // Only if status === 'available'
}
```

---

## 🔐 Security Features

1. **Email Masking**: Shows only first 3 chars + domain
2. **Session Validation**: Checks localStorage for userEmail
3. **Server-side Validation**: All inputs validated on backend
4. **Rate Limiting**: Debounced searches prevent spam
5. **Team Limit Enforcement**: Max 2 coaches per Team ID

---

## ⚡ Performance Optimizations

1. **Debouncing**: 500ms delay on search and validation
2. **Lazy Loading**: Coaches loaded on-demand
3. **Optimistic UI**: Instant feedback before API response
4. **Error Recovery**: Clear error messages + retry options
5. **Loading States**: Spinners for all async operations

---

## 🐛 Error Handling

### Common Errors:
| Error | Message | User Action |
|-------|---------|-------------|
| Session expired | "Session expired. Please login again." | Re-login |
| Network error | "Failed to check Team ID" | Retry |
| No coach selected | Button disabled | Select coach |
| Invalid Team ID | "Must be exactly 10 alphanumeric characters" | Fix format |
| Team full | "Already has 2 coaches" | Try different ID |

---

## 📱 Mobile Responsiveness

- **Desktop**: Modal centered, max-width 28rem
- **Mobile**: Full-screen overlay, rounded corners on top
- **Scrollable**: Content area scrolls independently
- **Touch-friendly**: 44px minimum tap targets
- **Keyboard**: Auto-focus on inputs

---

## 🎯 Success Metrics

Users complete setup when:
- ✅ Coach selected
- ✅ Valid Team ID claimed (NEW or AVAILABLE)
- ✅ Approval request sent to coach
- ✅ Redirected to OTP validation

Next Step: Coach must **approve** the request before user gains full access.

---

## 🔗 Related Flows

1. **Coach Approval Flow**: Coach receives notification → Approves/Rejects
2. **OTP Validation Flow**: User verifies phone number
3. **Dashboard Access**: After approval + OTP → Full app access
4. **Team Management**: View team structure, add members

---

## 📝 Technical Notes

**Frontend**: React + Framer Motion + Tailwind CSS
**State Management**: Local useState hooks
**API Integration**: Axios
**Routing**: Modal overlay (no route change)
**Local Storage**: userEmail persistence
**Validation**: Client-side + Server-side
**Database Tables**: `CoachTeams`, `approval_requests`, `users`

