@echo off
REM ========================================
REM Wellness Buddy - Camera Photo Detection
REM Build and Deploy Script
REM ========================================

echo.
echo ========================================
echo  Wellness Buddy Build Script
echo  Building with Camera Photo Detection
echo ========================================
echo.

cd /d "%~dp0frontend"

REM Check if we're in the right directory
if not exist "package.json" (
    echo ERROR: package.json not found!
    echo Make sure you're running this from the project root.
    pause
    exit /b 1
)

echo [1/6] Installing dependencies...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed!
    pause
    exit /b 1
)

echo.
echo [2/6] Building React app...
call npm run build
if errorlevel 1 (
    echo ERROR: React build failed!
    pause
    exit /b 1
)

echo.
echo [3/6] Syncing with Capacitor...
call npx cap sync android
if errorlevel 1 (
    echo ERROR: Capacitor sync failed!
    pause
    exit /b 1
)

echo.
echo [4/6] Copying assets...
call npx cap copy android
if errorlevel 1 (
    echo ERROR: Capacitor copy failed!
    pause
    exit /b 1
)

echo.
echo [5/6] Building Android APK (Debug)...
cd android
call gradlew clean assembleDebug
if errorlevel 1 (
    echo ERROR: Android build failed!
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo [6/6] Locating APK...
set APK_PATH=android\app\build\outputs\apk\debug\app-debug.apk
if exist "%APK_PATH%" (
    echo.
    echo ========================================
    echo  BUILD SUCCESSFUL!
    echo ========================================
    echo.
    echo APK Location: %APK_PATH%
    echo.
    echo Features Included:
    echo   [x] Camera Photo Detection
    echo   [x] Real-time FileObserver monitoring
    echo   [x] Native notifications with Admit/No buttons
    echo   [x] Background service with auto-restart
    echo   [x] Battery-efficient implementation
    echo.
    
    REM Check if device is connected
    adb devices > nul 2>&1
    if %errorlevel% equ 0 (
        echo Do you want to install on connected device? (Y/N)
        set /p INSTALL=
        if /i "%INSTALL%"=="Y" (
            echo.
            echo Installing APK...
            adb install -r "%APK_PATH%"
            if errorlevel 1 (
                echo ERROR: Installation failed!
                echo Make sure device is connected and USB debugging is enabled.
            ) else (
                echo.
                echo ========================================
                echo  INSTALLATION SUCCESSFUL!
                echo ========================================
                echo.
                echo Testing Steps:
                echo   1. Open Wellness Buddy app
                echo   2. Open your phone's Camera app
                echo   3. Take a photo of food
                echo   4. Wait 1-2 seconds
                echo   5. Check notification bar
                echo   6. Tap "Admit" to test
                echo.
                echo Debug Logs:
                echo   adb logcat -s CameraMonitorService
                echo   adb logcat -s FoodDetectionReceiver
                echo.
            )
        )
    )
) else (
    echo ERROR: APK not found at %APK_PATH%
)

echo.
echo ========================================
echo  Build process completed
echo ========================================
echo.
pause
