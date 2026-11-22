@echo off
chcp 65001 >nul
title BMA MIS2 เบิกจ่ายอัตโนมัติ (FRM_PAY_DOC)
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "%~dp0mis2_pay_autofill.ps1"
if errorlevel 1 (
    echo.
    echo [ERROR] ไม่สามารถเปิดโปรแกรมได้ กรุณาลองรันด้วย PowerShell เพื่อดูรายละเอียด:
    powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0mis2_pay_autofill.ps1"
    pause
)
