# Setup Wizard Skip - Coach Relationship Handling

## 🎯 Issue: Admin/Developer Dashboard & Coach Selection

### Problem Statement
When a user selects a coach in Step 1 but skips Team ID in Step 2, the **coach selection was being lost** because we returned early before saving any database relationships.

This caused issues:
- ❌ User has no `UplineCoachId` in database
- ❌ Team hierarchy features don't work
- ❌ Coach-specific reports fail
- ❌ Any feature requiring coach relationship breaks

### Admin/Developer Access
Admin and developer users have **`Role = "admin"` or `Role = "developer"`** in the database, so they bypass the setup wizard entirely. The issue was with **regular users** who skip.

---

## ✅ Solution: Preserve Coach Relationship

### New Behavior
When user skips Team ID after selecting a coach:

```
Step 1: User selects coach "John Doe" (userId: 123)
   ↓
Step 2: User leaves Team ID empty, clicks "Skip & Continue"
   ↓
Backend saves:
   • SetupSkipped = true ✅
   • UplineCoachId = 123 ✅ (coach relationship preserved!)
   • TeamId = NULL ✅
   ↓
Result: User can skip Team ID but still has coach relationship
```

---

## 📊 Three Skip Scenarios

### Scenario 1: Skip via "Skip Setup" Button (Top-Left)
**User Action:** Click "Skip Setup" without selecting coach

**Database Result:**
```json
{
  "SetupSkipped": true,
  "UplineCoachId": null,
  "TeamId": null
}
```
**Use Case:** User wants to skip entirely, no coach needed

---

### Scenario 2: Skip After Selecting Coach (Recommended)
**User Action:** 
1. Select coach in Step 1
2. Click "Continue"
3. Leave Team ID empty in Step 2
4. Click "Skip & Continue"

**Database Result:**
```json
{
  "SetupSkipped": true,
  "UplineCoachId": 123,  // ← Coach saved!
  "TeamId": null
}
```
**Use Case:** User wants coach relationship but doesn't want/need Team ID

---

### Scenario 3: Complete Setup (Normal Flow)
**User Action:**
1. Select coach in Step 1
2. Enter Team ID in Step 2
3. Click "Complete Setup"

**Database Result:**
```json
{
  "SetupSkipped": false,
  "UplineCoachId": 123,
  "TeamId": "ABC1234567"
}
```
**Use Case:** Full setup with coach and Team ID

---

## 🔧 Technical Implementation

### Backend API: `/api/user/skip-setup`

**Request Body:**
```javascript
{
  email: "user@example.com",
  coachId: 123  // Optional - only if coach was selected
}
```

**Logic:**
```javascript
const updateData = { SetupSkipped: true };

// If coach was selected, save the relationship
if (coachId) {
  updateData.UplineCoachId = coachId;
}

await supabase
  .from("team_table")
  .update(updateData)
  .eq("Email", email);
```

**Response:**
```javascript
{
  success: true,
  message: "Setup skip recorded successfully",
  coachSaved: true  // Indicates if coach was saved
}
```

---

### Frontend: SetupWizard.js

**Skip Button (Top-Left):**
```javascript
await axios.post(`${API_BASE}/api/user/skip-setup`, {
  email: userEmail,
  coachId: null,  // No coach - full skip
});
```

**Skip & Continue (Step 2):**
```javascript
await axios.post(`${API_BASE}/api/user/skip-setup`, {
  email: userEmail,
  coachId: selectedCoach?.userId || null,  // Save coach if selected
});
```

---

## 🎨 User Experience

### What Users See

**Scenario 1: Skip Entirely**
```
User clicks "Skip Setup"
   ↓
✅ Success: "Setup skipped!"
   ↓
Goes to Dashboard (no coach, no Team ID)
```

**Scenario 2: Skip with Coach**
```
User selects "John Doe" → Click "Continue"
   ↓
Sees: "Selected Coach: ✅ John Doe"
   ↓
Leaves Team ID empty → Click "Skip & Continue"
   ↓
✅ Success: "Setup skipped! You can continue using the app."
   ↓
Goes to Dashboard (has coach, no Team ID)
```

---

## 📋 Impact on Features

### With Coach Saved (Scenario 2):
✅ **Team Hierarchy** - User appears under their coach  
✅ **Discipline Reports** - Coach can see user's data  
✅ **Coach Dashboard** - User shows up in coach's team  
✅ **Team Analytics** - User included in team stats  
❌ **Team ID Features** - Not available (no Team ID)  

### Without Coach (Scenario 1):
❌ **Team Hierarchy** - User is independent  
❌ **Discipline Reports** - No coach to view data  
❌ **Coach Dashboard** - User not in any team  
❌ **Team Analytics** - User excluded  
❌ **Team ID Features** - Not available  

### Admin/Developer Users:
✅ **All Features** - Full access regardless of setup status  
✅ **Bypass Setup** - Never see setup wizard  
✅ **Role-Based Access** - Determined by `Role` column  

---

## 🔐 Role-Based Access

### Role Hierarchy

| Role | Setup Required? | Coach Required? | Team ID Required? |
|------|----------------|----------------|-------------------|
| **admin** | ❌ No | ❌ No | ❌ No |
| **developer** | ❌ No | ❌ No | ❌ No |
| **coach** | ✅ Yes* | ❌ No | ⚠️ Optional |
| **user** | ✅ Yes* | ⚠️ Optional | ⚠️ Optional |

*Can skip if `SetupSkipped = true`

---

## 🧪 Testing Checklist

### Test 1: Skip Without Coach
- [ ] Click "Skip Setup" button
- [ ] Verify: `SetupSkipped = true`, `UplineCoachId = null`
- [ ] Verify: No team features show up
- [ ] Verify: User can still use core app features

### Test 2: Skip With Coach
- [ ] Select coach in Step 1
- [ ] Skip Team ID in Step 2
- [ ] Verify: `SetupSkipped = true`, `UplineCoachId = <coach_id>`
- [ ] Verify: User appears in coach's team hierarchy
- [ ] Verify: Coach can see user in discipline reports
- [ ] Verify: No Team ID features available

### Test 3: Admin Access
- [ ] Login as admin user
- [ ] Verify: No setup wizard shown
- [ ] Verify: Full dashboard access
- [ ] Verify: Can view all team data

### Test 4: Developer Access
- [ ] Login as developer user
- [ ] Verify: No setup wizard shown
- [ ] Verify: Full dashboard access
- [ ] Verify: Same as admin

---

## 📊 Database State Comparison

### Regular User States

| State | SetupSkipped | UplineCoachId | TeamId | Explanation |
|-------|-------------|---------------|--------|-------------|
| **Fresh User** | false | null | null | Just registered |
| **Setup Complete** | false | 123 | ABC123 | Full setup done |
| **Skip No Coach** | true | null | null | Skipped entirely |
| **Skip With Coach** | true | 123 | null | Coach saved, no Team ID |

### Special User States

| State | Role | SetupSkipped | UplineCoachId | TeamId | Explanation |
|-------|------|-------------|---------------|--------|-------------|
| **Admin** | admin | any | any | any | Full access always |
| **Developer** | developer | any | any | any | Full access always |

---

## 🚀 Benefits

✅ **Coach Relationship Preserved** - Users who skip Team ID still linked to coach  
✅ **Feature Compatibility** - Team hierarchy and reports work even without Team ID  
✅ **Flexible UX** - Users can skip Team ID but keep coach benefits  
✅ **No Breaking Changes** - Admin/Developer access unchanged  
✅ **Database Consistency** - Clear state for each scenario  

---

## 📝 Notes

1. **Team ID is Optional** - Users can have a coach without a Team ID
2. **Coach Relationship Matters** - Many features depend on `UplineCoachId`, not `TeamId`
3. **Admin/Developer Always Work** - Role-based access is independent of setup status
4. **Skip is Reversible** - Users could potentially complete setup later (future feature)
