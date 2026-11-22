@echo off
chcp 65001 >nul
title ติดตั้ง/เปิดใช้งาน BMA MIS Auto-Filler บน Internet Explorer (IE / Edge IE Mode)
echo ====================================================================
echo   กำลังสร้างปุ่มลัด "BMA MIS Auto-Filler" บนแถบ Favorites ของ IE
echo   และฉีดแผงควบคุมเข้าหน้าต่าง IE ที่เปิดอยู่โดยอัตโนมัติ...
echo ====================================================================

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$favDir = [Environment]::GetFolderPath('Favorites'); " ^
  "$barDir = Join-Path $favDir 'Links'; " ^
  "if (-not (Test-Path $barDir)) { $barDir = $favDir }; " ^
  "$jsUrl = 'javascript:(function(){var s=document.createElement(''script'');s.src=''https://cdn.jsdelivr.net/gh/isaradec16-eng/po-pharmacy@main/bma-mis-autofill-extension/ie-autofill.js?t=''+new Date().getTime();document.body.appendChild(s);})();'; " ^
  "$urlContent = \"[DEFAULT]`r`nBASEURL=$jsUrl`r`n[InternetShortcut]`r`nURL=$jsUrl`r`n\"; " ^
  "Set-Content -Path (Join-Path $favDir 'BMA_MIS_AutoFill.url') -Value $urlContent -Encoding ASCII; " ^
  "Set-Content -Path (Join-Path $barDir 'BMA_MIS_AutoFill.url') -Value $urlContent -Encoding ASCII; " ^
  "Write-Host '✓ สร้างปุ่มลัด BMA_MIS_AutoFill ใน Favorites ของ IE/Edge สำเร็จ!'; " ^
  "try { " ^
  "  $code = (Invoke-WebRequest -Uri ('https://raw.githubusercontent.com/isaradec16-eng/po-pharmacy/main/bma-mis-autofill-extension/ie-autofill.js?t=' + [DateTimeOffset]::Now.ToUnixTimeSeconds()) -UseBasicParsing).Content; " ^
  "  $shell = New-Object -ComObject Shell.Application; " ^
  "  $injected = 0; " ^
  "  foreach ($win in $shell.Windows()) { " ^
  "    try { " ^
  "      if ($win.LocationURL -match 'bma\.go\.th') { " ^
  "        $win.Document.parentWindow.execScript($code, 'javascript'); " ^
  "        $injected++; " ^
  "      } " ^
  "    } catch {} " ^
  "  } " ^
  "  Write-Host ('✓ ส่งแผงควบคุมเข้าหน้าต่าง IE ที่เปิดอยู่สำเร็จ (' + $injected + ' หน้าต่าง)'); " ^
  "} catch { Write-Host 'หมายเหตุ: สามารถกดปุ่ม BMA_MIS_AutoFill บนแถบ Favorites ใน IE/Edge ได้ทันที' }"

echo.
echo ====================================================================
echo   วิธีใช้งานใน IE / Microsoft Edge (IE Mode):
echo   1. กดปุ่มดาว (Favorites) หรือดูที่แถบ Favorites Bar ด้านบนของ IE/Edge
echo   2. คลิกที่ "BMA_MIS_AutoFill" 1 ครั้ง แผงควบคุมจะเด้งขึ้นมาบนหน้าเว็บทันที!
echo   3. โค้ดจะดึงสดจาก GitHub ทุกครั้งที่คลิก ไม่ต้องดาวน์โหลดใหม่เวลาอัปเดตโค้ด
echo ====================================================================
pause
