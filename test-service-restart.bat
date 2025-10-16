@echo off
echo ========================================
echo Testing GalleryMonitor Service Restart
echo ========================================
echo.

echo [Step 1] Checking if device is connected...
adb devices
echo.

echo [Step 2] Checking if app is installed...
adb shell pm list packages | findstr wellnessbuddy
echo.

echo [Step 3] Checking current service status...
adb shell dumpsys activity services com.wellnessbuddy.app | findstr GalleryMonitorService
echo.

echo [Step 4] Force stopping the app...
adb shell am force-stop com.wellnessbuddy.app
echo App force stopped.
echo.

echo [Step 5] Waiting 3 seconds for service restart...
timeout /t 3 /nobreak >nul
echo.

echo [Step 6] Checking if service restarted...
adb shell dumpsys activity services com.wellnessbuddy.app | findstr GalleryMonitorService
echo.

echo [Step 7] Monitoring service logs (Press Ctrl+C to stop)...
echo Looking for: onTaskRemoved, ServiceRestartWorker, onStartCommand
echo ========================================
echo.
adb logcat -s GalleryMonitorService:D ServiceRestartWorker:D MainActivity:D -v time
