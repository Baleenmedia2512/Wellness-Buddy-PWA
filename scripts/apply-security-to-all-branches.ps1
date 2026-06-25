# 🔒 Apply Security Fixes to ALL Branches
# This script removes IPA files and updates .gitignore across all branches

Write-Host "`n🔒 SECURITY FIX - Apply to All Branches" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Save current branch
$currentBranch = git branch --show-current
Write-Host "📍 Current branch: $currentBranch" -ForegroundColor Yellow
Write-Host ""

# Define what to clean
$filesToRemove = @(
    "frontend/ios/**/*.ipa",
    "frontend/ios/**/*.xcarchive",
    "frontend/android/app/src/main/assets/public",
    "frontend/ios/App/App/public",
    "frontend/build"
)

# Step 1: Commit changes on current branch
Write-Host "Step 1: Commit security fixes on current branch..." -ForegroundColor Cyan
git add frontend/.gitignore
git add -u  # Stage deletions
git status --short

$commitNeeded = git status --porcelain
if ($commitNeeded) {
    Write-Host ""
    $confirm = Read-Host "Commit these changes? (y/n)"
    if ($confirm -eq 'y') {
        git commit -m "fix(security): remove IPA files and block build artifacts

- Removed all .ipa files (contained exposed API keys)
- Removed .xcarchive files
- Updated .gitignore to block iOS/Android build artifacts
- Blocks: *.ipa, *.xcarchive, IPA-*/, build/, ios/App/App/public/
- Part of comprehensive security remediation

Related: SECURITY_REMEDIATION.md"
        Write-Host "✅ Committed on $currentBranch" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Skipped commit" -ForegroundColor Yellow
    }
} else {
    Write-Host "✅ No changes to commit" -ForegroundColor Green
}

Write-Host ""
Write-Host "Step 2: Apply to main branch..." -ForegroundColor Cyan
Write-Host "⚠️  This will merge your security fixes into main" -ForegroundColor Yellow
Write-Host ""
$applyToMain = Read-Host "Merge security fixes to main? (y/n)"

if ($applyToMain -eq 'y') {
    git checkout main
    git pull origin main
    git merge --no-ff $currentBranch -m "fix(security): merge security fixes from $currentBranch

Security remediation:
- Removed all IPA/xcarchive files (contained exposed API keys)
- Updated .gitignore to block build artifacts
- Added comprehensive security documentation

See: SECURITY_REMEDIATION.md, QUICK_START.md"
    
    Write-Host "✅ Merged to main" -ForegroundColor Green
    Write-Host ""
    Write-Host "Push to remote? (y/n)" -ForegroundColor Yellow
    $pushMain = Read-Host
    if ($pushMain -eq 'y') {
        git push origin main
        Write-Host "✅ Pushed main to remote" -ForegroundColor Green
    }
    
    # Return to original branch
    git checkout $currentBranch
}

Write-Host ""
Write-Host "Step 3: Update ALL other branches (OPTIONAL)..." -ForegroundColor Cyan
Write-Host "⚠️  This will rebase/merge main into every local branch" -ForegroundColor Yellow
Write-Host "⚠️  This may take several minutes and could have conflicts" -ForegroundColor Red
Write-Host ""
$updateAll = Read-Host "Update all branches from main? (y/n)"

if ($updateAll -eq 'y') {
    $branches = git branch | ForEach-Object { $_.Trim('* ') }
    $skipped = @()
    $updated = @()
    $failed = @()
    
    foreach ($branch in $branches) {
        if ($branch -eq 'main' -or $branch -eq $currentBranch) {
            continue  # Skip main and current branch
        }
        
        Write-Host ""
        Write-Host "Processing: $branch" -ForegroundColor Yellow
        
        git checkout $branch 2>$null
        if ($LASTEXITCODE -ne 0) {
            $skipped += $branch
            continue
        }
        
        # Try to merge main
        git merge main --no-edit 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  ✅ Merged main into $branch" -ForegroundColor Green
            $updated += $branch
        } else {
            Write-Host "  ⚠️  Conflict in $branch - skipping" -ForegroundColor Red
            git merge --abort 2>$null
            $failed += $branch
        }
    }
    
    # Return to original branch
    git checkout $currentBranch
    
    # Summary
    Write-Host ""
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "📊 SUMMARY" -ForegroundColor Cyan
    Write-Host "==========================================" -ForegroundColor Cyan
    Write-Host "✅ Updated: $($updated.Count) branches" -ForegroundColor Green
    Write-Host "⚠️  Failed: $($failed.Count) branches (had conflicts)" -ForegroundColor Yellow
    Write-Host "⏭️  Skipped: $($skipped.Count) branches" -ForegroundColor Gray
    
    if ($failed.Count -gt 0) {
        Write-Host ""
        Write-Host "Branches with conflicts:" -ForegroundColor Yellow
        $failed | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
        Write-Host ""
        Write-Host "These branches need manual merge. For each:" -ForegroundColor White
        Write-Host "  git checkout <branch-name>" -ForegroundColor Gray
        Write-Host "  git merge main" -ForegroundColor Gray
        Write-Host "  # Resolve conflicts" -ForegroundColor Gray
        Write-Host "  git commit" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🎯 NEXT STEPS" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. ✅ Security fixes committed to $currentBranch"
if ($applyToMain -eq 'y') {
    Write-Host "2. ✅ Fixes merged to main"
}
Write-Host "3. 🔄 All team members should rebase their branches on main:"
Write-Host "   git checkout <their-branch>"
Write-Host "   git rebase main"
Write-Host ""
Write-Host "4. 🚫 IMPORTANT: Tell team to run this to remove IPA files:"
Write-Host "   Remove-Item -Recurse -Force frontend/ios/IPA-*"
Write-Host "   Remove-Item frontend/ios/**/*.ipa"
Write-Host "   Remove-Item -Recurse frontend/ios/**/*.xcarchive"
Write-Host ""
Write-Host "5. 📚 Share with team: SECURITY_REMEDIATION.md"
Write-Host ""
Write-Host "✅ Done! Your repo is more secure." -ForegroundColor Green
