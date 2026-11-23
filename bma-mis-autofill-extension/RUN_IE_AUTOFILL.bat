@echo off
chcp 65001 >nul
set "APP_DIR=%~dp0"
title ติดตั้ง/เปิดใช้งาน BMA MIS & MIS2 Auto-Filler บน Edge (IE Mode) / IE
echo ====================================================================
echo   ระบบรวม 2 ระบบ (จัดซื้อ/ตรวจรับ 8 ขั้นตอน + เบิกจ่าย MIS2)
echo   1. รีสตาร์ทตัวช่วย Oracle Forms (พอร์ต 47291) เป็นเวอร์ชันล่าสุด
echo   2. สร้างปุ่มลัด "BMA_MIS_AutoFill" + คัดลอกโค้ดสำหรับแถบ Favorites ของ Edge
echo   3. ส่งแผงควบคุมเข้าหน้าต่าง IE ที่เปิดเว็บ bma.go.th อยู่ทันที
echo ====================================================================

powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*oracle_bridge.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1
timeout /t 1 /nobreak >nul
if exist "%~dp0oracle_bridge.ps1" (
  start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "%~dp0oracle_bridge.ps1"
  timeout /t 2 /nobreak >nul
)

powershell -NoProfile -ExecutionPolicy Bypass -STA -Command ^
  "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; " ^
  "$dir = $env:APP_DIR.TrimEnd('\'); " ^
  "try { $st = (New-Object System.Net.WebClient).DownloadString('http://127.0.0.1:47291/status'); Write-Host ('[OK] ตัวช่วย Oracle Forms พร้อมทำงาน: ' + $st) -ForegroundColor Green } catch { Write-Host '[!] ยังไม่พบพอร์ต 47291 (ลองเปิด START_ORACLE_BRIDGE.bat)' -ForegroundColor Yellow }; " ^
  "$favDir = [Environment]::GetFolderPath('Favorites'); " ^
  "$barDir = Join-Path $favDir 'Links'; " ^
  "if (-not (Test-Path $barDir)) { $barDir = $favDir }; " ^
  "$jsUrl = 'javascript:(function(){var t=new Date().getTime(),s=document.createElement(''script'');s.src=''http://127.0.0.1:47291/ie-autofill.js?t=''+t;s.onerror=function(){var f=document.createElement(''script'');f.src=''https://cdn.jsdelivr.net/gh/isaradec16-eng/po-pharmacy@main/bma-mis-autofill-extension/ie-autofill.js?t=''+t;document.body.appendChild(f);};document.body.appendChild(s);})();'; " ^
  "$urlContent = \"[DEFAULT]`r`nBASEURL=$jsUrl`r`n[InternetShortcut]`r`nURL=$jsUrl`r`n\"; " ^
  "Set-Content -Path (Join-Path $favDir 'BMA_MIS_AutoFill.url') -Value $urlContent -Encoding ASCII; " ^
  "Set-Content -Path (Join-Path $barDir 'BMA_MIS_AutoFill.url') -Value $urlContent -Encoding ASCII; " ^
  "try { Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::SetText($jsUrl); Write-Host '[OK] คัดลอก URL ปุ่มลัดใหม่ลง Clipboard แล้ว (นำไปวางแก้ใน Edge Favorites ได้เลย!)' -ForegroundColor Cyan } catch {}; " ^
  "try { " ^
  "  $localJs = Join-Path $dir 'ie-autofill.js'; " ^
  "  if (Test-Path $localJs) { $code = [System.IO.File]::ReadAllText($localJs, [System.Text.Encoding]::UTF8) } " ^
  "  else { $code = (New-Object System.Net.WebClient).DownloadString('https://raw.githubusercontent.com/isaradec16-eng/po-pharmacy/main/bma-mis-autofill-extension/ie-autofill.js?t=' + [DateTime]::Now.Ticks) }; " ^
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
  "  Write-Host ('[OK] ส่งแผงควบคุมเข้าหน้าต่าง IE ที่เปิดอยู่ (' + $injected + ' หน้าต่าง)') -ForegroundColor Green; " ^
  "} catch {}"

echo.
echo ====================================================================
echo   วิธีอัปเดตปุ่มลัดบน Microsoft Edge (ทำครั้งเดียว จะไม่ต้องเจอแคชเก่าอีก):
echo   1. คลิกขวาปุ่ม "BMA_MIS_AutoFill" บนแถบ Favorites ใน Edge ^> เลือก Edit (แก้ไข)
echo   2. ลบช่อง URL เดิมออก แล้วกด Ctrl+V (ระบบคัดลอก URL ใหม่ให้แล้ว!) ^> กด Save
echo   3. กดปุ่ม BMA_MIS_AutoFill ได้ทันที (จะขึ้น ARISSARA.K v2.2 และเชื่อมต่อทันที)
echo ====================================================================
pause
