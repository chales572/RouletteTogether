@echo off
echo Starting Roulette Together Server...
cd /d %~dp0
call npx ts-node index.ts
pause
