@echo off
echo Building Android APK with heartbeat worker...
cd frontend\android
call gradlew.bat assembleDebug
echo Build complete!
pause
