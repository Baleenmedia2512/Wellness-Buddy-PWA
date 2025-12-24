# Coach-Team Authentication & Hierarchical Structure - Feature Plan

## Executive Summary

A post-login authentication system that establishes a hierarchical coach network with approval workflows. Every user is a coach with their own team and can also be a member of another coach's team, creating a multi-level network organization.

---

## 1. USER ROLES & HIERARCHY

### Core Principle: Everyone is a Coach

**Key Concept:**
- Every user in the app is a coach by default
- Every coach has their own team (even if empty initially)
- Every coach can also be a member of ONE other coach's team (their upline/parent coach)
- Team ID is shared between exactly 2 coaches (Coach + Co-Coach partnership)

### Role Definitions

1. **Coach (Everyone)**
   - Has their own Team ID (shared with 1 co-coach)
   - Can have unlimited team members (other coaches who join their team)
   - Can approve/reject requests from other coaches wanting to join their team
   - Can ALSO be a member of another coach's team (their upline)

2. **Co-Coach Partnership**
   - Two coaches share the same Team ID
   - Both are coaches for the same team
   - Both can approve/reject team member requests
   - Equal privileges within the shared team

3. **Member Role (Secondary)**
   - When Coach A joins Coach B's team, Coach A becomes a "member" in Coach B's team
   - Coach A still maintains their own team and Team ID
   - Coach A can recruit their own team members independently

### Hierarchical Structure

```
Level 1: Coach A (Team ID: ABC123XYZ0) ↔ Co-Coach B (Team ID: ABC123XYZ0)
         ├── Coach C (Member in A's team, has own Team ID: DEF456UVW1)
         ├── Coach D (Member in A's team, has own Team ID: GHI789RST2)
         └── Coach E (Member in A's team, has own Team ID: JKL012MNO3)

Level 2: Coach C (Team ID: DEF456UVW1) ↔ Co-Coach F (Team ID: DEF456UVW1)
         ├── Coach G (Member in C's team, has own Team ID: PQR345STU4)
         ├── Coach H (Member in C's team, has own Team ID: VWX678YZA5)
         └── Coach I (Member in C's team, has own Team ID: BCD901EFG6)

Level 3: Coach G continues the pattern...
```

**Key Principles:**
- Everyone is a coach (no "regular members")
- Everyone has their own Team ID (shared with 1 co-coach)
- Everyone can recruit their own team
- Everyone can also be a member of ONE other coach's team (upline)
- Infinite levels of hierarchy possible

---

## 2. USER JOURNEY FLOWS

### Flow 1: New User First-Time Setup

**Step 1: Login Completion**
- User completes regular authentication (existing system)
- System detects: No Team ID assigned (new user)

**Step 2: Post-Login Setup Page**
- Redirected to "Team Setup" page
- Two options presented:
  - **Option A**: "Create New Team" (become independent coach)
  - **Option B**: "Join Existing Team" (join as co-coach with partner)

---

#### Path A: Create New Team (Independent Coach)

**Step 2A: Team ID Creation**
- User enters or auto-generates Team ID (10 alphanumeric characters)
- System validates uniqueness
- Team created with user as primary coach
- Status: Active coach with own team

**Step 3A: Find Your Upline Coach**
- Prompt: "Who is your coach?" (optional initially, required eventually)
- Search field: "Search for your upline coach by username"
- **Returns ALL users in the app** (everyone is a coach)
- Results show:
  - Profile picture
  - Username  
  - Masked email (e.g., lo***h@gmail.com)
  - Team size (optional)

**Step 4A: Select Upline Coach**
- User clicks on a coach from search results
- Confirmation: "Request to join [Coach Name]'s team?"
- Note displayed: "You will remain a coach of your own team, but will also become a member of [Coach Name]'s team"

**Step 5A: Request Approval**
- Button: "Ask for Approval"
- Request sent to selected coach
- User can now access app with limited features OR wait for approval
- **Decision Point**: Allow immediate access or require approval first?

**Step 6A: Approval Process**
- Selected coach receives notification
- Coach approves → User receives OTP
- User validates OTP
- User is now: Coach of own team + Member of upline coach's team

---

#### Path B: Join as Co-Coach (Team Partnership)

**Step 2B: Enter Partner's Team ID**
- Input: "Enter your partner's Team ID"
- System validates:
  - Team ID exists
  - Team ID has only 1 coach (not 2 already)
- User automatically added as co-coach

**Step 3B: Find Your Upline Coach** (Same as 3A)
- Search and select upline coach
- Request approval
- Approval + OTP validation
- User is now: Co-coach of partner's team + Member of upline coach's team

---
2: Coach Approval Process

**Step 1: Notification Receipt**
- Coach receives notification:
  - In-app badge on "Team Members" section
  - Email: "[Username] wants to join your team"

**Step 2: Access Approval Module**
- Navigate to "My Team" → "Pending Requests"
- Shows all pending join requests

**Step 3: Review Request**
- Display card showing:
  - Requester's name
  - Requester's email
  - Requester's profile picture
  - Requester's own Team ID
  - Requested date/time
  - Current team size (if any)

**Step 4: Decision**
- Options:
  - **Approve**: Generates OTP, sends to requester
  - **Reject**: Requester notified, can select different upline coach

**Step 5: Post-Approval**
- OTP generated (6-digit, valid for 15 minutes)
- Sent to requester via email + in-app notification
- Requester validates OTP
- Status changes to: "Active member in your team"
- Requester remains a coach of their own team

---

### Flow 3: Existing Coach Adding Team Members

**Scenario**: Coach B is already set up and active

**Step 1: Another user (Coach C) searches for upline**
- Coach C searches all users
- Finds Coach B in results
- Selects Coach B

**Step 2: Approval Flow** (Same as Flow 2)
- Request → Approval → OTP → Validated

**Result:**
- Coach C is now a member of Coach B's team
- Coach C still has their own Team ID and can recruit their own members
- Coach C's members don't automatically become Coach B's members

---

### Flow 4: Changing Upline Coach

**Scenario**: Coach wants to change their upline coach

**Step 1: Leave Current Team**
- Navigate to "My Profile" → "My Upline Coach"
- Option: "Leave Team"
- Confirmation requSetup Page ⭐ **CRITICAL**

**Purpose**: Ensure every user has a Team ID and optionally selects an upline coach

**Components**:
- Route guard/middleware
- Team setup wizard
- Conditional rendering based on user state

**States to Handle**:
- New user (no Team ID) → Redirect to setup
- Team ID created, no upline (pending selection) → Allow app access or require upline?
- Pending approval from upline coach
- Approved but OTP not validated
- Fully authenticated (has Team ID + upline coach
### 3.1 Post-Login Authentication Page ⭐ **CRITICAL**

**Purpose**: Gate access to main app until team structure is established

**Components**:
- Route guard/middleware
- Role detection logic
- Conditional rendering based on user state

**States to Handle**:
- New user (no coach, not a coach)
- Pending approval
- Approved but OTP not validated
- Fully authenticated
- Coach/Co-Coach (different flow)

---

### 3.2 User Search Module ⭐ **CRITICAL**

**Purpose**: Search ALL users in the app to find upline coach

**Features**:
- Real-time search with debouncing (300ms)
- Search by: Username (primary)
- **Returns ALL users** in the app (everyone is a coach)
- Display masked email for privacy
- Pagination (load more results)
- Exclude: Self from results
- Show team size (optional)

**Technical Needs**:
- Search API endpoint returning all users
- Email masking logic (show first 2 + last 1 chars)
- User profile data structure
- Exclude current user from results

**Not Essential (Can Skip)**:
- Advanced filters (specialty, location)
- User ratings/reviews
- User bio/description (can add later)

---

### 3.3 Team ID Management ⭐ **CRITICAL**

**Features**:
- Generate unique 10-character Team IDs
- Validate Team ID format
- Check Team ID availability (for new teams)
- Verify Team ID exists (for co-coach joining)
- Ensure only 2 users per Team ID (1 Coach + 1 Co-Coach)

**Validation Rules**:
- Exactly 10 characters
- Alphanumeric only (A-Z, 0-9)
- Case-insensitive
- Must be unique across system

**Edge Cases**:
- Team ID already has 2 users (Coach + Co-Coach) → Reject
- Team ID doesn't exist (co-coach trying to join) → Error message
- Team ID conflict during generation → Regenerate

**Not Essential**:
- Memorable Team ID generation (like words)
- Custom Team ID naming

---

### 3.4 Approval Request System ⭐ **CRITICAL**

**Features**:
- Submit approval request
- Store request in database (pending state)
- Track request status: Pending → Approved/Rejected
- Cancel request functionality
- Request history (optional)

**Data to Store**:
- Requester user ID
- Coach user ID
- Team ID entered
- Request timestamp
- Status (pending/approved/rejected)
- OTP (after approval)
- OTP expiry time

---

### 3.5 Notification System ⭐ **CRITICAL**

**Required Channels**:
1. **In-App Notifications**
   - Real-time updates using WebSocket/polling
   - Badge counts on approval section
   - Notification list page

2. **Email Notifications**
   - Coach: New approval request
   - User: Request approved + OTP
   - User: Request rejected
   - Co-Coach: You've been added

**Templates Needed**:
- Approval request email (to coach)
- OTP delivery email (to user)
- Rejection email (to user)
- Welcome to team email (to user after OTP validation)

**Not Essential (Can Add Later)**:
- SMS notifications
- Push notifications (mobile)
- Notification preferences/settings

---

### 3.6 Coach Approval Module ⭐ **CRITICAL**

**Access Control**:
- Only visible to users with Coach or Co-Coach role
- Show requests for THEIR team only

**Features**:
- List all pending approval requests
- View request details
- Approve/Reject actions
- Search/filter requests (if volume is high)
- Request history (approved/rejected)

**UI Components**:
- Pending requests list
- Request detail card
- Approve/Reject buttons
- Confirmation modals

**Not Essential**:
- Bulk approve/reject
- Request notes/comments
- Assignee (if multiple co-coaches) - current design has only 2

---

### 3.7 OTP Validation System ⭐ **CRITICAL**

**Features**:
- Generate 6-digit OTP
- Set expiry time (15 minutes recommended)
- Validate OTP input
- Resend OTP (with cooldown, e.g., 60 seconds)
- Limit attempts (max 5 tries)
- Auto-approve after successful OTP validation

**Security Considerations**:
- Hash OTP in database
- Rate limiting on validation attempts
- Expire OTP after successful use
- Expire OTP after max attempts

**Not Essential**:
- OTP via SMS (start with email only)
- Alphanumeric OTP (numeric is simpler)

---

### 3.8 Role & Permission Management ⭐ **CRITICAL**
Coach (everyone by default)
- Co-Coach (partner in same Team ID)
- Member (when joined another coach's team)
- Pending (awaiting upline approval)
- Super Admin (optional, for system management)

**Permissions**:
- Access main app: All coaches (decision: require upline or not?)
- View team members: All coaches (their own team)
- Approve/reject requests: All coaches (for their team)
- Recruit team members: All coaches

**Multi-Role Support**:
- Every user is a coach with own Team ID
- User can also be a member in ONE upline coach's team
- User can be co-coach (shares Team ID with 1 partner)
- User can be member in Team A AND coach in Team B
- Need role-team association table

---

### 3.9 Hierarchical Team Visualization (Optional, Phase 2)

**Purpose**: Show team structure and relationships

**Features**:
- Tree view of team hierarchy
- Show who coaches who
- Navigate up/down the hierarchy
- View team member profiles

**When to Build**: After core features are stable

---

### 3.10 Team Dashboard (For Coaches) (Optional, Phase 2)

**Features**:
- View all team members
- See team statistics
- Member activity tracking
- Communication tools (team chat, announcements)

**When to Build**: After approval system is working

---

## 4. DATA MODEL REQUIREMENTS

### 4.1 Database Tables Needed

**users table** (expand existing)
```
- id
- team_id (unique, 10 chars) - their own team
- upline_coach_id (foreign key to users.id) - NULL if top-level
- is_cocoach (boolean) - shares team_id with partner
- created_at
- ... (existing fields)
```

**teams table** ⭐ **NEW (Simplified)**
```
- id
- team_id (unique, 10 chars)
- coach_1_id (user_id)
- coach_2_id (user_id, NULL if no co-coach yet)
- created_at
- status (active/inactive)
```

**team_members table** ⭐ **NEW**
```
- id
- coach_id (user_id) - the upline coach
- member_id (user_id) - the member/downline
- joined_at
- status (pending/active/removed)
```

**approval_requests table** ⭐ **NEW**
```
- id
- requester_id (user_id) - coach wanting to join
- upline_coach_id (user_id) - coach being requeste
- requester_id (user_id)
- coach_id (user_id)
- team_id
- status (pending/approved/rejected)
- requested_at
- processed_at
- otp_hash
- otp_expires_at
- otp_attempts
```

**notifications table** ⭐ **NEW or expand existing**
```
- id
- user_id
- type (approval_request/approval_granted/approval_rejected)
- content (JSON)
- read (boolean)
- created_at
```

---users create same Team ID simultaneously
- **Solution**: Database unique constraint + transaction handling
- **UX**: "Team ID already taken, please try another"

✅ **Scenario 2**: User tries to join as co-coach but Team ID already has 2 coaches
- **Solution**: Validate before allowing join
- **UX**: "This team already has 2 coaches (coach + co-coach)"

✅ **Scenario 3**: User enters Team ID that doesn't exist (co-coach flow)
- **Solution**: Validate Team ID exists in database
- **UX**: "Team ID not found. Ask your partner for correct Team ID"

✅ **Scenario 4**: Both coaches (partners) leave/delete account
- **Solution**: Their team members' upline becomes NULL, they need to select new upline
- **Rule**: Notify all team members to select new upline coach doesn't exist
- **Solution**: Validate Team ID exists in database
- **UX**: "Team ID not found. Please check or create new team"

✅ **Scenario 4**: Coach submits multiple requests to different upline coaches
- **Decision Needed**: Allow or restrict to one pending request?
- **Recommendation**: Restrict to ONE pending request at a time (simplifies logic)
- **Alternative**: Allow multiple, first approval wins, others auto-cancelled

✅ **Scenario 6**: Upline coach rejects request
- **Solution**: Requester can immediately select different upline coach
- **UX**: Show rejection notification (optional reason)

✅ **Scenario 7**: Requester cancels request after upline already approved
- **Solution**: OTP becomes invalid, upline coach notified of cancellation

✅ **Scenario 8**: Upline coach account gets deleted/deactivated
- **Solution**: Auto-reject pending requests, notify requesters
- **Solution**: Existing members' upline becomes NULL, must select new upline

✅ **Scenario 7**: User cancels request after coach already approved
- **Solution**: OTP becomes invalid, coach notified of cancellation

✅ **Scenario 8**: Coach account gets deleted/deactivated with pending requests
- **Solution**: Auto-reject all pending requests, notify users

### OTP Scenarios

✅ **Scenario 9**: OTP expires before user enters it
- **Solution**: Allow "Resend OTP" button
- **Limit**: Max 3 OTP generations per approval

✅ **Scenario 10**: User enters wrong OTP multiple times
- **Solution**: Lock after 5 attempts, require new approval request
Coach wants to leave their upline's team
- **Solution**: Allow self-removal
- **Rule**: Can leave anytime, remains a coach with own team
- **UX**: Confirmation required

✅ **Scenario 13**: Coach wants to remove a team member
- **Solution**: Coach removal functionality
- **UX**: Confirmation + notify removed member
- **Result**: Removed member's upline becomes NULL

✅ **Scenario 14**: Coach is member in multiple teams
- **Decision**: Allow or restrict?
- **Recommendation**: ONE upline coach only (simplifies structure)
- **Rationale**: Clear single reporting line

✅ **Scenario 15**: Circular hierarchy (A's upline is B, B's upline is A)
- **Solution**: Prevent during selection
- **Check**: Cannot select someone who is already your downline (directly or indirectly)
- **UX**: "Cannot select this user as they are in your downline"

✅ **Scenario 16**: Coach creates team but never gets a co-coach
- **Solution**: Allow single-coach teams (co-coach is optional)
- **UX**: Show "Invite Co-Coach" optiony (A coaches B, B coaches A)
- **Solution**: This is actually OK - they're in different teams
- **No restriction needed**

✅ **Scenario 16**: User creates team but never gets a co-coach
- **Solution**: Allow single-coach teams
- **UX**: Show "Add Co-Coach" prompt

---

## 6. FEATURE PRIORITIZATION

### Phase 1: MVP (Must-Have) ⭐

**Goal**: Basic approval workflow functional

1. ✅ Post-login authentication gate
2. ✅ Coach search (basic, by username)
3. ✅ Team ID creation and validation
4. ✅ Approval request submission
5. ✅ Email notifications (basic templates)
6. ✅ Coach approval module (list + approve/reject)
7. ✅ OTP generation and validation
8. ✅ Basic role management (coach, co-coach, member, pending)
9. ✅ Database schema implementation

**Skip for MVP**:
- In-app real-time notifications (use email only)
- Advanced search filters
- Team hierarchy visualization
- Team dashboard
- Request history
- Bulk operations

---

### Phase 2: Enhanced Experience

1. ✅ In-app notification system (real-time)
2. ✅ Notification preferences
3. ✅ Request history page
4. ✅ Enhanced coach search (filters, bio)
5. ✅ Team member management (remove, edit roles)
6. ✅ Resend OTP functionality
7. ✅ Better email templates (branded, responsive)

---

### Phase 3: Advanced Features

1. ✅ Team hierarchy visualization (tree view)
2. ✅ Team dashboard for coaches
3. ✅ Analytics (team growth, member activity)
4. ✅ Communication tools (team announcements)
5. ✅ Multi-team management interface
6. ✅ Mobile push notifications
7. ✅ SMS OTP option

---

## 7. USER EXPERIENCE CONSIDERATIONS

### Critical UX Decisions

**Decision 1**: What happens if user never gets approved?
- **Solution**: Allow cancel + try different coach
- **Timeout**: Auto-cancel after 7 days of pending?

**Decision 2**: Can user use app while "pending approval"?
- **Recommendation**: NO - gate access completely OR
- **Alternative**: Limited read-only access

**Decision 3**: How to handle Coach/Co-Coach equality?
- **Recommendation**: Both have identical permissions
- **No hierarchy between coach and co-coach**

**Decision 4**: Can a co-coach become coach of another team?
- **Recommendation**: YES - roles are team-specific

**Decision 5**: Email masking pattern
- **Recommendation**: lo***h@gmail.com (first 2 + last 1 before @)
- **Alternative**: l****@gmail.com (first 1 + domain)

---

## 8. SECURITY & PRIVACY

### Security Measures Needed

1. ✅ **Rate Limiting**
   - Search requests (prevent scraping coach data)
   - Approval requests (prevent spam)
   - OTP validation (prevent brute force)

2. ✅ **Data Privacy**
   - Email masking in search results
   - Only show necessary coach information
   - GDPR compliance for notifications

3. ✅ **Authorization**
   - Verify user can only see their own pending requests
   - Verify coach can only see their team's requests
   - Prevent unauthorized team access

4. ✅ **OTP Security**
   - Hash OTPs in database
   - setup/team` - Team ID creation/co-coach join page
2. `/setup/upline` - Select upline coach page
3. `/setup/pending` - Waiting for upline approval status
4. `/setup/validate-otp` - OTP entry page
5. `/team/members` - View my team members
6. `/team/requests` - Pending team member requests (approval module)
7. `/team/my-upline` - View/change upline coach
8. `/users/search` - Search all users to find upline

### API Endpoints Needed

**Setup & Team Creation**
- `GET /api/user/status` - Check user setup status (has team_id, has upline)
- `POST /api/team/create` - Create new Team ID
- `POST /api/team/join-cocoach` - Join existing Team ID as co-coach
- `GET /api/team/validate/:teamId` - Validate Team ID exists and has space

**User Search (Everyone)**
- `GET /api/users/search?q={username}` - Search ALL users in app
- `GET /api/users/:id/profile` - Get user public profile

**Approval Workflow**
- `POST /api/upline/request` - Request to join upline coach's team
- `GET /api/upline/my-request` - Get my pending upline request
- `DELETE /api/upline/request` - Cancel pending request
- `GET /api/team/pending-requests` - Get pending team member requests
- `POST /api/team/approve-request` - Approve/reject team member request
- `POST /api/upline/validate-otp` - Validate OTP after approval

**Team Management**
- `GET /api/team/my-members` - Get my team members (direct downline)
- `GET /api/team/my-upline` - Get my upline coach info
- `POST /api/team/leave-upline` - Leave current upline coach
- `DELETE /api/team/remove-ls/request` - Submit approval request
- `GET /api/approvals/my-requests` - Get user's requests
- `DELETE /api/approvals/request/:id` - Cancel request
- `GET /api/approvals/pending` - Get pending requests (coach-only)
- `POST /api/approvals/process` - Approve/reject request
- `POST /api/approvals/validate-otp` - Validate OTP

**Team Management**
- `GET /api/team/members` - Get team members (coach-only)
- `GET /api/team/my-teams` - Get teams user belongs to
- `DELETE /api/team/member/:id` - Remove team member

**Notificcoach have multiple pending upline requests simultaneously?**
   - Suggested: NO - One pending request at a time (simplifies logic)

2. **What if upline coach never responds to approval request?**
   - Suggested: Auto-expire after 7 days, requester can select different coach

3. **Can coach change upline after being approved?**
   - Suggested: YES - Leave current upline, select new one, go through approval again

4. **Should co-coach be able to approve/reject team member requests?**
   - Suggested: YES - Both coaches have equal permissions for their shared team

5. **Can coach function without selecting an upline (top-level)?**
   - Suggested: YES - Upline selection optional (allows independent top-level coaches)
   - Alternative: REQUIRE upline selection to access app (enforces hierarchy)

6. **Maximum team size limit per coach?**
   - Suggested: No limit initially, can add later if needed

7. **Should new users be forced to select upline immediately?**
   - Option A: Yes, gate app access until upline selected and approved
   - Option B: No, allow app access, prompt upline selection later
   - **Recommended: Option B** (better onboarding experience)

8. **Approval notification frequency?**
   - Suggested: Immediate email + in-app notification (real-time)

9. **Should search show team size or success metrics?**
   - Suggested: Phase 2 feature (focuses on recruitment)

10. **Can a coach remove their co-coach?**
    - Suggested: NO - Co-coach partnership is permanent (or both must agree to dissolve)
    - Alternative: YES - Primary coach can remove co-coachT being a member of another team?**
   - Suggested: Yes (top-level coaches)

8. **Approval notification frequency?**
   - Suggested: Immediate email + in-app badge (no digest)

9. **Should system suggest coaches based on location/specialty?**
   - Suggested: Phase 2 feature

10. **What analytics should coaches see about their team?**
    - Suggested: Phase 3 feature

---

## 11. IMPLEMENTATION SEQUENCE (When Ready to Code)

When you're ready to implement, follow this sequence:

### Step 1: Database Schema
- Create tables: teams, team_roles, approval_requests
- Add migrations
- Seed test data

### Step 2: Backend APIs
- Team creation and Team ID validation
- Coach search endpoint
- Approval request submission
- Coach approval endpoints
- OTP generation and validation

### Step 3: Email System
- Set up email service (if not existing)
- Create email templates
- Test email delivery

### Step 4: Frontend - User Flow
- Post-login gate/middleware
- Join team page
- Coach search UI
- Pending approval status page
- OTP validation page

### Step 5: Frontend - Coach Flow
- Coach team setup page
- Approval module UI
- Team member list

### Step 6: Testing
- Unit tests for each API
- Integration tests for full flow
- User acceptance testing
- Load testing (especially search)

### Step 7: Deployment
- Database migration in production
- Feature flag (gradual rollout)
- Monitor error rates and user feedback

---

## 12. SUCCESS METRICS

How to measure if this feature is working well:

1. **Approval Flow Completion Rate**
   - % of users who start → complete approval flow

2. **Average Time to Approval**
   - How long until coach approves request

3. **OTP Validation Success Rate**
   Team ID creation/validation (everyone gets one)
2. Co-coach joining (optional partner feature)
3. User search returning ALL users (everyone is searchable)
4. Upline coach selection from search results
5. Approval request system
6. Email notifications (basic)
7. Team member approval module (view pending, approve/reject)
8. OTP generation and validation
9. Database schema (users with team_id, team_members table, approval_requests)
10. Security (rate limiting, auth checks, prevent circular hierarchy

---

## SUMMARY: WHAT'S NECESSARY vs OPTIONAL

### ✅ ABSOLUTELY NECESSARY (Can't launch without)

1. Post-login authentication gate
2. Coach search (basic by username)
3. Team ID creation/validation
4. Approval request system
5. Email notifications (basic)
6. Coach approval module
7. OTP system
8. Basic role management
9. Database schema
10. Security (rate limiting, auth checks)

### ⚠️ IMPORTANT BUT CAN WAIT

1. In-app real-time notifications (use email for MVP)
2. Advanced search filters
3. Request history
4. Resend OTP (can add quickly if needed)
5. Team member removal
6. Better email templates

### ❌ NOT NECESSARY FOR INITIAL LAUNCH

1. Team hierarchy visualization
2. Team dashboard and analytics
3. Communication tools (announcements, chat)
4. SMS notifications
5. Push notifications
6. Coach ratings/reviews
7. Bulk operations
8. Multiple pending requests (can restrict to 1 for MVP)
---

## KEY CHANGES FROM PREVIOUS VERSION

**Major Conceptual Changes:**
1. ✅ **Everyone is a coach** - No separate "member" role, all users are coaches with their own teams
2. ✅ **Search returns ALL users** - Not just designated coaches, everyone is searchable
3. ✅ **Team membership = Upline selection** - When User A selects User B and gets approved, User A becomes a member of User B's team (User B is User A's upline)
4. ✅ **Every coach has own Team ID** - Shared with optional co-coach partner
5. ✅ **Simplified hierarchy** - Coach + optional co-coach → team members (who are also coaches) → their team members (infinite levels)

**Terminology:**
- "Coach search" → "User search" (searches all users)
- "Team member" → "Downline member" or "Team member" (coaches who joined your team)
- "Parent coach" → "Upline coach" (the coach whose team you joined)

---

**Document Version**: 2.0  
**Created**: December 18, 2025  
**Updated**: December 18, 2025  
**Status**: Revised - Awaiting Confirmation
---

## NEXT STEPS

Once you approve this plan:

1. Review and confirm business logic decisions
2. Resolve open questions (Section 10)
3. Finalize database schema
4. Create detailed technical specifications
5. Begin implementation following the sequence in Section 11

---

**Document Version**: 1.0  
**Created**: December 18, 2025  
**Status**: Draft - Pending Approval
