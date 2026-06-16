# 🚀 Migration Guide: Secure Gemini API Implementation

This guide helps you migrate from the old insecure Gemini integration to the new secure backend proxy architecture.

---

## 📋 Prerequisites

- [ ] You have revoked the old API keys in Google Cloud Console
- [ ] You have generated new API keys with proper restrictions
- [ ] You have access to Vercel dashboard (for backend environment variables)
- [ ] Backend changes are ready to deploy

---

## 🔄 Migration Steps

### Phase 1: Backend Preparation (10 minutes)

#### 1.1 Add API Key to Vercel Backend

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your backend project (e.g., `wellness-valley-pwa-backend-test`)
3. Go to **Settings** → **Environment Variables**
4. Add new variable:
   - **Name:** `GEMINI_API_KEY` (NO "REACT_APP_" prefix!)
   - **Value:** Your new Gemini API key
   - **Environments:** Production, Preview, Development (all)
5. Save

**Important:** Use `GEMINI_API_KEY`, not `REACT_APP_GEMINI_API_KEY`. The `REACT_APP_` prefix makes it public!

#### 1.2 Install Required Dependencies

Check if your backend has these packages:

```bash
cd backend
npm list formidable @google/generative-ai
```

If not installed:

```bash
npm install formidable @google/generative-ai
```

#### 1.3 Deploy Backend

```bash
cd backend
git add pages/api/ai/
git commit -m "feat(security): add secure AI proxy endpoints"
git push origin main
```

Wait for Vercel deployment to complete (check dashboard).

#### 1.4 Verify Backend Endpoints

Test that endpoints are working:

```bash
# Replace with your actual backend URL
BACKEND_URL="https://wellness-valley-pwa-backend-test.vercel.app"

# Test if endpoint exists (should return 405 for GET)
curl -X GET "$BACKEND_URL/api/ai/analyze-nutrition"

# Should return: {"ok":false,"error":{"code":"METHOD_NOT_ALLOWED","message":"Only POST allowed"}}
# This means the endpoint exists and is working!
```

---

### Phase 2: Frontend Migration (15 minutes)

#### 2.1 Update Frontend Environment

Edit `frontend/.env`:

```bash
# Remove or comment out:
# REACT_APP_GEMINI_API_KEY=your_key_here

# Keep only:
REACT_APP_API_BASE_URL=https://wellness-valley-pwa-backend-test.vercel.app
```

#### 2.2 Switch to Secure Services

**Option A: Safe Rename (Recommended)**

```bash
cd frontend/src

# Backup old services
mv shared/services/geminiService.js shared/services/geminiService.OLD.js
mv features/weight/services/weightDetectionService.js features/weight/services/weightDetectionService.OLD.js
mv features/education/services/educationDetectionService.js features/education/services/educationDetectionService.OLD.js

# Activate secure versions
mv shared/services/geminiService.secure.js shared/services/geminiService.js
mv features/weight/services/weightDetectionService.secure.js features/weight/services/weightDetectionService.js
mv features/education/services/educationDetectionService.secure.js features/education/services/educationDetectionService.js
```

**Option B: Direct Replacement**

Simply delete the old files and rename the `.secure.js` files:

```bash
cd frontend/src

rm shared/services/geminiService.js
cp shared/services/geminiService.secure.js shared/services/geminiService.js

rm features/weight/services/weightDetectionService.js
cp features/weight/services/weightDetectionService.secure.js features/weight/services/weightDetectionService.js

rm features/education/services/educationDetectionService.js
cp features/education/services/educationDetectionService.secure.js features/education/services/educationDetectionService.js
```

#### 2.3 Test Locally

```bash
cd frontend
npm start

# Try these features in the app:
# - Take a food photo → should analyze nutrition
# - Take a weight scale photo → should detect weight
# - Take a meeting screenshot → should detect platform
```

Check browser console for:
- ✅ `🔒 SecureGeminiService: Calling backend...`
- ❌ Should NOT see `🔍 GeminiService: Starting optimized...` (old service)

#### 2.4 Build and Verify No Keys in Bundle

```bash
cd frontend
npm run build

# Search for API keys in build (should return NOTHING)
grep -r "AIza" build/

# If you see any API keys, STOP! Something went wrong.
```

#### 2.5 Deploy Frontend

```bash
git add .
git commit -m "fix(security): migrate to secure backend AI proxy

- Switch to secure geminiService
- Remove client-side API key usage
- All AI calls now authenticated through backend

BREAKING CHANGE: Requires backend deployment first"

git push origin main
```

---

### Phase 3: Testing & Verification (10 minutes)

#### 3.1 Test on Staging/Production

1. **Food Analysis:**
   - Open app → Camera → Take food photo
   - Should see nutrition data appear
   - Check Network tab → should call `/api/ai/analyze-nutrition`

2. **Weight Detection:**
   - Take weight scale photo
   - Should detect weight value
   - Check Network tab → should call `/api/ai/detect-weight`

3. **Meeting Detection:**
   - Upload meeting screenshot
   - Should detect platform (Zoom/Meet/Teams)
   - Check Network tab → should call `/api/ai/detect-image-type`

#### 3.2 Check Backend Logs

In Vercel Dashboard → Functions → select an AI endpoint → View logs

Should see:
```
✓ Gemini API call successful
✓ Returned nutrition data
```

Should NOT see:
```
✗ GEMINI_API_KEY not configured
✗ 500 Internal Server Error
```

#### 3.3 Monitor Error Rates

Check your error tracking (Sentry/etc) for:
- API 500 errors from `/api/ai/*`
- Frontend errors mentioning "Gemini"
- Authentication failures

---

### Phase 4: Cleanup (5 minutes)

#### 4.1 Remove Old Service Files

After confirming everything works:

```bash
cd frontend/src

# Delete backups
rm shared/services/geminiService.OLD.js
rm features/weight/services/weightDetectionService.OLD.js
rm features/education/services/educationDetectionService.OLD.js

# Delete the .secure.js versions (now copied to main files)
rm shared/services/geminiService.secure.js
rm features/weight/services/weightDetectionService.secure.js
rm features/education/services/educationDetectionService.secure.js
```

#### 4.2 Update .gitignore

Verify these entries exist in `frontend/.gitignore`:

```gitignore
# Environment variables - NEVER commit these
.env
.env.local
.env.*.local

# Build artifacts
android/app/src/main/assets/public/
ios/App/App/public/
build/
```

#### 4.3 Commit Cleanup

```bash
git add .
git commit -m "chore: remove old insecure service files"
git push
```

---

## 🔍 Troubleshooting

### Problem: "AI service not configured" error

**Cause:** Backend doesn't have `GEMINI_API_KEY`

**Fix:**
1. Check Vercel environment variables
2. Ensure variable name is `GEMINI_API_KEY` (not `REACT_APP_GEMINI_API_KEY`)
3. Redeploy backend after adding variable

### Problem: "Network Error" when analyzing images

**Cause:** Backend endpoint not deployed or wrong URL

**Fix:**
1. Check `REACT_APP_API_BASE_URL` in frontend `.env`
2. Verify backend deployment succeeded
3. Test endpoint manually: `curl -X POST https://your-backend.vercel.app/api/ai/analyze-nutrition`

### Problem: Old API key still in build

**Cause:** Environment variable cached in build process

**Fix:**
1. Remove `REACT_APP_GEMINI_API_KEY` completely from all `.env` files
2. Clear build cache: `rm -rf frontend/.next frontend/build`
3. Rebuild: `npm run build`
4. Verify: `grep -r "AIza" frontend/build/`

### Problem: "Method Not Allowed" error

**Cause:** Frontend sending GET instead of POST

**Fix:**
- Check that you're using the secure services (they send POST with FormData)
- Verify imports: `import { geminiService } from './geminiService'`

---

## ✅ Success Criteria

Your migration is complete when:

- [ ] Backend has `GEMINI_API_KEY` environment variable
- [ ] All AI endpoints return 200 OK with valid data
- [ ] Frontend uses secure service files
- [ ] No API keys in `frontend/build/` JavaScript bundles
- [ ] App functionality works (food/weight/meeting detection)
- [ ] Error rates are normal (< 5%)
- [ ] Old service files deleted
- [ ] `.env` committed to `.gitignore`

---

## 📚 Additional Resources

- [Google Cloud API Key Restrictions](https://cloud.google.com/docs/authentication/api-keys#restrict-api-key)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [claude.md §8.2 - Secrets Governance](../claude.md#82-secrets)

---

## 🆘 Rollback Plan

If you need to rollback:

1. **Keep backend changes** (they don't break anything)
2. **Restore old frontend services:**
   ```bash
   git revert HEAD  # Revert migration commit
   ```
3. **Temporarily add key to frontend:**
   - Add `REACT_APP_GEMINI_API_KEY` to Vercel frontend environment
   - Redeploy frontend
4. **Debug and retry migration**

**Note:** Rollback means API keys are exposed again! Only use this temporarily.

---

**Migration Estimated Time:** ~40 minutes  
**Downtime:** None (if backend deployed first)  
**Risk Level:** Low (backend changes are additive)

Good luck! 🚀
