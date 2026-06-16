# 🚀 Local Development Startup Script

Write-Host "`n🔒 Wellness Valley - Local Development`n" -ForegroundColor Cyan

# Check if backend .env exists
if (!(Test-Path "backend\.env")) {
    Write-Host "❌ backend/.env not found!" -ForegroundColor Red
    Write-Host "Creating from template..." -ForegroundColor Yellow
    Copy-Item "backend\.env.example" "backend\.env"
    Write-Host "⚠️  Edit backend/.env and add your GEMINI_API_KEY" -ForegroundColor Yellow
    notepad "backend\.env"
    exit 1
}

# Check if frontend .env exists
if (!(Test-Path "frontend\.env")) {
    Write-Host "❌ frontend/.env not found!" -ForegroundColor Red
    Write-Host "Creating from template..." -ForegroundColor Yellow
    Copy-Item "frontend\.env.example" "frontend\.env"
}

# Check for API key in backend
$backendEnv = Get-Content "backend\.env" -Raw
if (!($backendEnv -match "GEMINI_API_KEY=\w+")) {
    Write-Host "❌ GEMINI_API_KEY not configured in backend/.env" -ForegroundColor Red
    Write-Host "Add your key and try again." -ForegroundColor Yellow
    notepad "backend\.env"
    exit 1
}

Write-Host "✅ Configuration validated!`n" -ForegroundColor Green

# Ask which mode
Write-Host "Select development mode:" -ForegroundColor Cyan
Write-Host "  [1] Backend only (port 3000)"
Write-Host "  [2] Frontend only (port 3001) - requires backend running"
Write-Host "  [3] Both (recommended)"
Write-Host ""
$choice = Read-Host "Enter choice (1-3)"

switch ($choice) {
    "1" {
        Write-Host "`n🚀 Starting Backend on http://localhost:3000..." -ForegroundColor Green
        Set-Location backend
        npm run dev
    }
    "2" {
        Write-Host "`n🚀 Starting Frontend on http://localhost:3001..." -ForegroundColor Green
        Write-Host "⚠️  Make sure backend is running on port 3000!" -ForegroundColor Yellow
        
        # Update .env to use local backend
        $frontendEnv = Get-Content "frontend\.env" -Raw
        if ($frontendEnv -notmatch "http://localhost:3000") {
            Write-Host "📝 Updating frontend/.env to use local backend..." -ForegroundColor Yellow
            $frontendEnv = $frontendEnv -replace "REACT_APP_API_BASE_URL=.*", "REACT_APP_API_BASE_URL=http://localhost:3000"
            Set-Content "frontend\.env" $frontendEnv
        }
        
        Set-Location frontend
        $env:PORT = 3001
        npm start
    }
    "3" {
        Write-Host "`n🚀 Starting Both Servers..." -ForegroundColor Green
        Write-Host "  Backend: http://localhost:3000" -ForegroundColor Cyan
        Write-Host "  Frontend: http://localhost:3001" -ForegroundColor Cyan
        Write-Host "`n⚠️  You'll need TWO terminal windows:" -ForegroundColor Yellow
        Write-Host "`nTerminal 1 (Backend):" -ForegroundColor White
        Write-Host "  cd backend" -ForegroundColor Gray
        Write-Host "  npm run dev" -ForegroundColor Gray
        Write-Host "`nTerminal 2 (Frontend):" -ForegroundColor White
        Write-Host "  cd frontend" -ForegroundColor Gray
        Write-Host '  $env:PORT=3001; npm start' -ForegroundColor Gray
        Write-Host "`nPress any key to start Backend in this window..."
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
        
        # Update frontend .env
        $frontendEnv = Get-Content "frontend\.env" -Raw
        if ($frontendEnv -notmatch "http://localhost:3000") {
            Write-Host "`n📝 Updating frontend/.env to use local backend..." -ForegroundColor Yellow
            $frontendEnv = $frontendEnv -replace "REACT_APP_API_BASE_URL=.*", "REACT_APP_API_BASE_URL=http://localhost:3000"
            Set-Content "frontend\.env" $frontendEnv
        }
        
        Set-Location backend
        npm run dev
    }
    default {
        Write-Host "Invalid choice!" -ForegroundColor Red
        exit 1
    }
}
