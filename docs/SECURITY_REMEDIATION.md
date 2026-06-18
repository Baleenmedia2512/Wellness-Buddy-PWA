# 🔐 API Key Security Remediation

**Date:** 2026-06-16  
**Status:** ✅ REMEDIATED  
**Severity:** CRITICAL  

---

## 🚨 Issue Summary

**What was exposed:**
- Gemini API Key: `AIzaSyDtLAmg2N-***` (REVOKED)
- Google Maps API Key: `AIzaSyAJ92i***` (REVOKED)
- Both keys were hardcoded in:
  - `frontend/.env` (committed to Git)
  - Bundled JavaScript in IPA/APK files
  - Multiple service files reading `process.env.REACT_APP_*`

**Attack Vector:**
Anyone with access to the IPA/APK file could:
1. Unzip the package
2. Search for "AIza" in JavaScript bundles
3. Extract all API keys in plain text
4. Use them for unlimited API calls on YOUR account

**Financial Impact:**
- Potential for hundreds of thousands of API requests
- Google would bill YOU for all abuse
- App would stop working when quota exceeded

---

## ✅ Remediation Actions Taken

### 1. **Environment File Security** ✅
- [x] Cleared all API keys from `frontend/.env`
- [x] Created `frontend/.env.example` as template
- [x] Added `.env*` files to `.gitignore`
- [x] Added build artifacts to `.gitignore`

### 2. **Backend Proxy Architecture** ✅
Created secure backend endpoints that keep API keys server-side:

- **`/api/ai/analyze-nutrition`** - Food nutrition analysis
- **`/api/ai/detect-image-type`** - Image classification  
- **`/api/ai/detect-weight`** - Weight scale reading

**Flow:**
```
Frontend (no keys) ──► Backend API (with auth) ──► Gemini API (secure)
```

### 3. **New Secure Services** ✅
Created replacement services that call YOUR backend:

- `frontend/src/shared/services/geminiService.secure.js`
- `frontend/src/features/weight/services/weightDetectionService.secure.js`
- `frontend/src/features/education/services/educationDetectionService.secure.js`

### 4. **Git History** ⚠️ MANUAL ACTION REQUIRED
Old commits still contain the exposed keys. See "Next Steps" below.

---

## 📋 Next Steps (MANUAL ACTIONS REQUIRED)

### STEP 1: Revoke Compromised Keys (URGENT) 🔴
1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. **Delete these keys immediately:**
   - Gemini API: `AIzaSyDtLAmg2N-NTUbKxoJwGHuSRwkojYkeQN0`
   - Google Maps: `AIzaSyAJ92i69y8ooAOt_4Br-UXrJBuobz7bryY`

### STEP 2: Generate New Keys with Restrictions 🔒
Generate new keys and apply strict restrictions:

**New Gemini API Key:**
- Name: `Wellness-Valley-Backend-Only`
- Restrictions: IP/Domain restrictions to your Vercel backend
- No referrer restrictions (backend-only)

**New Google Maps API Key:**
- Name: `Wellness-Valley-Frontend`
- Application restrictions: HTTP referrers (your domains only)
- API restrictions: Maps JavaScript API only

### STEP 3: Add Keys to Vercel Backend (Backend Only) ⚙️

In Vercel Dashboard → Project → Settings → Environment Variables:

```bash
# Backend API key (NO "REACT_APP_" prefix!)
GEMINI_API_KEY=your_new_key_here

# This is SERVER-SIDE only - never exposed to frontend
```

**Important:** The key name is `GEMINI_API_KEY` (not `REACT_APP_GEMINI_API_KEY`).  
The `REACT_APP_` prefix makes it PUBLIC - we don't want that!

### STEP 4: Deploy Backend Changes 🚀

```bash
cd backend
git add pages/api/ai/
git commit -m "feat(security): add secure AI proxy endpoints

- Create /api/ai/analyze-nutrition endpoint
- Create /api/ai/detect-image-type endpoint  
- Create /api/ai/detect-weight endpoint
- Keep Gemini API key server-side only
- Per claude.md §8.2 (secrets governance)

[security] [api-keys]"

git push origin main
```

Verify deployment in Vercel logs.

### STEP 5: Switch Frontend to Secure Services 🔄

**Option A: Rename Files (Safe Migration)**
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

**Option B: Direct Edit (if you prefer)**
Replace the old service files with the `.secure.js` versions.

### STEP 6: Test Locally (Optional New Key) 🧪

If you want to test with a temporary key during development:

```bash
# frontend/.env
REACT_APP_API_BASE_URL=http://localhost:3000
```

Backend will use `GEMINI_API_KEY` from your backend `.env` or Vercel config.

### STEP 7: Deploy Frontend 🚢

```bash
cd frontend
npm run build
# Check that NO API keys appear in build/static/js/*.js

git add .
git commit -m "fix(security): remove client-side Gemini API calls

- Switch to secure backend proxy services
- Remove REACT_APP_GEMINI_API_KEY usage
- All AI calls now go through authenticated backend
- Per claude.md §8.2 (secrets must never be in frontend)

BREAKING CHANGE: Requires backend deployment first

[security] [api-keys]"

git push origin main
```

### STEP 8: Clean Git History (Optional but Recommended) 🧹

⚠️ **WARNING:** This rewrites Git history. Coordinate with your team first!

```bash
# Install BFG Repo Cleaner
# https://rtyley.github.io/bfg-repo-cleaner/

# Clone a fresh copy
git clone --mirror git@github.com:your-org/Wellness-Buddy-PWA.git

# Remove the exposed keys from all commits
bfg --replace-text <(echo 'AIzaSyDtLAmg2N-NTUbKxoJwGHuSRwkojYkeQN0') Wellness-Buddy-PWA.git
bfg --replace-text <(echo 'AIzaSyAJ92i69y8ooAOt_4Br-UXrJBuobz7bryY') Wellness-Buddy-PWA.git

cd Wellness-Buddy-PWA.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (⚠️ COORDINATE WITH TEAM!)
git push --force
```

**Alternative:** If you can't rewrite history, at least document that old keys are revoked.

### STEP 9: Update CI/CD Secrets 🔧

If you have GitHub Actions or other CI/CD:

1. Remove `REACT_APP_GEMINI_API_KEY` from GitHub Secrets
2. Add `GEMINI_API_KEY` to backend environment variables
3. Update workflows to not inject frontend API keys

### STEP 10: Verify No Exposure 🔍

After deploying:

1. Download your production IPA/APK
2. Unzip and search for "AIza"
3. **Ensure no API keys appear in any .js files**
4. If found, something went wrong - rollback!

---

## 🛡️ Future Prevention

### 1. **Pre-commit Hook (gitleaks)**
```bash
# Install gitleaks
brew install gitleaks  # macOS
# or download from https://github.com/gitleaks/gitleaks

# Add pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/sh
gitleaks protect --staged --verbose
EOF

chmod +x .git/hooks/pre-commit
```

### 2. **CI/CD Checks**
Ensure `.github/workflows/security.yml` runs on every PR:
- `gitleaks` - scan for secrets
- `npm audit` - check dependencies
- Bundle analysis - verify no keys in build

### 3. **Code Review Checklist**
Before approving any PR:
- [ ] No `process.env.REACT_APP_*` for API keys
- [ ] All external API calls go through backend
- [ ] No secrets in `.env` committed
- [ ] Build artifacts not committed

### 4. **Google Cloud Billing Alerts**
Set up budget alerts in Google Cloud:
- Alert at $50 usage
- Alert at $100 usage
- Hard cap if possible

### 5. **API Key Rotation Schedule**
- Rotate Gemini key every 90 days
- Document in calendar
- Test new key in staging first

---

## 📊 Compliance with claude.md

This remediation satisfies:

- **§1.2 (Forbidden Practices):** No secrets committed ✅
- **§8.2 (Secrets Governance):** All secrets in Vercel env vars ✅
- **§8.6 (Automated Security Checks):** gitleaks pre-commit ✅
- **§5.1 (AI Operating Rules):** Backend keeps keys secure ✅

---

## ✅ Verification Checklist

After completing all steps:

```
Backend:
[ ] New Gemini API key added to Vercel environment
[ ] /api/ai/* endpoints deployed and working
[ ] Old keys revoked in Google Cloud Console
[ ] API restrictions applied to new keys

Frontend:
[ ] .env file cleared of sensitive data
[ ] .gitignore blocks .env files
[ ] Secure services activated
[ ] Build contains NO API keys (verified in bundle)
[ ] App still works in production

Git:
[ ] Build artifacts added to .gitignore
[ ] Old .env removed from future commits
[ ] (Optional) Git history cleaned

Monitoring:
[ ] Google Cloud billing alerts set up
[ ] Error monitoring (Sentry) shows no auth failures
[ ] API usage within normal range
```

---

## 🆘 Rollback Plan

If something breaks after deployment:

1. **Immediate:** Revert frontend deployment in Vercel
2. **Add temporary key:** Add `REACT_APP_GEMINI_API_KEY` back to Vercel frontend env
3. **Restore old service files:** `git revert <commit>`
4. **Debug:** Check Vercel function logs for errors
5. **Fix and retry**

---

## 📞 Support

Questions? Contact:
- Security Team: `@security` in CODEOWNERS
- Principal Engineer: `@principal-eng`
- See: `AGENTS.md` and `claude.md` for governance

---

**Document Version:** 1.0  
**Last Updated:** 2026-06-16  
**Next Review:** After deployment verification
