# 🌳 Apply Security Fixes to ALL Branches

## Problem
You have 27+ local branches and 40+ remote branches. IPA files with exposed API keys exist in many of them.

## Solution Strategy

### ✅ **RECOMMENDED: The "Forward-Only" Approach**

Instead of updating ALL old branches, make `main` secure and force all future work to start from there.

---

## 📋 Step-by-Step

### **Step 1: Secure Your Current Branch** ✅

```powershell
cd C:\xampp\htdocs\Wellness-Buddy-PWA

# Stage the security fixes
git add frontend/.gitignore
git add .gitattributes
git add -u  # Stage all deletions

# Commit
git commit -m "fix(security): remove IPA files and block build artifacts

CRITICAL SECURITY FIX:
- Removed 8 .ipa files (contained exposed API keys)
- Removed 2 .xcarchive files
- Updated .gitignore to block: *.ipa, *.xcarchive, IPA-*/, build artifacts
- Added .gitattributes to prevent future commits

Impact: All iOS/Android build artifacts with embedded keys are removed
See: SECURITY_REMEDIATION.md, QUICK_START.md"
```

---

### **Step 2: Apply to Main Branch**

```powershell
# Save your work
git checkout main
git pull origin main

# Merge your security fixes
git merge --no-ff MAD_Yasheer_2026-06-15 -m "fix(security): comprehensive security remediation

Merging security fixes:
- API keys removed from all committed files
- Build artifacts removed and blocked
- Backend proxy architecture implemented
- Documentation: SECURITY_REMEDIATION.md"

# Push to remote
git push origin main
```

---

### **Step 3: Team Communication** 📢

Send this message to your team:

```
🔒 CRITICAL SECURITY UPDATE

We've removed exposed API keys from the codebase.

ACTION REQUIRED for ALL developers:

1. Pull latest main:
   git checkout main
   git pull origin main

2. Rebase your feature branch:
   git checkout <your-branch>
   git rebase main

3. Remove IPA files locally:
   Remove-Item -Recurse -Force frontend/ios/IPA-*
   Remove-Item frontend/ios/**/*.ipa -Force

4. Continue working normally

❌ DO NOT:
- Merge old branches into new ones
- Cherry-pick commits from before this fix
- Try to recover deleted IPA files

See: SECURITY_REMEDIATION.md for details
```

---

### **Step 4: Protect Main Branch** 🔒

On GitHub:
1. Settings → Branches → Branch protection rules
2. Add rule for `main`:
   - ✅ Require pull request reviews
   - ✅ Require status checks to pass (if CI is set up)
   - ✅ Include administrators (so even admins follow the rules)

---

### **Step 5: OPTIONAL - Update All Local Branches Automatically**

If you want to update ALL your local branches:

```powershell
.\scripts\apply-security-to-all-branches.ps1
```

**Warning:** This will take time and may have merge conflicts in old branches.

---

## 🎯 Alternative: The Nuclear Option

If you want to **completely remove files from Git history** (so they never existed):

### Using BFG Repo-Cleaner (SAFEST):

```powershell
# 1. Install BFG (download from https://rtyley.github.io/bfg-repo-cleaner/)
# Or use Chocolatey: choco install bfg-repo-cleaner

# 2. Clone a fresh copy (backup!)
cd C:\temp
git clone --mirror https://github.com/your-org/Wellness-Buddy-PWA.git

# 3. Remove all IPA files from history
cd Wellness-Buddy-PWA.git
bfg --delete-files "*.ipa"
bfg --delete-files "*.xcarchive"
bfg --delete-folders "IPA-*"

# 4. Clean up
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5. Force push (⚠️ DESTRUCTIVE - coordinate with team!)
git push --force --all
```

**⚠️ WARNING:** This rewrites ALL branches. Everyone must re-clone the repo!

---

## 📊 Which Approach Should You Use?

| Approach | Pros | Cons | Recommended For |
|----------|------|------|-----------------|
| **Forward-Only** | Safe, no history rewrite, team-friendly | Old branches still have IPA files | ✅ Most teams |
| **Update All Branches** | All branches cleaned | Time-consuming, potential conflicts | Medium urgency |
| **BFG Nuclear** | Complete removal from history | Everyone must re-clone, risky | High security requirements |

---

## ✅ Current Status

After running these steps, you will have:

- ✅ Current branch: IPA files removed, .gitignore updated
- ✅ `.gitattributes`: Prevents future IPA commits
- ✅ `main` branch: Clean and secure
- ✅ Documentation: Complete security remediation guide
- ✅ All new branches: Will inherit the fixes from `main`

---

## 🔍 Verify It Worked

```powershell
# Check current branch has no IPA files
Get-ChildItem -Path . -Filter "*.ipa" -Recurse -ErrorAction SilentlyContinue

# Should return: Nothing

# Check .gitignore blocks IPA
git check-ignore frontend/ios/App.ipa
# Should return: frontend/ios/App.ipa (means it's blocked)

# Check what's staged
git status

# Check main is clean
git checkout main
Get-ChildItem -Path . -Filter "*.ipa" -Recurse -ErrorAction SilentlyContinue
# Should return: Nothing
```

---

## 🆘 If Team Members Have Issues

### "I have merge conflicts after rebasing"

```powershell
# If IPA files cause conflicts:
git checkout --theirs frontend/ios/IPA-*
git rm -rf frontend/ios/IPA-*
git rebase --continue
```

### "My branch still has IPA files"

```powershell
# Rebase on main (gets the security fixes)
git checkout main
git pull origin main
git checkout <your-branch>
git rebase main

# Manually remove if still present
Remove-Item -Recurse -Force frontend/ios/IPA-*
git add -u
git commit -m "fix(security): remove IPA files per security remediation"
```

---

## 📚 Related Documentation

- **Quick deployment:** [QUICK_START.md](../QUICK_START.md)
- **Full security analysis:** [SECURITY_REMEDIATION.md](SECURITY_REMEDIATION.md)
- **Local development:** [LOCAL_DEVELOPMENT.md](../LOCAL_DEVELOPMENT.md)
- **Git history cleanup:** [GIT_CLEANUP_COMMANDS.md](GIT_CLEANUP_COMMANDS.md)

---

**Bottom Line:** Secure `main` branch, have everyone rebase on it, and move forward. Old branches with IPA files can stay archived—just don't merge them into new work.
