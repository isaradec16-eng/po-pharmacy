@echo off
chcp 65001 >nul
title อัปเดต BMA MIS Auto-Filler จาก GitHub อัตโนมัติ
echo ========================================================
echo   กำลังดึงโค้ดล่าสุดจาก GitHub (isaradec16-eng/po-pharmacy)
echo ========================================================

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$base = 'https://raw.githubusercontent.com/isaradec16-eng/po-pharmacy/main/bma-mis-autofill-extension'; " ^
  "$files = @('manifest.json','background.js','content.js','panel.css','remote-config.json','google-apps-script.gs','ie-autofill.js','RUN_IE_AUTOFILL.bat','README.md'); " ^
  "foreach ($f in $files) { " ^
  "  Write-Host ('กำลังอัปเดต ' + $f + ' ...'); " ^
  "  Invoke-WebRequest -Uri ($base + '/' + $f + '?t=' + [DateTimeOffset]::Now.ToUnixTimeSeconds()) -OutFile (Join-Path $PSScriptRoot $f) -UseBasicParsing; " ^
  "}"

echo.
echo ========================================================
echo   ✓ อัปเดตไฟล์ส่วนขยายครบทั้งหมดเรียบร้อยแล้ว!
echo   (หากแก้ไขโครงสร้างหลัก ให้กดปุ่ม Reload ใน opera://extensions 1 ครั้ง)
echo ========================================================
pause
