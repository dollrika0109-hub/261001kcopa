@echo off
chcp 65001 > nul
title 모의신고 훈련 서버
cd /d "%~dp0"

REM ===== 운영 전 아래 두 값을 반드시 변경하세요 =====
set ADMIN_PASSWORD=kcopa1234
set ADMIN_PATH=kcopa-admin
set PORT=8080
REM ===============================================

where node > nul 2>&1
if errorlevel 1 (
  echo Node.js가 설치되어 있지 않습니다. https://nodejs.org 에서 LTS 버전을 설치해 주세요.
  pause
  exit /b
)
node server\server.js
pause
