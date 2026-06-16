# Git Cleanup Commands - Remove Exposed API Keys

⚠️ **DANGER ZONE:** These commands rewrite Git history!  
Only run this after coordinating with your entire team.

---

## Option 1: BFG Repo Cleaner (Recommended)

### Install BFG
```bash
# macOS
brew install bfg

# Windows
# Download from https://rtyley.github.io/bfg-repo-cleaner/
# Extract bfg.jar

# Linux
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar
mv bfg-1.14.0.jar bfg.jar
```

### Clean the Repository
```bash
# 1. Clone a fresh mirror
git clone --mirror git@github.com:your-org/Wellness-Buddy-PWA.git
cd Wellness-Buddy-PWA.git

# 2. Create replacement file with your exposed keys
cat > passwords.txt << 'EOF'
AIzaSyDtLAmg2N-NTUbKxoJwGHuSRwkojYkeQN0
AIzaSyAJ92i69y8ooAOt_4Br-UXrJBuobz7bryY
EOF

# 3. Run BFG to replace keys with ***REMOVED***
bfg --replace-text passwords.txt

# 4. Clean up the Git repository
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 5. Force push (⚠️ EVERYONE must re-clone after this!)
git push --force

# 6. Clean up
cd ..
rm -rf Wellness-Buddy-PWA.git
rm passwords.txt
```

### Team Instructions After Force Push
Send this to your team:
```
⚠️ Git history was rewritten to remove exposed API keys.

Everyone must:
1. Backup any local uncommitted work
2. Delete your local repo:
   rm -rf Wellness-Buddy-PWA
3. Re-clone from GitHub:
   git clone git@github.com:your-org/Wellness-Buddy-PWA.git
4. Apply your local changes (if any)
```

---

## Option 2: Git Filter-Repo (Alternative)

### Install git-filter-repo
```bash
pip install git-filter-repo
```

### Clean Specific Files
```bash
# 1. Backup your repo first!
cp -r Wellness-Buddy-PWA Wellness-Buddy-PWA.backup

# 2. Remove .env from entire history
cd Wellness-Buddy-PWA
git filter-repo --path frontend/.env --invert-paths --force

# 3. Push changes
git push origin --force --all
git push origin --force --tags
```

---

## Option 3: Manual Commit if History is Not Important

If you just started the project or history doesn't matter:

```bash
# 1. Delete the .git folder
rm -rf .git

# 2. Reinitialize
git init
git add .
git commit -m "feat: initial commit with secure configuration

- Removed all exposed API keys
- Implemented backend proxy for AI services
- Added proper .gitignore rules"

# 3. Force push to remote
git remote add origin git@github.com:your-org/Wellness-Buddy-PWA.git
git push -u origin main --force
```

---

## After Cleaning: Verify

```bash
# Search for any remaining keys
git log -p | grep -i "AIza"

# Should return nothing!
```

---

## ⚠️ Important Notes

1. **Coordinate with team first** - everyone must re-clone
2. **Backup everything** before running these commands
3. **Open PRs will be invalidated** - contributors must rebase
4. **CI/CD might break temporarily** - may need to reconfigure
5. **Protected branches** - you may need to temporarily disable branch protection

---

## Don't Want to Rewrite History?

If you can't rewrite history (large team, production dependencies):

1. **Just revoke the keys immediately** ✅
2. **Document that old keys are inactive** in README
3. **Add this to your repository root:**

```markdown
## ⚠️ Security Notice

API keys found in commits before 2026-06-16 have been REVOKED and are no longer valid.
The repository now uses secure backend proxies. See docs/SECURITY_REMEDIATION.md.
```

4. **Focus on preventing future leaks:**
   - Pre-commit hooks (gitleaks)
   - CI/CD secret scanning
   - Code review process

---

**When in doubt:** Revoking the keys is the most important step.  
Git history cleaning is optional but recommended.
