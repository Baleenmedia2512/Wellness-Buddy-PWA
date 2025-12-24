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

**Note:** This is a planning document. Code examples and implementation details should be generated during development with AI assistance.

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
   Setup                Setup            Already
   Incomplete          Pending           Complete
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
└────Page-by-Page Implementation Plan**

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
│  │                            [Select Coach] ─────┐  │
│  └──────────────────────────────────────────────┘  │  │
│                                                     │  │
│  ┌──────────────────────────────────────────────┐  │  │
│  │  👤 Johnny Doe                               │  │  │
│  │     @johnnyd · jo*****e@yahoo.com            │  │  │
│  │     Team ID: DEF456GHI7                      │  │  │
│  │                            [Select Coach]    │  │  │
│  └──────────────────────────────────────────────┘  │  │
│                                                     │  │
│  No more results                                    │  │
│                                                     │  │
│  [END SEARCH RESULTS]                               │  │
│                                                     │  │
└─────────────────────────────────────────────────────┼──┘
                                                      │
                   ┌──────────────────────────────────┘
                   │
                   ▼
         ┌─────────────────────────┐
         │  CONFIRMATION MODAL     │
         ├─────────────────────────┤
         │  Send join request to   │
         │  John Smith (@john)?    │
         │                         │
         │  You'll need approval   │
         │  to join their team.    │
         │                         │
         │  [Cancel]  [Send Request]│
         └─────────────────────────┘
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
    {
      userId: number,
      name: string,
      username: string,
      maskedEmail: string,
      teamId: string
    }
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
└───────────────
### **Route:** `/setup/pending`
        ├─► Filter: Exclude self, only show coaches
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

## **Implementation Details**

### **STATE 1: Request Sent - Pending Page**

**Route:** `/setup/pending`

**Purpose:** Show waiting state while coach reviews the request

**UI Requirements:**
```
┌─────────────────────────────────────────┐
│  Waiting for Approval                    │
│                                          │
│  ⏳ Your request is pending             │
│                                          │
│  Coach: John Smith (@john)               │
│  Team ID: ABC123XYZ0                     │
│  Requested: 2 hours ago                  │
│                                          │
│  Waiting for John to approve your        │
│  request to join their team...           │
│                                          │
│  You'll receive an email when they       │
│  respond.                                │
│                                          │
│  [Cancel Request] (gray button)          │
└─────────────────────────────────────────┘
```

**Backend API:**
```javascript
GET /api/upline/my-request
```

**Response Structure:**
```json
{
  "success": true,
  "request": {
    "id": 123,
    "status": "pending",
    "uplineCoach": {
      "userId": 456,
      "username": "john",
      "coachName": "John Smith",
      "teamId": "ABC123XYZ0"
    },
    "requestedAt": "2025-12-19T10:30:00Z"
  }
}
```

**Frontend Logic (React Example):**
```javascript
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function PendingApprovalPage() {
  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Poll every 10 seconds
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/upline/my-request', {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        const data = await response.json();
        
        if (data.success && data.request) {
          setRequest(data.request);
          
          // STATE TRANSITIONS
          if (data.request.status === 'approved') {
            // Coach approved! Redirect to OTP page
            navigate('/setup/validate-otp', { 
              state: { requestId: data.request.id } 
            });
          } else if (data.request.status === 'rejected') {
            // Coach rejected! Show rejection message
            navigate('/setup/rejected', { 
              state: { 
                reason: data.request.rejectionReason,
                coachName: data.request.uplineCoach.coachName 
              } 
            });
          }
        } else {
          // No pending request found - redirect to search
          navigate('/setup/upline');
        }
        
        setLoading(false);
      } catch (error) {
        console.error('Error fetching request status:', error);
      }
    };

    // Initial fetch
    fetchStatus();
    
    // Set up polling
    const interval = setInterval(fetchStatus, 10000); // 10 seconds
    
    // Cleanup
    return () => clearInterval(interval);
  }, [navigate]);

  const handleCancelRequest = async () => {
    if (!confirm('Are you sure you want to cancel this request?')) return;
    
    try {
      await fetch('/api/upline/request', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      
      // Redirect back to coach search
      navigate('/setup/upline');
    } catch (error) {
      alert('Failed to cancel request. Please try again.');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="pending-page">
      <h1>⏳ Waiting for Approval</h1>
      <div className="request-info">
        <p><strong>Coach:</strong> {request.uplineCoach.coachName}</p>
        <p><strong>Team ID:</strong> {request.uplineCoach.teamId}</p>
        <p><strong>Requested:</strong> {formatTimeAgo(request.requestedAt)}</p>
      </div>
      <p className="waiting-message">
        Waiting for {request.uplineCoach.coachName} to approve your request...
        You'll receive an email when they respond.
      </p>
      <button onClick={handleCancelRequest} className="btn-cancel">
        Cancel Request
      </button>
    </div>
  );
}
```

**Key Implementation Points:**
- ✅ Poll every 10 seconds using `setInterval`
- ✅ Check for status changes: `pending` → `approved` → `rejected`
- ✅ Auto-redirect based on status
- ✅ Allow user to cancel request
- ✅ Show coach details and time elapsed

---

### **STATE 2: APPROVED - Redirect to OTP Page**

**Trigger:** Coach clicks "Approve" in their dashboard

**Backend Process (handled by coach's action):**
```javascript
// POST /api/team/approve-request (Coach's action)
// This happens on coach's side - requester just receives the result

Backend automatically:
1. Updates approval_requests_table: Status = 'approved'
2. Generates 6-digit OTP
3. Hashes OTP with bcrypt
4. Stores: OtpHash, OtpExpiresAt (15 min), OtpAttempts = 0
5. Sends email to requester with OTP
```

**Email Template (Sent to Requester):**
```
Subject: Your Join Request Approved! 🎉

Hi [Requester Name],

Great news! [Coach Name] has approved your request to join their team.

Your Team ID: [ABC123XYZ0]
Coach: [Coach Name]

To complete the process, please enter this verification code:

┌─────────────────────┐
│   OTP CODE: 123456  │
└─────────────────────┘

This code expires in 15 minutes.

Enter the code here: [Link to app]

Welcome to the team!

Best regards,
Wellness Buddy Team
```

**Frontend Transition:**
```javascript
// In PendingApprovalPage, when polling detects status = 'approved':
if (data.request.status === 'approved') {
  // Show success toast
  showToast('✅ Approved! Check your email for OTP');
  
  // Redirect to OTP page after 2 seconds
  setTimeout(() => {
    navigate('/setup/validate-otp', { 
      state: { 
        requestId: data.request.id,
        coachName: data.request.uplineCoach.coachName 
      } 
    });
  }, 2000);
}
```

---

### **STATE 3: OTP Validation Page**

**Route:** `/setup/validate-otp`

**Purpose:** Validate OTP and grant app access

**UI Requirements:**
```
┌─────────────────────────────────────────┐
│  Enter Verification Code                 │
│                                          │
│  ✅ Your request was approved!          │
│                                          │
│  We've sent a 6-digit code to your      │
│  email. Enter it below:                  │
│                                          │
│  ┌───┬───┬───┬───┬───┬───┐             │
│  │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │             │
│  └───┴───┴───┴───┴───┴───┘             │
│                                          │
│  ⏱️ Code expires in: 14:32              │
│  🔢 Attempts remaining: 5                │
│                                          │
│  Didn't receive code?                    │
│  [Resend OTP] (disabled 60s cooldown)   │
│                                          │
│  ❌ Wrong code? (if error)              │
│  ⏰ Code expired? (if expired)          │
└─────────────────────────────────────────┘
```

**Backend APIs:**

**1. Validate OTP:**
```javascript
POST /api/upline/validate-otp
Content-Type: application/json

Request Body:
{
  "requestId": 123,
  "otp": "123456"
}

Success Response (200):
{
  "success": true,
  "message": "OTP validated successfully!",
  "accessGranted": true
}

Error Responses:
// Wrong OTP
{
  "success": false,
  "error": "Invalid OTP",
  "attemptsRemaining": 4
}

// Expired OTP
{
  "success": false,
  "error": "OTP has expired",
  "expired": true
}

// Too many attempts
{
  "success": false,
  "error": "Too many failed attempts. Please contact your coach.",
  "locked": true
}
```

**2. Resend OTP:**
```javascript
POST /api/upline/resend-otp
Content-Type: application/json

Request Body:
{
  "requestId": 123
}

Success Response (200):
{
  "success": true,
  "message": "New OTP sent to your email",
  "cooldownSeconds": 60
}
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
- **Content:** Explanation, coach contact info, support link }

    // 3. Check attempts limit
    if (request.OtpAttempts >= 5) {
      return res.status(400).json({ 
        success: false, 
        error: 'Too many failed attempts. Please contact your coach.',
        locked: true
      });
    }

    // 4. Verify OTP hash
    const bcrypt = require('bcrypt');
    const isValid = await bcrypt.compare(otp, request.OtpHash);

    if (!isValid) {
      // Increment attempts
      await db.query(
        `UPDATE approval_requests_table 
         SET OtpAttempts = OtpAttempts + 1 
         WHERE Id = ?`,
        [requestId]
      );

      return res.status(400).json({ 
        success: false, 
        error: 'Invalid OTP. Please try again.',
        attemptsRemaining: 5 - (request.OtpAttempts + 1)
      });
    }

    // 5. OTP is valid! Grant access
    
    // Add to team_members_table
    await db.query(
      `INSERT INTO team_members_table (CoachId, MemberId, JoinedAt, Status)
       VALUES (?, ?, NOW(), 'active')`,
      [request.UplineCoachId, userId]
    );

    // Update team_table with upline coach
    await db.query(
      `UPDATE team_table 
       SET UplineCoachId = ? 
       WHERE UserId = ?`,
      [request.UplineCoachId, userId]
    );

    // Mark request as completed (can add 'completed' status or delete)
    await db.query(
      `DELETE FROM approval_requests_table WHERE Id = ?`,
      [requestId]
    );

    // Send success email to requester
    await sendEmail(userId, 'welcome-to-team', {
      coachName: request.uplineCoach.coachName
    });

    // Send notification email to coach
    await sendEmail(request.UplineCoachId, 'member-joined', {
      memberName: req.user.UserName
    });

    return res.json({ 
      success: true, 
      message: 'OTP validated successfully!',
      accessGranted: true
    });

  } catch (error) {
    console.error('OTP validation error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Server error. Please try again.' 
    });
  }
};
```

**Frontend Implementation:**
```javascript
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function ValidateOtpPage() {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(5);
  const [timeRemaining, setTimeRemaining] = useState(15 * 60); // 15 minutes in seconds
  const [resendCooldown, setResendCooldown] = useState(0);
  
  const navigate = useNavigate();
  const location = useLocation();
  const requestId = location.state?.requestId;

  // Countdown timer for OTP expiry
  useEffect(() => {
    if (timeRemaining <= 0) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          setError('Code has expired. Please request a new one.');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    
    const timer = setInterval(() => {
      setResendCooldown(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle OTP input
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return; // Only digits
    
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // Only last digit
    setOtp(newOtp);
    
    // Auto-focus next input
    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`).focus();
    }
    
    // Auto-submit when all 6 digits entered
    if (newOtp.every(digit => digit !== '') && newOtp.join('').length === 6) {
      handleSubmit(newOtp.join(''));
    }
  };

  // Handle backspace
  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`).focus();
    }
  };

  // Submit OTP
  const handleSubmit = async (otpCode) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/upline/validate-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          requestId,
          otp: otpCode
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        // SUCCESS! Show animation and redirect to app
        showSuccessAnimation();
        
        setTimeout(() => {
          navigate('/dashboard'); // Main app
        }, 2000);
        
      } else {
        // ERROR handling
        if (data.expired) {
          setError('⏰ Code has expired. Please request a new one.');
          setTimeRemaining(0);
        } else if (data.locked) {
          setError('🔒 Too many failed attempts. Please contact your coach.');
        } else {
          setError(`❌ ${data.error}`);
          setAttemptsRemaining(data.attemptsRemaining || 0);
          
          // Clear OTP inputs for retry
          setOtp(['', '', '', '', '', '']);
          document.getElementById('otp-0').focus();
        }
      }
      
    } catch (error) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResend = async () => {
    if (resendCooldown > 0) return;
    
    try {
      const response = await fetch('/api/upline/resend-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ requestId })
      });
      
      const data = await response.json();
      
      if (data.success) {
        setResendCooldown(60); // 60 second cooldown
        setTimeRemaining(15 * 60); // Reset timer
        setAttemptsRemaining(5); // Reset attempts
        setError('');
        showToast('✅ New code sent to your email');
      } else {
        setError(data.error);
      }
      
    } catch (error) {
      setError('Failed to resend code. Please try again.');
    }
  };

  return (
    <div className="validate-otp-page">
      <h1>Enter Verification Code</h1>
      <p className="success-message">✅ Your request was approved!</p>
      <p>We've sent a 6-digit code to your email. Enter it below:</p>
      
      <div className="otp-inputs">
        {otp.map((digit, index) => (
          <input
            key={index}
            id={`otp-${index}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleOtpChange(index, e.target.value)}
            onKeyDown={(e) => handleKeyDown(index, e)}
            disabled={loading || timeRemaining === 0}
            className="otp-input"
          />
        ))}
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="otp-info">
        <p>⏱️ Code expires in: {formatTime(timeRemaining)}</p>
        <p>🔢 Attempts remaining: {attemptsRemaining}</p>
      </div>
      
      <div className="resend-section">
        <p>Didn't receive code?</p>
        <button 
          onClick={handleResend} 
          disabled={resendCooldown > 0 || timeRemaining === 0}
          className="btn-resend"
        >
          {resendCooldown > 0 
            ? `Resend in ${resendCooldown}s` 
            : 'Resend OTP'}
        </button>
      </div>
      
      {loading && <div className="loading-spinner">Validating...</div>}
    </div>
  );
}

function showSuccessAnimation() {
  // Show success animation/confetti
  const successDiv = document.createElement('div');
  successDiv.className = 'success-overlay';
  successDiv.innerHTML = `
    <div class="success-content">
      <div class="checkmark">✓</div>
      <h2>Welcome to the team!</h2>
      <p>Redirecting to app...</p>
    </div>
  `;
  document.body.appendChild(successDiv);
}
```

**Email Template (Success - Sent to Requester):**
```
Subject: Welcome to [Coach Name]'s Team! 🎉

Hi [Requester Name],

Congratulations! You've successfully joined [Coach Name]'s team.

Your Details:
• Team ID: [ABC123XYZ0]
• Coach: [Coach Name]
• Joined: [Date & Time]

You now have full access to the Wellness Buddy app. Start your wellness journey today!

[Open App Button]

Best regards,
Wellness Buddy Team
```

**Email Template (Success - Sent to Coach):**
```
Subject: New Team Member: [Requester Name] 👥

Hi [Coach Name],

Great news! [Requester Name] has successfully joined your team.

Member Details:
• Name: [Requester Name]
• Email: [Masked Email]
• Team ID: [Their Team ID]
• Joined: [Date & Time]

You can now see them in your team dashboard.

[View Team Dashboard]

Best regards,
Wellness Buddy Team
```

---

### **STATE 4: REJECTED - Rejection Page**

**Route:** `/setup/rejected`

**Purpose:** Inform user that request was rejected and allow them to choose another coach

**UI Requirements:**
```
┌─────────────────────────────────────────┐
│  Request Not Approved                    │
│                                          │
│  ❌ Unfortunately, your request to      │
│  join [Coach Name]'s team was not        │
│  approved.                               │
│                                          │
│  Reason (if provided):                   │
│  ┌────────────────────────────────────┐ │
│  │ "Team is currently full. Please    │ │
│  │  try again in a few weeks."        │ │
│  └────────────────────────────────────┘ │
│                                          │
│  Don't worry! You can search for a       │
│  different coach and try again.          │
│                                          │
│  [Search for Another Coach]              │
└─────────────────────────────────────────┘
```

**Frontend Implementation:**
```javascript
import { useNavigate, useLocation } from 'react-router-dom';

function RejectionPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { reason, coachName } = location.state || {};

  const handleSearchAgain = () => {
    navigate('/setup/upline');
  };

  return (
    <div className="rejection-page">
      <h1>Request Not Approved</h1>
      
      <div className="rejection-message">
        <p className="rejection-icon">❌</p>
        <p>
          Unfortunately, your request to join{' '}
          <strong>{coachName || 'the coach'}</strong>'s team was not approved.
        </p>
      </div>
      
      {reason && (
        <div className="rejection-reason">
          <h3>Reason provided:</h3>
          <blockquote>{reason}</blockquote>
        </div>
      )}
      
      <p className="encouragement">
        Don't worry! You can search for a different coach and try again.
      </p>
      
      <button onClick={handleSearchAgain} className="btn-primary">
        Search for Another Coach
      </button>
    </div>
  );
}
```

**Email Template (Rejection - Sent to Requester):**
```
Subject: Update on Your Join Request

Hi [Requester Name],

We wanted to let you know that [Coach Name] was unable to approve your request to join their team at this time.

[IF REASON PROVIDED:]
Reason: "[Rejection Reason]"

Don't worry! You can search for a different coach in the app and send a new request.

[Search for Coach Button]

If you need assistance, feel free to contact our support team.

Best regards,
Wellness Buddy Team
```

---

## **Route Guard Implementation**

**Purpose:** Ensure users can't bypass the setup process

```javascript
// middleware/setupGuard.js
const setupGuard = async (req, res, next) => {
  const userId = req.user.UserId;
  
  try {
    // Get user setup status
    const [user] = await db.query(
      'SELECT TeamId, UplineCoachId FROM team_table WHERE UserId = ?',
      [userId]
    );
    
    // Check for pending approval request
    const [pendingRequest] = await db.query(
      `SELECT Id, Status FROM approval_requests_table 
       WHERE RequesterId = ? AND Status IN ('pending', 'approved')`,
      [userId]
    );
    
    const setupStatus = {
      hasTeamId: !!user.TeamId,
      hasUpline: !!user.UplineCoachId,
      pendingRequest: pendingRequest || null,
      setupComplete: !!(user.TeamId && user.UplineCoachId)
    };
    
    req.setupStatus = setupStatus;
    next();
    
  } catch (error) {
    return res.status(500).json({ error: 'Setup check failed' });
  }
};

// Apply to protected routes
app.get('/api/dashboard', setupGuard, (req, res) => {
  if (!req.setupStatus.setupComplete) {
    return res.status(403).json({ 
      error: 'Setup incomplete',
      redirect: getRedirectPath(req.setupStatus)
    });
  }
  
  // Continue to dashboard
  // ...
});

function getRedirectPath(status) {
  if (!status.hasTeamId) return '/setup/team';
  
  if (status.pendingRequest) {
    if (status.pendingRequest.Status === 'pending') {
      return '/setup/pending';
    }
    if (status.pendingRequest.Status === 'approved') {
      return '/setup/validate-otp';
    }
  }
  
  if (!status.hasUpline) return '/setup/upline';
  
  return '/dashboard';
}
```

**Frontend Route Protection:**
```javascript
// App.js or Router.js
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function ProtectedRoute({ children }) {
  const navigate = useNavigate();
  
  useEffect(() => {
    checkSetupStatus();
  }, []);
  
  const checkSetupStatus = async () => {
    try {
      const response = await fetch('/api/user/status', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      
      if (!data.setupComplete) {
        // Redirect to appropriate setup page
        if (!data.hasTeamId) {
          navigate('/setup/team');
        } else if (data.pendingRequest) {
          if (data.pendingRequest.status === 'pending') {
            navigate('/setup/pending');
          } else if (data.pendingRequest.status === 'approved') {
            navigate('/setup/validate-otp');
          }
        } else if (!data.hasUpline) {
          navigate('/setup/upline');
        }
      }
    } catch (error) {
      console.error('Setup status check failed:', error);
    }
  };
  
  return children;
}

// Usage
<Routes>
  <Route path="/dashboard" element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  } />
  <Route path="/setup/team" element={<TeamSetup />} />
  <Route path="/setup/upline" element={<CoachSearch />} />
  <Route path="/setup/pending" element={<PendingApproval />} />
  <Route path="/setup/validate-otp" element={<ValidateOtp />} />
  <Route path="/setup/rejected" element={<Rejection />} />
</Routes>
```

---

## **Complete API Reference**

### **1. Get My Request Status**
```
GET /api/upline/my-request
Headers: Authorization: Bearer {token}

Response 200 (Pending):
{
  "success": true,
  "request": {
    "id": 123,
    "status": "pending",
    "uplineCoach": {
      "userId": 456,
      "username": "john",
      "coachName": "John Smith",
      "teamId": "ABC123XYZ0"
    },
    "requestedAt": "2025-12-19T10:30:00Z"
  }
}

Response 200 (Approved):
{
  "success": true,
  "request": {
    "id": 123,
    "status": "approved",
    "uplineCoach": { ... },
    "requestedAt": "2025-12-19T10:30:00Z"
  }
}

Response 200 (Rejected):
{
  "success": true,
  "request": {
    "id": 123,
    "status": "rejected",
    "rejectionReason": "Team is full",
    "uplineCoach": { ... },
    "requestedAt": "2025-12-19T10:30:00Z"
  }
}

Response 404 (No Request):
{
  "success": false,
  "error": "No pending request found"
}
```

### **2. Cancel My Request**
```
DELETE /api/upline/request
Headers: Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "message": "Request cancelled successfully"
}

Response 404:
{
  "success": false,
  "error": "No pending request to cancel"
}
```

### **3. Validate OTP**
```
POST /api/upline/validate-otp
Headers: Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "requestId": 123,
  "otp": "123456"
}

Response 200 (Success):
{
  "success": true,
  "message": "OTP validated successfully!",
  "accessGranted": true
}

Response 400 (Invalid):
{
  "success": false,
  "error": "Invalid OTP. Please try again.",
  "attemptsRemaining": 4
}

Response 400 (Expired):
{
  "success": false,
  "error": "OTP has expired. Please request a new code.",
  "expired": true
}

Response 400 (Locked):
{
  "success": false,
  "error": "Too many failed attempts. Please contact your coach.",
  "locked": true
}
```

### **4. Resend OTP**
```
POST /api/upline/resend-otp
Headers: Authorization: Bearer {token}
Content-Type: application/json

Body:
{
  "requestId": 123
}

Response 200:
{
  "success": true,
  "message": "New OTP sent to your email",
  "cooldownSeconds": 60
}

Response 400 (Cooldown):
{
  "success": false,
  "error": "Please wait before requesting a new code",
  "cooldownRemaining": 45
}
```

### **5. Get User Setup Status**
```
GET /api/user/status
Headers: Authorization: Bearer {token}

Response 200:
{
  "success": true,
  "hasTeamId": true,
  "hasUpline": false,
  "setupComplete": false,
  "pendingRequest": {
    "id": 123,
    "status": "pending"
  }
}
```

---

## **Database Queries Reference**

### **Check Request Status**
```sql
SELECT 
  ar.Id,
  ar.Status,
  ar.RejectionReason,
  ar.RequestedAt,
  ar.OtpExpiresAt,
  ar.OtpAttempts,
  t.UserId as CoachUserId,
  t.UserName as CoachUserName,
  t.CoachName as CoachName,
  t.TeamId as CoachTeamId
FROM approval_requests_table ar
INNER JOIN team_table t ON ar.UplineCoachId = t.UserId
WHERE ar.RequesterId = ? 
  AND ar.Status IN ('pending', 'approved', 'rejected')
ORDER BY ar.RequestedAt DESC
LIMIT 1;
```

### **Validate OTP**
```sql
-- Get request with OTP
SELECT 
  Id,
  RequesterId,
  UplineCoachId,
  Status,
  OtpHash,
  OtpExpiresAt,
  OtpAttempts
FROM approval_requests_table
WHERE Id = ? 
  AND RequesterId = ? 
  AND Status = 'approved';

-- Increment attempts
UPDATE approval_requests_table 
SET OtpAttempts = OtpAttempts + 1 
WHERE Id = ?;

-- On success: Add to team
INSERT INTO team_members_table 
  (CoachId, MemberId, JoinedAt, Status)
VALUES (?, ?, NOW(), 'active');

-- On success: Update user's upline
UPDATE team_table 
SET UplineCoachId = ? 
WHERE UserId = ?;

-- On success: Clean up request
DELETE FROM approval_requests_table 
WHERE Id = ?;
```

### **Cancel Request**
```sql
DELETE FROM approval_requests_table 
WHERE RequesterId = ? 
  AND Status = 'pending';
```

---

## **Testing Checklist**

### **Manual Testing Scenarios:**

**1. Happy Path - Approved:**
- [ ] Send join request
- [ ] See pending page with coach details
- [ ] Coach approves (test in separate session)
- [ ] Pending page auto-redirects to OTP page
- [ ] Receive OTP email
- [ ] Enter correct OTP
- [ ] See success animation
- [ ] Redirected to main app
- [ ] Can access dashboard
- [ ] Both requester and coach receive emails

**2. Rejection Path:**
- [ ] Send join request
- [ ] Coach rejects with reason (test in separate session)
- [ ] Pending page auto-redirects to rejection page
- [ ] See rejection message with reason
- [ ] Receive rejection email
- [ ] Click "Search Another Coach"
- [ ] Can send new request to different coach

**3. OTP Failure Scenarios:**
- [ ] Enter wrong OTP → See error, attempts decrement
- [ ] Enter wrong OTP 5 times → Account locked message
- [ ] Wait for OTP to expire → See expiry message
- [ ] Click resend → Get new OTP, timer resets
- [ ] Click resend again immediately → Button disabled (cooldown)

**4. Cancel Request:**
- [ ] Send request
- [ ] Click cancel on pending page
- [ ] Confirm cancellation
- [ ] Redirected to coach search
- [ ] Can send new request

**5. Route Protection:**
- [ ] Try to access /dashboard without setup → Redirected to /setup/team
- [ ] Try to access /dashboard with pending request → Redirected to /setup/pending
- [ ] Try to access /dashboard with approved OTP → Redirected to /setup/validate-otp
- [ ] After OTP validation → Can access /dashboard

**6. Edge Cases:**
- [ ] Close app during pending state → Reopen → Still on pending page
- [ ] Network error during OTP validation → Show retry option
- [ ] Coach deletes account while request pending → Handle gracefully
- [ ] Multiple tabs open → State syncs correctly

---

## **Error Handling**

### **Network Errors:**
```javascript
try {
  const response = await fetch('/api/endpoint');
  // Handle response
} catch (error) {
  // Network error
  showToast('Network error. Please check your connection.', 'error');
  // Offer retry button
}
```

### **API Errors:**
```javascript
const response = await fetch('/api/endpoint');
const data = await response.json();

if (!response.ok) {
  // Handle specific error codes
  switch (response.status) {
    case 400:
      showToast(data.error || 'Invalid request', 'error');
      break;
    case 401:
      // Unauthorized - redirect to login
      navigate('/login');
      break;
    case 404:
      showToast('Resource not found', 'error');
      break;
    case 500:
      showToast('Server error. Please try again later.', 'error');
      break;
    default:
      showToast('Something went wrong', 'error');
  }
}
```

---

## **Security Considerations**

1. **OTP Security:**
   - ✅ Always hash OTP with bcrypt before storing
   - ✅ Set 15-minute expiry
   - ✅ Limit to 5 attempts
   - ✅ 60-second cooldown between resends
   - ✅ Delete OTP after successful validation

2. **Authorization:**
   - ✅ Verify JWT token on every API call
   - ✅ Ensure requesterId matches JWT userId
   - ✅ Check request belongs to user before allowing validation

3. **Rate Limiting:**
   - ✅ Limit OTP validation attempts (5 max)
   - ✅ Cooldown on resend (60 seconds)
   - ✅ Consider IP-based rate limiting on endpoints

---

## **Performance Optimization**

1. **Polling Optimization:**
   - Use 10-second intervals (balance between real-time and server load)
   - Stop polling when component unmounts
   - Consider WebSocket for production (real-time updates)

2. **Caching:**
   - Cache user setup status for 30 seconds
   - Clear cache on status change

3. **Loading States:**
   - Show skeleton loaders during API calls
   - Disable buttons during submission
   - Provide visual feedback for all actions

---

## **Future Enhancements**

1. **WebSocket Integration:**
   - Replace polling with real-time WebSocket updates
   - Instant status changes when coach approves/rejects

2. **Push Notifications:**
   - Notify user when request is approved/rejected
   - No need to keep app open

3. **Request History:**
   - Show past requests (approved, rejected, cancelled)
   - Analytics dashboard

---

## **Developer Handoff Checklist**

Before starting implementation, ensure you have:

- [ ] Access to the database (team_table, approval_requests_table)
- [ ] JWT authentication working
- [ ] Email service configured (SendGrid/AWS SES)
- [ ] OTP generation service from existing codebase
- [ ] React Router setup
- [ ] State management (Context API/Redux)
- [ ] Toast notification library
- [ ] Environment variables configured

**Questions to clarify with product owner:**
- [ ] Should rejected users be able to re-request the same coach?
- [ ] How long should OTP remain valid? (Currently 15 min)
- [ ] Maximum resend attempts? (Currently unlimited with cooldown)
- [ ] What happens if coach deletes account while request is pending?

---

## **Summary**

This document provides complete implementation details for the **requester's journey** in the coach-team authentication system. The key flows are:

1. **Send Request** → Wait on pending page (polling every 10s)
2. **If Approved** → Redirect to OTP page → Validate → Access granted
3. **If Rejected** → Show rejection message → Allow new search
4. **If Cancelled** → Redirect to search → Can try again

All transitions are automatic, emails are sent at every step, and proper error handling ensures a smooth user experience.

---

**Ready for Implementation!** 🚀

**Contact:** Use AI assistant for code generation and debugging during implementation.  
**Last Updated:** December 19, 2025
