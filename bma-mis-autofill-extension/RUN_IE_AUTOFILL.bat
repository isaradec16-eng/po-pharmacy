@echo off
chcp 65001 >nul
title ติดตั้ง/เปิดใช้งาน BMA MIS & MIS2 Auto-Filler บน Internet Explorer (IE / Edge IE Mode)
echo ====================================================================
echo   ระบบรวม 2 ระบบ (จัดซื้อ/ตรวจรับ 8 ขั้นตอน + เบิกจ่าย MIS2)
echo   1. ตรวจสอบและเปิดตัวช่วย Oracle Forms (พอร์ต 47291) เบื้องหลัง
echo   2. สร้างปุ่มลัด "BMA_MIS_AutoFill" บนแถบ Favorites ของ IE
echo   3. ส่งแผงควบคุมเข้าหน้าต่าง IE ที่เปิดเว็บ bma.go.th อยู่ทันที
echo ====================================================================

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; " ^
  "$bridgeUp = $false; " ^
  "try { $tc = New-Object System.Net.Sockets.TcpClient; $tc.Connect('127.0.0.1', 47291); $tc.Close(); $bridgeUp = $true } catch {} " ^
  "if (-not $bridgeUp -and (Test-Path (Join-Path $PSScriptRoot 'oracle_bridge.ps1'))) { " ^
  "  Start-Process powershell.exe -WindowStyle Hidden -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-STA','-File',(Join-Path $PSScriptRoot 'oracle_bridge.ps1'); " ^
  "  Write-Host '✓ เปิดตัวช่วย Oracle Forms (System Tray) เรียบร้อย!'; " ^
  "} elseif ($bridgeUp) { Write-Host '✓ ตัวช่วย Oracle Forms เปิดทำงานอยู่แล้ว' }; " ^
  "$favDir = [Environment]::GetFolderPath('Favorites'); " ^
  "$barDir = Join-Path $favDir 'Links'; " ^
  "if (-not (Test-Path $barDir)) { $barDir = $favDir }; " ^
  "$jsUrl = 'javascript:(function(){var t=new Date().getTime(),s=document.createElement(''script'');s.src=''http://127.0.0.1:47291/ie-autofill.js?t=''+t;s.onerror=function(){var f=document.createElement(''script'');f.src=''https://cdn.jsdelivr.net/gh/isaradec16-eng/po-pharmacy@main/bma-mis-autofill-extension/ie-autofill.js?t=''+t;document.body.appendChild(f);};document.body.appendChild(s);})();'; " ^
  "$urlContent = \"[DEFAULT]`r`nBASEURL=$jsUrl`r`n[InternetShortcut]`r`nURL=$jsUrl`r`n\"; " ^
  "Set-Content -Path (Join-Path $favDir 'BMA_MIS_AutoFill.url') -Value $urlContent -Encoding ASCII; " ^
  "Set-Content -Path (Join-Path $barDir 'BMA_MIS_AutoFill.url') -Value $urlContent -Encoding ASCII; " ^
  "Write-Host '✓ สร้างปุ่มลัด BMA_MIS_AutoFill ใน Favorites ของ IE/Edge สำเร็จ!'; " ^
  "try { " ^
  "  $localJs = Join-Path $PSScriptRoot 'ie-autofill.js'; " ^
  "  if (Test-Path $localJs) { $code = [System.IO.File]::ReadAllText($localJs, [System.Text.Encoding]::UTF8) } " ^
  "  else { $code = (Invoke-WebRequest -Uri ('https://raw.githubusercontent.com/isaradec16-eng/po-pharmacy/main/bma-mis-autofill-extension/ie-autofill.js?t=' + [DateTimeOffset]::Now.ToUnixTimeSeconds()) -UseBasicParsing).Content }; " ^
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
echo   1. เปิดหน้าจัดซื้อ/ตรวจรับ (PurHire) หรือหน้าเบิกจ่าย (bmasso.bma.go.th)
echo   2. กดปุ่มลัด "BMA_MIS_AutoFill" บนแถบ Favorites 1 ครั้ง
echo   3. สลับแท็บด้านบนได้ทั้ง "จัดซื้อ/ตรวจรับ (8 ขั้น)" และ "เบิกจ่าย MIS2 (ฎีกา)"
echo ====================================================================
pause
