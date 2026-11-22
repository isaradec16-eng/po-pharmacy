@echo off
chcp 65001 >nul
title สร้างไอคอนลัดบนหน้าจอ Desktop (BMA MIS2 เบิกจ่ายอัตโนมัติ)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$ws = New-Object -ComObject WScript.Shell; " ^
  "$desk = [Environment]::GetFolderPath('Desktop'); " ^
  "$lnk = $ws.CreateShortcut((Join-Path $desk 'BMA MIS2 เบิกจ่ายอัตโนมัติ (ARISSARA.K).lnk')); " ^
  "$lnk.TargetPath = (Join-Path $PSScriptRoot 'START_MIS2_PAY_AUTOFILL.bat'); " ^
  "$lnk.WorkingDirectory = $PSScriptRoot; " ^
  "$lnk.IconLocation = 'shell32.dll,21'; " ^
  "$lnk.Description = 'โปรแกรมช่วยกรอกใบขอเบิกเงิน MIS2 กทม. (พัฒนาโดย ARISSARA.K)'; " ^
  "$lnk.Save();"
echo.
echo ✓ สร้างไอคอนลัดบนหน้าจอ Desktop เรียบร้อยแล้ว!
echo   สามารถดับเบิลคลิกเปิดใช้งานจากหน้า Desktop ได้เลยครับ
echo.
pause
