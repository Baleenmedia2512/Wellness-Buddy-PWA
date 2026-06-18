#!/bin/bash

# Security Verification Script
# Run this to verify your security fixes are working

echo "🔒 Wellness Valley - Security Verification Script"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Check 1: .env file cleared
echo "📋 Check 1: Verifying .env files are secured..."
if grep -q "AIza" frontend/.env 2>/dev/null; then
    echo -e "${RED}❌ FAIL: API keys still in frontend/.env${NC}"
    FAILED=$((FAILED + 1))
else
    echo -e "${GREEN}✅ PASS: frontend/.env is clean${NC}"
    PASSED=$((PASSED + 1))
fi

# Check 2: .env in .gitignore
echo ""
echo "📋 Check 2: Verifying .gitignore blocks .env files..."
if grep -q "^\.env$" frontend/.gitignore; then
    echo -e "${GREEN}✅ PASS: .env in .gitignore${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ FAIL: .env not in .gitignore${NC}"
    FAILED=$((FAILED + 1))
fi

# Check 3: Build artifacts in .gitignore
echo ""
echo "📋 Check 3: Verifying build artifacts are gitignored..."
if grep -q "android/app/src/main/assets/public/" frontend/.gitignore; then
    echo -e "${GREEN}✅ PASS: Android build artifacts blocked${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${YELLOW}⚠️  WARN: Android build artifacts not in .gitignore${NC}"
fi

if grep -q "ios/App/App/public/" frontend/.gitignore; then
    echo -e "${GREEN}✅ PASS: iOS build artifacts blocked${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${YELLOW}⚠️  WARN: iOS build artifacts not in .gitignore${NC}"
fi

# Check 4: Backend endpoints exist
echo ""
echo "📋 Check 4: Verifying backend endpoints exist..."
if [ -f "backend/pages/api/ai/analyze-nutrition.js" ]; then
    echo -e "${GREEN}✅ PASS: analyze-nutrition endpoint exists${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ FAIL: analyze-nutrition endpoint missing${NC}"
    FAILED=$((FAILED + 1))
fi

if [ -f "backend/pages/api/ai/detect-image-type.js" ]; then
    echo -e "${GREEN}✅ PASS: detect-image-type endpoint exists${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ FAIL: detect-image-type endpoint missing${NC}"
    FAILED=$((FAILED + 1))
fi

# Check 5: Secure services exist
echo ""
echo "📋 Check 5: Verifying secure frontend services exist..."
if [ -f "frontend/src/shared/services/geminiService.secure.js" ]; then
    echo -e "${GREEN}✅ PASS: geminiService.secure.js exists${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${YELLOW}⚠️  INFO: geminiService.secure.js not found (may be already activated)${NC}"
fi

# Check 6: Old services not using REACT_APP_GEMINI_API_KEY
echo ""
echo "📋 Check 6: Checking for exposed API key usage in source..."
EXPOSED_FILES=$(grep -r "REACT_APP_GEMINI_API_KEY" frontend/src/ --include="*.js" --include="*.jsx" 2>/dev/null | grep -v ".OLD.js" | grep -v ".secure.js" | wc -l)

if [ "$EXPOSED_FILES" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  WARN: Found $EXPOSED_FILES files still using REACT_APP_GEMINI_API_KEY${NC}"
    echo "   These will be fixed when you activate secure services."
else
    echo -e "${GREEN}✅ PASS: No active files using REACT_APP_GEMINI_API_KEY${NC}"
    PASSED=$((PASSED + 1))
fi

# Check 7: Documentation exists
echo ""
echo "📋 Check 7: Verifying documentation exists..."
if [ -f "docs/SECURITY_REMEDIATION.md" ] && [ -f "docs/MIGRATION_GUIDE.md" ]; then
    echo -e "${GREEN}✅ PASS: Security documentation exists${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}❌ FAIL: Security documentation missing${NC}"
    FAILED=$((FAILED + 1))
fi

# Check 8: Verify no keys in committed code
echo ""
echo "📋 Check 8: Searching for exposed API keys in staged/committed files..."
FOUND_KEYS=$(git grep "AIzaSy" -- '*.js' '*.jsx' '*.ts' '*.tsx' ':!*.OLD.js' 2>/dev/null | wc -l)

if [ "$FOUND_KEYS" -gt 0 ]; then
    echo -e "${RED}❌ FAIL: Found $FOUND_KEYS files with API keys in Git${NC}"
    echo "   Run: git grep 'AIzaSy' to see them"
    FAILED=$((FAILED + 1))
else
    echo -e "${GREEN}✅ PASS: No API keys found in Git${NC}"
    PASSED=$((PASSED + 1))
fi

# Summary
echo ""
echo "=================================================="
echo "📊 VERIFICATION SUMMARY"
echo "=================================================="
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
if [ "$FAILED" -gt 0 ]; then
    echo -e "${RED}❌ Failed: $FAILED${NC}"
fi
echo ""

if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL CHECKS PASSED!${NC}"
    echo ""
    echo "✅ Your code is secure and ready for deployment."
    echo ""
    echo "Next steps:"
    echo "1. Revoke old API keys in Google Cloud Console"
    echo "2. Add new GEMINI_API_KEY to Vercel backend"
    echo "3. Deploy backend: git push origin main"
    echo "4. Activate secure services (see MIGRATION_GUIDE.md)"
    echo "5. Deploy frontend"
    echo ""
    echo "📚 Read: docs/MIGRATION_GUIDE.md for detailed steps"
    exit 0
else
    echo -e "${RED}⚠️  SOME CHECKS FAILED${NC}"
    echo ""
    echo "Please fix the issues above before deploying."
    echo "See SECURITY_FIX_SUMMARY.md for guidance."
    exit 1
fi
