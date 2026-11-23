@echo off
chcp 65001 >nul
title ติดตั้งตัวช่วย Oracle Forms ให้เปิดอัตโนมัติ (BMA MIS & MIS2)
echo ====================================================================
echo   กำลังติดตั้งตัวช่วย Oracle Forms (BMA MIS2 Bridge)
echo   1. ตั้งค่าให้เปิดทำงานเบื้องหลังอัตโนมัติทุกครั้งที่เปิดเครื่อง
echo   2. สร้างไอคอนลัดบนหน้าจอ Desktop
echo   3. เริ่มการทำงานทันทีใน System Tray มุมขวาล่าง
echo ====================================================================

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$target = Join-Path $PSScriptRoot 'START_ORACLE_BRIDGE.bat'; " ^
  "$startup = [Environment]::GetFolderPath('Startup'); " ^
  "$lnk1 = $ws.CreateShortcut((Join-Path $startup 'BMA_MIS2_Oracle_Bridge.lnk')); " ^
  "$lnk1.TargetPath = $target; $lnk1.WorkingDirectory = $PSScriptRoot; $lnk1.WindowStyle = 7; $lnk1.IconLocation = 'shell32.dll,21'; $lnk1.Save(); " ^
  "$desk = [Environment]::GetFolderPath('Desktop'); " ^
  "$lnk2 = $ws.CreateShortcut((Join-Path $desk 'BMA MIS2 ตัวช่วย Oracle Forms (ARISSARA.K).lnk')); " ^
  "$lnk2.TargetPath = $target; $lnk2.WorkingDirectory = $PSScriptRoot; $lnk2.WindowStyle = 7; $lnk2.IconLocation = 'shell32.dll,21'; $lnk2.Save();"

start "" powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "%~dp0oracle_bridge.ps1"

echo.
echo ✓ ติดตั้งและเปิดตัวช่วย Oracle Forms เรียบร้อยแล้ว!
echo   (สังเกตไอคอนมุมขวาล่างใกล้เวลา และสามารถใช้งานจากส่วนขยาย Opera / IE ได้ทันที)
echo.
pause
