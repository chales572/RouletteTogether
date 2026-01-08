@echo off
echo Starting Roulette Together Client...
cd /d %~dp0
echo.
echo Building client...
call npm run build
echo.
echo Starting web server...
call node serve.js
pause
