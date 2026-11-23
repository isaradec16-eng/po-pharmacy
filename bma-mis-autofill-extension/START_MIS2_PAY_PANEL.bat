@echo off
chcp 65001 >nul
title BMA MIS2 แผงลอยเบิกจ่าย (ลอยทับ Oracle Forms) — ARISSARA.K
if not exist "%~dp0mis2_pay_autofill.ps1" (
  echo [ERROR] ไม่พบไฟล์ mis2_pay_autofill.ps1 ในโฟลเดอร์นี้
  echo กรุณาดับเบิลคลิก UPDATE_FROM_GITHUB.bat เพื่อดาวน์โหลดไฟล์ให้ครบก่อนครับ
  pause
  exit /b 1
)
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "%~dp0mis2_pay_autofill.ps1"
exit /b 0
