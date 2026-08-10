@echo off
setlocal

echo.
echo ================================================
echo   ERP Money Transfer -- Release APK Builder
echo ================================================
echo.

:: ── Navigate to mobile directory ──────────────────
cd /d "%~dp0mobile"
if errorlevel 1 (
  echo ERROR: Could not find mobile directory.
  pause & exit /b 1
)

:: ── Kill Gradle / Java ────────────────────────────
echo [0/3] Releasing locks on android folder ...
if exist "android\gradlew.bat" (
  cd android
  call gradlew.bat --stop >nul 2>&1
  cd ..
)
taskkill /F /IM java.exe   >nul 2>&1
taskkill /F /IM javaw.exe  >nul 2>&1

:: Stop Windows Search Indexer (most common folder lock culprit)
net stop "Windows Search" >nul 2>&1

:: Wait for handles to release
ping -n 4 127.0.0.1 >nul

:: Force-delete android folder
if exist "android" (
  echo Deleting android folder ...
  rd /s /q android
  if exist "android" (
    echo.
    echo ERROR: Could not delete android folder.
    echo Something is still locking it. Try:
    echo   1. Close any terminal windows open inside the android folder
    echo   2. Open Task Manager and end any remaining java.exe processes
    echo   3. Run this script as Administrator
    echo.
    net start "Windows Search" >nul 2>&1
    pause & exit /b 1
  )
)
echo Done.
echo.

:: ── Prebuild ──────────────────────────────────────
echo [1/3] Running expo prebuild ...
call npx expo prebuild
if errorlevel 1 (
  net start "Windows Search" >nul 2>&1
  echo ERROR: expo prebuild failed.
  pause & exit /b 1
)
echo.

:: ── Restore local.properties ──────────────────────
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
  cd ..
  net start "Windows Search" >nul 2>&1
  echo.
  echo ERROR: Gradle build failed. Check output above.
  pause & exit /b 1
)
cd ..

:: ── Restart Windows Search ────────────────────────
net start "Windows Search" >nul 2>&1

:: ── Done ──────────────────────────────────────────
echo.
echo ================================================
echo   BUILD SUCCESS
echo   APK: mobile\android\app\build\outputs\apk\release\app-release.apk
echo ================================================
echo.
pause
endlocal
