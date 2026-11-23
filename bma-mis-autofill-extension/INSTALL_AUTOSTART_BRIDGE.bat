@echo off
chcp 65001 >nul
set "APP_DIR=%~dp0"
title ติดตั้งตัวช่วย Oracle Forms ให้เปิดอัตโนมัติ (BMA MIS & MIS2)
echo ====================================================================
echo   กำลังติดตั้งตัวช่วย Oracle Forms (BMA MIS2 Bridge)
echo   1. ตั้งค่าให้เปิดทำงานเบื้องหลังอัตโนมัติทุกครั้งที่เปิดเครื่อง
echo   2. สร้างไอคอนลัดบนหน้าจอ Desktop (ตัวช่วย + แผงลอยเบิกจ่าย)
echo   3. เริ่มการทำงานทันทีใน System Tray มุมขวาล่าง
echo ====================================================================

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$dir = $env:APP_DIR.TrimEnd('\'); " ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$target = Join-Path $dir 'START_ORACLE_BRIDGE.bat'; " ^
  "$payTarget = Join-Path $dir 'START_MIS2_PAY_PANEL.bat'; " ^
  "$startup = [Environment]::GetFolderPath('Startup'); " ^
  "$lnk1 = $ws.CreateShortcut((Join-Path $startup 'BMA_MIS2_Oracle_Bridge.lnk')); " ^
  "$lnk1.TargetPath = $target; $lnk1.WorkingDirectory = $dir; $lnk1.WindowStyle = 7; $lnk1.IconLocation = 'shell32.dll,21'; $lnk1.Save(); " ^
  "$desk = [Environment]::GetFolderPath('Desktop'); " ^
  "$lnk2 = $ws.CreateShortcut((Join-Path $desk 'BMA MIS2 ตัวช่วย Oracle Forms (ARISSARA.K).lnk')); " ^
  "$lnk2.TargetPath = $target; $lnk2.WorkingDirectory = $dir; $lnk2.WindowStyle = 7; $lnk2.IconLocation = 'shell32.dll,21'; $lnk2.Save(); " ^
  "$lnk3 = $ws.CreateShortcut((Join-Path $desk 'BMA MIS2 แผงลอยเบิกจ่าย (ARISSARA.K).lnk')); " ^
  "$lnk3.TargetPath = $payTarget; $lnk3.WorkingDirectory = $dir; $lnk3.WindowStyle = 7; $lnk3.IconLocation = 'shell32.dll,21'; $lnk3.Save(); " ^
  "Get-CimInstance Win32_Process -Filter \"Name='powershell.exe'\" | Where-Object { $_.CommandLine -like '*oracle_bridge.ps1*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

timeout /t 1 /nobreak >nul
start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "%~dp0oracle_bridge.ps1"

echo.
echo [OK] ติดตั้งและเปิดตัวช่วย Oracle Forms เรียบร้อยแล้ว!
echo   - ไอคอนบน Desktop: "BMA MIS2 แผงลอยเบิกจ่าย (ARISSARA.K)" กดเปิดลอยทับ Oracle Forms ได้ทันที
echo.
pause
