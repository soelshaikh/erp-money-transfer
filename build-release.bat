@echo off
setlocal

echo.
echo ================================================
echo   ERP Money Transfer — Release APK Builder
echo ================================================
echo.

:: ── Navigate to mobile directory ──────────────────
cd /d "%~dp0mobile"
if errorlevel 1 (
  echo ERROR: Could not find mobile directory.
  pause & exit /b 1
)

:: ── Prebuild (clean) ──────────────────────────────
echo [1/3] Running expo prebuild --clean ...
call npx expo prebuild --clean
if errorlevel 1 (
  echo ERROR: expo prebuild failed.
  pause & exit /b 1
)
echo.

:: ── Restore local.properties (wiped by prebuild) ──
echo [2/3] Restoring android/local.properties ...
(
  echo sdk.dir=C\:\\Users\\USER\\AppData\\Local\\Android\\Sdk
) > android\local.properties
echo Done.
echo.

:: ── Gradle assembleRelease ────────────────────────
echo [3/3] Building release APK ...
cd android
call gradlew.bat assembleRelease
if errorlevel 1 (
  echo.
  echo ERROR: Gradle build failed. Check output above.
  pause & exit /b 1
)

:: ── Done ──────────────────────────────────────────
echo.
echo ================================================
echo   BUILD SUCCESS
echo   APK: mobile\android\app\build\outputs\apk\release\app-release.apk
echo ================================================
echo.
pause
endlocal
