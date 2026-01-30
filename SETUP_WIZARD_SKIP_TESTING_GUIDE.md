# Setup Wizard Skip - Testing Guide

## Prerequisites

1. **Run Database Migration First:**
   ```bash
   # Connect to your Supabase/PostgreSQL database
   psql -d your_database -f ADD_SETUP_SKIPPED_COLUMN.sql
   ```

2. **Verify Column Exists:**
   ```sql
   SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_name = 'team_table'
   AND column_name = 'SetupSkipped';
   ```
   Expected output: `SetupSkipped | boolean | false`

3. **Deploy Backend API:**
   - Ensure `backend/pages/api/user/skip-setup.js` is deployed
   - Ensure `backend/pages/api/user/status.js` changes are deployed

4. **Deploy Frontend:**
   - Ensure `frontend/src/pages/SetupWizard.js` changes are deployed
   - Ensure `frontend/src/App.js` changes are deployed

---

## Test Case 1: Skip via "Skip Setup" Button (No Coach Selected)

### Steps:
1. Login with email
2. Wait for Setup Wizard to appear
3. Click "Skip Setup" button (top-left corner)

### Expected Results:
✅ Wizard closes immediately  
✅ Dashboard/main app appears  
✅ Console shows: "✅ Setup skipped by user (via Skip button)"  
✅ Database check: `SELECT "SetupSkipped" FROM team_table WHERE "Email" = 'test@example.com'` → Returns `true`  
✅ Refresh page → Wizard does NOT appear again  

### Failure Indicators:
❌ Wizard doesn't close  
❌ Error in console  
❌ Wizard reappears on refresh  

---

## Test Case 2: Skip After Selecting Coach (Step 2)

### Steps:
1. Login with email
2. Setup Wizard appears
3. **Step 1:** Search for coach (e.g., "John")
4. **Step 1:** Select a coach from results
5. **Step 1:** Click "Continue" button
6. **Step 2:** See Team ID input field
7. **Step 2:** Leave Team ID field EMPTY
8. **Step 2:** Click "Skip & Continue" button

### Expected Results:
✅ Success message: "Setup skipped! You can continue using the app."  
✅ Console shows: "⏭️ Team ID empty - skipping setup WITHOUT sending OTP or approval request"  
✅ Wizard closes after 1.5 seconds  
✅ Dashboard appears  
✅ **NO OTP email sent to selected coach** ⭐  
✅ Database check: `SELECT "SetupSkipped" FROM team_table WHERE "Email" = 'test@example.com'` → Returns `true`  
✅ Database check: `SELECT * FROM approval_requests_table WHERE "RequesterId" = <your_user_id>` → No new records  
✅ Refresh page → Wizard does NOT appear again  

### Failure Indicators:
❌ OTP email sent to coach (CHECK COACH EMAIL!)  
❌ Approval request created in database  
❌ Error message shown  
❌ Wizard reappears on refresh  

---

## Test Case 3: Complete Setup (Not Skipping - For Comparison)

### Steps:
1. Login with email
2. Setup Wizard appears
3. **Step 1:** Search and select a coach
4. **Step 1:** Click "Continue"
5. **Step 2:** Enter a Team ID (10 characters, e.g., "ABC1234567")
6. **Step 2:** Wait for availability check (should show green ✅ or blue 🆕)
7. **Step 2:** Click "Complete Setup" button

### Expected Results:
✅ Success message: "Request sent!"  
✅ OTP email IS sent to selected coach ⭐ (This is correct behavior)  
✅ Navigate to OTP validation page  
✅ Database check: `SELECT "SetupSkipped" FROM team_table WHERE "Email" = 'test@example.com'` → Returns `false` or `NULL`  
✅ Database check: `SELECT * FROM approval_requests_table WHERE "RequesterId" = <your_user_id>` → New record exists  

---

## Test Case 4: Refresh After Skip (Persistence Test)

### Steps:
1. Complete Test Case 2 (skip after selecting coach)
2. Close browser tab
3. Open new tab, navigate to app
4. Login with same email

### Expected Results:
✅ Setup Wizard does NOT appear  
✅ Goes directly to Dashboard  
✅ Console shows: "⏭️ [Auth State] User skipped setup (localStorage), bypassing wizard"  
   OR: "⏭️ [Auth State] User skipped setup (database), bypassing wizard"  

### Failure Indicators:
❌ Setup Wizard appears again  

---

## Test Case 5: API Status Endpoint

### Direct API Test:
```bash
curl "http://localhost:3000/api/user/status?email=test@example.com"
```

### Expected Response (After Skipping):
```json
{
  "success": true,
  "setupComplete": true,
  "setupSkipped": true,
  "hasTeamId": false,
  "hasUpline": false,
  "teamId": null,
  "uplineCoachId": null,
  "pendingRequest": null,
  "redirectTo": "/dashboard",
  "message": "Setup skipped by user"
}
```

### Key Fields to Verify:
✅ `setupComplete: true`  
✅ `setupSkipped: true`  
✅ `redirectTo: "/dashboard"`  

---

## Test Case 6: Clear Skip Status (Optional - For Re-testing)

### Reset User to Show Wizard Again:
```sql
-- Reset skip status for a specific user
UPDATE team_table
SET "SetupSkipped" = false
WHERE "Email" = 'test@example.com';

-- Also clear localStorage in browser
// Run in browser console:
localStorage.removeItem('setupSkipped');
location.reload();
```

---

## Test Case 7: Multiple Users

### Test with 3 different users:
1. **User A:** Skip via "Skip Setup" button
2. **User B:** Skip via "Skip & Continue" (after selecting coach)
3. **User C:** Complete full setup (with Team ID + Coach)

### Verify:
✅ User A: SetupSkipped = true, no approval request  
✅ User B: SetupSkipped = true, no approval request  
✅ User C: SetupSkipped = false, approval request exists  

---

## Edge Cases

### Edge Case 1: Network Failure During Skip
**Scenario:** Skip API call fails (500 error)

**Expected Behavior:**
- Catch error in try-catch
- Still set localStorage: setupSkipped = "true"
- Still close wizard
- User can continue using app
- Console logs error

### Edge Case 2: User Has Existing Team ID
**Scenario:** User previously had a Team ID, then skips setup

**Expected Behavior:**
- SetupSkipped = true is still set
- Existing Team ID remains in database
- Wizard doesn't show on refresh

---

## Debugging Checklist

If tests fail, check:

1. **Database:**
   ```sql
   -- Check if column exists
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'team_table' AND column_name = 'SetupSkipped';
   
   -- Check user's skip status
   SELECT "UserId", "Email", "SetupSkipped", "TeamId", "UplineCoachId"
   FROM team_table
   WHERE "Email" = 'test@example.com';
   ```

2. **Backend Logs:**
   - Check for errors in `/api/user/skip-setup`
   - Check for errors in `/api/user/status`

3. **Frontend Console:**
   - Check for network errors (failed API calls)
   - Check localStorage: `localStorage.getItem('setupSkipped')`
   - Check for React errors

4. **Email Server:**
   - Check if OTP emails are being sent (they should NOT be sent when skipping)

---

## Success Criteria

✅ All 7 test cases pass  
✅ No OTP emails sent when skipping  
✅ Skip status persists across sessions  
✅ Database correctly stores skip status  
✅ No errors in console  
✅ Wizard doesn't reappear after skip  

---

## Rollback Plan

If issues occur in production:

1. **Quick Fix:** Revert frontend changes only
   ```bash
   git checkout HEAD~1 frontend/src/pages/SetupWizard.js
   git checkout HEAD~1 frontend/src/App.js
   ```

2. **Full Rollback:** Revert all changes
   ```bash
   git revert <commit-hash>
   ```

3. **Database:** Drop column (if needed)
   ```sql
   ALTER TABLE team_table DROP COLUMN "SetupSkipped";
   ```

---

## Performance Notes

- Skip check happens BEFORE other setup checks (fast path)
- localStorage check happens BEFORE API call (fastest path)
- Database query includes SetupSkipped in single SELECT (no extra query)
- No impact on users who complete setup normally
