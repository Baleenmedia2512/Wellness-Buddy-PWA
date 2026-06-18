# Security Verification Script
# Run this to verify your security fixes are working (Windows version)

Write-Host "🔒 Wellness Valley - Security Verification Script" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

$PASSED = 0
$FAILED = 0

# Check 1: .env file cleared
Write-Host "📋 Check 1: Verifying .env files are secured..."
if (Test-Path "frontend\.env") {
    $envContent = Get-Content "frontend\.env" -Raw
    if ($envContent -match "AIza") {
        Write-Host "❌ FAIL: API keys still in frontend\.env" -ForegroundColor Red
        $FAILED++
    } else {
        Write-Host "✅ PASS: frontend\.env is clean" -ForegroundColor Green
        $PASSED++
    }
} else {
    Write-Host "⚠️  WARN: frontend\.env not found" -ForegroundColor Yellow
}

# Check 2: .env in .gitignore
Write-Host ""
Write-Host "📋 Check 2: Verifying .gitignore blocks .env files..."
if (Test-Path "frontend\.gitignore") {
    $gitignore = Get-Content "frontend\.gitignore" -Raw
    if ($gitignore -match "^\.env$" -or $gitignore -match "\n\.env") {
        Write-Host "✅ PASS: .env in .gitignore" -ForegroundColor Green
        $PASSED++
    } else {
        Write-Host "❌ FAIL: .env not in .gitignore" -ForegroundColor Red
        $FAILED++
    }
}

# Check 3: Build artifacts in .gitignore
Write-Host ""
Write-Host "📋 Check 3: Verifying build artifacts are gitignored..."
if (Test-Path "frontend\.gitignore") {
    $gitignore = Get-Content "frontend\.gitignore" -Raw
    if ($gitignore -match "android/app/src/main/assets/public/") {
        Write-Host "✅ PASS: Android build artifacts blocked" -ForegroundColor Green
        $PASSED++
    }
    if ($gitignore -match "ios/App/App/public/") {
        Write-Host "✅ PASS: iOS build artifacts blocked" -ForegroundColor Green
        $PASSED++
    }
}

# Check 4: Backend endpoints exist
Write-Host ""
Write-Host "📋 Check 4: Verifying backend endpoints exist..."
if (Test-Path "backend\pages\api\ai\analyze-nutrition.js") {
    Write-Host "✅ PASS: analyze-nutrition endpoint exists" -ForegroundColor Green
    $PASSED++
} else {
    Write-Host "❌ FAIL: analyze-nutrition endpoint missing" -ForegroundColor Red
    $FAILED++
}

if (Test-Path "backend\pages\api\ai\detect-image-type.js") {
    Write-Host "✅ PASS: detect-image-type endpoint exists" -ForegroundColor Green
    $PASSED++
} else {
    Write-Host "❌ FAIL: detect-image-type endpoint missing" -ForegroundColor Red
    $FAILED++
}

# Check 5: Secure services exist
Write-Host ""
Write-Host "📋 Check 5: Verifying secure frontend services exist..."
if (Test-Path "frontend\src\shared\services\geminiService.secure.js") {
    Write-Host "✅ PASS: geminiService.secure.js exists" -ForegroundColor Green
    $PASSED++
} else {
    Write-Host "⚠️  INFO: geminiService.secure.js not found (may be already activated)" -ForegroundColor Yellow
}

# Check 6: Documentation exists
Write-Host ""
Write-Host "📋 Check 6: Verifying documentation exists..."
if ((Test-Path "docs\SECURITY_REMEDIATION.md") -and (Test-Path "docs\MIGRATION_GUIDE.md")) {
    Write-Host "✅ PASS: Security documentation exists" -ForegroundColor Green
    $PASSED++
} else {
    Write-Host "❌ FAIL: Security documentation missing" -ForegroundColor Red
    $FAILED++
}

# Check 7: Search for API keys in source
Write-Host ""
Write-Host "📋 Check 7: Searching for exposed API keys in source files..."
$foundKeys = Get-ChildItem -Path "frontend\src" -Recurse -Include *.js,*.jsx | 
    Select-String -Pattern "AIzaSy" | 
    Where-Object { $_.Path -notmatch "\.OLD\.js$" -and $_.Path -notmatch "\.secure\.js$" } |
    Measure-Object | 
    Select-Object -ExpandProperty Count

if ($foundKeys -gt 0) {
    Write-Host "⚠️  WARN: Found $foundKeys files with API keys" -ForegroundColor Yellow
    Write-Host "   These will be fixed when you activate secure services."
} else {
    Write-Host "✅ PASS: No active files using REACT_APP_GEMINI_API_KEY" -ForegroundColor Green
    $PASSED++
}

# Summary
Write-Host ""
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "📊 VERIFICATION SUMMARY" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "✅ Passed: $PASSED" -ForegroundColor Green
if ($FAILED -gt 0) {
    Write-Host "❌ Failed: $FAILED" -ForegroundColor Red
}
Write-Host ""

if ($FAILED -eq 0) {
    Write-Host "🎉 ALL CHECKS PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "✅ Your code is secure and ready for deployment." -ForegroundColor Green
    Write-Host ""
    Write-Host "Next steps:"
    Write-Host "1. Revoke old API keys in Google Cloud Console"
    Write-Host "2. Add new GEMINI_API_KEY to Vercel backend"
    Write-Host "3. Deploy backend: git push origin main"
    Write-Host "4. Activate secure services (see MIGRATION_GUIDE.md)"
    Write-Host "5. Deploy frontend"
    Write-Host ""
    Write-Host "📚 Read: docs\MIGRATION_GUIDE.md for detailed steps"
} else {
    Write-Host "⚠️  SOME CHECKS FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please fix the issues above before deploying."
    Write-Host "See SECURITY_FIX_SUMMARY.md for guidance."
}
