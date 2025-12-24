# Coach-Team Authentication Flow - Implementation Complete

## Overview
Complete implementation of the coach-team authentication flow with Team ID claiming, coach selection, and OTP validation.

## Architecture

### Database Schema (3 Tables)
1. **team_table** - Modified with TeamId and UplineCoachId columns
2. **coach_teams_table** - Maps TeamIds to coaches (max 2 per team)
3. **approval_requests_table** - Tracks OTP requests with 24h expiry

### Backend APIs (6 Endpoints)
All APIs located in `backend/pages/api/`

1. **GET /api/team/check-availability/:teamId**
   - Checks if Team ID is available, taken by user, or taken by others
   - Validates format: ABC123XYZ0

2. **POST /api/team/claim-id**
   - Claims a Team ID for the user
   - Creates coach_teams_table entry if user is coach (Role=admin)

3. **GET /api/users/search?q={query}**
   - Searches for coaches (Role=admin only)
   - Returns: userId, userName, email, coachName, teamId

4. **POST /api/upline/request**
   - Creates approval request with OTP
   - Sends email to coach with 6-digit code
   - Sets 24-hour expiry

5. **GET /api/user/status**
   - Returns setup completion status
   - 5 states: no TeamId, has TeamId, pending request, expired request, complete
   - Provides redirectTo path

6. **POST /api/upline/validate-otp**
   - Validates 6-digit OTP
   - Max 5 attempts
   - Updates UplineCoachId on success

### Frontend Components (2 Pages)

#### SetupWizard.js
**Location:** `frontend/src/pages/SetupWizard.js`

**Features:**
- Step 1: Team ID input with real-time availability check
- Step 2: Coach search with selectable cards
- Auto-format Team ID (ABC123XYZ0)
- Progress indicator
- Error/success messages

**Props:**
- `onClose()` - Called when wizard should close
- `onNavigateToOTP()` - Called to navigate to OTP validation

**Flow:**
1. User enters Team ID → Real-time validation
2. User claims Team ID → Proceeds to Step 2
3. User searches for coach → Displays coach cards
4. User selects coach → Sends approval request
5. Email sent to coach with OTP → Navigate to ValidateOTP

#### ValidateOTP.js
**Location:** `frontend/src/pages/ValidateOTP.js`

**Features:**
- 6 separate input boxes with auto-focus
- Paste support (auto-distribute digits)
- Time remaining countdown
- Attempts counter (5/5)
- Auto-submit on completion
- Responsive mobile design

**Props:**
- `onClose()` - Called when returning to setup wizard
- `onSuccess()` - Called when OTP validation succeeds

**Flow:**
1. Fetches pending request info on load
2. User enters 6-digit OTP
3. Validates OTP (max 5 attempts)
4. On success: Setup complete
5. On expiry/failure: Returns to wizard

## Auth Flow Integration

### App.js Changes

**1. User Status Check (Line ~260)**
```javascript
// After user is confirmed active, check setup status
const statusResponse = await fetch(`${apiBaseUrl}/api/user/status`, {
  headers: { 
    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
    'Content-Type': 'application/json'
  }
});

if (statusResponse.ok) {
  const statusData = await statusResponse.json();
  
  if (!statusData.setupComplete) {
    if (statusData.state === 'pending_otp') {
      setShowValidateOTP(true); // User has pending OTP
    } else {
      setShowSetupWizard(true); // User needs setup
    }
  }
}
```

**2. Setup Wizard Modal (Line ~1920)**
```javascript
{showSetupWizard && (
  <Suspense fallback={<LoadingSpinner message="Loading setup..." />}>
    <SetupWizard 
      onClose={() => setShowSetupWizard(false)}
      onNavigateToOTP={() => {
        setShowSetupWizard(false);
        setShowValidateOTP(true);
      }}
    />
  </Suspense>
)}
```

**3. OTP Validation Modal (Line ~1930)**
```javascript
{showValidateOTP && (
  <Suspense fallback={<LoadingSpinner message="Loading validation..." />}>
    <ValidateOTP 
      onClose={() => {
        setShowValidateOTP(false);
        setShowSetupWizard(true);
      }}
      onSuccess={() => {
        setShowValidateOTP(false);
        // Setup complete, user can now access dashboard
      }}
    />
  </Suspense>
)}
```

## Complete User Journey

### New User Flow
1. **Login/Register** → User signs in with Google/OTP
2. **Status Check** → System checks if setup is complete
3. **Setup Wizard** → User enters Team ID
4. **Team ID Claimed** → System validates and claims ID
5. **Coach Search** → User searches for upline coach
6. **Select Coach** → User selects coach and sends request
7. **Email Sent** → Coach receives email with 6-digit OTP
8. **OTP Validation** → User enters OTP from coach
9. **Setup Complete** → User can access dashboard

### Existing User Flow
1. **Login** → User signs in
2. **Status Check** → Setup already complete
3. **Dashboard** → User goes directly to dashboard

### Pending OTP Flow
1. **Login** → User signs in
2. **Status Check** → Detects pending OTP request
3. **OTP Validation** → Opens OTP modal directly
4. **Validation** → User enters OTP
5. **Setup Complete** → User can access dashboard

## User States

The system handles 5 distinct user states:

1. **no_team_id** - User has no Team ID
   - Action: Show setup wizard (Step 1)

2. **has_team_id** - User has Team ID but no request
   - Action: Show setup wizard (Step 2 - Coach Search)

3. **pending_otp** - User has active OTP request
   - Action: Show OTP validation modal
   - Info: Coach email, time remaining, attempts left

4. **expired_request** - OTP request expired (>24h)
   - Action: Show setup wizard to send new request

5. **complete** - Setup fully complete
   - Action: Allow access to dashboard

## Security Features

### OTP Security
- 6-digit random codes
- Hashed with bcrypt (salt rounds: 10)
- 24-hour expiry
- Maximum 5 validation attempts
- Auto-cleanup of expired requests

### Team ID Validation
- Format: ABC123XYZ0 (3 letters + 3 digits + 3 letters + 1 digit)
- Unique constraint in database
- Real-time availability check
- Prevents duplicate claims

### Authorization
- JWT token required for all API calls
- User ID attached to all requests
- Role-based access (admin = coach)
- Database-level foreign key constraints (optional)

## Error Handling

### Frontend
- Real-time validation feedback
- Clear error messages
- Retry mechanisms
- Graceful degradation

### Backend
- Transaction-safe operations
- Detailed error responses
- Logging for debugging
- Fail-safe defaults

## Testing Checklist

- [ ] New user can claim Team ID
- [ ] Existing Team ID is detected
- [ ] Coach search returns results
- [ ] Approval request sends email
- [ ] OTP validation succeeds with correct code
- [ ] OTP validation fails with wrong code
- [ ] Max attempts (5) is enforced
- [ ] 24-hour expiry works
- [ ] Back navigation works
- [ ] Setup wizard reopens on incomplete setup
- [ ] Completed users go directly to dashboard

## File Locations

### Database
- Schema: `sql/coach_team_setup_schema.sql`

### Backend APIs
- `backend/pages/api/team/check-availability.js`
- `backend/pages/api/team/claim-id.js`
- `backend/pages/api/users/search.js`
- `backend/pages/api/upline/request.js`
- `backend/pages/api/upline/validate-otp.js`
- `backend/pages/api/user/status.js`

### Frontend
- Main App: `frontend/src/App.js` (lines 60, 260, 1920-1945)
- Setup Wizard: `frontend/src/pages/SetupWizard.js`
- Setup CSS: `frontend/src/pages/SetupWizard.css`
- OTP Validation: `frontend/src/pages/ValidateOTP.js`
- OTP CSS: `frontend/src/pages/ValidateOTP.css`

## Environment Variables

Make sure `.env` has:
```
REACT_APP_API_URL=http://localhost:3000
```

## Next Steps

1. **Test Flow End-to-End**
   - Start backend: `cd backend && npm run dev`
   - Start frontend: `cd frontend && npm start`
   - Login and test complete flow

2. **Email Template** (Optional)
   - Customize email template in `upline/request.js`
   - Add company logo/branding

3. **UI Enhancements** (Optional)
   - Add loading animations
   - Add success animations
   - Improve mobile responsiveness

4. **Admin Panel** (Future)
   - View all team structures
   - Manage approval requests
   - Manual coach assignments

## Support

For issues or questions:
- Check browser console for errors
- Check backend terminal for API errors
- Verify database tables exist
- Ensure JWT tokens are valid
- Check email configuration for OTP delivery
