@echo off
chcp 65001 >nul
title BMA MIS2 แผงลอยเบิกจ่าย (ลอยทับ Oracle Forms) — ARISSARA.K
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "%~dp0mis2_pay_autofill.ps1"
exit /b 0
