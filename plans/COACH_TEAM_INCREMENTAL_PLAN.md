# Coach-Team Authentication System - Incremental Delivery Plan

**Project:** Wellness Buddy PWA - Coach Network System  
**Start Date:** TBD (Suggested: January 6, 2026)  
**Duration:** 6-8 Weeks  
**Approach:** Incremental Module Delivery  
**Related Documents:** 
- [Feature Plan](./COACH_TEAM_AUTHENTICATION_PLAN.md)
- [High-Level Design](./COACH_TEAM_HLD.md)
- [Full Task Breakdown](./COACH_TEAM_DELIVERABLES.md)

---

## **Executive Summary**

Build the coach-team authentication system incrementally, delivering **usable modules every 2-3 days** that clients can test and provide feedback on. Each module is independently functional and adds value to the system.

**Client-Visible Milestones:**
- **Week 1**: ✅ Team ID Creation Module (clients can create teams)
- **Week 2**: ✅ User Search Module (clients can find coaches)
- **Week 3**: ✅ Approval Workflow Module (coaches can approve members)
- **Week 4**: ✅ OTP Authentication Module (secure verification working)
- **Week 5**: ✅ Team Management Module (view/manage team members)
- **Week 6**: ✅ Production-Ready System (fully polished)

---

## **Development Philosophy**

### **Incremental Delivery Approach:**
```
Traditional:                     Incremental:
├─ 6 weeks coding               ├─ Week 1: Team Setup ✓
├─ 1 week testing               ├─ Week 2: User Search ✓
└─ 1 week deployment            ├─ Week 3: Approvals ✓
   (Client sees nothing          ├─ Week 4: OTP System ✓
    until Week 8)                ├─ Week 5: Team Mgmt ✓
                                 └─ Week 6: Polish ✓
                                    (Client sees progress
                                     every 2-3 days)
```

### **Benefits:**
- ✅ Client sees working features throughout development
- ✅ Early feedback prevents major rework
- ✅ Issues discovered and fixed incrementally
- ✅ Team stays motivated with visible progress
- ✅ Can adjust priorities based on feedback

---

## **WEEK 1 - TEAM FOUNDATION MODULE** (Days 1-5)

### **Client-Visible Outcome:** 
*Users can create Team IDs, join as co-coach, and see their team dashboard (even if empty)*

---

### **WP-001: Team ID Creation System** (Days 1-2)

**What Client Will See:**
- ✅ New users redirected to "Create Your Team" page
- ✅ Option to create new Team ID or join existing as co-coach
- ✅ Auto-generate Team ID button works
- ✅ Success message: "Team created! Your Team ID: ABC123XYZ0"
- ✅ Team ID displayed in profile

**Development Tasks:**
1. ☐ **[Day 1 - Backend]** Database setup + Team ID APIs
   - Create `teams` and `team_members` tables
   - Build `POST /api/team/create` endpoint
   - Build `POST /api/team/join-cocoach` endpoint
   - Test with Postman (create team, join as cocoach, validate)

2. ☐ **[Day 1-2 - Frontend]** Team Setup Page UI
   - Create `/setup/team` route with setup wizard UI
   - Team ID creation form with validation
   - Auto-generate Team ID button
   - Co-coach join form
   - Success/error messaging

3. ☐ **[Day 2 - Testing]** End-to-end testing
   - Test: Create new Team ID → See success → Verify in database
   - Test: Join as co-coach → Enter partner's Team ID → Verify linked
   - Test: Try duplicate Team ID → See error message
   - Test: Invalid Team ID format → See validation error

**Demo Points:**
- Show client: "Sign up → Create Team → Get Team ID → See it in profile"
- Show client: "Enter partner's Team ID → Become co-coach → See both names"

---

### **WP-002: Basic Team Dashboard** (Days 3-5)

**What Client Will See:**
- ✅ "My Team" page accessible from navigation
- ✅ Shows Team ID prominently
- ✅ Shows "You" as coach
- ✅ Shows co-coach name (if exists)
- ✅ Shows "No team members yet" placeholder
- ✅ Route guard: Can't access app without Team ID setup

**Development Tasks:**
4. ☐ **[Day 3 - Backend]** User status API
   - Update `users` table (add `team_id`, `upline_coach_id` columns)
   - Build `GET /api/user/status` endpoint
   - Build `GET /api/team/my-team` endpoint
   - Test with Postman (verify returns team data)

5. ☐ **[Day 3-4 - Frontend]** Team Dashboard UI
   - Create `/team/dashboard` page
   - Display Team ID card
   - Display coach/co-coach info
   - Empty state for team members
   - Navigation integration

6. ☐ **[Day 4-5 - Frontend]** Route Guards & Setup Flow
   - Create setup status check middleware
   - Redirect logic: No Team ID → Setup page
   - Has Team ID → Allow app access
   - Update existing login flow

7. ☐ **[Day 5 - Testing]** Integration testing
   - Test: New user → Goes to setup → Can't skip
   - Test: Create Team → Redirected to dashboard
   - Test: Dashboard shows correct Team ID
   - Test: Co-coach sees both names on dashboard

**Demo Points:**
- Show client: "Login → Forced to create team → See dashboard with Team ID"
- Show client: "Can't access main app without team setup"
- Show client: "Co-coach sees partner's name on dashboard"

---

## **WEEK 2 - USER SEARCH MODULE** (Days 6-10)

### **Client-Visible Outcome:**
*Users can search ALL other users in the app, see masked emails, and select an upline coach*

---

### **WP-003: User Search Engine** (Days 6-8)

**What Client Will See:**
- ✅ "Find Your Coach" page with search bar
- ✅ Type username → See live search results
- ✅ Each result shows: profile pic, username, masked email
- ✅ Pagination: "Load More" button works
- ✅ Empty state: "No users found"

**Development Tasks:**
8. ☐ **[Day 6 - Backend]** User search API
   - Build `GET /api/users/search?q={query}` endpoint
   - Email masking logic implementation
   - Pagination (20 results per page)
   - Exclude current user from results
   - Test with Postman (search, pagination, masking)

9. ☐ **[Day 6-7 - Frontend]** Search UI with debouncing
   - Create `/setup/upline` search page
   - Search input with 300ms debounce
   - User card component (profile pic, name, masked email)
   - Loading states and animations
   - Empty state handling

10. ☐ **[Day 7-8 - Frontend]** Search results & pagination
    - Results list with smooth scrolling
    - "Load More" button
    - Search results count display
    - Selected user highlight
    - Responsive design

11. ☐ **[Day 8 - Testing]** Search functionality testing
    - Test: Type "john" → See matching users
    - Test: Clear search → Results cleared
    - Test: Click "Load More" → More results appear
    - Test: Verify email masking (lo***h@gmail.com format)
    - Test: Current user NOT in results

**Demo Points:**
- Show client: "Search for any user → See results in real-time"
- Show client: "Email privacy: Only see lo***h@gmail.com"
- Show client: "Load more results → Pagination works"

---

### **WP-004: Coach Selection & Request** (Days 9-10)

**What Client Will See:**
- ✅ Click user card → Selection modal appears
- ✅ Modal shows: "Request to join [Coach Name]'s team?"
- ✅ Note: "You'll remain a coach of your own team"
- ✅ "Send Request" button
- ✅ Success: "Request sent! Waiting for approval..."

**Development Tasks:**
12. ☐ **[Day 9 - Backend]** Approval request API
    - Create `approval_requests` table
    - Build `POST /api/upline/request` endpoint
    - Validation: No self-request, no duplicate requests
    - Basic circular hierarchy check
    - Test with Postman (create request, validate rules)

13. ☐ **[Day 9-10 - Frontend]** Selection modal & confirmation
    - User selection modal component
    - Coach info display in modal
    - Confirmation flow
    - "Send Request" button
    - Success/error messages
    - Redirect to pending status page

14. ☐ **[Day 10 - Testing]** Selection flow testing
    - Test: Select coach → See modal → Confirm → Request sent
    - Test: Try to request self → See error
    - Test: Try duplicate request → See "Already requested"
    - Test: After request → Can't search again

**Demo Points:**
- Show client: "Find coach → Click → Confirm → Request sent"
- Show client: "Can't request yourself (validation works)"
- Show client: "See 'Waiting for approval' status"

---

## **WEEK 3 - APPROVAL WORKFLOW MODULE** (Days 11-15)

### **Client-Visible Outcome:**
*Coaches can see pending requests, view requester details, and approve/reject with reasons*

---

### **WP-005: Pending Requests Dashboard** (Days 11-13)

**What Client Will See:**
- ✅ Coaches see "Team Requests" in navigation (with badge)
- ✅ List of pending join requests
- ✅ Each request shows: requester name, email, profile pic, Team ID
- ✅ "Requested 2 hours ago" timestamp
- ✅ Empty state: "No pending requests"

**Development Tasks:**
15. ☐ **[Day 11 - Backend]** Pending requests API
    - Build `GET /api/team/pending-requests` endpoint
    - Coach-only authorization middleware
    - Return requester details with request
    - Test with Postman (create test requests, fetch)

16. ☐ **[Day 11-12 - Frontend]** Requests dashboard UI
    - Create `/team/requests` page (coach-only)
    - Pending requests list component
    - Request card component with requester info
    - Badge on navigation (unread count)
    - Empty state design

17. ☐ **[Day 12-13 - Frontend]** Request detail view
    - Expandable request cards
    - Show requester Team ID and team size
    - Show request timestamp
    - Request status indicator
    - Smooth animations

18. ☐ **[Day 13 - Testing]** Requests dashboard testing
    - Test: Coach sees pending requests
    - Test: Non-coach can't access page (403 error)
    - Test: Badge shows correct count
    - Test: Request cards show all details correctly

**Demo Points:**
- Show client: "Login as coach → See '3 pending requests' badge"
- Show client: "Click badge → See all requests with details"
- Show client: "Non-coach can't see this page (secure)"

---

### **WP-006: Approval & Rejection Actions** (Days 13-15)

**What Client Will See:**
- ✅ "Approve" and "Reject" buttons on each request
- ✅ Approve: "Approved! OTP sent to [User]" confirmation
- ✅ Reject: Optional reason input → "Request rejected"
- ✅ Request disappears from pending list
- ✅ Requester sees status update

**Development Tasks:**
19. ☐ **[Day 13-14 - Backend]** Approval processing API
    - Build `POST /api/team/approve-request` endpoint
    - Handle approve action (generate OTP placeholder)
    - Handle reject action (save reason)
    - Update request status
    - Test with Postman (approve, reject, verify status)

20. ☐ **[Day 14 - Frontend]** Approve/Reject UI
    - Approve button with confirmation modal
    - Reject button with reason input
    - Success/error messaging
    - Optimistic UI updates
    - Request removal animation

21. ☐ **[Day 14-15 - Frontend]** Request status page (for requester)
    - Create `/setup/pending` page
    - Show "Waiting for approval from [Coach]"
    - Show approval status updates
    - "Cancel Request" option
    - Auto-refresh every 10 seconds

22. ☐ **[Day 15 - Testing]** Approval workflow testing
    - Test: Coach approves → See success → Request disappears
    - Test: Coach rejects → Enter reason → Request disappears
    - Test: Requester sees "Approved!" status update
    - Test: Requester sees "Rejected: [reason]" status
    - Test: Cancel request → Request deleted

**Demo Points:**
- Show client: "Coach clicks Approve → Requester sees 'Approved!'"
- Show client: "Coach clicks Reject → Enter reason → Requester notified"
- Show client: "Real-time status updates (polling works)"

---

## **WEEK 4 - OTP AUTHENTICATION MODULE** (Days 16-20)

### **Client-Visible Outcome:**
*Complete secure authentication flow with OTP generation, email delivery, and validation*

---

### **WP-007: OTP Generation & Email System** (Days 16-18)

**What Client Will See:**
- ✅ When approved: Requester receives email with 6-digit OTP
- ✅ Email subject: "Your Team Join Request Approved!"
- ✅ Email shows: Coach name, OTP code, expiry time (15 min)
- ✅ Professional email template

**Development Tasks:**
23. ☐ **[Day 16 - Backend]** OTP service setup
    - Crypto-secure 6-digit OTP generation
    - OTP hashing with bcrypt
    - Store OTP in `approval_requests` table
    - Set 15-minute expiry
    - Test OTP generation and hashing

24. ☐ **[Day 16-17 - Backend]** Email service integration
    - Set up SendGrid/AWS SES integration
    - Create OTP email template (HTML + plain text)
    - Build email sending function
    - Test email delivery to real inbox
    - Verify email formatting

25. ☐ **[Day 17-18 - Backend]** Integrate OTP with approval
    - Update `approve-request` endpoint to generate OTP
    - Send email when coach approves
    - Handle email failures gracefully
    - Test end-to-end: Approve → OTP sent → Email received

26. ☐ **[Day 18 - Testing]** Email delivery testing
    - Test: Coach approves → Email sent within 5 seconds
    - Test: Email contains correct OTP and coach name
    - Test: Email shows expiry time
    - Test: Email failure → User sees error message

**Demo Points:**
- Show client: "Coach approves → Check inbox → See OTP email"
- Show client: "Professional email template with branding"
- Show client: "OTP expires in 15 minutes (security)"

---

### **WP-008: OTP Validation & Access Grant** (Days 18-20)

**What Client Will See:**
- ✅ After approval: "Enter the 6-digit code sent to your email"
- ✅ 6-digit OTP input fields
- ✅ "Resend OTP" button (with 60s cooldown)
- ✅ Countdown timer: "Code expires in 14:32"
- ✅ Wrong OTP: "Invalid code. 4 attempts remaining"
- ✅ Success: "✓ Verified! Welcome to the team" → Access granted

**Development Tasks:**
27. ☐ **[Day 18 - Backend]** OTP validation API
    - Build `POST /api/upline/validate-otp` endpoint
    - Verify OTP hash matches
    - Check expiry time
    - Track attempts (max 5)
    - Grant access on success (add to team_members)
    - Test with Postman (valid, invalid, expired OTPs)

28. ☐ **[Day 18-19 - Backend]** Resend OTP API
    - Build `POST /api/upline/resend-otp` endpoint
    - 60-second cooldown enforcement
    - Max 3 resends per approval
    - Invalidate old OTP, generate new
    - Test cooldown and limits

29. ☐ **[Day 19 - Frontend]** OTP validation page UI
    - Create `/setup/validate-otp` page
    - 6-digit OTP input component
    - Countdown timer component
    - Resend button with cooldown
    - Attempt counter display
    - Success animation

30. ☐ **[Day 19-20 - Frontend]** OTP validation logic
    - Auto-submit on 6-digit entry
    - Handle validation response
    - Show attempt counter
    - Lock after 5 attempts
    - Success flow: Update user status → Redirect to app
    - Error handling (expired, invalid, locked)

31. ☐ **[Day 20 - Testing]** OTP validation testing
    - Test: Enter correct OTP → Access granted
    - Test: Enter wrong OTP → See error, attempts decrement
    - Test: 5 wrong attempts → Locked
    - Test: Wait 15 min → OTP expires → See error
    - Test: Resend OTP → New code sent → Old code invalid
    - Test: Resend cooldown → Button disabled for 60s
    - Test: Success flow → User added to team → Dashboard shows upline

**Demo Points:**
- Show client: "Enter OTP → Access granted → See main app"
- Show client: "Wrong OTP → See attempts remaining"
- Show client: "Resend OTP → Get new code in email"
- Show client: "Complete flow: Request → Approve → OTP → Access"

---

## **WEEK 5 - TEAM MANAGEMENT MODULE** (Days 21-25)

### **Client-Visible Outcome:**
*Coaches can view team members, see hierarchy, remove members, and users can leave teams*

---

### **WP-009: Team Members Display** (Days 21-23)

**What Client Will See:**
- ✅ Enhanced "My Team" page shows all team members
- ✅ Each member card shows: name, email, Team ID, join date
- ✅ Team statistics: "15 total members, 3 joined this week"
- ✅ Search/filter team members
- ✅ Pagination for large teams

**Development Tasks:**
32. ☐ **[Day 21 - Backend]** Team members API
    - Build `GET /api/team/my-members` endpoint
    - Fetch all direct team members (downline)
    - Include member profile data
    - Calculate team statistics
    - Pagination support
    - Test with Postman (create test team, fetch members)

33. ☐ **[Day 21-22 - Frontend]** Enhanced team dashboard
    - Update `/team/dashboard` page
    - Team members list component
    - Member card component with details
    - Team statistics cards
    - Search/filter functionality

34. ☐ **[Day 22-23 - Frontend]** Member list features
    - Sort by: join date, name
    - Search by username
    - Pagination controls
    - Empty state: "No team members yet"
    - Loading states

35. ☐ **[Day 23 - Testing]** Team members display testing
    - Test: Coach sees all team members
    - Test: Member count correct
    - Test: Search filters correctly
    - Test: Pagination works with many members
    - Test: Non-team-members not shown

**Demo Points:**
- Show client: "See all your team members in one place"
- Show client: "Team statistics at a glance"
- Show client: "Search and filter members"

---

### **WP-010: Team Management Actions** (Days 23-25)

**What Client Will See:**
- ✅ "Remove Member" button on each member card
- ✅ Confirmation modal: "Remove [Name] from your team?"
- ✅ Success: Member removed, list updates
- ✅ Removed member sees: "You've been removed from [Coach]'s team"
- ✅ User profile shows "My Upline Coach" section
- ✅ "Leave Team" button
- ✅ After leaving: Can search for new upline

**Development Tasks:**
36. ☐ **[Day 23 - Backend]** Team management APIs
    - Build `DELETE /api/team/remove-member/:id` endpoint
    - Build `POST /api/team/leave-upline` endpoint
    - Build `GET /api/team/my-upline` endpoint
    - Validation: Coach can only remove own members
    - Update user's `upline_coach_id` on removal
    - Test with Postman (remove, leave, verify updates)

37. ☐ **[Day 24 - Frontend]** Remove member UI
    - "Remove" button on member cards
    - Confirmation modal with warning
    - Optimistic UI update
    - Success/error messaging
    - Send notification to removed member

38. ☐ **[Day 24-25 - Frontend]** My upline section
    - Add "My Upline Coach" section to profile
    - Display upline coach info
    - "Leave Team" button
    - Confirmation modal
    - After leaving: Redirect to coach search

39. ☐ **[Day 25 - Testing]** Team management testing
    - Test: Coach removes member → Member disappears
    - Test: Removed member notified → Can search new coach
    - Test: User leaves team → Upline updated
    - Test: After leaving → Can join different team
    - Test: Coach can't remove non-members (403 error)

**Demo Points:**
- Show client: "Remove member → Immediate update"
- Show client: "Member notified they were removed"
- Show client: "Users can leave team anytime"
- Show client: "After leaving → Can join different coach"

---

## **WEEK 6 - NOTIFICATION & POLISH MODULE** (Days 26-30+)

### **Client-Visible Outcome:**
*Professional notification system, polished UI/UX, production-ready system*

---

### **WP-011: Notification System** (Days 26-28)

**What Client Will See:**
- ✅ Bell icon in navigation with unread count badge
- ✅ Notification dropdown/page
- ✅ Notifications: "New request", "Approved", "Rejected", "Member joined"
- ✅ Mark as read functionality
- ✅ Email notifications for critical events

**Development Tasks:**
40. ☐ **[Day 26 - Backend]** Notification APIs
    - Create `notifications` table
    - Build `GET /api/notifications` endpoint
    - Build `POST /api/notifications/read` endpoint
    - Create notification service (save + email)
    - Test with Postman (create, fetch, mark read)

41. ☐ **[Day 26-27 - Backend]** Email notification templates
    - Approval request received (to coach)
    - Request approved (to requester)
    - Request rejected (to requester)
    - Member joined (to coach)
    - Member removed (to member)
    - Test all email templates

42. ☐ **[Day 27-28 - Frontend]** Notification center UI
    - Bell icon with badge in navigation
    - Notification dropdown component
    - Notification list component
    - Mark as read functionality
    - Real-time updates (polling)
    - Empty state

43. ☐ **[Day 28 - Testing]** Notification system testing
    - Test: New request → Coach sees notification + email
    - Test: Approve → Requester sees notification + email
    - Test: Click notification → Marked as read
    - Test: Badge count updates correctly
    - Test: All email types sent correctly

**Demo Points:**
- Show client: "Real-time notifications for all actions"
- Show client: "Email + in-app notifications"
- Show client: "Never miss a team update"

---

### **WP-012: UI/UX Polish & Production Prep** (Days 28-30+)

**What Client Will See:**
- ✅ Smooth animations and transitions
- ✅ Loading states everywhere
- ✅ Professional error messages
- ✅ Responsive design (mobile-perfect)
- ✅ Dark mode support (if applicable)
- ✅ Accessibility improvements
- ✅ Fast performance

**Development Tasks:**
44. ☐ **[Day 28-29 - Frontend]** UI polish
    - Add loading skeletons
    - Smooth page transitions
    - Professional error messages
    - Success animations
    - Empty state designs
    - Icon consistency

45. ☐ **[Day 29 - Frontend]** Responsive design
    - Mobile optimization for all pages
    - Tablet layout adjustments
    - Touch-friendly buttons
    - Mobile navigation
    - Test on multiple devices

46. ☐ **[Day 29-30 - Frontend]** Accessibility & performance
    - ARIA labels for screen readers
    - Keyboard navigation
    - Focus management
    - Performance optimization (lazy loading)
    - Code splitting
    - Image optimization

47. ☐ **[Day 30 - Testing]** Comprehensive testing
    - Cross-browser testing (Chrome, Firefox, Safari)
    - Mobile device testing (iOS, Android)
    - Accessibility testing
    - Performance testing
    - Security testing

48. ☐ **[Day 30+ - Deployment]** Production deployment
    - Remove debug features
    - Environment configuration
    - Database migration to production
    - Deploy backend APIs
    - Deploy frontend
    - Post-deployment verification
    - Monitor error logs

**Demo Points:**
- Show client: "Smooth, professional experience"
- Show client: "Perfect on all devices"
- Show client: "Accessible to all users"
- Show client: "Ready for production launch"

---

## **Sprint-by-Sprint Client Demos**

### **Sprint 1 Demo (End of Week 1):**
**Theme: "Team Foundation"**
- ✅ Show team creation flow
- ✅ Show co-coach joining
- ✅ Show team dashboard
- ✅ Show route guards working
- **Client Feedback:** Gather thoughts on UI, flow, and terminology

### **Sprint 2 Demo (End of Week 2):**
**Theme: "Finding Your Coach"**
- ✅ Show user search in action
- ✅ Show email privacy (masking)
- ✅ Show coach selection and request flow
- ✅ Show pending status page
- **Client Feedback:** Is search intuitive? Any confusing steps?

### **Sprint 3 Demo (End of Week 3):**
**Theme: "Approval Workflow"**
- ✅ Show coach receiving requests
- ✅ Show approval/rejection flow
- ✅ Show requester seeing status updates
- ✅ Show complete request-to-approval cycle
- **Client Feedback:** Is approval process clear for coaches?

### **Sprint 4 Demo (End of Week 4):**
**Theme: "Secure Authentication"**
- ✅ Show email with OTP arriving
- ✅ Show OTP validation flow
- ✅ Show complete end-to-end authentication
- ✅ Show error handling (wrong OTP, expired, etc.)
- **Client Feedback:** Is OTP process user-friendly?

### **Sprint 5 Demo (End of Week 5):**
**Theme: "Team Management"**
- ✅ Show team members list
- ✅ Show member removal flow
- ✅ Show leaving team flow
- ✅ Show complete team hierarchy
- **Client Feedback:** Any missing team management features?

### **Sprint 6 Demo (End of Week 6):**
**Theme: "Production Ready"**
- ✅ Show notification system
- ✅ Show polished UI/UX
- ✅ Show mobile experience
- ✅ Full system walkthrough
- **Client Feedback:** Final approval for launch

---

## **Risk Mitigation with Incremental Delivery**

### **Traditional Risk:**
"What if client doesn't like the approval workflow after 6 weeks of development?"
- **Result:** Major rework, weeks of delay

### **Incremental Approach:**
"Client sees approval workflow in Week 3, provides feedback immediately"
- **Result:** Small adjustments, no major rework

### **Early Issue Detection:**

| Issue Type | Traditional (Week 8) | Incremental (Week X) |
|------------|---------------------|----------------------|
| UX Confusion | Discovered at UAT | Discovered Week 2 demo |
| Missing Feature | Scope creep | Added in next sprint |
| Performance Issue | Production crisis | Caught Week 5 testing |
| Security Flaw | Post-launch vulnerability | Found Week 4 review |

---

## **Progress Tracking Dashboard**

### **Week 1 Status:**
- [ ] WP-001: Team ID Creation ⏳ Not Started
- [ ] WP-002: Team Dashboard ⏳ Not Started
- **Client Demo:** Not Scheduled

### **Week 2 Status:**
- [ ] WP-003: User Search ⏳ Not Started
- [ ] WP-004: Coach Selection ⏳ Not Started
- **Client Demo:** Not Scheduled

### **Week 3 Status:**
- [ ] WP-005: Pending Requests ⏳ Not Started
- [ ] WP-006: Approval Actions ⏳ Not Started
- **Client Demo:** Not Scheduled

### **Week 4 Status:**
- [ ] WP-007: OTP Generation ⏳ Not Started
- [ ] WP-008: OTP Validation ⏳ Not Started
- **Client Demo:** Not Scheduled

### **Week 5 Status:**
- [ ] WP-009: Team Members Display ⏳ Not Started
- [ ] WP-010: Team Management ⏳ Not Started
- **Client Demo:** Not Scheduled

### **Week 6 Status:**
- [ ] WP-011: Notifications ⏳ Not Started
- [ ] WP-012: Polish & Deploy ⏳ Not Started
- **Client Demo:** Not Scheduled

---

## **Definition of "Usable Module"**

Each Work Package (WP) delivers a module that is:

✅ **Functional:** Works end-to-end without breaking  
✅ **Testable:** Client can interact and provide feedback  
✅ **Integrated:** Works with previous modules  
✅ **Visible:** Clear user-facing value  
✅ **Documented:** Has demo script for client presentation

---

## **Communication Plan**

### **Daily Standup (15 min):**
- What module did I complete yesterday?
- What module am I working on today?
- Any blockers?

### **Client Demo (30 min every Friday):**
- Show completed WPs from the week
- Get feedback and approval
- Discuss next week's modules
- Adjust priorities if needed

### **Slack/Email Updates:**
- Each WP completion: "✅ WP-003 Complete: User Search Module Ready"
- Include screenshots/video
- Link to demo environment

---

## **Success Criteria**

### **Week-by-Week Acceptance:**

**Week 1:** Client can create team and see dashboard ✓  
**Week 2:** Client can search and select coaches ✓  
**Week 3:** Client can approve/reject requests ✓  
**Week 4:** Client sees OTP system working ✓  
**Week 5:** Client can manage team members ✓  
**Week 6:** Client approves production launch ✓

### **Overall Success:**
- ✅ All 12 WPs delivered on time
- ✅ Client satisfied with incremental progress
- ✅ No major surprises at end
- ✅ Smooth production launch
- ✅ Early feedback incorporated

---

## **Next Steps**

1. **Schedule Kickoff:** Align on incremental delivery approach
2. **Set Demo Schedule:** Book recurring Friday demo slots
3. **Create Staging Environment:** Where client can test modules
4. **Begin WP-001:** Start with Team ID Creation module
5. **Establish Communication:** Set up Slack channel for updates

---

**Project Manager Note:**  
*This incremental approach requires discipline but dramatically reduces project risk and increases client satisfaction. Each Friday demo builds confidence and ensures we're building the right thing.*

---

**Document Status:** Ready for Project Kickoff  
**Last Updated:** December 19, 2025  
**Approach:** Incremental Module Delivery (IMD)
