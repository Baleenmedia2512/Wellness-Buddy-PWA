# Account Activation User Flow - Team ID Optional

## Overview

This document describes the complete user flow for account activation in Wellness Valley, where Team ID claiming is now **optional**.

---

## 📱 Complete User Journey

### 1️⃣ **LOGIN / SIGNUP**

**Entry Point**: User opens the app

```
┌─────────────────────────────────┐
│         Login Screen            │
│                                 │
│  Option A: Google OAuth         │
│  Option B: Email OTP            │
└────────────┬────────────────────┘
             │
             ▼
    Authentication Success
             │
             ▼
    Check User Status via API
    GET /api/user/status
```

**API Response Scenarios:**

| Scenario           | HasTeamId | HasUpline | Redirect To                       |
| ------------------ | --------- | --------- | --------------------------------- |
| New User           | ❌        | ❌        | `/setup/upline` (Coach Selection) |
| Has Team, No Coach | ✅        | ❌        | `/setup/upline` (Coach Selection) |
| Setup Complete     | ✅/❌     | ✅        | `/dashboard`                      |
| Admin/Developer    | Any       | Any       | `/dashboard`                      |

---

### 2️⃣ **STEP 1: SELECT COACH**

**Screen**: `/setup/upline` or Setup Wizard Step 1

```
┌─────────────────────────────────────────┐
│     🔍 Find Your Coach                  │
│                                         │
│  Search Box: [Enter name or email...]  │
│                                         │
│  Search Results:                        │
│  ┌───────────────────────────────────┐ │
│  │ 👤 John Smith                     │ │
│  │    john@wellness.com              │ │
│  │    Team: COACH2024                │ │
│  │              [Select] ←           │ │
│  └───────────────────────────────────┘ │
│  ┌───────────────────────────────────┐ │
│  │ 👤 Jane Doe                       │ │
│  │    jane@wellness.com              │ │
│  │              [Select] ←           │ │
│  └───────────────────────────────────┘ │
│                                         │
│  [Continue to Next Step] →             │
└─────────────────────────────────────────┘
```

**Actions:**

1. User types in search box (minimum 2 characters)
2. System searches via `GET /api/users/search?q=...`
3. User selects their coach
4. Clicks "Continue to Next Step"

**Validation:**

- ✅ Must select a coach before proceeding
- ✅ Cannot select self as coach

---

### 3️⃣ **STEP 2: TEAM ID (OPTIONAL)** ⭐ NEW

**Screen**: Setup Wizard Step 2

```
┌────────────────────────────────────────────────┐
│  Welcome to Wellness Valley                    │
│  Complete these 2 simple steps to join         │
│                                                │
│  ① Coach ✅  ② Team ID                        │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ 👤 Selected Coach: John Smith            │ │
│  │    [Change]                               │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  Create your Team ID (Optional) ⭐             │
│  This unique ID identifies your team.          │
│  You can skip this step.                       │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  [M][Y][T][E][A][M][2][0][2][5]         │ │
│  │  0/10 characters • Letters & Numbers     │ │
│  │  Status: ✅ Available                     │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ [←] [Complete Setup] ✅                  │ │
│  └──────────────────────────────────────────┘ │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │ [Skip Team ID & Continue] ⭐             │ │
│  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────┘
```

**User Has 2 Options:**

#### **Option A: Create Team ID**

1. User enters 10-character Team ID (auto-uppercase)
2. System checks availability in real-time
   - API: `GET /api/team/check-availability/:teamId`
3. Status indicators:
   - 🆕 **New** - Brand new ID, user becomes primary coach
   - ✅ **Available** - 1 coach exists, user joins as co-coach
   - ❌ **Taken** - 2 coaches already, cannot join
   - ⚠️ **Owned** - User already owns this ID
4. User clicks **"Complete Setup"**
5. System processes:
   ```javascript
   POST /api/team/claim-id
   {
     teamId: "MYTEAM2025",
     email: "user@example.com"
   }
   ↓
   POST /api/upline/request
   {
     coachId: 456,
     email: "user@example.com"
   }
   ```

#### **Option B: Skip Team ID** ⭐ NEW

1. User clicks **"Skip Team ID & Continue"**
2. System skips Team ID claiming:

   ```javascript
   // No call to /api/team/claim-id

   POST /api/upline/request
   {
     coachId: 456,
     email: "user@example.com"
   }
   ```

**Backend Logic:**

- ✅ Team ID check **removed** from `/api/upline/request`
- ✅ Request created without Team ID requirement
- ✅ OTP email sent to coach

---

### 4️⃣ **STEP 3: VALIDATE OTP**

**Screen**: `/setup/validate-otp`

```
┌────────────────────────────────────────────┐
│      🔐 Enter Verification Code            │
│                                            │
│  Your coach has received a 6-digit code    │
│  Ask them to share it with you.            │
│                                            │
│  ┌────────────────────────────────────┐   │
│  │  [_] [_] [_] [_] [_] [_]           │   │
│  └────────────────────────────────────┘   │
│                                            │
│  Code expires in: 23h 45m                  │
│  Attempts remaining: 5                     │
│                                            │
│  [Verify Code]                             │
│                                            │
│  [← Back] [Resend Request]                │
└────────────────────────────────────────────┘
```

**Process:**

1. Coach receives email with 6-digit OTP
2. User enters OTP from coach
3. System validates:
   ```javascript
   POST /api/upline/validate-otp
   {
     otp: "123456",
     email: "user@example.com"
   }
   ```

**Backend Processing:**

```javascript
// Validate OTP
✅ Check OTP hash matches
✅ Check expiry (24 hours)
✅ Check attempts (max 5)

// If user HAS Team ID:
✅ Update coach_teams_table
   - Add as CoachId or CoCoachId
   - Set Status = 'active'

// If user SKIPPED Team ID: ⭐
⭐ SKIP coach_teams_table operations

// ALWAYS do this:
✅ Update team_table
   - UplineCoachId = coach's ID
   - CoachName = coach's name
   - CoCoachName = co-coach's name
✅ Mark request as 'approved'
✅ Return success
```

---

### 5️⃣ **ACCOUNT ACTIVATED** ✅

**Screen**: Redirect to `/dashboard`

```
┌────────────────────────────────────────────┐
│      ✅ Account Activated!                 │
│                                            │
│  Welcome to Wellness Valley                │
│  Your setup is complete.                   │
│                                            │
│  Coach: John Smith                         │
│  Team ID: MYTEAM2025 (or "Not Set" ⭐)    │
│                                            │
│  [Go to Dashboard] →                       │
└────────────────────────────────────────────┘
```

---

## 📊 Database State Comparison

### **Scenario 1: User Created Team ID**

**team_table:**

```sql
UserId: 123
Email: user@example.com
TeamId: 'MYTEAM2025' ✅
UplineCoachId: 456 ✅
CoachName: 'John Smith' ✅
CoCoachName: 'Jane Doe' ✅
```

**coach_teams_table:**

```sql
TeamId: 'MYTEAM2025'
CoachId: 123 ✅
CoCoachId: NULL
Status: 'active' ✅
```

**approval_requests_table:**

```sql
RequesterId: 123
UplineCoachId: 456
Status: 'approved' ✅
```

---

### **Scenario 2: User Skipped Team ID** ⭐

**team_table:**

```sql
UserId: 123
Email: user@example.com
TeamId: NULL ⭐
UplineCoachId: 456 ✅
CoachName: 'John Smith' ✅
CoCoachName: 'Jane Doe' ✅
```

**coach_teams_table:**

```sql
(No entry created) ⭐
```

**approval_requests_table:**

```sql
RequesterId: 123
UplineCoachId: 456
Status: 'approved' ✅
```

---

## 🔄 Flow Diagram

```
                    START
                      │
                      ▼
            ┌──────────────────┐
            │   User Login     │
            └────────┬─────────┘
                     │
                     ▼
            ┌──────────────────┐
            │  Select Coach    │
            │   (Step 1)       │
            └────────┬─────────┘
                     │
                     ▼
            ┌──────────────────┐
            │   Team ID?       │
            │  (Optional)      │
            └────┬─────┬───────┘
                 │     │
        Create   │     │   Skip
                 │     │
                 ▼     ▼
         ┌─────────┐ ┌──────────┐
         │ Claim   │ │  Send    │
         │ Team ID │ │ Request  │
         └────┬────┘ └─────┬────┘
              │            │
              └─────┬──────┘
                    │
                    ▼
         ┌──────────────────┐
         │   Validate OTP   │
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────┐
         │  WITH Team ID?   │
         └───┬──────────┬───┘
             │          │
         YES │          │ NO
             │          │
             ▼          ▼
    ┌────────────┐  ┌──────────┐
    │  Update    │  │   Skip   │
    │coach_teams │  │coach_teams│
    └─────┬──────┘  └─────┬────┘
          │               │
          └───────┬───────┘
                  │
                  ▼
         ┌──────────────────┐
         │  Update          │
         │  team_table      │
         │  (UplineCoachId) │
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────┐
         │   ✅ ACTIVATED   │
         │   → Dashboard    │
         └──────────────────┘
```

---

## 🎯 Key Features

### ✅ **Account Activation is Guaranteed**

- User can activate account **with or without** Team ID
- No blockers in the flow
- Coach relationship established regardless

### ⭐ **Team ID is Truly Optional**

- User can skip during setup
- Can claim Team ID later if needed
- No impact on core functionality

### 🔒 **Security Maintained**

- OTP validation still required
- 24-hour expiry window
- Maximum 5 attempts per request

### 🔄 **Flexible Flow**

- User controls their journey
- Can go back and change coach
- Can resend requests if OTP expires

---

## 📝 User States Summary

| State               | TeamId | UplineCoachId | coach_teams_table | Can Use App                        |
| ------------------- | ------ | ------------- | ----------------- | ---------------------------------- |
| **New User**        | ❌     | ❌            | ❌                | ❌ Setup Required                  |
| **Coach Selected**  | ❌     | ❌            | ❌                | ❌ Pending OTP                     |
| **Skipped Team ID** | ❌     | ✅            | ❌                | ✅ **Full Access**                 |
| **With Team ID**    | ✅     | ✅            | ✅                | ✅ **Full Access + Team Features** |

---

## 🚀 Next Steps After Activation

Users who skipped Team ID can:

1. Use all core app features
2. View their coach relationship
3. Claim a Team ID later via `/setup/team`
4. Once Team ID claimed, join `coach_teams_table`

---

## 📧 Email Notifications

### Coach Receives:

```
Subject: 🤝 Team Approval Request - Wellness Valley

Hello John Smith!

You have a new team member request.
Sarah Johnson would like to join your coaching team.

Requester Details:
👤 Sarah Johnson
📧 sarah@example.com
🔖 Team ID: MYTEAM2025  (or omitted if skipped ⭐)

Approval Code: 123456

Share this code with Sarah Johnson to approve their request.
Code expires in 24 hours.
```

---

## ⚠️ Edge Cases Handled

1. **User already has coach** → Blocked, redirect to dashboard
2. **User selects self as coach** → Prevented in search results
3. **OTP expired** → Request marked expired, user must resend
4. **Max attempts exceeded** → Request deleted, user must create new request
5. **Team ID taken by 2 coaches** → Cannot claim, must choose different ID
6. **Network failure** → Error shown, user can retry

---

## 🔧 API Endpoints Used

| Endpoint                               | Method | Purpose                  |
| -------------------------------------- | ------ | ------------------------ |
| `/api/user/status`                     | GET    | Check user setup state   |
| `/api/users/search`                    | GET    | Find coaches             |
| `/api/team/check-availability/:teamId` | GET    | Check Team ID status     |
| `/api/team/claim-id`                   | POST   | Claim Team ID (optional) |
| `/api/upline/request`                  | POST   | Send approval request    |
| `/api/upline/validate-otp`             | POST   | Validate OTP & activate  |

---

## ✅ Implementation Complete

This user flow is **fully implemented** and ready for production use.

**Last Updated**: February 9, 2026
**Feature**: WP - Account Activation: Make Team ID Claim Optional
