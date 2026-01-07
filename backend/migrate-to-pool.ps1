# Bulk Migration Script - Convert all APIs to use Connection Pool
# This fixes ETIMEDOUT errors across all endpoints

Write-Host "Starting bulk API migration to connection pool..." -ForegroundColor Green

# Files to migrate (most critical first)
$criticalFiles = @(
    "pages/api/get-background-analysis.js",
    "pages/api/save-background-analysis.js",
    "pages/api/get-user-context.js",
    "pages/api/save-weight-entry.js",
    "pages/api/get-weight-history.js",
    "pages/api/save-education-log.js",
    "pages/api/get-education-logs.js",
    "pages/api/user-nutrition-stats.js",
    "pages/api/get-food-corrections.js",
    "pages/api/save-food-correction.js",
    "pages/api/update-nutrition-analysis.js",
    "pages/api/save-google-user.js",
    "pages/api/send-otp.js",
    "pages/api/verify-otp.js",
    "pages/api/get-token-usage.js",
    "pages/api/user/status.js",
    "pages/api/users/search.js",
    "pages/api/team/claim-id.js",
    "pages/api/team/check-availability.js",
    "pages/api/upline/request.js",
    "pages/api/upline/validate-otp.js",
    "pages/api/upline/cancel-request.js",
    "pages/api/coach/discipline-report.js",
    "pages/api/delete-background-analysis.js",
    "pages/api/delete-weight-entry.js",
    "pages/api/delete-education-log.js",
    "pages/api/undo-deleted-analysis.js",
    "pages/api/undo-deleted-weight-entry.js",
    "pages/api/undo-deleted-education-log.js",
    "pages/api/admin/time-windows.js"
)

$updatedCount = 0
$errorCount = 0

foreach ($file in $criticalFiles) {
    if (Test-Path $file) {
        try {
            Write-Host "Processing: $file" -ForegroundColor Cyan
            
            $content = Get-Content $file -Raw -Encoding UTF8
            $original = $content
            
            # Step 1: Update import statement
            if ($content -match "import mysql from 'mysql2/promise';") {
                $content = $content -replace "import mysql from 'mysql2/promise';", "import { getPool } from '../../utils/dbPool.js';"
                Write-Host "  OK Updated import" -ForegroundColor Gray
            }
            
            # Step 2: Replace connection creation
            $content = $content -replace "const connection = await mysql\.createConnection\([^)]+\);(\s*console\.log[^;]+;)?", 'const pool = getPool();'
            $content = $content -replace "connection = await mysql\.createConnection\([^)]+\);(\s*console\.log[^;]+;)?", 'const pool = getPool();'
            $content = $content -replace "let connection;\s*try\s*\{\s*connection = await mysql\.createConnection\([^)]+\);", 'try { const pool = getPool();'
            
            # Step 3: Replace connection.execute with pool.execute
            $content = $content -replace "\bconnection\.execute\(", "pool.execute("
            
            # Step 4: Remove connection.end() calls
            $content = $content -replace "\s*await connection\.end\(\);?\s*", "`n"
            $content = $content -replace "\s*if \(connection\) await connection\.end\(\);?\s*", "`n"
            $content = $content -replace "\s*try \{ await connection\.end\(\); \} catch \{\}\s*", "`n"
            
            # Step 5: Update variable declarations
            $content = $content -replace "let connection;", ""
            
            # Only write if changes were made
            if ($content -ne $original) {
                Set-Content $file $content -Encoding UTF8 -NoNewline
                Write-Host "  SUCCESS Successfully updated" -ForegroundColor Green
                $updatedCount++
            } else {
                Write-Host "  WARNING No changes needed (already updated or different pattern)" -ForegroundColor Yellow
            }
        }
        catch {
            Write-Host "  ERROR: $($_.Exception.Message)" -ForegroundColor Red
            $errorCount++
        }
    }
    else {
        Write-Host "  WARNING File not found: $file" -ForegroundColor Yellow
    }
}

Write-Host "`n" -NoNewline
Write-Host "============================================================" -ForegroundColor Gray
Write-Host "Migration Complete!" -ForegroundColor Green
Write-Host "   Files updated: $updatedCount" -ForegroundColor Cyan
Write-Host "   Errors: $errorCount" -ForegroundColor $(if ($errorCount -eq 0) { "Green" } else { "Red" })
Write-Host "============================================================" -ForegroundColor Gray
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Review the changes: git diff" -ForegroundColor White
Write-Host "2. Test locally if possible" -ForegroundColor White
Write-Host "3. Commit: git add . && git commit -m 'fix: migrate all APIs to connection pool'" -ForegroundColor White
Write-Host "4. Deploy: git push" -ForegroundColor White
Write-Host "`nETIMEDOUT errors should be dramatically reduced!" -ForegroundColor Green
