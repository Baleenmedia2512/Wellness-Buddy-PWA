# 🚀 Quick Start - Deploy Your Secure App

**IMMEDIATE ACTION REQUIRED** (Follow in order)

---

## ⏱️ 30-Minute Deployment Checklist

### ☑️ RIGHT NOW (5 min) - Revoke Old Keys
```
1. Go to: https://console.cloud.google.com/apis/credentials
2. Find and DELETE:
   - Gemini Key: AIzaSyDtLAmg2N-NTUbKxoJwGHuSRwkojYkeQN0
   - Maps Key:   AIzaSyAJ92i69y8ooAOt_4Br-UXrJBuobz7bryY
```

### ☑️ STEP 1 (3 min) - Create New Keys
```
1. In Google Cloud Console, create NEW keys
2. Apply restrictions:
   - Gemini: Backend domain only
   - Maps: Frontend referrers only
```

### ☑️ STEP 2 (2 min) - Add to Vercel Backend
```
1. Go to: https://vercel.com/dashboard
2. Select your BACKEND project
3. Settings → Environment Variables
4. Add:
   Name:  GEMINI_API_KEY
   Value: [your new Gemini key]
   Envs:  ✓ Production ✓ Preview ✓ Development
5. Save
```

### ☑️ STEP 3 (5 min) - Deploy Backend
```bash
cd C:\xampp\htdocs\Wellness-Buddy-PWA

git add .
git commit -m "fix(security): implement secure AI backend proxy"
git push origin main

# Wait for Vercel to deploy...
# Check: https://vercel.com/your-org/backend/deployments
```

### ☑️ STEP 4 (5 min) - Activate Secure Frontend Services
```powershell
cd frontend\src

# Backup old services
Move-Item shared\services\geminiService.js shared\services\geminiService.OLD.js
Move-Item features\weight\services\weightDetectionService.js features\weight\services\weightDetectionService.OLD.js
Move-Item features\education\services\educationDetectionService.js features\education\services\educationDetectionService.OLD.js

# Activate secure versions
Move-Item shared\services\geminiService.secure.js shared\services\geminiService.js
Move-Item features\weight\services\weightDetectionService.secure.js features\weight\services\weightDetectionService.js
Move-Item features\education\services\educationDetectionService.secure.js features\education\services\educationDetectionService.js
```

### ☑️ STEP 5 (3 min) - Verify & Deploy Frontend
```powershell
cd C:\xampp\htdocs\Wellness-Buddy-PWA\frontend

# Build and verify
npm run build

# THIS MUST RETURN NOTHING:
Select-String -Path "build\static\js\*.js" -Pattern "AIza" -SimpleMatch

# If clear, deploy:
cd ..
git add .
git commit -m "fix(security): activate secure API services"
git push origin main
```

### ☑️ STEP 6 (2 min) - Test Production
```
1. Open your app: https://your-app.vercel.app
2. Take a food photo
3. Should see nutrition analysis
4. Check DevTools Network tab
5. Should call: /api/ai/analyze-nutrition ✓
```

### ☑️ STEP 7 (5 min) - Final Verification
```powershell
# Verify no keys in latest build
cd frontend
npm run build
Select-String -Path "build\**\*.js" -Pattern "AIzaSy" -Recurse

# Should return: NO MATCHES ✓
```

---

## ✅ Success Criteria

Your deployment is complete when ALL are true:

- [ ] Old API keys revoked in Google Cloud
- [ ] New key added to Vercel backend as `GEMINI_API_KEY`
- [ ] Backend deployed successfully
- [ ] Frontend using secure services (*.secure.js → *.js)
- [ ] Frontend deployed successfully
- [ ] Food analysis works in production
- [ ] NO "AIza" strings found in `frontend/build/` folder
- [ ] Network tab shows calls to `/api/ai/*` endpoints

---

## 🆘 If Something Goes Wrong

**Backend 500 Error:**
→ Check Vercel backend logs
→ Verify `GEMINI_API_KEY` is set in environment

**Frontend "Network Error":**
→ Check `REACT_APP_API_BASE_URL` in frontend `.env`
→ Verify backend deployment succeeded

**Still See API Keys in Build:**
→ Remove `REACT_APP_GEMINI_API_KEY` from ALL .env files
→ Clear cache: `Remove-Item -Recurse -Force frontend\.next, frontend\build`
→ Rebuild: `npm run build`

**Need to Rollback:**
```bash
git revert HEAD
git push origin main
```

---

## 📚 Full Documentation

- **Details:** `docs/MIGRATION_GUIDE.md`
- **Security:** `docs/SECURITY_REMEDIATION.md`
- **Git Cleanup:** `docs/GIT_CLEANUP_COMMANDS.md`
- **Summary:** `SECURITY_FIX_SUMMARY.md`

---

## 🎯 One-Command Verification

```powershell
# Run this anytime to check status:
.\scripts\verify-security.ps1
```

---

**Total Time:** ~30 minutes  
**Downtime:** Zero (if backend deployed first)  
**Risk:** Low (changes are additive)

🔒 **Your API keys will NEVER be exposed again!**
