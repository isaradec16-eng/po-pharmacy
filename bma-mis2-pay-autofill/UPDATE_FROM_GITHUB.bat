@echo off
chcp 65001 >nul
title อัปเดต BMA MIS2 เบิกจ่ายอัตโนมัติ จาก GitHub
echo ========================================================
echo   กำลังดึงไฟล์ล่าสุดจาก GitHub (isaradec16-eng/po-pharmacy)
echo ========================================================

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; " ^
  "$base = 'https://raw.githubusercontent.com/isaradec16-eng/po-pharmacy/main/bma-mis2-pay-autofill'; " ^
  "$files = @('mis2_pay_autofill.ps1','vendors-cache.json','START_MIS2_PAY_AUTOFILL.bat','CREATE_DESKTOP_SHORTCUT.bat','README.md'); " ^
  "foreach ($f in $files) { " ^
  "  Write-Host ('กำลังอัปเดต ' + $f + ' ...'); " ^
  "  Invoke-WebRequest -Uri ($base + '/' + $f + '?t=' + [DateTimeOffset]::Now.ToUnixTimeSeconds()) -OutFile (Join-Path $PSScriptRoot $f) -UseBasicParsing; " ^
  "}"

echo.
echo ========================================================
echo   ✓ อัปเดตไฟล์โปรแกรมครบทั้งหมดเรียบร้อยแล้ว!
echo   (ค่าพิกัด calibration.json และ config.json ของเครื่องนี้ยังคงเดิม)
echo ========================================================
pause
