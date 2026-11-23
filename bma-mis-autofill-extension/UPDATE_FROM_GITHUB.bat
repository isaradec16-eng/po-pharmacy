@echo off
chcp 65001 >nul
set "APP_DIR=%~dp0"
title อัปเดต BMA MIS & MIS2 Auto-Filler (รวม 2 ระบบ) จาก GitHub อัตโนมัติ
echo ========================================================
echo   กำลังดึงโค้ดล่าสุดจาก GitHub (isaradec16-eng/po-pharmacy)
echo   โฟลเดอร์ปลายทาง: %APP_DIR%
echo ========================================================

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; " ^
  "$dir = $env:APP_DIR.TrimEnd('\'); " ^
  "$base = 'https://raw.githubusercontent.com/isaradec16-eng/po-pharmacy/main/bma-mis-autofill-extension'; " ^
  "$files = @('manifest.json','background.js','content.js','panel.css','remote-config.json','google-apps-script.gs','ie-autofill.js','vendors-cache.json','config.json','mis2_pay_autofill.ps1','oracle_bridge.ps1','START_ORACLE_BRIDGE.bat','START_MIS2_PAY_PANEL.bat','INSTALL_AUTOSTART_BRIDGE.bat','RUN_IE_AUTOFILL.bat','README.md'); " ^
  "$wc = New-Object System.Net.WebClient; $ok = 0; $fail = 0; " ^
  "foreach ($f in $files) { " ^
  "  try { " ^
  "    $url = $base + '/' + $f + '?t=' + [DateTime]::Now.Ticks; " ^
  "    $dest = Join-Path $dir $f; " ^
  "    $wc.DownloadFile($url, $dest); " ^
  "    Write-Host ('  [OK] ' + $f) -ForegroundColor Green; $ok++; " ^
  "  } catch { " ^
  "    Write-Host ('  [ERROR] ' + $f + ' : ' + $_.Exception.Message) -ForegroundColor Red; $fail++; " ^
  "  } " ^
  "}; " ^
  "Write-Host ''; Write-Host ('อัปเดตสำเร็จ ' + $ok + '/' + $files.Count + ' ไฟล์ (ผิดพลาด ' + $fail + ')'); " ^
  "try { " ^
  "  $ws = New-Object -ComObject WScript.Shell; " ^
  "  $desk = [Environment]::GetFolderPath('Desktop'); " ^
  "  $lnk = $ws.CreateShortcut((Join-Path $desk 'BMA MIS2 แผงลอยเบิกจ่าย (ARISSARA.K).lnk')); " ^
  "  $lnk.TargetPath = (Join-Path $dir 'START_MIS2_PAY_PANEL.bat'); " ^
  "  $lnk.WorkingDirectory = $dir; $lnk.WindowStyle = 7; $lnk.IconLocation = 'shell32.dll,21'; $lnk.Save(); " ^
  "  Write-Host '  [OK] สร้างไอคอนลัดบนหน้าจอ Desktop: BMA MIS2 แผงลอยเบิกจ่าย (ARISSARA.K)'; " ^
  "} catch {}; " ^
  "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*oracle_bridge.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

timeout /t 1 /nobreak >nul
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "%~dp0oracle_bridge.ps1"

echo.
echo ========================================================
echo   อัปเดตและรีสตาร์ทตัวช่วย Oracle Forms (เวอร์ชันล่าสุด) แล้ว!
echo   - Opera / Chrome: กดปุ่ม Reload ใน opera://extensions 1 ครั้ง
echo   - หน้าเบิกจ่าย MIS2: ดับเบิลคลิกไอคอน "BMA MIS2 แผงลอยเบิกจ่าย" บน Desktop ได้เลย
echo   - Edge IE Mode: รัน RUN_IE_AUTOFILL.bat 1 ครั้งเพื่ออัปเดตปุ่มลัด
echo ========================================================
pause
