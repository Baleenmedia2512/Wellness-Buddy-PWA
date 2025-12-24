# Coach-Team Authentication - 2-Module Implementation Plan

**Project:** Wellness Buddy PWA - Coach Network System  
**Start Date:** TBD (When you're ready)  
**Duration:** 4-5 Days (Rapid Implementation)  
**Developer:** You + AI Assistant  
**Related Documents:** 
- [Feature Plan](./COACH_TEAM_AUTHENTICATION_PLAN.md)
- [High-Level Design](./COACH_TEAM_HLD.md)

---

## **Executive Summary**

Build the coach-team authentication system as a **single streamlined module**:

**MODULE 1: Post-Login Auth Page** (Setup Wizard) - **2 Days**
- Team ID creation
- User search
- Coach selection & request
- **Automatic OTP generation and email to coach**
- OTP validation (user receives OTP from coach externally)
- Complete user onboarding flow

**Key Changes from Original Plan:**
- ✅ **No coach approval dashboard needed** - Approval happens externally
- ✅ **OTP sent to coach immediately** when request is made
- ✅ **Coach shares OTP with requester** via phone/WhatsApp/etc.
- ✅ **24-hour expiry** - Request auto-expires if OTP not used
- ✅ **Simpler flow** - No pending state, no polling, no approve/reject UI

**Total Time:** 2 days with AI assistance (leveraging existing OTP infrastructure)

---

## **MODULE 1: POST-LOGIN AUTH PAGE** (Days 1-2)

### **What Users Will Experience:**
After logging in, new users go through a complete setup wizard:
1. Create their Team ID (or join as co-coach)
2. Search for their upline coach
3. Send join request
4. **Coach receives email with OTP immediately**
5. Coach shares OTP with requester externally (phone, WhatsApp, etc.)
6. Requester enters OTP in app and validates
7. Access granted to app

**Key Flow Changes:**
- ✅ **No waiting/pending page** - User goes directly to OTP entry
- ✅ **Coach gets OTP via email** automatically when request is sent
- ✅ **External communication** - Coach and requester communicate outside app
- ✅ **24-hour expiry** - OTP expires if not used within 24 hours

**Status:** Each user must complete this before accessing the main app.

**Note:** We'll reuse your existing OTP infrastructure for generation and validation.

---

### **DAY 1 - FOUNDATION, TEAM SETUP & USER SEARCH**

#### **WP(AUTH/1) - Database Foundation & Simplified Team ID System** (Morning)

**What You'll Build:**
- Database tables for teams, team members, approval requests
- **Simplified Team ID creation with real-time availability checking**
- Frontend page for team setup (single input with smart logic)
- User search with email masking
- Coach selection & request submission

**Development + Testing Activities:**

**Morning Session (3-4 hours):**
- [ ] **Create Database Tables:**
  ```sql
  -- coach_teams_table: Supports max 2 coaches per Team ID
  CREATE TABLE coach_teams_table (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    TeamId VARCHAR(10) UNIQUE NOT NULL,
    CoachId INT NULL,  -- First coach who created the ID
    CoCoachId INT NULL,  -- Second coach (co-coach)
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    Status ENUM('active', 'inactive') DEFAULT 'active',
    FOREIGN KEY (CoachId) REFERENCES team_table(UserId),
    FOREIGN KEY (CoCoachId) REFERENCES team_table(UserId),
    INDEX idx_team_id (TeamId),
    INDEX idx_coach (CoachId),
    INDEX idx_cocoach (CoCoachId)
  );
  
  -- Note: Coach-member relationships tracked via team_table.UplineCoachId (no separate junction table needed)
  -- Note: Foreign keys shown above are OPTIONAL - app works without them (validation in backend)
  
  -- approval_requests_table: Join requests with OTP
  CREATE TABLE approval_requests_table (
    Id INT PRIMARY KEY AUTO_INCREMENT,
    RequesterId INT NOT NULL,
    UplineCoachId INT NOT NULL,
    Status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    OtpHash VARCHAR(255) NULL,
    OtpExpiresAt DATETIME NULL,
    OtpAttempts INT DEFAULT 0,
    OtpSentAt DATETIME NULL,
    RejectionReason TEXT NULL,
    RequestedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (RequesterId) REFERENCES team_table(UserId),
    FOREIGN KEY (UplineCoachId) REFERENCES team_table(UserId),
    INDEX idx_requester (RequesterId),
    INDEX idx_upline (UplineCoachId),
    INDEX idx_status (Status)
  );
  
  -- Update team_table (your users table)
  ALTER TABLE team_table ADD COLUMN TeamId VARCHAR(10) NULL;
  ALTER TABLE team_table ADD COLUMN UplineCoachId INT NULL;
  ALTER TABLE team_table ADD INDEX idx_team_id (TeamId);
  ALTER TABLE team_table ADD INDEX idx_upline (UplineCoachId);
  ALTER TABLE team_table ADD FOREIGN KEY (UplineCoachId) REFERENCES team_table(UserId);
  ```
- [ ] **Test:** Run migrations → Insert test data → Verify tables created

- [ ] **Build Backend APIs:**
  - `GET /api/team/check-availability/:teamId` - **Real-time availability check**
    - Returns: { available: true/false, status: 'new'|'available'|'taken', coachCount: 0|1|2 }
  - `POST /api/team/claim-id` - **Single endpoint to claim Team ID**
    - Logic: Check coach count, assign to coach_1 or coach_2 accordingly
  - `GET /api/users/search?q={username}` - Search all users with email masking
  - `POST /api/upline/request` - Create approval request
  - `GET /api/upline/my-request` - Get user's pending request status
  - `DELETE /api/upline/request` - Cancel pending request

- [ ] **Test:** Postman testing all APIs
  - Check "ABC123" (not exist) → { status: 'new', coachCount: 0 }
  - Claim "ABC123" as User A → Verify CoachId set in coach_teams_table
  - Check "ABC123" again → { status: 'available', coachCount: 1 }
  - Claim "ABC123" as User B → Verify CoCoachId set in coach_teams_table
  - Check "ABC123" again → { status: 'taken', coachCount: 2 }
  - Try claim "ABC123" as User C → Verify error returned

**Afternoon Session (3-4 hours):**
- [ ] **Build Frontend Pages:**
  - `/setup/team` - **Simplified Team ID page with single input**
    - Single text input for Team ID (10 alphanumeric)
    - Real-time availability check (onBlur or 500ms after typing stops)
    - Display 3 states:
      1. 🆕 "This is a new Team ID. You'll be the first coach!"
      2. 🤝 "This ID has 1 coach. You'll join as co-coach!"
      3. 🚫 "This ID is full (2 coaches already). Try another ID."
    - "Continue" button (enabled only for states 1 & 2)
  - `/setup/upline` - Coach search page with live results
  - `/setup/validate-otp` - OTP validation page (user enters OTP received from coach)

- [ ] **Update Request API to Auto-Generate OTP:**
  - When `POST /api/upline/request` is called:
    - Create approval request record
    - **Generate 6-digit OTP immediately**
    - Hash OTP and store in approval_requests_table
    - Set OtpExpiresAt = NOW() + 24 hours
    - **Send email to coach with:**
      - Requester details (name, email, Team ID)
      - The OTP code (plain text in email)
      - Instructions to share OTP with requester
      - 24-hour expiry notice

- [ ] **Test:** 
  - Enter new ID → See "new ID" message → Continue → Verify saved as CoachId in coach_teams_table
  - Another user enters same ID → See "join as co-coach" → Continue → Verify saved as CoCoachId
  - Third user enters same ID → See "ID is full" → Button disabled
  - Search coach → Send request → **Verify coach receives email with OTP**
  - Check approval_requests_table → Verify OTP hashed, expiry set to 24 hours

**Deliverable:** Complete setup wizard with automatic OTP generation ✓

---

### **TECHNICAL NOTE: Handling 2-User Limitation Per Team ID**

**Database Logic:**
The `coach_teams_table` has two columns: `CoachId` and `CoCoachId`

**Backend Logic for `/api/team/claim-id`:**
```javascript
// POST /api/team/claim-id
// Body: { teamId: "ABC123" }

const userId = req.user.UserId; // From JWT auth (your team_table.UserId)
const { teamId } = req.body;

// 1. Check if user already has a Team ID
const user = await db.query(
  'SELECT TeamId FROM team_table WHERE UserId = ?', 
  [userId]
);
if (user[0].TeamId) {
  return res.status(400).json({ error: 'You already have a Team ID' });
}

// 2. Check if Team ID exists in coach_teams_table
const team = await db.query(
  'SELECT * FROM coach_teams_table WHERE TeamId = ?', 
  [teamId]
);

if (team.length === 0) {
  // Case 1: New Team ID - User becomes Coach
  await db.query(
    'INSERT INTO coach_teams_table (TeamId, CoachId, CoCoachId) VALUES (?, ?, NULL)',
    [teamId, userId]
  );
  await db.query(
    'UPDATE team_table SET TeamId = ? WHERE UserId = ?',
    [teamId, userId]
  );
  return res.json({ success: true, role: 'coach', message: 'Team ID created!' });
}

// 3. Team exists - Check availability
const coachTeam = team[0];
if (coachTeam.CoachId && coachTeam.CoCoachId) {
  // Case 2: Both slots filled - ID is taken
  return res.status(400).json({ error: 'Team ID is full (2 coaches already)' });
}

// 4. One slot available - User becomes CoCoach
if (coachTeam.CoachId && !coachTeam.CoCoachId) {
  await db.query(
    'UPDATE coach_teams_table SET CoCoachId = ? WHERE TeamId = ?',
    [userId, teamId]
  );
  await db.query(
    'UPDATE team_table SET TeamId = ? WHERE UserId = ?',
    [teamId, userId]
  );
  return res.json({ success: true, role: 'cocoach', message: 'Joined as co-coach!' });
}

// Edge case: CoachId is null (shouldn't happen, but handle it)
if (!coachTeam.CoachId) {
  await db.query(
    'UPDATE coach_teams_table SET CoachId = ? WHERE TeamId = ?',
    [userId, teamId]
  );
  await db.query(
    'UPDATE team_table SET TeamId = ? WHERE UserId = ?',
    [teamId, userId]
  );
  return res.json({ success: true, role: 'coach', message: 'Team ID created!' });
}
```

**Frontend Logic for Real-Time Check:**
```javascript
// GET /api/team/check-availability/:teamId

const team = await db.query(
  'SELECT CoachId, CoCoachId FROM coach_teams_table WHERE TeamId = ?',
  [teamId]
);

if (team.length === 0) {
  return res.json({ 
    available: true, 
    status: 'new', 
    coachCount: 0,
    message: 'This is a new Team ID. You\'ll be the first coach!' 
  });
}

const coachTeam = team[0];
const coachCount = [coachTeam.CoachId, coachTeam.CoCoachId].filter(Boolean).length;

if (coachCount === 2) {
  return res.json({ 
    available: false, 
    status: 'taken', 
    coachCount: 2,
    message: 'This ID is full (2 coaches already). Try another ID.' 
  });
}

if (coachCount === 1) {
  return res.json({ 
    available: true, 
    status: 'available', 
    coachCount: 1,
    message: 'This ID has 1 coach. You\'ll join as co-coach!' 
  });
}
```

**Key Points:**
- ✅ `CoachId` and `CoCoachId` are both nullable (NULL = slot available)
- ✅ Check both columns to count coaches: `filter(Boolean).length`
- ✅ Only allow claim if `coachCount < 2`
- ✅ Update `team_table.TeamId` when user claims an ID
- ✅ Prevent user from claiming multiple IDs (check `TeamId` first)

**Edge Cases Handled:**
1. User already has Team ID → Error
2. Both coaches leave team → Reset CoachId and CoCoachId to NULL
3. Only CoCoachId exists (Coach left) → New user can fill CoachId slot
4. Simultaneous claims → Use database transaction to prevent race condition

---

### **DAY 2 - OTP VALIDATION & ROUTE GUARDS**

#### **WP(AUTH/2) - OTP Validation & Expiry Handling** (Morning)

**What You'll Build:**
- OTP validation page and logic
- 24-hour expiry handling
- Route guards for setup wizard
- Complete end-to-end flow

**Morning Session (2-3 hours):**
- [ ] **Build OTP Validation APIs:**
  - `POST /api/upline/validate-otp` - Verify OTP and grant access
    - Check if OTP exists and not expired (24 hours)
    - Compare hashed OTP with bcrypt
    - Track attempts (max 5)
    - On success: Update team_table.UplineCoachId for requester (establishes coach-member relationship)
    - On success: Delete/archive approval request
  - `GET /api/user/status` - Check user's setup completion status
  - `GET /api/upline/my-request-status` - Check if user has pending/expired request

- [ ] **Implement 24-Hour Expiry Logic:**
  - Create background job or API endpoint to check expired requests
  - `POST /api/upline/check-expiry` (can be called on OTP validation attempt)
  - If OtpExpiresAt < NOW(): Mark request as 'expired'
  - Send email to requester: "Your request has expired. Please request again."

- [ ] **Test:** Postman testing
  - Send request → Verify coach receives email with OTP
  - Validate correct OTP → Verify user added to team
  - Test wrong OTP → Verify attempts tracked (max 5)
  - Test expired OTP (mock time) → Verify rejection
  - Test OTP after 24 hours → Verify expiry handling

**Afternoon Session (2-3 hours):**
- [ ] **Build Frontend OTP Validation:**
  - `/setup/validate-otp` page
  - **Instructional message:** "Your coach has received a verification code. Please ask them to share it with you."
  - 6-digit OTP input with auto-submit
  - **No countdown timer** (24-hour expiry, not visible to user)
  - Attempts counter (max 5)
  - **No resend button** (coach already has the OTP)
  - Success animation on validation
  - Error messages:
    - "Invalid code. Please try again." (wrong OTP)
    - "This code has expired. Please send a new request." (24 hours passed)
    - "Too many failed attempts. Please contact your coach." (5 attempts)

- [ ] **Implement Route Guards:**
  - Middleware to check setup status on every route
  - Redirect flow:
    - No team_id → `/setup/team`
    - No upline & has request → `/setup/validate-otp`
    - No upline & no request → `/setup/upline`
    - Complete → Allow app access

- [ ] **Test Complete Flow:**
  - New user logs in → Redirected to team setup
  - Create Team ID → Search coach → Send request
  - **Verify coach receives email with OTP**
  - User auto-redirected to `/setup/validate-otp`
  - Enter correct OTP → Access granted → Can access main app
  - Enter wrong OTP 5 times → Locked out
  - Try OTP after 24 hours → Expired message
  - Try to bypass steps → Route guards redirect correctly

**Deliverable:** Complete authentication flow working end-to-end ✓

---

### **MODULE 1 TESTING CHECKLIST** (End of Day 2)

**End-to-End User Flow:**
- [ ] New user logs in → Goes to team setup page
- [ ] Can create Team ID → Success message shown
- [ ] Can join as co-coach → Partner's team linked
- [ ] Search for coach → Results appear with masked emails
- [ ] Select coach → Confirmation modal → Request sent
- [ ] **Coach receives email with OTP immediately** → Verify email content
- [ ] User auto-redirected to `/setup/validate-otp` page
- [ ] **Instructional message visible:** "Ask your coach for the code"
- [ ] Coach shares OTP externally (simulate this)
- [ ] Enter correct OTP → Success, access granted
- [ ] Try wrong OTP → See error with attempts
- [ ] After setup complete → Can access main app
- [ ] Try to bypass steps → Route guards redirect

**Edge Cases:**
- [ ] Duplicate Team ID → Error message
- [ ] Search self → Not in results
- [ ] Request self → Error message
- [ ] Multiple pending requests → Error message
- [ ] **OTP after 24 hours** → Expired error, must send new request
- [ ] 5 wrong OTP attempts → Locked, contact coach
- [ ] User refreshes OTP page → requestId preserved
- [ ] User tries to send multiple requests → Only 1 active request allowed

**MODULE 1 COMPLETE:** Users can complete entire authentication flow ✓

---

## **NO MODULE 2 NEEDED**

### **Why Module 2 Was Removed:**

The original plan included a coach approval dashboard where coaches would log into the app to approve/reject requests. However, the new flow is simpler:

**New Approval Process:**
1. ✅ User sends request → Coach receives email with OTP **immediately**
2. ✅ Coach and requester communicate **externally** (phone, WhatsApp, etc.)
3. ✅ Coach shares OTP with requester
4. ✅ Requester enters OTP in app → Validated → Access granted
5. ✅ If 24 hours pass without OTP validation → Request expires

**Benefits of New Approach:**
- 🚀 **Faster implementation** - No need to build coach dashboard
- 📧 **Email-based approval** - Coaches don't need to log in to app
- 💬 **External communication** - Natural flow (coaches already talk to members)
- ⏰ **Automatic expiry** - No manual rejection needed
- 🔒 **Still secure** - OTP validation ensures authenticity

**What Coaches Receive via Email:**
- New request notification
- Requester details (name, email, Team ID)
- **6-digit OTP code** (to share with requester)
- Instructions: "Share this code with [Requester Name] if you approve"
- 24-hour expiry notice
- Option to ignore if they don't want to approve

**Coach Dashboard (Future Phase 2):**
If needed later, we can add:
- View all team members
- Remove members
- View team statistics
- Team management features

But for MVP, coaches only need email notifications with OTP.

---

## **COMPLETE SYSTEM TESTING** (End of Day 2)

### **End-to-End Flows:**

**Flow 1: New User Complete Journey**
- [ ] Sign up → Create Team ID → Search coach → Send request
- [ ] **Coach receives email with OTP** → Verify email content
- [ ] User redirected to OTP validation page
- [ ] **Coach shares OTP externally** (simulate via phone/WhatsApp)
- [ ] User enters OTP → Validation succeeds → Access granted to app
- [ ] Verify UplineCoachId set in team_table (coach-member relationship established)

**Flow 2: OTP Expiry (24 Hours)**
- [ ] User sends request → Coach receives OTP
- [ ] **Wait 24 hours** (or mock timestamp)
- [ ] User tries to enter OTP → "Expired" error
- [ ] User must send new request
- [ ] Old request marked as expired in database

**Flow 3: Co-Coach Partnership**
- [ ] User A creates Team ID → User B joins as co-coach → Both have same TeamId
- [ ] Both can receive member requests independently

**Flow 4: Failed OTP Attempts**
- [ ] User enters wrong OTP → Error, attempts decrement (5 → 4)
- [ ] After 5 wrong attempts → Locked out
- [ ] Message: "Contact your coach for assistance"

**Cross-Platform Testing:**
- [ ] Test on Chrome, Firefox, Safari
- [ ] Test on mobile devices (iOS, Android)
- [ ] Test on different screen sizes
- [ ] Test with slow internet connection

**Security Testing:**
- [ ] Can't bypass setup wizard
- [ ] Can't validate OTP for other user's request
- [ ] OTP properly secured (hashed, expires after 24h)
- [ ] Rate limiting works on validation API (prevent brute force)
- [ ] Can't reuse same OTP after successful validation

---

## **PROJECT TIMELINE SUMMARY**

### **2 Day Rapid Implementation Plan:**

**Day 1:** Database, Team Setup, User Search, Request Submission with Auto-OTP Generation
**Day 2:** OTP Validation, 24-Hour Expiry, Route Guards, Testing, Production Deploy

**Why So Fast?**
- ✅ **Removed Module 2** - No coach approval dashboard needed
- ✅ **Email-based approval** - Coach gets OTP via email automatically
- ✅ **External communication** - No in-app pending/approval flow
- ✅ Reusing existing OTP infrastructure (saves time)
- ✅ AI pair programming guidance at each step
- ✅ Focused single-module approach
- ✅ Testing integrated with development

---

## **Success Criteria**

**Module 1 Success:**
- ✅ New users complete setup wizard smoothly
- ✅ User search works with email masking
- ✅ **Coach receives OTP email immediately** when request sent
- ✅ OTP validation works securely (hashed, 5 attempts, 24h expiry)
- ✅ Route guards prevent bypassing
- ✅ Zero users can access app without setup
- ✅ **24-hour expiry works correctly** - Old requests auto-expire

**Overall Success:**
- ✅ Complete flow works end-to-end
- ✅ No security vulnerabilities
- ✅ Professional UI/UX
- ✅ Works on all devices
- ✅ Production ready
- ✅ **Simpler than original plan** - Less code to maintain

---

## **Daily Progress Tracking**

### **MODULE 1: POST-LOGIN AUTH PAGE (Days 1-2)**
- [ ] Day 1 Morning: Database setup + Core APIs ⏳ Not Started
- [ ] Day 1 Afternoon: Frontend pages (team, search, OTP) + Auto-OTP generation ⏳ Not Started
- [ ] Day 2 Morning: OTP validation + 24h expiry logic + Validation APIs ⏳ Not Started
- [ ] Day 2 Afternoon: OTP UI + Route guards + E2E testing + Deploy ⏳ Not Started

### **NO MODULE 2 - EMAIL-BASED APPROVAL ONLY**
- ✅ Coaches receive OTP via email automatically
- ✅ No approval dashboard needed
- ✅ Simpler, faster implementation

---

## **When You're Ready to Start**

1. **Let me know** and we'll begin with Day 1 - Database Setup
2. **I'll guide you** through each step with code snippets
3. **We'll test** as we go to ensure everything works
4. **You can ask questions** anytime during implementation

---

**Ready to build?** Let's start when you are! 🚀

**Document Status:** Ready for Rapid Implementation  
**Last Updated:** December 19, 2025  
**Estimated Duration:** 2 days with AI assistance (simplified email-based approval)  
**Scope:** Setup wizard + OTP validation only (no coach dashboard needed)  
**Key Changes:**
- ✅ **OTP sent to coach immediately** when request is made
- ✅ **External approval** - Coach shares OTP outside app
- ✅ **24-hour auto-expiry** - No manual rejection needed
- ✅ **Simpler implementation** - Removed entire Module 2
**Key Advantage:** Email-based approval is faster, simpler, and requires less code!
