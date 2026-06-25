# Email Usage - Exact Module Map

> **Quick Reference:** Exact module names and file paths for all email usage

---

## Backend Modules

### 1. **Authentication Module**
**Path:** `backend/features/auth/`

| File | Exact Module Name |
|------|-------------------|
| `auth.service.js` | `backend/features/auth/auth.service` |
| `auth.repository.js` | `backend/features/auth/auth.repository` |

**Functions Using Email:**
- `resolveUserAfterOtp({ recipient, contactType })`
- `findUserByEmail(recipient)`

---

### 2. **User Module**
**Path:** `backend/features/user/`

| File | Exact Module Name |
|------|-------------------|
| `user.repository.js` | `backend/features/user/user.repository` |
| `user.service.js` | `backend/features/user/user.service` |
| `lookup.service.js` | `backend/features/user/lookup.service` |
| `google-auth.service.js` | `backend/features/user/google-auth.service` |
| `setup.service.js` | `backend/features/user/setup.service` |
| `profile.service.js` | `backend/features/user/profile.service` |
| `status.service.js` | `backend/features/user/status.service` |
| `user.validators.js` | `backend/features/user/user.validators` |

**Functions Using Email:**
- `findByEmail(email, columns)`
- `findByExactEmail(email, columns)`
- `getProfile(email)`
- `updateUserByEmail(email, updateData)`
- `getStatusFields(email)`
- `purgeUserData(userId, normalizedEmail)`
- `lookupUser({ email })`
- `saveGoogleUser({ email, displayName, photoURL })`
- `skipSetup({ email, coachId })`
- `saveProfilePicture({ email, base64Image })`
- `getProfilePicture({ email })`
- `getStatus({ email })`
- `normalizeEmail(raw)`
- `validateLookup(req)`
- `validateProfileRequest(body)`
- `validateSetupSkip(body)`
- `validateProfilePictureSave(body)`
- `validateProfilePictureFetch(body)`
- `validateStatusRequest(req)`

---

### 3. **Token Module**
**Path:** `backend/features/token/`

| File | Exact Module Name |
|------|-------------------|
| `token.repository.js` | `backend/features/token/token.repository` |

**Functions Using Email:**
- `findLatestToken(email, type)`

---

### 4. **Hierarchy Utilities**
**Path:** `backend/utils/`

| File | Exact Module Name |
|------|-------------------|
| `hierarchyHelpers.js` | `backend/utils/hierarchyHelpers` |
| `teamHierarchyBuilder.js` | `backend/utils/teamHierarchyBuilder` |
| `teamAttendanceHelpers.js` | `backend/utils/teamAttendanceHelpers` |
| `columnMapping.js` | `backend/utils/columnMapping` |
| `disciplineCalculationsSupabase.js` | `backend/utils/disciplineCalculationsSupabase` |

**Email in Data Structures:**
- Node objects include `email: node.Email`
- User objects include `email: user.Email`
- Hierarchy data includes email fields

---

### 5. **Cache Utilities**
**Path:** `backend/utils/`

| File | Exact Module Name |
|------|-------------------|
| `cache.js` | `backend/utils/cache` |

**Functions Using Email:**
- `cacheKeys.userProfile(email)` - Email as cache key

---

### 6. **User Activity Shared Library**
**Path:** `backend/shared/lib/`

| File | Exact Module Name |
|------|-------------------|
| `userActivity.js` | `backend/shared/lib/userActivity` |

**Functions Using Email:**
- `invalidateUserProfileCache(userId)` - Fetches email to invalidate cache

---

### 7. **API Route Handlers**
**Path:** `backend/pages/api/`

| API Endpoint | File Path | Exact Module |
|--------------|-----------|--------------|
| `/api/user/lookup` | `backend/pages/api/user/lookup.js` | Handler for user lookup |
| `/api/user/profile` | `backend/pages/api/user/profile.js` | Handler for profile fetch |
| `/api/user/status` | `backend/pages/api/user/status.js` | Handler for status check |
| `/api/user/setup-skip` | `backend/pages/api/user/setup-skip.js` | Handler for setup skip |
| `/api/user/profile-picture` | `backend/pages/api/user/profile-picture.js` | Handler for picture save |
| `/api/user/profile-picture-fetch` | `backend/pages/api/user/profile-picture-fetch.js` | Handler for picture fetch |
| `/api/upline/request` | `backend/pages/api/upline/request.js` | Coach OTP request |
| `/api/upline/validate-otp` | `backend/pages/api/upline/validate-otp.js` | Coach OTP validation |
| `/api/upline/cancel-request` | `backend/pages/api/upline/cancel-request.js` | Cancel OTP request |
| `/api/team/claim-id` | `backend/pages/api/team/claim-id.js` | Team ID claim |
| `/api/team/check-availability` | `backend/pages/api/team/check-availability.js` | Email availability check |
| `/api/coach/team-hierarchy` | `backend/pages/api/coach/team-hierarchy.js` | Coach hierarchy fetch |
| `/api/coach/hierarchical-club-attendance` | `backend/pages/api/coach/hierarchical-club-attendance.js` | Club attendance |
| `/api/users/search` | `backend/pages/api/users/search.js` | User search with email mask |

---

## Frontend Modules

### 8. **Main Application Module**
**Path:** `frontend/src/`

| File | Exact Module Name |
|------|-------------------|
| `App.js` | `frontend/src/App` |

**Email Usage:** 110+ occurrences across:
- Session management
- Profile completion checks
- Authentication handlers
- User state management
- API calls
- Modal displays

---

### 9. **Session Storage Service**
**Path:** `frontend/src/shared/services/`

| File | Exact Module Name |
|------|-------------------|
| `sessionStorage.js` | `frontend/src/shared/services/sessionStorage` |

**Functions Using Email:**
- `getUserEmail()`
- `setUserEmail(email)`
- `clearUserEmail()`

---

### 10. **User Identity Service**
**Path:** `frontend/src/shared/services/`

| File | Exact Module Name |
|------|-------------------|
| `getUserId.js` | `frontend/src/shared/services/getUserId` |

**Functions Using Email:**
- `getUserId(user)` - Requires `user.email`
- `lookupUserByEmail(email)`
- `clearUserIdCache()`

---

### 11. **Auth Profile Services**
**Path:** `frontend/src/shared/services/auth/`

| File | Exact Module Name |
|------|-------------------|
| `userProfile.js` | `frontend/src/shared/services/auth/userProfile` |
| `userSetup.js` | `frontend/src/shared/services/auth/userSetup` |
| `demoSetup.js` | `frontend/src/shared/services/auth/demoSetup` |

**Functions Using Email:**
- `fetchProfileCompletion({ apiBaseUrl, email })`
- `fetchProfilePicture({ apiBaseUrl, email })`
- `fetchSetupStatus({ apiBaseUrl, email })`
- `silentlyCompleteDemoSetup(userEmail)`
- Constant: `DEMO_EMAIL`

---

### 12. **Token Tracker Service**
**Path:** `frontend/src/shared/services/tokenCost/`

| File | Exact Module Name |
|------|-------------------|
| `tokenTracker.js` | `frontend/src/shared/services/tokenCost/tokenTracker` |

**Functions Using Email:**
- `createTokenTracker(defaultModelName)`
  - `setCurrentUser(userId, email)`
  - `getCurrentUserEmail()`

---

### 13. **User Feature Components**
**Path:** `frontend/src/features/user/`

| File | Exact Module Name |
|------|-------------------|
| `components/login/LoginEmailEntry.js` | `frontend/src/features/user/components/login/LoginEmailEntry` |
| `components/InactiveUserModal.jsx` | `frontend/src/features/user/components/InactiveUserModal` |
| `components/UserNotFoundModal.jsx` | `frontend/src/features/user/components/UserNotFoundModal` |

**Props Using Email:**
- `<InactiveUserModal userEmail={...} />`
- `<UserNotFoundModal userEmail={...} />`

---

### 14. **Wellness Counselling Pages**
**Path:** `frontend/src/pages/`

| File | Exact Module Name |
|------|-------------------|
| `WellnessCounselling.js` | `frontend/src/pages/WellnessCounselling` |
| `WellnessCounsellingCards.js` | `frontend/src/pages/WellnessCounsellingCards` |

**Functions Using Email:**
- `getUserId(email)` - Local helper
- API call: `/api/user/lookup?email=${email}`

---

## Native Platform Modules

### 15. **Android Gallery Monitor Service**
**Path:** `frontend/android/app/src/main/java/com/wellnessvalley/app/services/`

| File | Exact Module Name |
|------|-------------------|
| `GalleryMonitorService.java` | `com.wellnessvalley.app.services.GalleryMonitorService` |

**Methods Using Email:**
- `getCurrentUserId()` - Reads `current_user_email` from SharedPreferences
- Uses email for database UserId lookup

---

### 16. **Android Gallery Monitor Plugin**
**Path:** `frontend/android/app/src/main/java/com/wellnessvalley/app/plugins/`

| File | Exact Module Name |
|------|-------------------|
| `GalleryMonitorPlugin.java` | `com.wellnessvalley.app.plugins.GalleryMonitorPlugin` |

**Methods Using Email:**
- `setCurrentUser(PluginCall call)` - Stores `userEmail` in SharedPreferences

---

### 17. **Android Database Sync Client**
**Path:** `frontend/android/app/src/main/java/com/wellnessvalley/app/services/`

| File | Exact Module Name |
|------|-------------------|
| `DatabaseSyncClient.java` | `com.wellnessvalley.app.services.DatabaseSyncClient` |

**Methods Using Email:**
- `lookupDatabaseUserId(String userEmail, String apiBaseUrl)`

---

## Testing Modules

### 18. **E2E Test Helpers**
**Path:** `e2e/helpers/`

| File | Exact Module Name |
|------|-------------------|
| `auth.js` | `e2e/helpers/auth` |

**Functions Using Email:**
- `loginAsUser(page, { email, password })`
- `loginAsCoach(page)` - Uses `E2E_COACH_EMAIL`

---

### 19. **E2E Test Journeys**
**Path:** `e2e/journeys/`

| File | Exact Module Name |
|------|-------------------|
| `log-water.spec.js` | E2E test for water logging |
| `log-weight.spec.js` | E2E test for weight logging |
| `coach-views-team.spec.js` | E2E test for coach dashboard |
| `view-dashboard.spec.js` | E2E test for dashboard |

**Environment Variables:**
- `E2E_USER_EMAIL`
- `E2E_COACH_EMAIL`

---

### 20. **Test Scripts**
**Path:** Root directory

| File | Exact Module Name |
|------|-------------------|
| `test-apis.sh` | Shell script for API testing |
| `test-inactive-user-flow.js` | Node script for inactive user flow |
| `test-background-service.sh` | Shell script for background service |

**Variables Using Email:**
- `TEST_EMAIL="test@wellness.com"`
- `email = "leenah.grace@gmail.com"`
- Test requests with email parameter

---

## Static Content Modules

### 21. **Privacy Policy**
**Path:** `backend/public/`

| File | Exact Module Name |
|------|-------------------|
| `privacy-policy.html` | Static HTML page |

**Email References:**
- Account information collection (email address)
- Google account data (email)
- Contact email: `easy2work.india@gmail.com`

---

### 22. **Account Deletion Page**
**Path:** `backend/pages/`

| File | Exact Module Name |
|------|-------------------|
| `delete-account.js` | Next.js page component |

**Email References:**
- Instructions to send email to support
- User must include registered email address
- Account information includes email

---

## Configuration & Workflow Modules

### 23. **GitHub Actions Workflows**
**Path:** `.github/workflows/`

| File | Exact Module Name |
|------|-------------------|
| `e2e.yml` | GitHub Actions E2E workflow |

**Environment Variables:**
- `E2E_USER_EMAIL: ${{ secrets.E2E_USER_EMAIL }}`
- `E2E_COACH_EMAIL: ${{ secrets.E2E_COACH_EMAIL }}`

---

### 24. **Playwright Config**
**Path:** Root directory

| File | Exact Module Name |
|------|-------------------|
| `playwright.config.js` | Playwright configuration |

**Environment Variables Referenced:**
- `E2E_USER_EMAIL`
- `E2E_COACH_EMAIL`

---

## Summary by Category

### **Backend Services (7 modules)**
1. `backend/features/auth/` - Authentication
2. `backend/features/user/` - User management
3. `backend/features/token/` - Token handling
4. `backend/utils/` - Utilities (hierarchy, cache, discipline)
5. `backend/shared/lib/` - Shared libraries
6. `backend/pages/api/` - API route handlers (15+ endpoints)
7. `backend/public/` - Static content

### **Frontend Services (7 modules)**
8. `frontend/src/App` - Main application
9. `frontend/src/shared/services/` - Shared services (session, getUserId)
10. `frontend/src/shared/services/auth/` - Auth services
11. `frontend/src/shared/services/tokenCost/` - Token tracking
12. `frontend/src/features/user/` - User feature components
13. `frontend/src/pages/` - Page components (counselling)
14. Root configuration files

### **Native Platform (3 modules)**
15. `com.wellnessvalley.app.services.GalleryMonitorService` (Android)
16. `com.wellnessvalley.app.plugins.GalleryMonitorPlugin` (Android)
17. `com.wellnessvalley.app.services.DatabaseSyncClient` (Android)

### **Testing (4 modules)**
18. `e2e/helpers/` - E2E test helpers
19. `e2e/journeys/` - E2E test suites
20. Root test scripts
21. GitHub Actions workflows

### **Static/Config (3 modules)**
22. Privacy policy & deletion pages
23. GitHub workflows
24. Playwright configuration

---

## Quick Import Reference

### **Backend Imports**

```javascript
// Authentication
import { resolveUserAfterOtp } from 'backend/features/auth/auth.service';
import { findUserByEmail } from 'backend/features/auth/auth.repository';

// User Operations
import { findByEmail, updateUserByEmail } from 'backend/features/user/user.repository';
import { lookupUser } from 'backend/features/user/lookup.service';
import { saveGoogleUser } from 'backend/features/user/google-auth.service';
import { skipSetup } from 'backend/features/user/setup.service';
import { getStatus } from 'backend/features/user/status.service';
import { normalizeEmail } from 'backend/features/user/user.validators';

// Cache
import { cacheKeys } from 'backend/utils/cache';
import { invalidateUserProfileCache } from 'backend/shared/lib/userActivity';
```

### **Frontend Imports**

```javascript
// Session Management
import * as Session from './shared/services/sessionStorage';
// Usage: Session.getUserEmail(), Session.setUserEmail(email)

// User Identity
import { getUserId, lookupUserByEmail } from './shared/services/getUserId';

// Auth Services
import { fetchProfileCompletion, fetchProfilePicture } from './shared/services/auth/userProfile';
import { fetchSetupStatus } from './shared/services/auth/userSetup';
import { DEMO_EMAIL } from './shared/services/auth/demoSetup';

// Token Tracking
import { createTokenTracker } from './shared/services/tokenCost/tokenTracker';
```

### **Android Native**

```java
// Service
import com.wellnessvalley.app.services.GalleryMonitorService;

// Plugin
import com.wellnessvalley.app.plugins.GalleryMonitorPlugin;

// Database Client
import com.wellnessvalley.app.services.DatabaseSyncClient;
```

---

## Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                        Email (Core)                          │
└─────────────┬───────────────────────────────────────────────┘
              │
              ├──► backend/features/user/user.repository
              │    └──► findByEmail(email) [PRIMARY LOOKUP]
              │
              ├──► backend/features/auth/auth.service
              │    └──► resolveUserAfterOtp({ recipient })
              │
              ├──► frontend/src/shared/services/getUserId
              │    └──► getUserId(user) [email → userId]
              │
              ├──► frontend/src/shared/services/sessionStorage
              │    └──► getUserEmail() / setUserEmail(email)
              │
              ├──► frontend/src/App.js
              │    └──► 110+ email references
              │
              ├──► backend/utils/cache
              │    └──► userProfile: (email) => cache key
              │
              ├──► com.wellnessvalley.app.services.GalleryMonitorService
              │    └──► lookupDatabaseUserId(userEmail)
              │
              └──► 15+ API endpoints
                   └──► /api/user/lookup (PRIMARY)
```

---

## Critical Module Priority

### **P0 (CRITICAL - System Fails)**
1. `backend/features/user/user.repository` - DB queries
2. `frontend/src/shared/services/getUserId` - Identity resolution
3. `frontend/src/App` - Main app logic
4. `backend/pages/api/user/lookup.js` - Identity API

### **P1 (HIGH - Major Features Break)**
5. `backend/features/auth/auth.service` - Authentication
6. `frontend/src/shared/services/sessionStorage` - Session persistence
7. `backend/utils/cache` - Cache system
8. `com.wellnessvalley.app.services.GalleryMonitorService` - Android background

### **P2 (MEDIUM - Specific Features Break)**
9. `backend/pages/api/upline/*` - OTP reactivation
10. `backend/utils/hierarchyHelpers` - Team structure
11. `frontend/src/pages/WellnessCounselling` - Counselling module

### **P3 (LOW - Nice to Have)**
12. E2E test modules
13. Privacy policy pages
14. Test scripts

---

**Document End**
