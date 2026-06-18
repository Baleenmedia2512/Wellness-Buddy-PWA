# Inactive User Modal Not Showing - Debug Guide

## Problem
User with email `leenah.grace@gmail.com` has status "Inactive" in the database, but after entering OTP, the "Account Restricted" modal does not appear.

## Root Cause Analysis

The modal should appear when **both** these conditions are met:
1. User's `Status` field in `team_table` is `'Inactive'`
2. Frontend correctly detects this status after OTP verification

## Verification Steps

### Step 1: Check Database Status
```sql
-- Run this in your Supabase SQL editor or database client
SELECT "UserId", "UserName", "Email", "Status", "LastActiveAt"
FROM team_table
WHERE "Email" = 'leenah.grace@gmail.com';
```

**Expected Result:**
- `Status` column should be `'Inactive'` (case-sensitive, capital I)

**Possible Issues:**
- If Status is `'Active'` → User is not inactive in database
- If Status is `'inactive'` (lowercase) → Database inconsistency
- If Status is NULL or empty → Database schema issue

### Step 2: Test Backend API

Run the test script:
```bash
cd /Applications/XAMPP/xamppfiles/htdocs/Wellness-Buddy-PWA
node test-inactive-user-flow.js
```

**Expected Output for Inactive User:**
```json
{
  "success": true,
  "userId": 123,
  "userName": "leenah.grace",
  "email": "leenah.grace@gmail.com",
  "status": "Inactive",
  "isActive": false,
  "role": "user"
}
```

**If `isActive: true`:**
- Backend is not detecting user as inactive
- Check database Status field (Step 1)

### Step 3: Test Frontend with Browser Console

1. Open the app in Chrome/Safari
2. Open Developer Tools (F12 or Cmd+Option+I)
3. Go to Console tab
4. Enter the email `leenah.grace@gmail.com`
5. Enter the OTP
6. Look for these debug logs:

```
🔍 [handleOtpVerified] Parsed user object: {...}
🔍 [handleOtpVerified] Status field: Inactive
🔍 [handleOtpVerified] Status (capital): undefined
🔍 [handleOtpVerified] Normalized status: inactive
🔐 [handleOtpVerified] User is inactive (fast-path check), showing restricted modal
```

**If you DON'T see these logs:**
- The OTP verification response is not including the status field
- Check Step 4

**If you see the logs but modal doesn't appear:**
- React state issue
- Check Step 5

### Step 4: Check OTP Verification Response

After entering OTP, check Network tab in DevTools:

1. Filter for: `verify-otp`
2. Click on the request
3. Check the Response tab

**Expected Response:**
```json
{
  "success": true,
  "message": "OTP verified successfully",
  "isNewUser": false,
  "user": {
    "id": 123,
    "username": "leenah.grace",
    "email": "leenah.grace@gmail.com",
    "status": "Inactive"
  }
}
```

**If `status` field is missing or `status: "Active"`:**
- Backend issue in `/backend/features/auth/auth.service.js`
- The `resolveUserAfterOtp` function should return `status: userInfo.Status`

### Step 5: Check React State

In browser console after OTP verification:
```javascript
// Check if modal state is set
console.log(document.querySelector('[class*="fixed inset-0"]')); // Should show modal element
```

**If modal element exists but not visible:**
- CSS/styling issue
- Z-index issue

**If modal element doesn't exist:**
- React state `showInactiveModal` is not being set to `true`

## Solutions

### Solution 1: Database Status is Wrong
If database shows `Status = 'Active'` but user should be inactive:

```sql
UPDATE team_table 
SET "Status" = 'Inactive' 
WHERE "Email" = 'leenah.grace@gmail.com';
```

### Solution 2: Backend Not Returning Status
Check file: `/backend/features/auth/auth.service.js` line 220-230

Ensure this code exists:
```javascript
return {
  isNewUser,
  user: {
    id: userInfo.UserId,
    username: userInfo.UserName,
    email: userInfo.Email,
    status: userInfo.Status,  // ← This line must be present
  },
};
```

### Solution 3: Frontend Status Check Issue
Already fixed in `/frontend/src/App.js` with enhanced logging.

The code now checks both `parsedUser.status` and `parsedUser.Status`:
```javascript
const userStatus = (parsedUser?.status || parsedUser?.Status || '').toLowerCase();
if (userStatus === 'inactive') {
  setShowInactiveModal(true);
  // ...
}
```

### Solution 4: Clear Cache and Retry
```bash
# Clear browser storage
localStorage.clear();
sessionStorage.clear();

# Or in browser console:
localStorage.clear();
sessionStorage.clear();
location.reload();
```

## Testing Checklist

- [ ] Database Status is 'Inactive' (capital I)
- [ ] Backend `/api/user/lookup` returns `isActive: false`
- [ ] Backend `/api/auth/verify-otp` returns `user.status: "Inactive"`
- [ ] Frontend logs show: `🔍 [handleOtpVerified] Normalized status: inactive`
- [ ] Frontend logs show: `🔐 User is inactive (fast-path check), showing restricted modal`
- [ ] Modal appears on screen after OTP verification
- [ ] User cannot access dashboard or other features

## Quick Test Command

```bash
# Test the backend API directly
curl -X POST http://localhost:3000/api/user/lookup \
  -H "Content-Type: application/json" \
  -d '{"email":"leenah.grace@gmail.com"}' | jq '.'

# Expected output should include: "isActive": false
```

## Common Mistakes

1. **Case sensitivity**: Database has 'Inactive' (capital I), code checks 'inactive' (lowercase)
   - ✅ Fixed: Code now uses `.toLowerCase()` for comparison

2. **Status field name**: Backend might use `Status` (capital S) vs `status` (lowercase s)
   - ✅ Fixed: Code now checks both variants

3. **Timing issue**: Modal state set but component hasn't re-rendered yet
   - Check if `isOtpVerified` state is also set to `true`

4. **OTP verification success but user object not stored**
   - Check `Session.setOtpUser()` is called with the full user object

## Contact Support

If issue persists after all checks:
1. Capture screenshot of browser console logs (🔍 logs)
2. Capture screenshot of Network tab (verify-otp response)
3. Capture screenshot of database query result
4. Share with development team

---

**Last Updated:** 18 June 2026
**Version:** 1.0
