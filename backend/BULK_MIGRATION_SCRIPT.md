# Bulk API Migration Script

## Quick Fix for All ETIMEDOUT Errors

Run this PowerShell script to migrate all APIs to use connection pool:

```powershell
# Navigate to backend
cd backend/pages/api

# List of files to update
$files = @(
    "get-background-analysis.js",
    "save-background-analysis.js",
    "delete-background-analysis.js",
    "undo-deleted-analysis.js",
    "get-user-context.js",
    "save-weight-entry.js",
    "get-weight-history.js",
    "delete-weight-entry.js",
    "undo-deleted-weight-entry.js",
    "save-education-log.js",
    "get-education-logs.js",
    "delete-education-log.js",
    "undo-deleted-education-log.js",
    "get-food-corrections.js",
    "save-food-correction.js",
    "update-nutrition-analysis.js",
    "user-nutrition-stats.js",
    "save-google-user.js",
    "send-otp.js",
    "verify-otp.js",
    "get-token-usage.js",
    "service-health.js",
    "test-db.js",
    "user/status.js",
    "users/search.js",
    "team/claim-id.js",
    "team/check-availability.js",
    "upline/request.js",
    "upline/validate-otp.js",
    "upline/cancel-request.js",
    "admin/time-windows.js",
    "coach/discipline-report.js"
)

# For each file, replace the import and connection pattern
foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Processing $file..."
        
        # Read content
        $content = Get-Content $file -Raw
        
        # Replace import
        $content = $content -replace "import mysql from 'mysql2/promise';", "import { getPool } from '../../utils/dbPool.js';"
        
        # Replace connection creation patterns
        $content = $content -replace "const connection = await mysql\.createConnection\([^)]+\);", "const pool = getPool();"
        $content = $content -replace "connection = await mysql\.createConnection\([^)]+\);", "const pool = getPool();"
        
        # Replace connection.execute with pool.execute
        $content = $content -replace "connection\.execute\(", "pool.execute("
        
        # Remove connection.end() calls
        $content = $content -replace "await connection\.end\(\);[\r\n]*", ""
        $content = $content -replace "if \(connection\) await connection\.end\(\);[\r\n]*", ""
        $content = $content -replace "try \{ await connection\.end\(\); \} catch \{\}[\r\n]*", ""
        
        # Write back
        Set-Content $file $content -NoNewline
        
        Write-Host "✓ Updated $file"
    }
}

Write-Host "`nDone! All APIs migrated to connection pool."
```

## Manual Alternative

If script doesn't work, manually do this for each file:

### 1. Replace import
```javascript
// OLD:
import mysql from 'mysql2/promise';

// NEW:
import { getPool } from '../../utils/dbPool.js';
```

### 2. Replace connection creation
```javascript
// OLD:
const connection = await mysql.createConnection({...});

// NEW:
const pool = getPool();
```

### 3. Replace all connection.execute
```javascript
// OLD:
await connection.execute(query, params);

// NEW:
await pool.execute(query, params);
```

### 4. Remove all connection.end()
```javascript
// DELETE THESE LINES:
await connection.end();
if (connection) await connection.end();
try { await connection.end(); } catch {}
```

## After Migration

Commit and push:
```bash
git add backend/
git commit -m "fix: migrate all APIs to connection pool to resolve ETIMEDOUT errors"
git push
```
