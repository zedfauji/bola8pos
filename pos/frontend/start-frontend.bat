@echo off
set NODE_ENV=development
set PORT=3000
set VITE_API_URL=http://localhost:3001/api
set BROWSER=none

cd /d %~dp0
call npm run dev
