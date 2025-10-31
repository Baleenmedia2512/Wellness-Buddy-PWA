# Debug Guide: Inactive User Status Check

## Overview
This guide helps you debug the inactive user status check feature using the comprehensive logs added to the system.

---

## Log Locations

### Backend Logs
**File**: `backend/pages/api/lookup-user-id.js`
- Terminal/Console where backend is running
- Check for emoji-prefixed logs

### Frontend Logs
**Files**: 
- `frontend/src/App.js`
- `frontend/src/components/InactiveUserModal.js`
- `frontend/src/components/UserNotFoundModal.js`
- Browser Developer Console (F12)

---

## Log Flow for Inactive User

### Expected Console Output (Inactive User Scenario)

```
🔍 [checkUserStatus] Starting status check for user: {user object}
📧 [checkUserStatus] User email: user@example.com
📡 [checkUserStatus] Calling lookup-user-id API with email: user@example.com

--- BACKEND ---
🔍 [lookup-user-id] Request received: {email: "user@example.com", method: "POST"}
📊 [lookup-user-id] Database connection established
🔎 [lookup-user-id] Executing query: SELECT UserId, UserName, Email, Status FROM team_table WHERE Email = ? with params: ["user@example.com"]
📋 [lookup-user-id] Query results: {rowCount: 1, rows: [...]}
✅ [lookup-user-id] User found: {userId: 123, userName: "User", email: "user@example.com", status: "Inactive", isActive: false}
⚠️ [lookup-user-id] User is INACTIVE - Status: Inactive
--- END BACKEND ---

📥 [checkUserStatus] API response status: 200
📋 [checkUserStatus] API response data: {success: true, userId: 123, ..., status: "Inactive", isActive: false}
⚠️ [checkUserStatus] User is INACTIVE
🔴 [checkUserStatus] User Status: Inactive
🔴 [checkUserStatus] isActive: false
🔴 [checkUserStatus] Showing InactiveUserModal
🔴 [InactiveUserModal] Modal component rendered
```

---

## Log Flow for User Not Found

### Expected Console Output (User Not Found Scenario)

```
🔍 [checkUserStatus] Starting status check for user: {user object}
📧 [checkUserStatus] User email: newuser@example.com
📡 [checkUserStatus] Calling lookup-user-id API with email: newuser@example.com

--- BACKEND ---
🔍 [lookup-user-id] Request received: {email: "newuser@example.com", method: "POST"}
📊 [lookup-user-id] Database connection established
🔎 [lookup-user-id] Executing query: SELECT UserId, UserName, Email, Status FROM team_table WHERE Email = ? with params: ["newuser@example.com"]
📋 [lookup-user-id] Query results: {rowCount: 0, rows: []}
❌ [lookup-user-id] User not found in database
--- END BACKEND ---

📥 [checkUserStatus] API response status: 404
📋 [checkUserStatus] API response data: {success: false, message: "User not found", userNotFound: true}
❌ [checkUserStatus] User not found in database
🔴 [checkUserStatus] Showing UserNotFoundModal
🟠 [UserNotFoundModal] Modal component rendered
```

---

## Log Flow for Active User

### Expected Console Output (Active User Scenario)

```
🔍 [checkUserStatus] Starting status check for user: {user object}
📧 [checkUserStatus] User email: activeuser@example.com
📡 [checkUserStatus] Calling lookup-user-id API with email: activeuser@example.com

--- BACKEND ---
🔍 [lookup-user-id] Request received: {email: "activeuser@example.com", method: "POST"}
📊 [lookup-user-id] Database connection established
🔎 [lookup-user-id] Executing query: SELECT UserId, UserName, Email, Status FROM team_table WHERE Email = ? with params: ["activeuser@example.com"]
📋 [lookup-user-id] Query results: {rowCount: 1, rows: [...]}
✅ [lookup-user-id] User found: {userId: 456, userName: "Active User", email: "activeuser@example.com", status: "Active", isActive: true}
✅ [lookup-user-id] User is ACTIVE
--- END BACKEND ---

📥 [checkUserStatus] API response status: 200
📋 [checkUserStatus] API response data: {success: true, userId: 456, ..., status: "Active", isActive: true}
✅ [checkUserStatus] User is ACTIVE - allowing access
✅ [checkUserStatus] User Status: Active
✅ [checkUserStatus] isActive: true
```

---

## Log Emoji Guide

### Backend Logs
- 🔍 **Search/Lookup** - Starting a lookup operation
- 📊 **Database** - Database connection/operation
- 🔎 **Query** - SQL query execution
- 📋 **Results** - Query results
- ✅ **Success** - User found and active
- ⚠️ **Warning** - User found but inactive
- ❌ **Error** - User not found or error occurred

### Frontend Logs
- 🔍 **Check Status** - Status check starting
- 📧 **Email** - Email-related action
- 📡 **API Call** - Making API request
- 📥 **Response** - API response received
- 📋 **Data** - Response data
- ✅ **Active** - User is active, access granted
- ⚠️ **Warning** - Warning or issue
- ❌ **Not Found** - User not found
- 🔴 **Inactive** - User is inactive or modal shown
- 🟠 **Not Found Modal** - UserNotFoundModal
- 🚪 **Sign Out** - User being signed out
- 🔐 **Auth State** - Authentication state change
- 🔄 **OTP Restoration** - OTP user restoration
- 📦 **LocalStorage** - LocalStorage operation

---

## Auth State Flow Logs

### Google Sign-In
```
🔐 [Auth State Change] User state changed: User signed in
👤 [Auth State Change] User details: {email: "...", displayName: "...", uid: "..."}
🔍 [Auth State Change] Running status check...
📊 [Auth State Change] Status check result: ACTIVE/INACTIVE/NOT FOUND
✅ [Auth State Change] Access granted - setting user state
```

### OTP Verification
```
✅ [OTP Verified] OTP verification successful
📦 [OTP Verified] OTP user in localStorage: found
👤 [OTP Verified] Parsed user: {id: 123, email: "..."}
🔍 [OTP Verified] Running status check...
📊 [OTP Verified] Status check result: ACTIVE/INACTIVE/NOT FOUND
✅ [OTP Verified] Access granted
✅ [OTP Verified] Setting isOtpVerified to true
```

### OTP User Restoration (Page Refresh)
```
🔄 [OTP Restoration] Checking if OTP user needs restoration...
🔄 [OTP Restoration] isOtpVerified: true user: null
📦 [OTP Restoration] OTP user in localStorage: found
👤 [OTP Restoration] Parsed OTP user: {id: 123, email: "..."}
🔍 [OTP Restoration] Running status check...
📊 [OTP Restoration] Status check result: ACTIVE/INACTIVE/NOT FOUND
✅ [OTP Restoration] Access granted - restoring user
```

---

## Modal Interaction Logs

### InactiveUserModal
```
🔴 [InactiveUserModal] Modal component rendered
📧 [InactiveUserModal] Send Email button clicked
📧 [InactiveUserModal] Opening email client to: easy2work.india@gmail.com
❌ [InactiveUserModal] Close button clicked
🔴 [handleInactiveModalClose] Closing InactiveUserModal
🚪 [handleInactiveModalClose] Signing out user
```

### UserNotFoundModal
```
🟠 [UserNotFoundModal] Modal component rendered
📧 [UserNotFoundModal] Send Email button clicked
📧 [UserNotFoundModal] Opening email client to: easy2work.india@gmail.com
❌ [UserNotFoundModal] Close button clicked
🟠 [handleUserNotFoundModalClose] Closing UserNotFoundModal
🚪 [handleUserNotFoundModalClose] Signing out user
```

---

## Debugging Steps

### Step 1: Check Backend Logs
1. Open terminal where backend is running
2. Look for `[lookup-user-id]` logs
3. Verify database query executed
4. Check query results

### Step 2: Check Frontend Logs
1. Open browser Developer Console (F12)
2. Look for `[checkUserStatus]` logs
3. Verify API call was made
4. Check response data

### Step 3: Verify Database
```sql
-- Check user status directly
SELECT UserId, UserName, Email, Status 
FROM team_table 
WHERE Email = 'user@example.com';

-- Expected results:
-- Active user: Status = 'Active'
-- Inactive user: Status = 'Inactive' or any other value
-- Not found: No rows returned
```

### Step 4: Check Modal State
1. Look for modal render logs
2. `🔴 [InactiveUserModal]` = Inactive user
3. `🟠 [UserNotFoundModal]` = User not found
4. No modal logs = User is active

---

## Common Issues & Solutions

### Issue 1: Modal Not Appearing
**Symptoms**: User is inactive but no modal shows

**Debug**:
1. Check for `🔴 [checkUserStatus] Showing InactiveUserModal` in console
2. Verify `setShowInactiveModal(true)` was called
3. Check React state in browser DevTools

**Solution**: Check if modal component is properly imported and rendered

---

### Issue 2: Wrong Status Returned
**Symptoms**: Active user shown as inactive (or vice versa)

**Debug**:
1. Check backend log: `✅ [lookup-user-id] User found: {...}`
2. Verify `status` field value
3. Check `isActive` boolean

**Solution**: Verify database Status column value is exactly "Active" (case-sensitive)

---

### Issue 3: API Not Called
**Symptoms**: No backend logs appearing

**Debug**:
1. Check frontend: `📡 [checkUserStatus] Calling lookup-user-id API`
2. Verify API URL is correct
3. Check network tab for failed requests

**Solution**: Verify backend server is running and API_BASE_URL is correct

---

### Issue 4: User Still Has Access After Inactive
**Symptoms**: Inactive user can still use app

**Debug**:
1. Check if modal appeared: Look for `🔴 [InactiveUserModal]`
2. Verify sign-out was called: `🚪 [handleInactiveModalClose] Signing out user`
3. Check if user has multiple tabs open

**Solution**: Close modal should trigger sign-out. Clear browser cache and localStorage

---

## Testing with Logs

### Test 1: Set User to Inactive
```sql
UPDATE team_table SET Status = 'Inactive' WHERE Email = 'test@example.com';
```

**Expected Logs**:
- ⚠️ [lookup-user-id] User is INACTIVE
- 🔴 [checkUserStatus] Showing InactiveUserModal
- 🔴 [InactiveUserModal] Modal component rendered

---

### Test 2: Test Non-Existent User
Try logging in with email not in database

**Expected Logs**:
- ❌ [lookup-user-id] User not found in database
- 🔴 [checkUserStatus] Showing UserNotFoundModal
- 🟠 [UserNotFoundModal] Modal component rendered

---

### Test 3: Set User to Active
```sql
UPDATE team_table SET Status = 'Active' WHERE Email = 'test@example.com';
```

**Expected Logs**:
- ✅ [lookup-user-id] User is ACTIVE
- ✅ [checkUserStatus] User is ACTIVE - allowing access
- ✅ [Auth State Change] Access granted

---

## Production Debugging

For production environments, you can:

1. **Enable Verbose Logging** - Logs are already in code
2. **Check Browser Console** - Users can send console screenshots
3. **Backend Logs** - Check server logs for API calls
4. **Monitor API Responses** - Track success/failure rates

---

## Log Filtering Tips

### Browser Console Filters
```
// Show only status check logs
[checkUserStatus]

// Show only inactive user logs
🔴

// Show only backend logs
[lookup-user-id]

// Show only modal logs
Modal

// Show only errors
❌
```

---

## Support Information

When reporting issues, include:
1. Full console output (with emoji logs)
2. Database query result for the user
3. Network tab screenshot showing API request/response
4. Which modal appeared (if any)

---

**Last Updated**: October 31, 2025
