@echo off
chcp 65001 >nul
title อัปเดต BMA MIS & MIS2 Auto-Filler (รวม 2 ระบบ) จาก GitHub อัตโนมัติ
echo ========================================================
echo   กำลังดึงโค้ดล่าสุดจาก GitHub (isaradec16-eng/po-pharmacy)
echo   ครอบคลุมทั้ง Opera/Chrome Extension + IE + Oracle Bridge
echo ========================================================

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; " ^
  "$base = 'https://raw.githubusercontent.com/isaradec16-eng/po-pharmacy/main/bma-mis-autofill-extension'; " ^
  "$files = @('manifest.json','background.js','content.js','panel.css','remote-config.json','google-apps-script.gs','ie-autofill.js','vendors-cache.json','config.json','mis2_pay_autofill.ps1','oracle_bridge.ps1','START_ORACLE_BRIDGE.bat','INSTALL_AUTOSTART_BRIDGE.bat','RUN_IE_AUTOFILL.bat','README.md'); " ^
  "foreach ($f in $files) { " ^
  "  Write-Host ('กำลังอัปเดต ' + $f + ' ...'); " ^
  "  Invoke-WebRequest -Uri ($base + '/' + $f + '?t=' + [DateTimeOffset]::Now.ToUnixTimeSeconds()) -OutFile (Join-Path $PSScriptRoot $f) -UseBasicParsing; " ^
  "}"

echo.
echo ========================================================
echo   ✓ อัปเดตไฟล์ครบทั้งหมดเรียบร้อยแล้ว!
echo   - Opera / Chrome: กดปุ่ม Reload ใน opera://extensions 1 ครั้ง
echo   - Oracle Bridge: หากเปิดค้างไว้อยู่ ให้คลิกขวาไอคอนมุมขวาล่าง -> ปิด แล้วเปิดใหม่
echo ========================================================
pause
