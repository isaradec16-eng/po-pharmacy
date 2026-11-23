@echo off
chcp 65001 >nul
title BMA MIS2 ตัวช่วย Oracle Forms (ARISSARA.K)
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "%~dp0oracle_bridge.ps1"
exit /b 0
