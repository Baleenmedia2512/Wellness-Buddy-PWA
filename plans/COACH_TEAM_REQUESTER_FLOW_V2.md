# Requester Flow - Complete Auth Module Plan

**Project:** Wellness Buddy PWA - Coach Team Authentication  
**Module:** Complete Requester's Journey (Post-Login Authentication)  
**Developer:** To be implemented with AI assistance  
**Parent Plan:** [COACH_TEAM_2_MODULE_PLAN.md](./COACH_TEAM_2_MODULE_PLAN.md)

---

## **Executive Overview**

This document provides a comprehensive plan for the **complete requester authentication module** - covering every step from post-login to app access. This is the entire setup wizard that new users must complete.

**Complete User Journey:**
> "After logging in for the first time, I need to: (1) Create or join a Team ID, (2) Search and select my upline coach, (3) Send a join request, (4) Wait for coach approval, (5) Validate OTP when approved, and (6) Gain access to the main application."

**Scope:** This document covers ALL 5 pages of the authentication flow:
1. Team ID Setup Page (`/setup/team`)
2. Coach Search Page (`/setup/upline`)
3. Pending Approval Page (`/setup/pending`)
4. OTP Validation Page (`/setup/validate-otp`)
5. Rejection Page (`/setup/rejected`)

**Note:** This is a planning document focused on requirements, flows, and UI/UX. Code examples should be generated during development with AI assistance.

---

## **Complete User Journey Map**

### **Full Flow Diagram:**

```
┌──────────────────────────────────────────────────────────────────────┐
│                  COMPLETE REQUESTER AUTHENTICATION FLOW               │
└──────────────────────────────────────────────────────────────────────┘

                    [USER LOGS IN]
                          │
                          ▼
              ┌─────────────────────┐
              │  Check Setup Status │
              └─────────────────────┘
                          │
                          ▼
           ┌──────────────────────────────┐
           │  Has TeamId? Has Upline?     │
           │  Has Pending Request?        │
           └──────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
   Setup              Setup            Already
   Incomplete        Pending           Complete
        │                 │                 │
        ▼                 ▼                 ▼
                                    
┌───────────────────────────────────────────────────────────────────┐
│                    STEP 1: TEAM ID SETUP                          │
│                    Route: /setup/team                             │
└───────────────────────────────────────────────────────────────────┘
        │
        ├─► Input Team ID (10 alphanumeric)
        ├─► Real-time availability check
        ├─► 3 States: NEW / AVAILABLE (1 coach) / TAKEN (2 coaches)
        ├─► Continue button (disabled if TAKEN)
        │
        ▼
    Team ID claimed → Saved to database
        │
        ▼

┌───────────────────────────────────────────────────────────────────┐
│                    STEP 2: COACH SEARCH                           │
│                    Route: /setup/upline                           │
└───────────────────────────────────────────────────────────────────┘
        │
        ├─► Search input with live results
        ├─► Filter: Exclude self, only show coaches
        ├─► Display: Name, Username, Masked Email, Team ID
        ├─► Select coach → Confirmation modal
        │
        ▼
    Join request sent → Email to coach
        │
        ▼

┌───────────────────────────────────────────────────────────────────┐
│                    STEP 3: PENDING APPROVAL                       │
│                    Route: /setup/pending                          │
└───────────────────────────────────────────────────────────────────┘
        │
        ├─► Display: Coach info, Request time, Waiting message
        ├─► Poll status every 10 seconds
        ├─► Action: Can cancel request
        │
        ▼
      ┌─────────────────────────────────────┐
      │   Wait for Coach Decision           │
      │   (Auto-refresh every 10 seconds)   │
      └─────────────────────────────────────┘
        │
        ▼
   ┌────────────────┬────────────────┬────────────────┐
   │                │                │                │
   ▼                ▼                ▼                ▼
APPROVED        REJECTED        CANCELLED        TIMEOUT
   │                │                │                │
   │                │                │                │
OTP sent      Reason shown    User action     After 7 days
   │                │                │                │
   ▼                ▼                ▼                ▼

┌───────────────────────────────────────────────────────────────────┐
│                    STEP 4: OTP VALIDATION                         │
│                    Route: /setup/validate-otp                     │
└───────────────────────────────────────────────────────────────────┘
        │
        ├─► 6-digit OTP input (auto-submit)
        ├─► Countdown timer (15 minutes)
        ├─► Attempts tracker (5 max)
        ├─► Resend button (60s cooldown)
        │
        ▼
      ┌─────────────┬─────────────┬─────────────┐
      │             │             │             │
      ▼             ▼             ▼             ▼
   CORRECT       WRONG        EXPIRED      5 FAILED
      │             │             │             │
      │             │             │             │
      ▼             ▼             ▼             ▼
  SUCCESS      Retry       Resend new    LOCKED
      │         again         OTP          │
      │             │             │         │
      ▼             │             │         ▼
 Access       ◄─────┴─────────────┘   Contact
 Granted                              coach
      │
      ▼
┌───────────────────────────────────────────────────────────────────┐
│                    FINAL: MAIN APP ACCESS                         │
│                    Route: /dashboard                              │
└───────────────────────────────────────────────────────────────────┘

─────────────────────────────────────────────────────────────────────

┌───────────────────────────────────────────────────────────────────┐
│                    ALTERNATE: REJECTION FLOW                      │
│                    Route: /setup/rejected                         │
└───────────────────────────────────────────────────────────────────┘
        │
        ├─► Display: Rejection message, Reason (if provided)
        ├─► Email notification sent
        ├─► Action: Search for different coach
        │
        ▼
    Back to STEP 2 (Coach Search)
```

### **Journey Duration Estimates:**
- **Step 1 (Team ID):** 1-2 minutes
- **Step 2 (Coach Search):** 2-3 minutes
- **Step 3 (Pending):** Wait time (depends on coach - hours to days)
- **Step 4 (OTP):** 1-2 minutes
- **Total Active Time:** 4-7 minutes
- **Total Wait Time:** Variable (coach-dependent)

---

## **User States & Redirect Logic**

### **How We Identify Setup Status:**

The system checks **3 key data points** to determine where the user is in the setup process:

1. **`team_table.TeamId`** - Has user claimed a Team ID?
2. **`team_table.UplineCoachId`** - Has user joined a coach's team?
3. **`approval_requests_table`** - Does user have a pending request? Is it expired?

### **State Detection & Auto-Redirect:**

#### **State 1: Brand New User (Incomplete Setup)**
```
Database Check:
  team_table.TeamId = NULL
  team_table.UplineCoachId = NULL
  approval_requests_table: No records

User Status: Setup not started
→ Redirect to: /setup/team
→ Action Required: User must create or join Team ID
```

#### **State 2: Has Team ID, No Coach, No Request**
```
Database Check:
  team_table.TeamId = "ABC123XYZ0" ✓
  team_table.UplineCoachId = NULL
  approval_requests_table: No records

User Status: Team ID claimed, coach selection pending
→ Redirect to: /setup/upline
→ Action Required: User must search for coach and send request
```

#### **State 3: Has Team ID, Active Request (Waiting for OTP)**
```
Database Check:
  team_table.TeamId = "ABC123XYZ0" ✓
  team_table.UplineCoachId = NULL
  approval_requests_table: 
    - RequesterId = user.UserId
    - Status = 'pending'
    - OtpExpiresAt > NOW() (not expired) ✓

User Status: Request sent, waiting for coach to share OTP
→ Redirect to: /setup/validate-otp
→ Action Required: User must enter OTP received from coach
→ Display Message: "Your coach has received a verification code. 
                    Please ask them to share it with you."
```

#### **State 4: Has Team ID, Request Expired (24 Hours Passed)**
```
Database Check:
  team_table.TeamId = "ABC123XYZ0" ✓
  team_table.UplineCoachId = NULL
  approval_requests_table: 
    - RequesterId = user.UserId
    - Status = 'pending'
    - OtpExpiresAt < NOW() (EXPIRED) ✗

User Status: Request expired, must resend
→ Backend Action: Delete expired request from database
→ Redirect to: /setup/upline
→ Action Required: User must search for coach again and send new request
→ Display Message: "Your previous request expired. Please select your 
                    coach again to send a new request."
```

#### **State 5: Setup Complete ✅**
```
Database Check:
  team_table.TeamId = "ABC123XYZ0" ✓
  team_table.UplineCoachId = 456 (coach's UserId) ✓
  approval_requests_table: No pending records (or archived)

User Status: Setup complete, full access granted
→ Allow access to: /dashboard and all app routes
→ Action: User can use app normally
→ No redirects: Route guards allow passage
```

### **Status Check API:**

**Endpoint:**
```
GET /api/user/status
Authorization: Bearer {JWT_TOKEN}
```

**Response Structure:**
```json
{
  "success": true,
  "setupComplete": boolean,
  "hasTeamId": boolean,
  "hasUpline": boolean,
  "pendingRequest": {
    "id": number,
    "expiresAt": "ISO timestamp"
  } | null,
  "redirectTo": "/setup/team" | "/setup/upline" | "/setup/validate-otp" | "/dashboard"
}
```

**Response Examples:**

**Example 1: New User**
```json
{
  "success": true,
  "setupComplete": false,
  "hasTeamId": false,
  "hasUpline": false,
  "pendingRequest": null,
  "redirectTo": "/setup/team"
}
```

**Example 2: Waiting for OTP**
```json
{
  "success": true,
  "setupComplete": false,
  "hasTeamId": true,
  "hasUpline": false,
  "pendingRequest": {
    "id": 123,
    "expiresAt": "2025-12-23T10:30:00Z"
  },
  "redirectTo": "/setup/validate-otp"
}
```

**Example 3: Setup Complete**
```json
{
  "success": true,
  "setupComplete": true,
  "hasTeamId": true,
  "hasUpline": true,
  "pendingRequest": null,
  "redirectTo": "/dashboard"
}
```

### **Backend Implementation Logic:**

**Key Database Queries:**
```sql
-- 1. Get user's Team ID and Upline Coach
SELECT TeamId, UplineCoachId 
FROM team_table 
WHERE UserId = ?;

-- 2. Check for active (non-expired) pending request
SELECT Id, Status, OtpExpiresAt 
FROM approval_requests_table 
WHERE RequesterId = ? 
  AND Status = 'pending'
  AND OtpExpiresAt > NOW()
LIMIT 1;

-- 3. Find and clean up expired requests
DELETE FROM approval_requests_table 
WHERE RequesterId = ? 
  AND Status = 'pending'
  AND OtpExpiresAt < NOW();
```

**Decision Flow:**
```
1. Has TeamId?
   ├─ NO → Redirect to /setup/team
   └─ YES → Continue to step 2

2. Has pending non-expired request?
   ├─ YES → Redirect to /setup/validate-otp
   └─ NO → Continue to step 3

3. Has expired request?
   ├─ YES → Delete it, redirect to /setup/upline
   └─ NO → Continue to step 4

4. Has UplineCoachId?
   ├─ NO → Redirect to /setup/upline
   └─ YES → Setup complete, allow app access ✅
```

### **Frontend Route Guard:**

**Call on:**
1. **App load** (when user opens app)
2. **After login** (successful authentication)
3. **On protected route access** (before rendering dashboard/features)
4. **After state changes** (Team ID claimed, request sent, OTP validated)

**Implementation Pattern:**
```javascript
// On app load or route change
async function checkSetupStatus() {
  const response = await fetch('/api/user/status');
  const status = await response.json();

  if (!status.setupComplete) {
    // Redirect to appropriate setup page
    navigate(status.redirectTo);
  } else {
    // Allow access to app
    // User can proceed to requested route
  }
}
```

**Caching Strategy (Optional):**
- Cache status response for 5 minutes
- Clear cache after setup state changes:
  - After Team ID claimed
  - After request sent
  - After OTP validated
- Prevents excessive API calls on route changes

### **Visual State Diagram:**

```
┌─────────────┐
│  User Logs  │
│     In      │
└──────┬──────┘
       │
       ▼
┌─────────────────────┐
│ GET /api/user/status│
└──────┬──────────────┘
       │
       ▼
   Check Database
       │
       ├─────────────────────────────────────────┐
       │                                         │
   No TeamId?                               Has TeamId
       │                                         │
       ▼                                         ▼
  /setup/team                          Has pending request?
                                               │
                                      ├────────┴────────┐
                                      │                 │
                                    YES                NO
                                      │                 │
                                      ▼                 ▼
                                 Expired?         Has UplineCoachId?
                                      │                 │
                              ├───────┴────────┐   ├────┴─────┐
                              │                │   │          │
                             YES              NO  YES         NO
                              │                │   │          │
                              ▼                ▼   ▼          ▼
                      /setup/upline  /setup/    /dashboard  /setup/
                      (delete old)   validate-    (DONE)    upline
                                     otp
```

### **Key Takeaway:**

**Single Source of Truth:**
- `team_table.TeamId` + `team_table.UplineCoachId` = Setup completion status
- Everything else (pending requests, expiry checks) determines the **intermediate redirect path**

**Automatic Cleanup:**
- Expired requests are deleted when detected
- No manual intervention needed
- User can immediately send new request after expiry

---

## **Page-by-Page Requirements**

---

## **PAGE 1: TEAM ID SETUP**

### **Route:** `/setup/team`

### **Purpose:** 
First step in authentication flow. User creates a new Team ID or joins an existing one as co-coach. This establishes the user's team identity.

### **Entry Conditions:**
- User has logged in successfully
- User does NOT have a Team ID in `team_table.TeamId`
- User is redirected here by route guard

### **Exit Conditions:**
- User has claimed a Team ID (saved to database)
- User is redirected to `/setup/upline` (coach search)

### **Page Layout & UI Components:**

```
┌────────────────────────────────────────────────────────┐
│  [Logo]                              [Logout]          │
├────────────────────────────────────────────────────────┤
│                                                        │
│          Setup Your Team (Step 1 of 3)                │
│                                                        │
│  Create or join a Team ID. Each Team ID can have      │
│  up to 2 coaches.                                     │
│                                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │  Team ID (10 characters, alphanumeric)       │    │
│  │  [ ABC123XYZ0                          ] 🔍  │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  [STATUS MESSAGE AREA - Dynamic based on check]       │
│                                                        │
│  Case 1 (New ID):                                     │
│  🆕 This is a new Team ID!                            │
│     You'll be the first coach.                        │
│                                                        │
│  Case 2 (Available):                                  │
│  🤝 This Team ID has 1 coach.                         │
│     You'll join as co-coach!                          │
│     Coach: John Smith (@john)                         │
│                                                        │
│  Case 3 (Taken):                                      │
│  🚫 This Team ID is full (2 coaches).                 │
│     Please try a different ID.                        │
│                                                        │
│  [END STATUS MESSAGE AREA]                            │
│                                                        │
│  [Continue]  [Button enabled only for Case 1 & 2]    │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### **User Interactions:**

1. **Input Team ID:**
   - Text input field (10 characters max)
   - Only alphanumeric characters allowed (A-Z, 0-9)
   - Real-time character counter: "5/10 characters"
   - Case-insensitive (auto-uppercase)

2. **Real-Time Availability Check:**
   - **Trigger:** When user stops typing (500ms debounce) OR onBlur
   - **API Call:** `GET /api/team/check-availability/:teamId`
   - **Loading State:** Show spinner next to input
   - **Display Result:** One of 3 status messages (see UI above)

3. **Continue Button:**
   - **Enabled:** Only when status is "NEW" or "AVAILABLE"
   - **Disabled:** When status is "TAKEN" or input is invalid
   - **Click Action:** 
     - Call `POST /api/team/claim-id` with Team ID
     - Show success toast: "Team ID claimed!"
     - Redirect to `/setup/upline`

### **Validation Rules:**

**Team ID Requirements:**
- Exactly 10 characters
- Alphanumeric only (A-Z, 0-9)
- No spaces, special characters, or emojis
- Must be unique (checked by backend)

**Error Messages:**
- "Team ID must be exactly 10 characters"
- "Only letters and numbers allowed"
- "This Team ID is already full (2 coaches)"
- "Network error. Please check connection and try again."

### **Backend API Requirements:**

**1. Check Availability:**
```
GET /api/team/check-availability/:teamId
Response: {
  available: boolean,
  status: 'new' | 'available' | 'taken',
  coachCount: 0 | 1 | 2,
  message: string,
  existingCoach?: { name, username }  // If coachCount = 1
}
```

**2. Claim Team ID:**
```
POST /api/team/claim-id
Body: { teamId: string }
Response: {
  success: boolean,
  role: 'coach' | 'cocoach',
  message: string
}
```

### **Database Changes:**

**On successful claim:**
1. **If new Team ID:**
   - Insert into `coach_teams_table`: (TeamId, CoachId, CoCoachId=NULL)
   - Update `team_table`: Set TeamId for user

2. **If joining as co-coach:**
   - Update `coach_teams_table`: Set CoCoachId for existing Team ID
   - Update `team_table`: Set TeamId for user

### **Edge Cases & Error Handling:**

| Scenario | Behavior |
|----------|----------|
| User already has Team ID | Show error: "You already have a Team ID: ABC123" |
| Network timeout | Show retry button, allow manual refresh |
| Team ID becomes full while typing | Show updated "TAKEN" status, disable button |
| Invalid characters entered | Show inline error, clear invalid chars |
| Backend error | Show generic error, log details to console |

### **Success Criteria:**
- ✅ User can enter Team ID with real-time feedback
- ✅ Availability check works accurately (3 states)
- ✅ Button only enabled for valid, available IDs
- ✅ Team ID saved correctly to database
- ✅ User redirected to coach search page
- ✅ Cannot claim multiple Team IDs
- ✅ 2-coach limit enforced correctly

---

## **PAGE 2: COACH SEARCH**

### **Route:** `/setup/upline`

### **Purpose:** 
Search for and select an upline coach. This establishes the hierarchical relationship in the team structure.

### **Entry Conditions:**
- User has a Team ID (from Page 1)
- User does NOT have an upline coach (`team_table.UplineCoachId` is NULL)
- User does NOT have a pending request

### **Exit Conditions:**
- User has sent a join request to a coach
- User is redirected to `/setup/pending`

### **Page Layout & UI Components:**

```
┌────────────────────────────────────────────────────────┐
│  [← Back]                            [Logout]          │
├────────────────────────────────────────────────────────┤
│                                                        │
│          Find Your Coach (Step 2 of 3)                │
│                                                        │
│  Search for your upline coach by name or username.    │
│                                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │  🔍 Search coaches...                        │    │
│  │  [john                                    ]  │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  [SEARCH RESULTS - Live filtering]                    │
│                                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │  👤 John Smith                               │    │
│  │     @john · jo***n@gmail.com                 │    │
│  │     Team ID: ABC123XYZ0                      │    │
│  │                            [Select Coach]    │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │  👤 Johnny Doe                               │    │
│  │     @johnnyd · jo*****e@yahoo.com            │    │
│  │     Team ID: DEF456GHI7                      │    │
│  │                            [Select Coach]    │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  No more results                                      │
│                                                        │
└────────────────────────────────────────────────────────┘

                   ┌──────────────────────┐
                   │  CONFIRMATION MODAL  │
                   ├──────────────────────┤
                   │  Send join request   │
                   │  to John Smith       │
                   │  (@john)?            │
                   │                      │
                   │  You'll need         │
                   │  approval to join    │
                   │  their team.         │
                   │                      │
                   │  [Cancel] [Send]     │
                   └──────────────────────┘
```

### **User Interactions:**

1. **Search Input:**
   - Type to search (live filtering)
   - Searches: Name, Username, Email (partial match)
   - Debounce: 300ms after typing stops
   - Min characters: 2
   - Clear button (X) to reset search

2. **Search Results:**
   - Display all matching coaches
   - Show: Name, Username, Masked Email, Team ID
   - Max results: 20 (with "Load More" if needed)
   - Empty state: "No coaches found. Try different keywords."
   - Exclude self from results
   - Sort by: Relevance (name match priority)

3. **Email Masking:**
   - Format: `first***last@domain.com`
   - Examples:
     - john@gmail.com → `jo***n@gmail.com`
     - alice.smith@yahoo.com → `al***th@yahoo.com`
     - a@test.com → `a@test.com` (too short, no mask)

4. **Select Coach:**
   - Click "Select Coach" button
   - Show confirmation modal
   - Display coach details in modal
   - Confirm → Send request → Show success toast → Redirect

### **Validation Rules:**

**Search Requirements:**
- Minimum 2 characters to trigger search
- Maximum 50 characters
- No special validation (any text allowed)

**Selection Requirements:**
- Cannot select self
- Cannot select if already have pending request
- Cannot select if already have upline coach

**Error Messages:**
- "Enter at least 2 characters to search"
- "You already have a pending request to [Coach Name]"
- "You cannot select yourself as your coach"
- "Network error. Please try again."

### **Backend API Requirements:**

**1. Search Coaches:**
```
GET /api/users/search?q={searchQuery}
Response: {
  success: boolean,
  results: [
    { userId, name, username, maskedEmail, teamId }
  ],
  count: number
}
```

**2. Send Join Request:**
```
POST /api/upline/request
Body: { uplineCoachId: number }
Response: {
  success: boolean,
  requestId: number,
  message: string
}
```

**3. Check Existing Request:**
```
GET /api/upline/my-request
Response: {
  success: boolean,
  request: object | null
}
```

### **Database Changes:**

**On successful request:**
1. Insert into `approval_requests_table`:
   - RequesterId: Current user's UserId
   - UplineCoachId: Selected coach's UserId
   - Status: 'pending'
   - RequestedAt: NOW()

2. Send email to coach:
   - Subject: "New team join request from [Requester Name]"
   - Include: Requester details, link to approval page

### **Edge Cases & Error Handling:**

| Scenario | Behavior |
|----------|----------|
| Already have pending request | Show error, redirect to `/setup/pending` |
| Coach deleted account | Show error: "Coach not found" |
| Network timeout during search | Show retry button |
| No search results | Show empty state with suggestions |
| Select same coach twice | Prevent duplicate request |
| Coach's team is full | Allow request (coach may reject) |

### **Success Criteria:**
- ✅ Search works with live filtering
- ✅ Email masking protects privacy
- ✅ Cannot select self or create duplicate requests
- ✅ Confirmation modal prevents accidental selections
- ✅ Request saved correctly to database
- ✅ Email sent to coach successfully
- ✅ User redirected to pending page

---

## **PAGE 3: PENDING APPROVAL**

### **Route:** `/setup/pending`

### **Purpose:** 
Display waiting state while coach reviews the request. Automatically refresh status and redirect based on coach's decision.

### **Entry Conditions:**
- User has sent a join request (from Page 2)
- Request status is 'pending' in database
- User is waiting for coach approval

### **Exit Conditions:**
- **If Approved:** Auto-redirect to `/setup/validate-otp`
- **If Rejected:** Auto-redirect to `/setup/rejected`
- **If Cancelled:** User clicks cancel → Redirect to `/setup/upline`

### **Page Layout & UI Components:**

```
┌────────────────────────────────────────────────────────┐
│  [← Back to Search]                  [Logout]          │
├────────────────────────────────────────────────────────┤
│                                                        │
│          Waiting for Approval (Step 3 of 3)           │
│                                                        │
│  ⏳ Your request is pending                           │
│                                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │  👤 Coach Information                        │    │
│  │                                              │    │
│  │  Name: John Smith                            │    │
│  │  Username: @john                             │    │
│  │  Team ID: ABC123XYZ0                         │    │
│  │  Requested: 2 hours ago                      │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  📧 Waiting for John to approve your request...       │
│                                                        │
│  You'll receive an email when they respond.           │
│  This page will update automatically.                 │
│                                                        │
│  🔄 Last checked: 5 seconds ago                       │
│                                                        │
│  ───────────────────────────────────────────────      │
│                                                        │
│  Need to choose a different coach?                    │
│  [Cancel Request]                                     │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### **User Interactions:**

1. **Auto-Refresh Status:**
   - **Polling Interval:** Every 10 seconds
   - **Method:** Call `GET /api/upline/my-request`
   - **Visual Indicator:** "Last checked: X seconds ago" (updates each poll)
   - **Loading State:** Subtle spinner during API call

2. **Status Transitions:**
   - **Pending → Approved:** 
     - Show success toast: "✅ Approved! Check your email for OTP"
     - Wait 2 seconds (let user see message)
     - Auto-redirect to `/setup/validate-otp`
   
   - **Pending → Rejected:**
     - Show error toast: "❌ Request was not approved"
     - Wait 2 seconds
     - Auto-redirect to `/setup/rejected`

3. **Cancel Request:**
   - Click "Cancel Request" button
   - Show confirmation modal:
     - "Are you sure? You'll need to select a different coach."
     - [No, Keep Request] [Yes, Cancel]
   - If confirmed:
     - Call `DELETE /api/upline/request`
     - Show toast: "Request cancelled"
     - Redirect to `/setup/upline`

4. **Time Display:**
   - Show "Requested: X time ago"
   - Update every minute
   - Format: "2 minutes ago", "1 hour ago", "2 days ago"

### **Backend API Requirements:**

**1. Get Request Status:**
```
GET /api/upline/my-request
Response: {
  success: boolean,
  request: {
    id, status, uplineCoach{}, requestedAt, rejectionReason?
  }
}
```

**2. Cancel Request:**
```
DELETE /api/upline/request
Response: { success: boolean, message: string }
```

### **Auto-Redirect Logic:**

**Polling Response Handling:**
1. Status = 'pending' → Stay on page, continue polling
2. Status = 'approved' → Stop polling, show success, redirect to OTP page
3. Status = 'rejected' → Stop polling, show error, redirect to rejection page
4. No request found → Stop polling, redirect to coach search

**Stop Polling Conditions:**
- Status changed from 'pending'
- User navigates away from page
- User clicks cancel
- 30 minutes elapsed (timeout protection)

### **Edge Cases & Error Handling:**

| Scenario | Behavior |
|----------|----------|\n| Network error during poll | Show offline indicator, retry next interval |
| Coach deletes account | Show error: "Coach no longer available", allow cancel |
| Request timeout (7 days) | Auto-cancel, redirect to coach search |
| Multiple tabs open | All tabs sync (polling detects changes) |
| User closes app | On reopen, detect pending status, redirect here |
| Backend down | Show error banner, manual refresh button |

### **Success Criteria:**
- ✅ Polling works correctly (every 10 seconds)
- ✅ Auto-redirects on status change
- ✅ Cancel request works properly
- ✅ Time display updates accurately
- ✅ Visual indicators show polling activity
- ✅ No memory leaks (cleanup on unmount)
- ✅ Works with multiple tabs open

---

## **PAGE 4: OTP VALIDATION**

### **Route:** `/setup/validate-otp`

### **Purpose:** 
Verify user's identity through email-based OTP. Final security step before granting app access.

### **Entry Conditions:**
- User's request was approved by coach
- OTP has been generated and emailed to user
- User is redirected here from `/setup/pending` (auto-redirect on approval)

### **Exit Conditions:**
- **Success:** OTP validated → User added to team → Redirect to `/dashboard`
- **Failure:** Max attempts reached → Show locked message
- **Expired:** OTP expired → Must request resend

### **Page Layout & UI Components:**

```
┌────────────────────────────────────────────────────────┐
│  [Logo]                              [Need Help?]      │
├────────────────────────────────────────────────────────┤
│                                                        │
│          Enter Verification Code                      │
│                                                        │
│  ✅ Your request was approved!                        │
│                                                        │
│  We've sent a 6-digit code to:                        │
│  jo***n@gmail.com                                     │
│                                                        │
│  Enter it below:                                      │
│                                                        │
│  ┌────────────────────────────────────────┐          │
│  │  [ 1 ]  [ 2 ]  [ 3 ]  [ 4 ]  [ 5 ]  [ 6 ] │          │
│  │  (6 separate input boxes)             │          │
│  └────────────────────────────────────────┘          │
│                                                        │
│  ⏱️ Code expires in: 14:32                            │
│  🔢 Attempts remaining: 5                              │
│                                                        │
│  ───────────────────────────────────────────────      │
│                                                        │
│  Didn't receive the code?                             │
│  [Resend OTP]  (Resend in 60s)                       │
│                                                        │
│  [ERROR MESSAGE AREA - Shows when needed]             │
│  ❌ Incorrect code. Please try again.                 │
│  ⏰ Code has expired. Request a new one.              │
│  🔒 Too many attempts. Contact your coach.            │
│  [END ERROR MESSAGE AREA]                             │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### **User Interactions:**

1. **OTP Input:**
   - 6 separate input boxes (one per digit)
   - Auto-focus next box when digit entered
   - Auto-focus previous box on backspace
   - Auto-submit when all 6 digits entered
   - Only numeric input allowed (0-9)
   - Paste support: Auto-fill all boxes from clipboard

2. **Countdown Timer:**
   - Display time remaining: "14:32" (MM:SS format)
   - Updates every second
   - Red color when < 2 minutes remaining
   - Shows "Expired" when time runs out
   - Disables input when expired

3. **Attempts Tracker:**
   - Display attempts remaining: "5/5"
   - Decrements on each wrong attempt
   - Shows warning when ≤ 2 attempts left
   - Shows locked state at 0 attempts

4. **Resend Button:**
   - Initially disabled for 60 seconds (cooldown)
   - Shows countdown: "Resend in 45s"
   - Enabled after cooldown
   - Click → Generate new OTP → Reset timer & attempts
   - New 60s cooldown starts

5. **Submit OTP:**
   - **Auto-Submit:** When 6th digit entered
   - **Manual Submit:** [Verify] button (optional)
   - Show loading spinner during validation
   - Disable inputs while validating

### **Validation Flow:**

**On OTP Submit:**
1. **Pre-Validation Checks:**
   - All 6 digits entered
   - Not currently validating
   - OTP not expired
   - Attempts remaining > 0

2. **API Call:** `POST /api/upline/validate-otp`
   - Body: { requestId, otp }
   - Headers: JWT token

3. **Response Handling:**
   
   **Success (200):**
   - Show success animation (checkmark, confetti)
   - Display: "Welcome to the team! 🎉"
   - Wait 2 seconds
   - Redirect to `/dashboard`
   
   **Wrong OTP (400):**
   - Show error: "❌ Incorrect code. Please try again."
   - Decrement attempts counter
   - Clear input fields
   - Focus first input box
   - Shake animation on error
   
   **Expired OTP (400):**
   - Show error: "⏰ Code has expired. Request a new one."
   - Disable inputs
   - Highlight "Resend OTP" button
   - Timer shows "Expired"
   
   **Too Many Attempts (400):**
   - Show error: "🔒 Too many failed attempts."
   - Additional text: "Please contact your coach for assistance."
   - Disable all inputs
   - Hide resend button
   - Show "Contact Support" button

4. **Backend Actions on Success:**
   - Update `team_table.UplineCoachId` (establishes coach-member relationship)
   - Delete approval request (cleanup)
   - Send "Welcome" email to requester
   - Send "New member joined" email to coach

### **Backend API Requirements:**

**1. Validate OTP:**
```
POST /api/upline/validate-otp
Body: { requestId, otp }
Response:
  - Success: { success: true, accessGranted: true }
  - Wrong: { success: false, attemptsRemaining: number }
  - Expired: { success: false, expired: true }
  - Locked: { success: false, locked: true }
```

**2. Resend OTP:**
```
POST /api/upline/resend-otp
Body: { requestId }
Response:
  - Success: { success: true, cooldownSeconds: 60 }
  - Cooldown: { success: false, cooldownRemaining: number }
```

### **OTP Generation (Backend Process):**

**When coach approves request:**
1. Generate random 6-digit code (100000-999999)
2. Hash with bcrypt (salt rounds: 10)
3. Store in `approval_requests_table`:
   - OtpHash: Hashed code
   - OtpExpiresAt: NOW() + 15 minutes
   - OtpAttempts: 0
   - OtpSentAt: NOW()
4. Send email with plain OTP to requester

**Security Measures:**
- Never store plain OTP in database
- Always compare hashed values
- Expire after 15 minutes
- Max 5 attempts per OTP
- 60-second cooldown between resends
- Rate limit API endpoints (10 requests/minute per IP)

### **Email Notifications:**

**1. OTP Email (Sent when coach approves):**
- **To:** Requester
- **Subject:** "Your Join Request Approved! 🎉"
- **Content:**
  - Approval confirmation
  - Coach name and Team ID
  - 6-digit OTP code (large, bold)
  - Expiry time (15 minutes)
  - Link to app
  - Instructions

**2. Success Email (Sent after OTP validation):**
- **To Requester:**
  - **Subject:** "Welcome to [Coach Name]'s Team!"
  - **Content:** Welcome message, team details, next steps
- **To Coach:**
  - **Subject:** "New Team Member: [Requester Name]"
  - **Content:** Member details, team size update

**3. Locked Account Email (Sent after 5 failed attempts):**
- **To:** Requester
- **Subject:** "Account Verification Locked"
- **Content:** Explanation, coach contact info, support link

### **Edge Cases & Error Handling:**

| Scenario | Behavior |
|----------|----------|
| Copy/paste OTP with spaces | Auto-trim and validate |
| OTP expires mid-entry | Show expiry message, disable submit |
| Network timeout | Show retry button, keep inputs |
| Resend while validating | Disable resend until validation complete |
| Multiple resend attempts | Enforce cooldown strictly |
| User refreshes page | Maintain requestId in URL/storage |

### **Success Criteria:**
- ✅ OTP input works smoothly (auto-focus, paste support)
- ✅ Countdown timer accurate and visible
- ✅ Attempts tracked correctly
- ✅ Resend cooldown enforced
- ✅ Auto-submit on 6th digit
- ✅ Success animation on validation
- ✅ Redirect to app after success
- ✅ All error states handled gracefully

---

## **PAGE 5: REJECTION**

### **Route:** `/setup/rejected`

### **Purpose:** 
Inform user that their join request was rejected and allow them to choose a different coach.

### **Entry Conditions:**
- User's request was rejected by coach
- Auto-redirected from `/setup/pending` (when polling detects rejection)

### **Exit Conditions:**
- User clicks "Search Another Coach" → Redirect to `/setup/upline`

### **Page Layout & UI Components:**

```
┌────────────────────────────────────────────────────────┐
│  [Logo]                              [Logout]          │
├────────────────────────────────────────────────────────┤
│                                                        │
│          Request Not Approved                         │
│                                                        │
│  ❌ Unfortunately, your request to join               │
│  John Smith's team was not approved.                  │
│                                                        │
│  ┌──────────────────────────────────────────────┐    │
│  │  Reason provided:                            │    │
│  │                                              │    │
│  │  "Team is currently full. Please try        │    │
│  │   again in a few weeks when spots open."    │    │
│  │                                              │    │
│  └──────────────────────────────────────────────┘    │
│                                                        │
│  Don't worry! You can search for a different          │
│  coach and try again.                                 │
│                                                        │
│  [Search for Another Coach]                           │
│                                                        │
└────────────────────────────────────────────────────────┘
```

### **User Interactions:**

1. **Display Rejection:**
   - Show rejection message (friendly tone)
   - Display coach's name
   - Show rejection reason (if provided by coach)
   - If no reason: Show generic "not approved at this time"

2. **Search Another Coach:**
   - Click button → Redirect to `/setup/upline`
   - User can select different coach
   - Previous request is already deleted/archived

### **Validation Rules:**
- No validation needed (informational page only)
- Cannot send new request from this page

### **Backend API Requirements:**
None (data comes from previous page's state or API call)

### **Email Notification:**

**Rejection Email (Sent when coach rejects):**
- **To:** Requester
- **Subject:** "Update on Your Join Request"
- **Content:**
  - Coach name
  - Rejection notice
  - Reason (if provided)
  - Link to search for another coach
  - Support contact info

### **Edge Cases & Error Handling:**

| Scenario | Behavior |
|----------|----------|
| No rejection reason provided | Show generic message |
| Coach deleted after rejection | Still show rejection with coach name |
| User refreshes page | Maintain rejection data in state/storage |
| User tries to go back | Redirect to coach search (can't re-request) |

### **Success Criteria:**
- ✅ Rejection message displays clearly
- ✅ Reason shown if provided
- ✅ User can easily search for different coach
- ✅ Tone is encouraging, not discouraging
- ✅ Email notification sent

---

## **Route Guard Implementation**

### **Purpose:** 
Ensure users cannot bypass the setup wizard and access the main app without completing all steps.

### **Guard Logic:**

**On every route access:**
1. Check user's setup status via `GET /api/user/status`
2. Redirect based on status:

```
if (!hasTeamId):
    redirect to /setup/team

if (hasPendingRequest):
    if (status = 'pending'):
        redirect to /setup/pending
    if (status = 'approved'):
        redirect to /setup/validate-otp
    if (status = 'rejected'):
        redirect to /setup/rejected

if (!hasUplineCoach):
    redirect to /setup/upline

if (hasTeamId && hasUplineCoach):
    allow access to app
```

### **Backend API:**

**Get Setup Status:**
```
GET /api/user/status
Response: {
  success: boolean,
  hasTeamId: boolean,
  hasUpline: boolean,
  setupComplete: boolean,
  pendingRequest: { id, status } | null
}
```

### **Protected Routes:**
All app routes (except login/signup) require `setupComplete = true`

---

## **Complete API Reference**

### **Summary of All APIs:**

| Endpoint | Method | Purpose | Page |
|----------|--------|---------|------|
| `/api/team/check-availability/:teamId` | GET | Check Team ID availability | Page 1 |
| `/api/team/claim-id` | POST | Claim Team ID | Page 1 |
| `/api/users/search?q={query}` | GET | Search for coaches | Page 2 |
| `/api/upline/request` | POST | Send join request | Page 2 |
| `/api/upline/my-request` | GET | Get request status | Page 3 |
| `/api/upline/request` | DELETE | Cancel request | Page 3 |
| `/api/upline/validate-otp` | POST | Validate OTP code | Page 4 |
| `/api/upline/resend-otp` | POST | Resend OTP code | Page 4 |
| `/api/user/status` | GET | Check setup status | All pages |

---

## **Database Schema Reference**

### **Tables Involved:**

**1. team_table (users table):**
- UserId (PK)
- TeamId (VARCHAR(10), nullable) - Added
- UplineCoachId (INT, nullable, FK to UserId) - Added
- UserName, Email, Password, etc.

**2. coach_teams_table:**
- Id (PK)
- TeamId (VARCHAR(10), unique)
- CoachId (INT, nullable, FK to UserId)
- CoCoachId (INT, nullable, FK to UserId)
- CreatedAt, Status

**Note:** Coach-member relationships are tracked via `team_table.UplineCoachId` field. No separate junction table needed. To query all members of a coach: `SELECT * FROM team_table WHERE UplineCoachId = {coachId}`.

**Foreign Keys:** Optional for development. Can be added in production for data integrity. App will work without them, validation handled in backend code.

**3. approval_requests_table:**
- Id (PK)
- RequesterId (INT, FK to UserId)
- UplineCoachId (INT, FK to UserId)
- Status (pending/approved/rejected)
- OtpHash, OtpExpiresAt, OtpAttempts, OtpSentAt
- RejectionReason, RequestedAt

---

## **Testing Checklist**

### **End-to-End Flows:**

**Flow 1: New User Complete Journey**
- [ ] Sign up → Login → Redirected to team setup
- [ ] Create new Team ID → Success message
- [ ] Search for coach → Select coach → Confirm
- [ ] See pending page → Coach approves (separate session)
- [ ] Auto-redirect to OTP page → Receive OTP email
- [ ] Enter correct OTP → Success animation → Redirect to app
- [ ] Can access dashboard → Team info visible

**Flow 2: Join as Co-Coach**
- [ ] Login → Team setup page
- [ ] Enter existing Team ID (1 coach) → See "join as co-coach" message
- [ ] Claim ID → Success → Redirect to coach search
- [ ] Complete rest of flow normally

**Flow 3: Rejection Flow**
- [ ] Send join request → Pending page
- [ ] Coach rejects with reason (separate session)
- [ ] Auto-redirect to rejection page → See reason
- [ ] Receive rejection email
- [ ] Click "Search Another Coach" → Can select different coach

**Flow 4: Cancel Request**
- [ ] Send request → Pending page
- [ ] Click "Cancel Request" → Confirm modal
- [ ] Confirm → Redirect to coach search
- [ ] Can send new request to different coach

**Flow 5: OTP Failure Scenarios**
- [ ] Enter wrong OTP → See error, attempts decrement
- [ ] Enter wrong OTP 5 times → Account locked message
- [ ] Wait for OTP to expire → See expiry message
- [ ] Click resend → Get new OTP, timer resets, attempts reset
- [ ] Resend while cooldown active → Button disabled

### **Route Guard Tests:**
- [ ] Try to access /dashboard without setup → Redirected to /setup/team
- [ ] Try to access /dashboard with pending request → Redirected to /setup/pending
- [ ] After OTP validation → Can access /dashboard
- [ ] Logout and login → Redirected to correct page based on status

### **Edge Cases:**
- [ ] Team ID becomes full while typing → Status updates correctly
- [ ] Coach deletes account while request pending → Handled gracefully
- [ ] Network error during polling → Shows retry option
- [ ] Multiple tabs open → All tabs sync status
- [ ] Close app during pending → Reopen → Still on pending page
- [ ] Paste OTP with spaces → Auto-trims and validates

---

## **Developer Handoff Checklist**

Before starting implementation, ensure you have:

- [ ] Access to the database (team_table, approval_requests_table, etc.)
- [ ] JWT authentication working
- [ ] Email service configured (SendGrid/AWS SES/etc.)
- [ ] OTP generation service from existing codebase
- [ ] React Router setup
- [ ] State management (Context API/Redux/Zustand)
- [ ] Toast notification library
- [ ] Environment variables configured
- [ ] bcrypt library for OTP hashing

**Questions to clarify with product owner:**
- [ ] Should rejected users be able to re-request the same coach?
- [ ] How long should OTP remain valid? (Currently 15 min)
- [ ] Maximum resend attempts? (Currently unlimited with cooldown)
- [ ] What happens if coach deletes account while request is pending?
- [ ] Should there be a timeout for pending requests (e.g., 7 days)?

---

## **Summary**

This document provides complete planning and requirements for the **requester's authentication flow** in the coach-team system. The key components are:

1. **Team ID Setup:** Create or join a Team ID (max 2 coaches)
2. **Coach Search:** Find and select upline coach with email privacy
3. **Pending Approval:** Wait for coach decision with auto-refresh
4. **OTP Validation:** Secure identity verification before app access
5. **Rejection Handling:** Graceful rejection with ability to try again

All transitions are automatic where possible, emails are sent at key steps, and proper error handling ensures a smooth user experience.

---

**Ready for Implementation!** 🚀

**Contact:** Use AI assistant for code generation and debugging during implementation.  
**Last Updated:** December 19, 2025  
**Status:** Planning Complete - Ready for Development
