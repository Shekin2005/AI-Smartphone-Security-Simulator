@echo off
REM ==================================================
REM  SHANNON BRIDGE - double-click to start
REM ==================================================
REM  Leave this window open while you use the Shannon
REM  engine on the AI Pentest screen. Closing it stops
REM  the bridge; the in-container agent keeps working.
REM ==================================================

title Shannon bridge - leave this window open

cd /d "%~dp0.."

echo.
echo Starting the Shannon bridge...
echo.

node tools\start-shannon.mjs

echo.
echo The bridge stopped. Press any key to close.
pause >nul
