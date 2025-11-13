@echo off
echo ========================================
echo Setting up weight_records_table
echo ========================================

REM Set your MySQL credentials
set MYSQL_USER=root
set MYSQL_PASS=Easy@2Work@123
set MYSQL_DB=baleeed5_wellness
set MYSQL_PATH=c:\xampp\mysql\bin\mysql.exe

echo.
echo Creating weight_records_table in database: %MYSQL_DB%
echo.

REM Execute the SQL file
"%MYSQL_PATH%" -u %MYSQL_USER% -p%MYSQL_PASS% %MYSQL_DB% < sql\create_weight_records_table.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ SUCCESS: weight_records_table created successfully!
    echo.
) else (
    echo.
    echo ❌ ERROR: Failed to create table. Please check your database credentials.
    echo.
)

pause
