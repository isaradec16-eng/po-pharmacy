#requires -Version 5.1
<#
.SYNOPSIS
    BMA MIS2 Disbursement Auto-Filler (FRM_PAY_DOC : บันทึกใบขอเบิก)
    ระบบช่วยกรอกข้อมูลใบขอเบิกเงินลงหน้าต่าง Oracle Forms (ระบบการเงินจ่าย กทม.)
    เชื่อมต่อฐานข้อมูล Google Sheets (Auto Crat-EGP70 + MISS70 + EGP+MIS ทะเบียนบริษัท)

    กติกาความปลอดภัยสูงสุด:
    - หยุดการทำงานก่อนกดบันทึกทุกครั้ง (ไม่มีการส่งคำสั่ง Save / Ctrl+S / F10 เด็ดขาด)
    - เจ้าหน้าที่ตรวจสอบความถูกต้องและกดบันทึกเองทุกครั้ง
    - กด ESC หรือเลื่อนเมาส์ไปมุมซ้ายบนสุดเพื่อหยุดฉุกเฉินได้ทันที
#>

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

trap {
    try {
        [System.Windows.Forms.MessageBox]::Show(
            "เกิดข้อผิดพลาดในแผงลอยเบิกจ่าย MIS2:`r`n$($_.Exception.Message)",
            "BMA MIS2 เบิกจ่ายอัตโนมัติ (Error)",
            [System.Windows.Forms.MessageBoxButtons]::OK,
            [System.Windows.Forms.MessageBoxIcon]::Error
        ) | Out-Null
    } catch {}
    break
}

# ==============================================================================
# 1. Win32 Native Helper (DPI-Aware, Window Finder, Hardware Ctrl+V, Hotkeys)
# ==============================================================================
$win32Code = @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Text;

public class Mis2Win32 {
    [StructLayout(LayoutKind.Sequential)]
    public struct RECT {
        public int Left;
        public int Top;
        public int Right;
        public int Bottom;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT {
        public int X;
        public int Y;
    }

    public class WinInfo {
        public IntPtr Hwnd;
        public string Title;
        public string ClassName;
        public int Left;
        public int Top;
        public int Width;
        public int Height;
        public override string ToString() {
            return Title + " [" + ClassName + "]";
        }
    }

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool SetProcessDPIAware();

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern bool IsWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool IsIconic(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowTextLength(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern bool BringWindowToTop(IntPtr hWnd);

    [DllImport("user32.dll")]
    private static extern IntPtr GetForegroundWindow();

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("kernel32.dll")]
    private static extern uint GetCurrentThreadId();

    [DllImport("user32.dll")]
    private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);

    [DllImport("user32.dll")]
    public static extern bool GetCursorPos(out POINT lpPoint);

    [DllImport("user32.dll")]
    public static extern bool SetCursorPos(int X, int Y);

    [DllImport("user32.dll")]
    private static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);

    [DllImport("user32.dll")]
    public static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll")]
    public static extern IntPtr WindowFromPoint(POINT Point);

    [DllImport("user32.dll")]
    public static extern IntPtr GetAncestor(IntPtr hwnd, uint gaFlags);

    private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    private const uint MOUSEEVENTF_LEFTUP   = 0x0004;
    private const uint KEYEVENTF_KEYUP      = 0x0002;
    private const int  SW_RESTORE           = 9;
    private const uint GA_ROOT              = 2;

    public const byte VK_BACK    = 0x08;
    public const byte VK_TAB     = 0x09;
    public const byte VK_RETURN  = 0x0D;
    public const byte VK_SHIFT   = 0x10;
    public const byte VK_CONTROL = 0x11;
    public const byte VK_ESCAPE  = 0x1B;
    public const byte VK_END     = 0x23;
    public const byte VK_HOME    = 0x24;
    public const byte VK_DELETE  = 0x2E;
    public const byte VK_A       = 0x41;
    public const byte VK_V       = 0x56;
    public const int  VK_F8      = 0x77;
    public const int  VK_F9      = 0x78;

    public static List<WinInfo> GetVisibleWindows() {
        var list = new List<WinInfo>();
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam) {
            if (!IsWindowVisible(hWnd)) return true;
            int len = GetWindowTextLength(hWnd);
            if (len <= 0) return true;
            var sbTitle = new StringBuilder(len + 1);
            GetWindowText(hWnd, sbTitle, sbTitle.Capacity);
            var sbClass = new StringBuilder(256);
            GetClassName(hWnd, sbClass, sbClass.Capacity);
            RECT r;
            GetWindowRect(hWnd, out r);
            int w = r.Right - r.Left;
            int h = r.Bottom - r.Top;
            if (w < 100 || h < 60) return true;
            list.Add(new WinInfo {
                Hwnd = hWnd,
                Title = sbTitle.ToString().Trim(),
                ClassName = sbClass.ToString().Trim(),
                Left = r.Left,
                Top = r.Top,
                Width = w,
                Height = h
            });
            return true;
        }, IntPtr.Zero);
        return list;
    }

    public static WinInfo GetWindowInfo(IntPtr hWnd) {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd)) return null;
        int len = GetWindowTextLength(hWnd);
        var sbTitle = new StringBuilder(len + 1);
        if (len > 0) GetWindowText(hWnd, sbTitle, sbTitle.Capacity);
        var sbClass = new StringBuilder(256);
        GetClassName(hWnd, sbClass, sbClass.Capacity);
        RECT r;
        GetWindowRect(hWnd, out r);
        return new WinInfo {
            Hwnd = hWnd,
            Title = sbTitle.ToString().Trim(),
            ClassName = sbClass.ToString().Trim(),
            Left = r.Left,
            Top = r.Top,
            Width = r.Right - r.Left,
            Height = r.Bottom - r.Top
        };
    }

    public static IntPtr GetTopWindowAtCursor() {
        POINT pt;
        if (!GetCursorPos(out pt)) return IntPtr.Zero;
        IntPtr h = WindowFromPoint(pt);
        if (h == IntPtr.Zero) return IntPtr.Zero;
        IntPtr root = GetAncestor(h, GA_ROOT);
        return root != IntPtr.Zero ? root : h;
    }

    public static bool FocusWindow(IntPtr hWnd) {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd)) return false;
        if (IsIconic(hWnd)) {
            ShowWindow(hWnd, SW_RESTORE);
        }
        IntPtr fg = GetForegroundWindow();
        uint curThread = GetCurrentThreadId();
        uint dummy;
        uint fgThread = fg != IntPtr.Zero ? GetWindowThreadProcessId(fg, out dummy) : 0;
        uint targetThread = GetWindowThreadProcessId(hWnd, out dummy);

        bool attachedFg = false;
        bool attachedTarget = false;
        if (fgThread != 0 && fgThread != curThread) {
            attachedFg = AttachThreadInput(curThread, fgThread, true);
        }
        if (targetThread != 0 && targetThread != curThread) {
            attachedTarget = AttachThreadInput(curThread, targetThread, true);
        }

        BringWindowToTop(hWnd);
        bool ok = SetForegroundWindow(hWnd);

        if (attachedTarget) AttachThreadInput(curThread, targetThread, false);
        if (attachedFg) AttachThreadInput(curThread, fgThread, false);
        return ok;
    }

    public static void LeftClick(int x, int y) {
        SetCursorPos(x, y);
        System.Threading.Thread.Sleep(45);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(35);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
    }

    public static void TapKey(byte vk) {
        keybd_event(vk, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(20);
        keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }

    public static void KeyCombo(byte modVk, byte keyVk) {
        keybd_event(modVk, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(25);
        keybd_event(keyVk, 0, 0, UIntPtr.Zero);
        System.Threading.Thread.Sleep(30);
        keybd_event(keyVk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        System.Threading.Thread.Sleep(25);
        keybd_event(modVk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }

    public static void SelectAllAndClear(bool isMultiline) {
        if (isMultiline) {
            // Ctrl+A + BackSpace (safe for multi-line Oracle Forms text areas)
            KeyCombo(VK_CONTROL, VK_A);
            System.Threading.Thread.Sleep(40);
            TapKey(VK_BACK);
            System.Threading.Thread.Sleep(30);
            // Also Ctrl+Home -> Ctrl+Shift+End -> BackSpace
            KeyCombo(VK_CONTROL, VK_HOME);
            System.Threading.Thread.Sleep(25);
            keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
            keybd_event(VK_SHIFT, 0, 0, UIntPtr.Zero);
            TapKey(VK_END);
            keybd_event(VK_SHIFT, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            System.Threading.Thread.Sleep(25);
            TapKey(VK_BACK);
        } else {
            // Home -> Shift+End -> BackSpace (works across Oracle Forms 6i/10g/11g/12c)
            TapKey(VK_HOME);
            System.Threading.Thread.Sleep(25);
            KeyCombo(VK_SHIFT, VK_END);
            System.Threading.Thread.Sleep(30);
            TapKey(VK_BACK);
            System.Threading.Thread.Sleep(25);
            // Fallback Ctrl+A + BackSpace in case field has trailing spaces
            KeyCombo(VK_CONTROL, VK_A);
            System.Threading.Thread.Sleep(25);
            TapKey(VK_BACK);
        }
    }

    public static void HardwarePaste() {
        // Hardware VK_CONTROL + VK_V works reliably even when Windows keyboard is set to Thai!
        KeyCombo(VK_CONTROL, VK_V);
    }

    [DllImport("user32.dll")]
    private static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);

    public static void ForceTopMost(IntPtr hWnd) {
        if (hWnd == IntPtr.Zero || !IsWindow(hWnd)) return;
        if (IsIconic(hWnd)) ShowWindow(hWnd, SW_RESTORE);
        SetWindowPos(hWnd, new IntPtr(-1), 0, 0, 0, 0, 0x0001 | 0x0002 | 0x0040);
        FocusWindow(hWnd);
    }

    public static bool IsKeyDown(int vk) {
        return (GetAsyncKeyState(vk) & 0x8000) != 0;
    }

    public static bool IsEmergencyStopTriggered() {
        if (IsKeyDown(VK_ESCAPE)) return true;
        POINT pt;
        if (GetCursorPos(out pt)) {
            if (pt.X <= 5 && pt.Y <= 5) return true;
        }
        return false;
    }
}
"@

Add-Type -TypeDefinition $win32Code -Language CSharp
[Mis2Win32]::SetProcessDPIAware() | Out-Null

$script:PanelMutex = New-Object System.Threading.Mutex($false, "Local\BmaMis2PayPanel_ARISSARA")
if (-not $script:PanelMutex.WaitOne(0, $false)) {
    try {
        $existing = [Mis2Win32]::GetVisibleWindows() | Where-Object { $_.Title -match "BMA MIS2 เบิกจ่ายอัตโนมัติ" } | Select-Object -First 1
        if ($existing) {
            [Mis2Win32]::ForceTopMost($existing.Hwnd)
        }
    } catch {}
    exit 0
}

# ==============================================================================
# 2. Paths, State & Configuration Management
# ==============================================================================
$script:AppDir          = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:ConfigPath      = Join-Path $script:AppDir "config.json"
$script:CalibrationPath = Join-Path $script:AppDir "calibration.json"
$script:VendorCachePath = Join-Path $script:AppDir "vendors-cache.json"

$script:Config          = $null
$script:Calibration     = @{}
$script:Items           = @()
$script:Vendors         = @()
$script:FilteredItems   = @()
$script:FilteredVendors = @()
$script:SelectedItem    = $null
$script:SelectedVendor  = $null
$script:TargetHwnd      = [IntPtr]::Zero
$script:TargetWinTitle  = ""

# All calibratable Oracle Forms (FRM_PAY_DOC) target points — NEVER includes Save!
$script:CalibDefinitions = @(
    @{ Key = "rcvNo";         Group = "ขั้นที่ 1 (ใบตรวจรับ)";    Label = "ช่อง เลขที่เอกสารตรวจรับ (ซ้ายของ /)";  Note = "ช่องกรอกเลขใบตรวจรับ เช่น 54" },
    @{ Key = "rcvYear";       Group = "ขั้นที่ 1 (ใบตรวจรับ)";    Label = "ช่อง ปีงบประมาณตรวจรับ (ขวาของ /)";    Note = "ช่องปี 2 หลัก เช่น 70" },
    @{ Key = "rcvSearchBtn";  Group = "ขั้นที่ 1 (ใบตรวจรับ)";    Label = "ปุ่ม แว่นขยาย 🔍 (อ้างอิงจัดซื้อ/จัดจ้าง)"; Note = "ปุ่มค้นหาข้างช่องปี" },
    @{ Key = "popupDetail";   Group = "ขั้นที่ 1.5 (Popup เลือกงบ)"; Label = "ปุ่ม 'รายละเอียด' แถวที่ 1 ใน Popup";  Note = "ข้ามได้ (F9) ถ้าต้องการกดเอง" },
    @{ Key = "popupBudgetChk";Group = "ขั้นที่ 1.5 (Popup เลือกงบ)"; Label = "ช่องติ๊กถูก ☑ แถวที่ 1 (งบประมาณ)";     Note = "ข้ามได้ (F9) ถ้าต้องการติ๊กเอง" },
    @{ Key = "popupOkBtn";    Group = "ขั้นที่ 1.5 (Popup เลือกงบ)"; Label = "ปุ่ม 'ตกลง' ด้านล่าง Popup";          Note = "ข้ามได้ (F9) ถ้าต้องการกดเอง" },
    @{ Key = "vatAmount";     Group = "ขั้นที่ 1.6 (ตารางภาษี)";     Label = "ช่อง 'ภาษีมูลค่าเพิ่ม' (7%) แถวที่ 1"; Note = "ในตารางแท็บข้อมูลฎีกาเบิกเงิน" },
    @{ Key = "whtAmount";     Group = "ขั้นที่ 1.6 (ตารางภาษี)";     Label = "ช่อง 'หักภาษีเงินได้' (1%) แถวที่ 1";  Note = "0.00 สำหรับ สภากาชาด/เอเบิ้ล/อภ./ยูนีซัน" },
    @{ Key = "tabPayee";      Group = "ขั้นที่ 2 (แท็บผู้รับเงิน)"; Label = "หัวแท็บ 'ผู้รับเงิน'";                  Note = "แท็บที่ 3 ของฟอร์ม FRM_PAY_DOC" },
    @{ Key = "payTo";         Group = "ขั้นที่ 2 (แท็บผู้รับเงิน)"; Label = "ช่อง 'จ่ายให้'";                       Note = "ชื่อบริษัทจากคอลัมน์ A (ทะเบียนบริษัท)" },
    @{ Key = "assignTo";      Group = "ขั้นที่ 2 (แท็บผู้รับเงิน)"; Label = "ช่อง 'โดยมอบให้'";                     Note = "สำนักงานบริหารการเงินการคลังฯ โอนเข้าบัญชี รพจ." },
    @{ Key = "bankCode";      Group = "ขั้นที่ 2 (แท็บผู้รับเงิน)"; Label = "ช่อง 'รหัสธนาคาร' (3 หลัก)";           Note = "เช่น 004, 006, 014, 031 (จากคอลัมน์ B)" },
    @{ Key = "branchCode";    Group = "ขั้นที่ 2 (แท็บผู้รับเงิน)"; Label = "ช่อง 'รหัสสาขา' (4 หลัก)";             Note = "เช่น 0001 (ดึงจาก 0+3 หลักแรกของบัญชี และจำค่าที่แก้ให้)" },
    @{ Key = "accountNo";     Group = "ขั้นที่ 2 (แท็บผู้รับเงิน)"; Label = "ช่อง 'เลขที่บัญชี'";                   Note = "เลขบัญชีจากคอลัมน์ E (MIs2)" },
    @{ Key = "tabDetail";     Group = "ขั้นที่ 3 (รายละเอียดเบิก)"; Label = "หัวแท็บ 'รายละเอียดเงินเบิกจ่าย'";      Note = "แท็บที่ 4 ของฟอร์ม FRM_PAY_DOC" },
    @{ Key = "requesterName"; Group = "ขั้นที่ 3 (รายละเอียดเบิก)"; Label = "ช่อง 'ชื่อผู้เบิก'";                    Note = "กล่องใหญ่ด้านล่างจำนวนเงินที่จ่าย" },
    @{ Key = "payDate";       Group = "ขั้นที่ 3 (รายละเอียดเบิก)"; Label = "ช่อง 'วันที่เบิก'";                     Note = "รูปแบบ dd/MM/yyyy พ.ศ." },
    @{ Key = "description";   Group = "ขั้นที่ 3 (รายละเอียดเบิก)"; Label = "ช่อง 'คำอธิบายรายการเบิก'";            Note = "กล่องใหญ่ด้านล่างสุด (ข้ามจำนวนเอกสาร)" }
)

function Load-Config {
    $defaultFyMap = [ordered]@{
        "70" = @{
            missSheetId     = "1tTaFrjVCPm8IrjJAg6e0Y27jIqoedLsmJz92py1O0lU"
            missTabName     = "ชีต1"
            autocratSheetId = "1qFqdTqcP_d_nNLAX3AL0Gq21s2zjffXW2Czo3Jv1F_Y"
            autocratTabName = "main"
        }
        "71" = @{ missSheetId = ""; missTabName = "ชีต1"; autocratSheetId = ""; autocratTabName = "main" }
        "72" = @{ missSheetId = ""; missTabName = "ชีต1"; autocratSheetId = ""; autocratTabName = "main" }
        "73" = @{ missSheetId = ""; missTabName = "ชีต1"; autocratSheetId = ""; autocratTabName = "main" }
        "74" = @{ missSheetId = ""; missTabName = "ชีต1"; autocratSheetId = ""; autocratTabName = "main" }
        "75" = @{ missSheetId = ""; missTabName = "ชีต1"; autocratSheetId = ""; autocratTabName = "main" }
    }
    $defaultCfg = [ordered]@{
        version             = "1.0.0"
        mis2LoginUrl        = "http://bmasso.bma.go.th/MIS2DirectLogins/index2.jsp"
        gasWebAppUrl        = "https://script.google.com/macros/s/AKfycbyAvDPZrKrKK0B50nU84aK9bVTyLWT47YhjW2ppGiGPSFIrI3Lryu55CBbnPFKCXKMx/exec"
        egpMisSheetId       = "1m0EdHfSe3M6JUBirvivwJW5GOnzKos9sUI-smRsrOvE"
        vendorsGid          = "1778203595"
        fiscalYear          = "70"
        fiscalYears         = $defaultFyMap
        defaultAssignTo     = "สำนักงานบริหารการเงินการคลังกรุงเทพมหานคร โอนเงินเข้าบัญชี รพจ."
        assignToPresets     = @(
            "สำนักงานบริหารการเงินการคลังกรุงเทพมหานคร โอนเงินเข้าบัญชี รพจ.",
            "คณะกรรมการรับ-ส่งเงินกองการเงินโอนเข้าบัญชี รพจ."
        )
        defaultRequester    = "นางอรชุมา หุตะโกวิท"
        defaultDateMode     = "today"
        descriptionTemplate = "(ค่า{subject})"
        stepDelayMs         = 220
        clearBeforePaste    = $true
        autoFillFields      = @{
            payTo      = $true
            assignTo   = $true
            bankCode   = $true
            branchCode = $true
            accountNo  = $true
        }
        whtExemptKeywords   = @("สภากาชาด", "เอเบิ้ล", "เอเบิล", "A-ble", "Abel", "องค์การเภสัชกรรม", "GPO", "ยูนีซัน", "Unison")
        neverAutoSave       = $true
    }
    if (Test-Path $script:ConfigPath) {
        try {
            $raw = [System.IO.File]::ReadAllText($script:ConfigPath, [System.Text.Encoding]::UTF8)
            $loaded = $raw | ConvertFrom-Json
            foreach ($prop in $loaded.PSObject.Properties) {
                if ($prop.Name -eq "fiscalYears" -and $prop.Value) {
                    $fyHt = [ordered]@{}
                    foreach ($k in $defaultFyMap.Keys) { $fyHt[$k] = $defaultFyMap[$k] }
                    foreach ($yp in $prop.Value.PSObject.Properties) {
                        $fyHt[[string]$yp.Name] = @{
                            missSheetId     = [string]$yp.Value.missSheetId
                            missTabName     = if ($yp.Value.missTabName) { [string]$yp.Value.missTabName } else { "ชีต1" }
                            autocratSheetId = [string]$yp.Value.autocratSheetId
                            autocratTabName = if ($yp.Value.autocratTabName) { [string]$yp.Value.autocratTabName } else { "main" }
                        }
                    }
                    $defaultCfg["fiscalYears"] = $fyHt
                } else {
                    $defaultCfg[$prop.Name] = $prop.Value
                }
            }
        } catch {}
    }
    $defaultCfg["neverAutoSave"] = $true
    $script:Config = $defaultCfg
}

function Save-Config {
    try {
        $script:Config["neverAutoSave"] = $true
        $json = $script:Config | ConvertTo-Json -Depth 6
        [System.IO.File]::WriteAllText($script:ConfigPath, $json, (New-Object System.Text.UTF8Encoding($false)))
    } catch {}
}

function Extract-SpreadsheetId([string]$idOrUrl) {
    if ([string]::IsNullOrWhiteSpace($idOrUrl)) { return "" }
    $s = $idOrUrl.Trim()
    $m = [regex]::Match($s, "/d/([a-zA-Z0-9-_]+)")
    if ($m.Success) { return $m.Groups[1].Value }
    return $s
}

function Get-FiscalYearEntry([string]$fy) {
    if ([string]::IsNullOrWhiteSpace($fy)) { $fy = [string]$script:Config["fiscalYear"] }
    if ([string]::IsNullOrWhiteSpace($fy)) { $fy = "70" }
    $map = $script:Config["fiscalYears"]
    if ($map -and $map.Contains($fy)) { return $map[$fy] }
    return @{ missSheetId = ""; missTabName = "ชีต1"; autocratSheetId = ""; autocratTabName = "main" }
}

function Show-FiscalYearSettingsDialog([string]$initialYear) {
    $dlg = New-Object System.Windows.Forms.Form
    $dlg.Text = "⚙️ ตั้งค่าไฟล์ปลายทางตามปีงบประมาณ (MISS / Auto Crat)"
    $dlg.Size = New-Object System.Drawing.Size(540, 355)
    $dlg.StartPosition = "CenterScreen"
    $dlg.TopMost = $true
    $dlg.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)
    $dlg.BackColor = [System.Drawing.Color]::FromArgb(245, 248, 252)

    $lblY = New-Object System.Windows.Forms.Label
    $lblY.Text = "เลือกปีงบประมาณ:"
    $lblY.Location = New-Object System.Drawing.Point(14, 16)
    $lblY.Size = New-Object System.Drawing.Size(120, 22)
    $dlg.Controls.Add($lblY)

    $cmbY = New-Object System.Windows.Forms.ComboBox
    $cmbY.Location = New-Object System.Drawing.Point(138, 13)
    $cmbY.Size = New-Object System.Drawing.Size(110, 24)
    $cmbY.DropDownStyle = "DropDownList"
    foreach ($k in ($script:Config["fiscalYears"].Keys | Sort-Object { [int]$_ })) {
        $cmbY.Items.Add($k) | Out-Null
    }
    $dlg.Controls.Add($cmbY)

    $btnAddY = New-Object System.Windows.Forms.Button
    $btnAddY.Text = "➕ เพิ่มปีงบถัดไป"
    $btnAddY.Location = New-Object System.Drawing.Point(258, 12)
    $btnAddY.Size = New-Object System.Drawing.Size(130, 27)
    $btnAddY.BackColor = [System.Drawing.Color]::FromArgb(224, 242, 254)
    $btnAddY.FlatStyle = "Flat"
    $dlg.Controls.Add($btnAddY)

    $lblMiss = New-Object System.Windows.Forms.Label
    $lblMiss.Text = "ลิงก์หรือ ID ไฟล์ MISS (เช่น ลิงก์ไฟล์ MISS70 / MISS71):"
    $lblMiss.Location = New-Object System.Drawing.Point(14, 54)
    $lblMiss.Size = New-Object System.Drawing.Size(490, 20)
    $lblMiss.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    $dlg.Controls.Add($lblMiss)

    $txtMissUrl = New-Object System.Windows.Forms.TextBox
    $txtMissUrl.Location = New-Object System.Drawing.Point(14, 76)
    $txtMissUrl.Size = New-Object System.Drawing.Size(495, 24)
    $dlg.Controls.Add($txtMissUrl)

    $lblMissTab = New-Object System.Windows.Forms.Label
    $lblMissTab.Text = "ชื่อชีตในไฟล์ MISS (ค่าเริ่มต้น: ชีต1):"
    $lblMissTab.Location = New-Object System.Drawing.Point(14, 108)
    $lblMissTab.Size = New-Object System.Drawing.Size(220, 20)
    $dlg.Controls.Add($lblMissTab)

    $txtMissTab = New-Object System.Windows.Forms.TextBox
    $txtMissTab.Location = New-Object System.Drawing.Point(240, 105)
    $txtMissTab.Size = New-Object System.Drawing.Size(120, 24)
    $dlg.Controls.Add($txtMissTab)

    $lblAc = New-Object System.Windows.Forms.Label
    $lblAc.Text = "ลิงก์หรือ ID ไฟล์ Auto Crat-EGP (เช่น Auto Crat-EGP70 / 71):"
    $lblAc.Location = New-Object System.Drawing.Point(14, 144)
    $lblAc.Size = New-Object System.Drawing.Size(490, 20)
    $lblAc.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    $dlg.Controls.Add($lblAc)

    $txtAcUrl = New-Object System.Windows.Forms.TextBox
    $txtAcUrl.Location = New-Object System.Drawing.Point(14, 166)
    $txtAcUrl.Size = New-Object System.Drawing.Size(495, 24)
    $dlg.Controls.Add($txtAcUrl)

    $lblAcTab = New-Object System.Windows.Forms.Label
    $lblAcTab.Text = "ชื่อชีตในไฟล์ Auto Crat (ค่าเริ่มต้น: main):"
    $lblAcTab.Location = New-Object System.Drawing.Point(14, 198)
    $lblAcTab.Size = New-Object System.Drawing.Size(220, 20)
    $dlg.Controls.Add($lblAcTab)

    $txtAcTab = New-Object System.Windows.Forms.TextBox
    $txtAcTab.Location = New-Object System.Drawing.Point(240, 195)
    $txtAcTab.Size = New-Object System.Drawing.Size(120, 24)
    $dlg.Controls.Add($txtAcTab)

    $lblHint = New-Object System.Windows.Forms.Label
    $lblHint.Location = New-Object System.Drawing.Point(14, 228)
    $lblHint.Size = New-Object System.Drawing.Size(495, 34)
    $lblHint.ForeColor = [System.Drawing.Color]::FromArgb(71, 85, 105)
    $lblHint.Font = New-Object System.Drawing.Font("Segoe UI", 8.2)
    $lblHint.Text = "💡 วาง URL เต็มของ Google Sheets ได้เลย ระบบจะตัดรหัส Spreadsheet ID ให้อัตโนมัติ`r`n   (อย่าลืม Deploy โค้ด google-apps-script.gs ล่าสุดเพื่อให้รองรับการสลับปีงบแบบ Live)"
    $dlg.Controls.Add($lblHint)

    $btnSave = New-Object System.Windows.Forms.Button
    $btnSave.Text = "💾 บันทึกและใช้ปีงบนี้"
    $btnSave.Location = New-Object System.Drawing.Point(344, 270)
    $btnSave.Size = New-Object System.Drawing.Size(165, 34)
    $btnSave.BackColor = [System.Drawing.Color]::FromArgb(13, 148, 136)
    $btnSave.ForeColor = [System.Drawing.Color]::White
    $btnSave.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
    $btnSave.FlatStyle = "Flat"
    $dlg.Controls.Add($btnSave)

    $btnCancel = New-Object System.Windows.Forms.Button
    $btnCancel.Text = "ยกเลิก"
    $btnCancel.Location = New-Object System.Drawing.Point(244, 270)
    $btnCancel.Size = New-Object System.Drawing.Size(92, 34)
    $btnCancel.FlatStyle = "Flat"
    $btnCancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $dlg.Controls.Add($btnCancel)

    $loadYearIntoDlg = {
        $yKey = [string]$cmbY.SelectedItem
        if (-not $yKey) { return }
        $ent = Get-FiscalYearEntry $yKey
        $lblMiss.Text   = "ลิงก์หรือ ID ไฟล์ MISS${yKey} (ปลายทางคอลัมน์ D/H/J):"
        $lblAc.Text     = "ลิงก์หรือ ID ไฟล์ Auto Crat-EGP${yKey}:"
        $txtMissUrl.Text = [string]$ent["missSheetId"]
        $txtMissTab.Text = if ($ent["missTabName"]) { [string]$ent["missTabName"] } else { "ชีต1" }
        $txtAcUrl.Text   = [string]$ent["autocratSheetId"]
        $txtAcTab.Text   = if ($ent["autocratTabName"]) { [string]$ent["autocratTabName"] } else { "main" }
    }

    $cmbY.Add_SelectedIndexChanged($loadYearIntoDlg)
    $btnAddY.Add_Click({
        $maxY = 70
        foreach ($k in $script:Config["fiscalYears"].Keys) {
            $n = 0
            if ([int]::TryParse([string]$k, [ref]$n) -and $n -gt $maxY) { $maxY = $n }
        }
        $nextY = [string]($maxY + 1)
        $script:Config["fiscalYears"][$nextY] = @{
            missSheetId     = ""
            missTabName     = "ชีต1"
            autocratSheetId = ""
            autocratTabName = "main"
        }
        Save-Config
        $cmbY.Items.Add($nextY) | Out-Null
        $cmbY.SelectedItem = $nextY
    })

    $btnSave.Add_Click({
        $yKey = [string]$cmbY.SelectedItem
        if (-not $yKey) { return }
        $script:Config["fiscalYears"][$yKey] = @{
            missSheetId     = Extract-SpreadsheetId $txtMissUrl.Text
            missTabName     = if ($txtMissTab.Text.Trim()) { $txtMissTab.Text.Trim() } else { "ชีต1" }
            autocratSheetId = Extract-SpreadsheetId $txtAcUrl.Text
            autocratTabName = if ($txtAcTab.Text.Trim()) { $txtAcTab.Text.Trim() } else { "main" }
        }
        $script:Config["fiscalYear"] = $yKey
        Save-Config
        $dlg.DialogResult = [System.Windows.Forms.DialogResult]::OK
        $dlg.Close()
    })

    if ($initialYear -and $cmbY.Items.Contains($initialYear)) {
        $cmbY.SelectedItem = $initialYear
    } elseif ($cmbY.Items.Count -gt 0) {
        $cmbY.SelectedIndex = 0
    }
    & $loadYearIntoDlg

    return ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK)
}

function Load-Calibration {
    $script:Calibration = @{}
    if (Test-Path $script:CalibrationPath) {
        try {
            $raw = [System.IO.File]::ReadAllText($script:CalibrationPath, [System.Text.Encoding]::UTF8)
            $obj = $raw | ConvertFrom-Json
            foreach ($prop in $obj.PSObject.Properties) {
                $script:Calibration[$prop.Name] = @{
                    dx   = [int]$prop.Value.dx
                    dy   = [int]$prop.Value.dy
                    winW = [int]$prop.Value.winW
                    winH = [int]$prop.Value.winH
                }
            }
        } catch {}
    }
}

function Save-Calibration {
    try {
        $json = $script:Calibration | ConvertTo-Json -Depth 5
        [System.IO.File]::WriteAllText($script:CalibrationPath, $json, (New-Object System.Text.UTF8Encoding($false)))
    } catch {}
}

# ==============================================================================
# 3. Thai Helpers, Bank Mapping & Google Sheets Fetching
# ==============================================================================
function Convert-ThaiDigits([string]$text) {
    if ([string]::IsNullOrEmpty($text)) { return "" }
    $th = @('๐','๑','๒','๓','๔','๕','๖','๗','๘','๙')
    $out = $text
    for ($i = 0; $i -lt 10; $i++) {
        $out = $out.Replace($th[$i], $i.ToString())
    }
    return $out
}

function Get-BankCode([string]$bankName) {
    if ([string]::IsNullOrWhiteSpace($bankName)) { return "" }
    $b = $bankName.Trim().ToLower()
    $rules = @(
        @("กรุงเทพ", "002"),
        @("กสิกร", "004"),
        @("กรุงไทย", "006"),
        @("ทหารไทย", "011"),
        @("ทีเอ็มบี", "011"),
        @("ธนชาต", "011"),
        @("ไทยพาณิช", "014"),
        @("ไทยพานิช", "014"),
        @("ซิตี้", "017"),
        @("สแตนดาร์ด", "020"),
        @("ซีไอเอ็มบี", "022"),
        @("ยูโอบี", "024"),
        @("uob", "024"),
        @("กรุงศรี", "025"),
        @("ออมสิน", "030"),
        @("ฮ่องกง", "031"),
        @("hsbc", "031"),
        @("ดอยซ์", "032"),
        @("ธ.ก.ส", "034"),
        @("บีเอ็นพี", "045"),
        @("bnp", "045"),
        @("ทิสโก้", "067"),
        @("เกียรตินาคิน", "069"),
        @("แลนด์", "073")
    )
    foreach ($r in $rules) {
        if ($b.Contains($r[0])) { return $r[1] }
    }
    return ""
}

function Normalize-CompanyKey([string]$name) {
    if ([string]::IsNullOrWhiteSpace($name)) { return "" }
    $s = Convert-ThaiDigits $name
    $s = [regex]::Replace($s, "บริษัท|ห้างหุ้นส่วนจำกัด|หจก\.?|จำกัด|\(มหาชน\)|\(ประเทศไทย\)|\.|,|-|\s+", "", "IgnoreCase")
    return $s.ToLower()
}

function Get-TodayThaiSlash {
    $now = Get-Date
    $beYear = $now.Year
    if ($beYear -lt 2400) { $beYear += 543 }
    return ("{0:00}/{1:00}/{2:0000}" -f $now.Day, $now.Month, $beYear)
}

function Fetch-Utf8String([string]$url, [int]$timeoutMs = 15000) {
    $req = [System.Net.HttpWebRequest]::Create($url)
    $req.Method = "GET"
    $req.Timeout = $timeoutMs
    $req.ReadWriteTimeout = $timeoutMs
    $req.AllowAutoRedirect = $true
    $req.UserAgent = "BMA-MIS2-Pay-AutoFill/1.0"
    $resp = $req.GetResponse()
    try {
        $stream = $resp.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
        return $reader.ReadToEnd()
    } finally {
        $resp.Close()
    }
}

function Post-Utf8Json([string]$url, [hashtable]$payload) {
    $json = $payload | ConvertTo-Json -Depth 5 -Compress
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
    $req = [System.Net.HttpWebRequest]::Create($url)
    $req.Method = "POST"
    $req.ContentType = "application/json; charset=utf-8"
    $req.ContentLength = $bytes.Length
    $req.Timeout = 20000
    $req.AllowAutoRedirect = $true
    $stream = $req.GetRequestStream()
    $stream.Write($bytes, 0, $bytes.Length)
    $stream.Close()
    $resp = $req.GetResponse()
    try {
        $rStream = $resp.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($rStream, [System.Text.Encoding]::UTF8)
        return $reader.ReadToEnd()
    } finally {
        $resp.Close()
    }
}

function Load-VendorsFromCache {
    $list = @()
    if (Test-Path $script:VendorCachePath) {
        try {
            $raw = [System.IO.File]::ReadAllText($script:VendorCachePath, [System.Text.Encoding]::UTF8)
            $obj = $raw | ConvertFrom-Json
            if ($obj.vendors) {
                foreach ($v in $obj.vendors) {
                    $list += [PSCustomObject]@{
                        company   = [string]$v.company
                        bank      = [string]$v.bank
                        bankCode  = if ($v.bankCode) { [string]$v.bankCode } else { Get-BankCode ([string]$v.bank) }
                        branch    = [string]$v.branch
                        accountNo = [string]$v.accountNo
                        address   = [string]$v.address
                        taxId     = [string]$v.taxId
                    }
                }
            }
        } catch {}
    }
    return $list
}

function Load-VendorsFromGvizCsv {
    $list = @()
    try {
        $sheetId = $script:Config["egpMisSheetId"]
        $gid     = $script:Config["vendorsGid"]
        $csvUrl  = "https://docs.google.com/spreadsheets/d/$sheetId/gviz/tq?tqx=out:csv&gid=$gid"
        $csvText = Fetch-Utf8String -url $csvUrl -timeoutMs 8000
        if ([string]::IsNullOrWhiteSpace($csvText) -or $csvText.TrimStart().StartsWith("<")) {
            return @()
        }
        $rows = $csvText | ConvertFrom-Csv
        foreach ($row in $rows) {
            $props = @($row.PSObject.Properties)
            if ($props.Count -lt 7) { continue }
            $company = ([regex]::Replace([string]$props[0].Value, "\s+", " ")).Trim()
            if ([string]::IsNullOrWhiteSpace($company)) { continue }
            $bank    = ([regex]::Replace([string]$props[1].Value, "\s+", " ")).Trim()
            $branch  = ([regex]::Replace([string]$props[2].Value, "\s+", " ")).Trim()
            $acctTh  = ([string]$props[3].Value).Trim()
            $acctMis = (Convert-ThaiDigits (if ([string]::IsNullOrWhiteSpace([string]$props[4].Value)) { $acctTh } else { [string]$props[4].Value })).Trim()
            $addr    = ([regex]::Replace([string]$props[6].Value, "\s+", " ")).Trim()
            $taxRaw  = if ($props.Count -ge 8) { [string]$props[7].Value } else { "" }
            $taxId   = [regex]::Replace((Convert-ThaiDigits $taxRaw), "\D", "")
            if ($taxId -eq "000000") { $taxId = "" }
            $list += [PSCustomObject]@{
                company   = $company
                bank      = $bank
                bankCode  = Get-BankCode $bank
                branch    = $branch
                accountNo = $acctMis
                address   = $addr
                taxId     = $taxId
            }
        }
    } catch {}
    return $list
}

function Find-MatchingVendor([string]$vendorName, [string]$taxId) {
    $cleanTax = [regex]::Replace((Convert-ThaiDigits $taxId), "\D", "")
    if ($cleanTax -and $cleanTax -ne "000000") {
        foreach ($v in $script:Vendors) {
            if ($v.taxId -eq $cleanTax) { return $v }
        }
    }
    $key = Normalize-CompanyKey $vendorName
    if ($key) {
        foreach ($v in $script:Vendors) {
            if ((Normalize-CompanyKey $v.company) -eq $key) { return $v }
        }
        if ($key.Length -ge 4) {
            foreach ($v in $script:Vendors) {
                $vk = Normalize-CompanyKey $v.company
                if ($vk -and ($vk.Contains($key) -or $key.Contains($vk))) { return $v }
            }
        }
    }
    return $null
}

function Sync-GoogleSheetsData {
    $statusParts = @()
    $gasUrl = [string]$script:Config["gasWebAppUrl"]
    $loadedVendorsFromGas = $false

    if (-not [string]::IsNullOrWhiteSpace($gasUrl)) {
        try {
            $fy = [string]$script:Config["fiscalYear"]
            if ([string]::IsNullOrWhiteSpace($fy)) { $fy = "70" }
            $fyEnt = Get-FiscalYearEntry $fy
            $qParts = @(
                "fiscalYear=" + [Uri]::EscapeDataString($fy),
                "t=" + [DateTime]::Now.Ticks
            )
            if ($fyEnt["missSheetId"])     { $qParts += "missSheetId=" + [Uri]::EscapeDataString([string]$fyEnt["missSheetId"]) }
            if ($fyEnt["missTabName"])     { $qParts += "missTabName=" + [Uri]::EscapeDataString([string]$fyEnt["missTabName"]) }
            if ($fyEnt["autocratSheetId"]) { $qParts += "autocratSheetId=" + [Uri]::EscapeDataString([string]$fyEnt["autocratSheetId"]) }
            if ($fyEnt["autocratTabName"]) { $qParts += "autocratTabName=" + [Uri]::EscapeDataString([string]$fyEnt["autocratTabName"]) }
            $sep = if ($gasUrl.Contains("?")) { "&" } else { "?" }
            $respText = Fetch-Utf8String -url ($gasUrl + $sep + ($qParts -join "&")) -timeoutMs 20000
            $json = $respText | ConvertFrom-Json
            if ($json.ok -and $json.items) {
                $script:Items = @($json.items)
                $statusParts += "ปีงบ $fy (MISS$fy): $($script:Items.Count) รายการ"
            }
            if ($json.ok -and $json.vendors -and $json.vendors.Count -gt 0) {
                $script:Vendors = @()
                foreach ($v in $json.vendors) {
                    $script:Vendors += [PSCustomObject]@{
                        company   = [string]$v.company
                        bank      = [string]$v.bank
                        bankCode  = if ($v.bankCode) { [string]$v.bankCode } else { Get-BankCode ([string]$v.bank) }
                        branch    = [string]$v.branch
                        accountNo = [string]$v.accountNo
                        address   = [string]$v.address
                        taxId     = [string]$v.taxId
                    }
                }
                $loadedVendorsFromGas = $true
                # Refresh local cache
                try {
                    $cacheObj = @{ updatedAt = (Get-Date -Format "yyyy-MM-dd HH:mm"); source = "Apps Script Live"; vendors = $script:Vendors }
                    [System.IO.File]::WriteAllText($script:VendorCachePath, ($cacheObj | ConvertTo-Json -Depth 5), (New-Object System.Text.UTF8Encoding($false)))
                } catch {}
                $statusParts += "ทะเบียนบริษัท (Live): $($script:Vendors.Count)"
            }
        } catch {
            $statusParts += "Apps Script ผิดพลาด: $($_.Exception.Message)"
        }
    }

    if (-not $loadedVendorsFromGas) {
        $gvizVendors = Load-VendorsFromGvizCsv
        if ($gvizVendors.Count -gt 0) {
            $script:Vendors = $gvizVendors
            $statusParts += "ทะเบียนบริษัท (Sheet CSV): $($script:Vendors.Count)"
        } else {
            $script:Vendors = Load-VendorsFromCache
            $statusParts += "ทะเบียนบริษัท (Cache): $($script:Vendors.Count)"
        }
    }

    return ($statusParts -join " | ")
}

# ==============================================================================
# 4. Oracle Forms Target Window & Safe Input Engine (NO AUTO-SAVE EVER!)
# ==============================================================================
function Find-OracleFormsWindow {
    $wins = [Mis2Win32]::GetVisibleWindows()
    $selfExcl = "BMA MIS2|ตัวช่วย Oracle Forms|ตั้งพิกัด|เลือกหน้าต่าง Oracle"
    # Priority 1: Standalone Java AWT Frame (Oracle Forms Applet / JNLP)
    foreach ($w in $wins) {
        if ($w.ClassName -match "SunAwtFrame|SunAwtDialog" -and $w.Title -notmatch $selfExcl) {
            return $w
        }
    }
    # Priority 2: Exact Oracle Developer Forms / FRM_PAY_DOC window (standalone OR embedded in Edge IE Mode / IE)
    foreach ($w in $wins) {
        if ($w.Title -match "Oracle Developer Forms|FRM_PAY_DOC|บันทึกใบขอเบิก|ระบบการเงินจ่าย" -and $w.Title -notmatch $selfExcl) {
            return $w
        }
    }
    # Priority 3: Window title containing Oracle / Hospital keywords (excluding browsers)
    foreach ($w in $wins) {
        if ($w.Title -match "โรงพยาบาลเจริญกรุง|สำนักการแพทย์|Oracle" -and $w.Title -notmatch "$selfExcl|Internet Explorer|Edge|Opera|Chrome") {
            return $w
        }
    }
    return $null
}

function Resolve-CalibPoint([string]$key) {
    if (-not $script:Calibration.ContainsKey($key)) { return $null }
    if ($script:TargetHwnd -eq [IntPtr]::Zero -or -not [Mis2Win32]::IsWindow($script:TargetHwnd)) {
        $auto = Find-OracleFormsWindow
        if ($auto) {
            $script:TargetHwnd = $auto.Hwnd
            $script:TargetWinTitle = $auto.Title
        } else {
            return $null
        }
    }
    $info = [Mis2Win32]::GetWindowInfo($script:TargetHwnd)
    if (-not $info) { return $null }
    $pt = $script:Calibration[$key]
    $absX = $info.Left + [int]$pt.dx
    $absY = $info.Top  + [int]$pt.dy
    return @{ X = $absX; Y = $absY; Win = $info }
}

function Set-ClipboardSafe([string]$text) {
    if ($null -eq $text) { $text = "" }
    for ($try = 0; $try -lt 5; $try++) {
        try {
            if ($text -eq "") {
                [System.Windows.Forms.Clipboard]::Clear()
            } else {
                [System.Windows.Forms.Clipboard]::SetText($text, [System.Windows.Forms.TextDataFormat]::UnicodeText)
            }
            return $true
        } catch {
            Start-Sleep -Milliseconds 50
        }
    }
    return $false
}

function Invoke-PasteAtCurrentCursor([string]$text, [bool]$isMultiline = $false) {
    if ([string]::IsNullOrEmpty($text)) { return $false }
    if ($script:TargetHwnd -eq [IntPtr]::Zero -or -not [Mis2Win32]::IsWindow($script:TargetHwnd)) {
        $auto = Find-OracleFormsWindow
        if ($auto) {
            $script:TargetHwnd = $auto.Hwnd
            $script:TargetWinTitle = $auto.Title
        }
    }
    Set-ClipboardSafe $text | Out-Null
    if ($script:TargetHwnd -ne [IntPtr]::Zero -and [Mis2Win32]::IsWindow($script:TargetHwnd)) {
        [Mis2Win32]::FocusWindow($script:TargetHwnd) | Out-Null
        Start-Sleep -Milliseconds 180
        if ($script:Config["clearBeforePaste"]) {
            [Mis2Win32]::SelectAllAndClear($isMultiline)
            Start-Sleep -Milliseconds 70
        }
        [Mis2Win32]::HardwarePaste()
        Start-Sleep -Milliseconds 90
        return $true
    }
    return $false
}

function Invoke-FillCalibratedField([string]$key, [string]$text, [bool]$isMultiline = $false, [bool]$clickOnly = $false) {
    if ([Mis2Win32]::IsEmergencyStopTriggered()) {
        throw "EMERGENCY_STOP"
    }
    $pos = Resolve-CalibPoint $key
    if (-not $pos) { return $false }

    [Mis2Win32]::FocusWindow($script:TargetHwnd) | Out-Null
    Start-Sleep -Milliseconds 100
    if ([Mis2Win32]::IsEmergencyStopTriggered()) { throw "EMERGENCY_STOP" }

    [Mis2Win32]::LeftClick($pos.X, $pos.Y)
    $delay = [int]$script:Config["stepDelayMs"]
    if ($delay -lt 80) { $delay = 80 }
    Start-Sleep -Milliseconds $delay

    if ($clickOnly) { return $true }

    if ([Mis2Win32]::IsEmergencyStopTriggered()) { throw "EMERGENCY_STOP" }
    if ($script:Config["clearBeforePaste"]) {
        [Mis2Win32]::SelectAllAndClear($isMultiline)
        Start-Sleep -Milliseconds 70
    }
    Set-ClipboardSafe $text | Out-Null
    Start-Sleep -Milliseconds 50
    [Mis2Win32]::HardwarePaste()
    Start-Sleep -Milliseconds $delay
    return $true
}

# ==============================================================================
# 5. Calibration Wizard Dialog (1-Time Per PC — Hover + F8, F9 to Skip)
# ==============================================================================
function Show-CalibrationDialog {
    if ($script:TargetHwnd -eq [IntPtr]::Zero -or -not [Mis2Win32]::IsWindow($script:TargetHwnd)) {
        $auto = Find-OracleFormsWindow
        if ($auto) {
            $script:TargetHwnd = $auto.Hwnd
            $script:TargetWinTitle = $auto.Title
        }
    }

    $dlg = New-Object System.Windows.Forms.Form
    $dlg.Text = "🎯 ตั้งพิกัดหน้าจอ Oracle Forms (ทำครั้งเดียวต่อเครื่อง)"
    $dlg.Size = New-Object System.Drawing.Size(560, 560)
    $dlg.StartPosition = "CenterScreen"
    $dlg.TopMost = $true
    $dlg.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)
    $dlg.BackColor = [System.Drawing.Color]::FromArgb(245, 248, 252)

    $lblHelp = New-Object System.Windows.Forms.Label
    $lblHelp.Location = New-Object System.Drawing.Point(12, 10)
    $lblHelp.Size = New-Object System.Drawing.Size(520, 62)
    $lblHelp.BackColor = [System.Drawing.Color]::FromArgb(224, 242, 254)
    $lblHelp.ForeColor = [System.Drawing.Color]::FromArgb(12, 74, 110)
    $lblHelp.Padding = New-Object System.Windows.Forms.Padding(8)
    $lblHelp.Text = "วิธีตั้งพิกัด (ใช้เวลาไม่ถึง 1 นาที):`r`n1. เปิดหน้าต่าง Oracle Forms (FRM_PAY_DOC) ไว้ข้างๆ`r`n2. เลือกรายการด้านล่าง ➔ เลื่อนเมาส์ไปวางบนช่องนั้น ➔ กดปุ่ม [F8] เพื่อบันทึก (กด [F9] เพื่อข้าม)"
    $dlg.Controls.Add($lblHelp)

    $lblWin = New-Object System.Windows.Forms.Label
    $lblWin.Location = New-Object System.Drawing.Point(12, 78)
    $lblWin.Size = New-Object System.Drawing.Size(520, 22)
    $lblWin.ForeColor = [System.Drawing.Color]::FromArgb(15, 118, 110)
    $lblWin.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    $lblWin.Text = if ($script:TargetWinTitle) { "หน้าต่างเป้าหมาย: $($script:TargetWinTitle)" } else { "⚠️ ยังไม่ได้เลือกหน้าต่างเป้าหมาย — วางเมาส์บน Oracle Forms แล้วกดปุ่ม F8 ระบบจะจับให้อัตโนมัติ" }
    $dlg.Controls.Add($lblWin)

    $lv = New-Object System.Windows.Forms.ListView
    $lv.Location = New-Object System.Drawing.Point(12, 105)
    $lv.Size = New-Object System.Drawing.Size(520, 315)
    $lv.View = [System.Windows.Forms.View]::Details
    $lv.FullRowSelect = $true
    $lv.GridLines = $true
    $lv.Columns.Add("กลุ่ม", 145) | Out-Null
    $lv.Columns.Add("ช่องเป้าหมายใน Oracle Forms", 255) | Out-Null
    $lv.Columns.Add("สถานะพิกัด", 100) | Out-Null
    $dlg.Controls.Add($lv)

    $refreshCalibList = {
        $selIdx = if ($lv.SelectedIndices.Count -gt 0) { $lv.SelectedIndices[0] } else { 0 }
        $lv.Items.Clear()
        foreach ($def in $script:CalibDefinitions) {
            $item = New-Object System.Windows.Forms.ListViewItem($def.Group)
            $item.SubItems.Add($def.Label) | Out-Null
            if ($script:Calibration.ContainsKey($def.Key)) {
                $p = $script:Calibration[$def.Key]
                $item.SubItems.Add("✓ ($($p.dx), $($p.dy))") | Out-Null
                $item.BackColor = [System.Drawing.Color]::FromArgb(236, 253, 245)
            } else {
                $item.SubItems.Add("ยังไม่ตั้ง") | Out-Null
            }
            $item.Tag = $def
            $lv.Items.Add($item) | Out-Null
        }
        if ($lv.Items.Count -gt 0) {
            if ($selIdx -ge $lv.Items.Count) { $selIdx = $lv.Items.Count - 1 }
            $lv.Items[$selIdx].Selected = $true
            $lv.Items[$selIdx].EnsureVisible()
        }
    }
    & $refreshCalibList

    $lblLive = New-Object System.Windows.Forms.Label
    $lblLive.Location = New-Object System.Drawing.Point(12, 428)
    $lblLive.Size = New-Object System.Drawing.Size(520, 36)
    $lblLive.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
    $lblLive.ForeColor = [System.Drawing.Color]::FromArgb(30, 64, 175)
    $lblLive.Text = "วางเมาส์บนช่องเป้าหมายแล้วกด F8..."
    $dlg.Controls.Add($lblLive)

    $btnTest = New-Object System.Windows.Forms.Button
    $btnTest.Text = "🔍 ทดสอบชี้ตำแหน่ง (ไม่คลิก)"
    $btnTest.Location = New-Object System.Drawing.Point(12, 472)
    $btnTest.Size = New-Object System.Drawing.Size(185, 34)
    $btnTest.BackColor = [System.Drawing.Color]::FromArgb(224, 242, 254)
    $btnTest.FlatStyle = "Flat"
    $btnTest.Add_Click({
        if ($lv.SelectedItems.Count -eq 0) { return }
        $def = $lv.SelectedItems[0].Tag
        $pos = Resolve-CalibPoint $def.Key
        if (-not $pos) {
            [System.Windows.Forms.MessageBox]::Show("ยังไม่ได้ตั้งพิกัดสำหรับ '$($def.Label)' หรือไม่พบหน้าต่าง Oracle Forms", "แจ้งเตือน")
            return
        }
        [Mis2Win32]::FocusWindow($script:TargetHwnd) | Out-Null
        Start-Sleep -Milliseconds 120
        [Mis2Win32]::SetCursorPos($pos.X, $pos.Y) | Out-Null
    })
    $dlg.Controls.Add($btnTest)

    $btnDel = New-Object System.Windows.Forms.Button
    $btnDel.Text = "🗑️ ล้างพิกัดแถวนี้"
    $btnDel.Location = New-Object System.Drawing.Point(205, 472)
    $btnDel.Size = New-Object System.Drawing.Size(130, 34)
    $btnDel.BackColor = [System.Drawing.Color]::FromArgb(254, 226, 226)
    $btnDel.FlatStyle = "Flat"
    $btnDel.Add_Click({
        if ($lv.SelectedItems.Count -eq 0) { return }
        $def = $lv.SelectedItems[0].Tag
        if ($script:Calibration.ContainsKey($def.Key)) {
            $script:Calibration.Remove($def.Key)
            Save-Calibration
            & $refreshCalibList
        }
    })
    $dlg.Controls.Add($btnDel)

    $btnClose = New-Object System.Windows.Forms.Button
    $btnClose.Text = "✓ เสร็จสิ้น"
    $btnClose.Location = New-Object System.Drawing.Point(412, 472)
    $btnClose.Size = New-Object System.Drawing.Size(120, 34)
    $btnClose.BackColor = [System.Drawing.Color]::FromArgb(16, 185, 129)
    $btnClose.ForeColor = [System.Drawing.Color]::White
    $btnClose.FlatStyle = "Flat"
    $btnClose.Add_Click({ $dlg.Close() })
    $dlg.Controls.Add($btnClose)

    $script:lastF8Down = $false
    $script:lastF9Down = $false

    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 70
    $timer.Add_Tick({
        $pt = New-Object Mis2Win32+POINT
        [Mis2Win32]::GetCursorPos([ref]$pt) | Out-Null
        $relText = "เมาส์: ($($pt.X), $($pt.Y))"
        if ($script:TargetHwnd -ne [IntPtr]::Zero -and [Mis2Win32]::IsWindow($script:TargetHwnd)) {
            $w = [Mis2Win32]::GetWindowInfo($script:TargetHwnd)
            if ($w) {
                $relText += "  |  สัมพัทธ์กับ Oracle: dx=$($pt.X - $w.Left), dy=$($pt.Y - $w.Top)"
            }
        }
        $curLabel = if ($lv.SelectedItems.Count -gt 0) { $lv.SelectedItems[0].Tag.Label } else { "-" }
        $lblLive.Text = "กำลังตั้ง: $curLabel`r`n$relText"

        $f8Down = [Mis2Win32]::IsKeyDown([Mis2Win32]::VK_F8)
        if ($f8Down -and -not $script:lastF8Down) {
            if ($lv.SelectedItems.Count -gt 0) {
                # Auto-detect window under cursor if TargetHwnd not locked yet
                if ($script:TargetHwnd -eq [IntPtr]::Zero -or -not [Mis2Win32]::IsWindow($script:TargetHwnd)) {
                    $under = [Mis2Win32]::GetTopWindowAtCursor()
                    if ($under -ne [IntPtr]::Zero -and $under -ne $dlg.Handle) {
                        $wi = [Mis2Win32]::GetWindowInfo($under)
                        if ($wi) {
                            $script:TargetHwnd = $wi.Hwnd
                            $script:TargetWinTitle = $wi.Title
                            $lblWin.Text = "หน้าต่างเป้าหมาย: $($wi.Title)"
                        }
                    }
                }
                if ($script:TargetHwnd -ne [IntPtr]::Zero -and [Mis2Win32]::IsWindow($script:TargetHwnd)) {
                    $w = [Mis2Win32]::GetWindowInfo($script:TargetHwnd)
                    $def = $lv.SelectedItems[0].Tag
                    $script:Calibration[$def.Key] = @{
                        dx   = [int]($pt.X - $w.Left)
                        dy   = [int]($pt.Y - $w.Top)
                        winW = [int]$w.Width
                        winH = [int]$w.Height
                    }
                    Save-Calibration
                    [System.Media.SystemSounds]::Asterisk.Play()
                    $nextIdx = $lv.SelectedIndices[0] + 1
                    & $refreshCalibList
                    if ($nextIdx -lt $lv.Items.Count) {
                        $lv.Items[$nextIdx].Selected = $true
                        $lv.Items[$nextIdx].EnsureVisible()
                    }
                }
            }
        }
        $script:lastF8Down = $f8Down

        $f9Down = [Mis2Win32]::IsKeyDown([Mis2Win32]::VK_F9)
        if ($f9Down -and -not $script:lastF9Down) {
            if ($lv.SelectedItems.Count -gt 0) {
                $nextIdx = $lv.SelectedIndices[0] + 1
                if ($nextIdx -lt $lv.Items.Count) {
                    $lv.Items[$nextIdx].Selected = $true
                    $lv.Items[$nextIdx].EnsureVisible()
                }
            }
        }
        $script:lastF9Down = $f9Down
    })
    $dlg.Add_Shown({ $timer.Start() })
    $dlg.Add_FormClosing({ $timer.Stop(); $timer.Dispose() })
    $dlg.ShowDialog() | Out-Null
}

# ==============================================================================
# 6. Window Picker Dialog (Pick Oracle Forms Window Manually if Needed)
# ==============================================================================
function Show-WindowPickerDialog {
    $wins = [Mis2Win32]::GetVisibleWindows() | Where-Object { $_.Title -notmatch "BMA MIS2" }
    $dlg = New-Object System.Windows.Forms.Form
    $dlg.Text = "เลือกหน้าต่าง Oracle Forms เป้าหมาย"
    $dlg.Size = New-Object System.Drawing.Size(500, 340)
    $dlg.StartPosition = "CenterScreen"
    $dlg.TopMost = $true
    $dlg.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)

    $lb = New-Object System.Windows.Forms.ListBox
    $lb.Location = New-Object System.Drawing.Point(12, 12)
    $lb.Size = New-Object System.Drawing.Size(460, 235)
    foreach ($w in $wins) { $lb.Items.Add($w) | Out-Null }
    if ($lb.Items.Count -gt 0) { $lb.SelectedIndex = 0 }
    $dlg.Controls.Add($lb)

    $btnOk = New-Object System.Windows.Forms.Button
    $btnOk.Text = "✓ เลือกหน้าต่างนี้"
    $btnOk.Location = New-Object System.Drawing.Point(342, 256)
    $btnOk.Size = New-Object System.Drawing.Size(130, 32)
    $btnOk.BackColor = [System.Drawing.Color]::FromArgb(13, 148, 136)
    $btnOk.ForeColor = [System.Drawing.Color]::White
    $btnOk.FlatStyle = "Flat"
    $btnOk.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $dlg.Controls.Add($btnOk)
    $dlg.AcceptButton = $btnOk

    if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK -and $lb.SelectedItem) {
        $chosen = $lb.SelectedItem
        $script:TargetHwnd = $chosen.Hwnd
        $script:TargetWinTitle = $chosen.Title
        return $true
    }
    return $false
}

# ==============================================================================
# 7. Main Floating Control Panel UI (Always-on-Top beside Oracle Forms)
# ==============================================================================
Load-Config
Load-Calibration

[System.Windows.Forms.Application]::EnableVisualStyles()

$form = New-Object System.Windows.Forms.Form
$form.Text = "BMA MIS2 เบิกจ่ายอัตโนมัติ (FRM_PAY_DOC) — พัฒนาโดย ARISSARA.K"
$screenArea = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$initH = [Math]::Min(815, [Math]::Max(520, $screenArea.Height - 24))
$form.Size = New-Object System.Drawing.Size(475, $initH)
$form.MinimumSize = New-Object System.Drawing.Size(435, [Math]::Min(520, $initH))
$form.AutoScroll = $true
$form.StartPosition = "Manual"
$form.Location = New-Object System.Drawing.Point(([Math]::Max(10, $screenArea.Right - 485)), 12)
$form.TopMost = $true
$form.BackColor = [System.Drawing.Color]::FromArgb(244, 247, 251)
$form.Font = New-Object System.Drawing.Font("Segoe UI", 9)

# --- Top Header Panel ---
$header = New-Object System.Windows.Forms.Panel
$header.Dock = "Top"
$header.Height = 96
$header.BackColor = [System.Drawing.Color]::FromArgb(15, 76, 129)
$form.Controls.Add($header)

$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text = "💊 BMA MIS2 เบิกจ่ายอัตโนมัติ (FRM_PAY_DOC)"
$lblTitle.Location = New-Object System.Drawing.Point(12, 8)
$lblTitle.Size = New-Object System.Drawing.Size(350, 24)
$lblTitle.ForeColor = [System.Drawing.Color]::White
$lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$header.Controls.Add($lblTitle)

$chkTopMost = New-Object System.Windows.Forms.CheckBox
$chkTopMost.Text = "📌 ปักหมุด"
$chkTopMost.Checked = $true
$chkTopMost.Location = New-Object System.Drawing.Point(368, 9)
$chkTopMost.Size = New-Object System.Drawing.Size(85, 22)
$chkTopMost.ForeColor = [System.Drawing.Color]::FromArgb(186, 230, 253)
$chkTopMost.Add_CheckedChanged({ $form.TopMost = $chkTopMost.Checked })
$header.Controls.Add($chkTopMost)

$lblSafety = New-Object System.Windows.Forms.Label
$lblSafety.Text = "🛡️ โหมดปลอดภัย: หยุดก่อนบันทึกทุกครั้ง (คนกด Save เอง) | กด ESC หยุดทันที"
$lblSafety.Location = New-Object System.Drawing.Point(12, 34)
$lblSafety.Size = New-Object System.Drawing.Size(435, 20)
$lblSafety.ForeColor = [System.Drawing.Color]::FromArgb(254, 240, 138)
$lblSafety.Font = New-Object System.Drawing.Font("Segoe UI", 8.2, [System.Drawing.FontStyle]::Bold)
$header.Controls.Add($lblSafety)

$btnOpenWeb = New-Object System.Windows.Forms.Button
$btnOpenWeb.Text = "🌐 เปิด MIS2 (IE)"
$btnOpenWeb.Location = New-Object System.Drawing.Point(12, 60)
$btnOpenWeb.Size = New-Object System.Drawing.Size(110, 27)
$btnOpenWeb.BackColor = [System.Drawing.Color]::FromArgb(2, 132, 199)
$btnOpenWeb.ForeColor = [System.Drawing.Color]::White
$btnOpenWeb.FlatStyle = "Flat"
$btnOpenWeb.FlatAppearance.BorderSize = 0
$btnOpenWeb.Add_Click({
    $url = [string]$script:Config["mis2LoginUrl"]
    $iePaths = @(
        "$env:ProgramFiles\Internet Explorer\iexplore.exe",
        "${env:ProgramFiles(x86)}\Internet Explorer\iexplore.exe"
    )
    $ieExe = $iePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($ieExe) {
        try { Start-Process -FilePath $ieExe -ArgumentList $url; return } catch {}
    }
    Start-Process $url
})
$header.Controls.Add($btnOpenWeb)

$btnReload = New-Object System.Windows.Forms.Button
$btnReload.Text = "🔄 โหลด Sheet"
$btnReload.Location = New-Object System.Drawing.Point(128, 60)
$btnReload.Size = New-Object System.Drawing.Size(105, 27)
$btnReload.BackColor = [System.Drawing.Color]::FromArgb(13, 148, 136)
$btnReload.ForeColor = [System.Drawing.Color]::White
$btnReload.FlatStyle = "Flat"
$btnReload.FlatAppearance.BorderSize = 0
$header.Controls.Add($btnReload)

$btnTarget = New-Object System.Windows.Forms.Button
$btnTarget.Text = "🪟 เลือกหน้าต่าง"
$btnTarget.Location = New-Object System.Drawing.Point(239, 60)
$btnTarget.Size = New-Object System.Drawing.Size(102, 27)
$btnTarget.BackColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$btnTarget.ForeColor = [System.Drawing.Color]::White
$btnTarget.FlatStyle = "Flat"
$btnTarget.FlatAppearance.BorderSize = 0
$header.Controls.Add($btnTarget)

$btnCalib = New-Object System.Windows.Forms.Button
$btnCalib.Text = "🎯 ตั้งพิกัด"
$btnCalib.Location = New-Object System.Drawing.Point(347, 60)
$btnCalib.Size = New-Object System.Drawing.Size(98, 27)
$btnCalib.BackColor = [System.Drawing.Color]::FromArgb(217, 119, 6)
$btnCalib.ForeColor = [System.Drawing.Color]::White
$btnCalib.FlatStyle = "Flat"
$btnCalib.FlatAppearance.BorderSize = 0
$header.Controls.Add($btnCalib)

# --- Bottom Status & Developer Credit Bar ---
$lblDevCredit = New-Object System.Windows.Forms.Label
$lblDevCredit.Dock = "Bottom"
$lblDevCredit.Height = 20
$lblDevCredit.BackColor = [System.Drawing.Color]::FromArgb(15, 23, 42)
$lblDevCredit.ForeColor = [System.Drawing.Color]::FromArgb(148, 163, 184)
$lblDevCredit.TextAlign = "MiddleRight"
$lblDevCredit.Padding = New-Object System.Windows.Forms.Padding(8, 0, 10, 0)
$lblDevCredit.Font = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Bold)
$lblDevCredit.Text = "ผู้พัฒนา: ARISSARA.K"
$form.Controls.Add($lblDevCredit)

$statusBar = New-Object System.Windows.Forms.Label
$statusBar.Dock = "Bottom"
$statusBar.Height = 26
$statusBar.BackColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$statusBar.ForeColor = [System.Drawing.Color]::FromArgb(226, 232, 240)
$statusBar.TextAlign = "MiddleLeft"
$statusBar.Padding = New-Object System.Windows.Forms.Padding(8, 0, 8, 0)
$statusBar.Text = "กำลังเตรียมโหลดข้อมูลจาก Google Sheets..."
$form.Controls.Add($statusBar)

# --- Main Scrollable Body ---
$body = New-Object System.Windows.Forms.Panel
$body.Dock = "Fill"
$body.AutoScroll = $true
$body.Padding = New-Object System.Windows.Forms.Padding(10)
$form.Controls.Add($body)
$body.BringToFront()

$y = 8

# --- Target Window Status Strip ---
$lblTargetStatus = New-Object System.Windows.Forms.Label
$lblTargetStatus.Location = New-Object System.Drawing.Point(10, $y)
$lblTargetStatus.Size = New-Object System.Drawing.Size(430, 22)
$lblTargetStatus.BackColor = [System.Drawing.Color]::FromArgb(226, 232, 240)
$lblTargetStatus.ForeColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$lblTargetStatus.Padding = New-Object System.Windows.Forms.Padding(6, 3, 6, 0)
$lblTargetStatus.Text = "🪟 หน้าต่าง Oracle Forms: กำลังค้นหา..."
$body.Controls.Add($lblTargetStatus)
$y += 28

# --- Fiscal Year Selector Bar (starts at 70, expandable & per-year target files) ---
$pnlFy = New-Object System.Windows.Forms.Panel
$pnlFy.Location = New-Object System.Drawing.Point(10, $y)
$pnlFy.Size = New-Object System.Drawing.Size(430, 32)
$pnlFy.BackColor = [System.Drawing.Color]::FromArgb(224, 242, 254)
$body.Controls.Add($pnlFy)

$lblFy = New-Object System.Windows.Forms.Label
$lblFy.Text = "📅 ปีงบประมาณ:"
$lblFy.Location = New-Object System.Drawing.Point(8, 7)
$lblFy.Size = New-Object System.Drawing.Size(96, 20)
$lblFy.ForeColor = [System.Drawing.Color]::FromArgb(12, 74, 110)
$lblFy.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$pnlFy.Controls.Add($lblFy)

$cmbFiscalYear = New-Object System.Windows.Forms.ComboBox
$cmbFiscalYear.Location = New-Object System.Drawing.Point(106, 4)
$cmbFiscalYear.Size = New-Object System.Drawing.Size(86, 24)
$cmbFiscalYear.DropDownStyle = "DropDownList"
$cmbFiscalYear.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$pnlFy.Controls.Add($cmbFiscalYear)

$lblFyFileStatus = New-Object System.Windows.Forms.Label
$lblFyFileStatus.Location = New-Object System.Drawing.Point(198, 7)
$lblFyFileStatus.Size = New-Object System.Drawing.Size(112, 20)
$lblFyFileStatus.ForeColor = [System.Drawing.Color]::FromArgb(15, 118, 110)
$lblFyFileStatus.Font = New-Object System.Drawing.Font("Segoe UI", 8.2, [System.Drawing.FontStyle]::Bold)
$lblFyFileStatus.Text = "ไฟล์: MISS70"
$pnlFy.Controls.Add($lblFyFileStatus)

$btnFyConfig = New-Object System.Windows.Forms.Button
$btnFyConfig.Text = "⚙️ ตั้งค่าไฟล์ปีงบ"
$btnFyConfig.Location = New-Object System.Drawing.Point(312, 3)
$btnFyConfig.Size = New-Object System.Drawing.Size(112, 26)
$btnFyConfig.BackColor = [System.Drawing.Color]::FromArgb(2, 132, 199)
$btnFyConfig.ForeColor = [System.Drawing.Color]::White
$btnFyConfig.Font = New-Object System.Drawing.Font("Segoe UI", 8.2, [System.Drawing.FontStyle]::Bold)
$btnFyConfig.FlatStyle = "Flat"
$btnFyConfig.FlatAppearance.BorderSize = 0
$pnlFy.Controls.Add($btnFyConfig)

$y += 38

# --- Section 1: Data Source Selection ---
$grpSource = New-Object System.Windows.Forms.GroupBox
$grpSource.Text = " 1. ค้นหารายการเบิกจ่าย (Auto Crat-EGP70 + MISS70 + ทะเบียนบริษัท) "
$grpSource.Location = New-Object System.Drawing.Point(10, $y)
$grpSource.Size = New-Object System.Drawing.Size(430, 178)
$grpSource.BackColor = [System.Drawing.Color]::White
$body.Controls.Add($grpSource)

$lblSearchCode = New-Object System.Windows.Forms.Label
$lblSearchCode.Text = "ค้นหารหัส ซ. (เช่น 1งบ, 7งบ):"
$lblSearchCode.Location = New-Object System.Drawing.Point(10, 22)
$lblSearchCode.Size = New-Object System.Drawing.Size(165, 20)
$grpSource.Controls.Add($lblSearchCode)

$txtSearchCode = New-Object System.Windows.Forms.TextBox
$txtSearchCode.Location = New-Object System.Drawing.Point(175, 19)
$txtSearchCode.Size = New-Object System.Drawing.Size(115, 24)
$grpSource.Controls.Add($txtSearchCode)

$btnClearCode = New-Object System.Windows.Forms.Button
$btnClearCode.Text = "แสดงทั้งหมด"
$btnClearCode.Location = New-Object System.Drawing.Point(296, 18)
$btnClearCode.Size = New-Object System.Drawing.Size(120, 25)
$btnClearCode.FlatStyle = "Flat"
$grpSource.Controls.Add($btnClearCode)

$cmbItem = New-Object System.Windows.Forms.ComboBox
$cmbItem.Location = New-Object System.Drawing.Point(10, 48)
$cmbItem.Size = New-Object System.Drawing.Size(406, 24)
$cmbItem.DropDownStyle = "DropDownList"
$grpSource.Controls.Add($cmbItem)

$lblSearchVendor = New-Object System.Windows.Forms.Label
$lblSearchVendor.Text = "หรือค้นหาบริษัท (ทะเบียนบริษัท):"
$lblSearchVendor.Location = New-Object System.Drawing.Point(10, 80)
$lblSearchVendor.Size = New-Object System.Drawing.Size(175, 20)
$grpSource.Controls.Add($lblSearchVendor)

$txtSearchVendor = New-Object System.Windows.Forms.TextBox
$txtSearchVendor.Location = New-Object System.Drawing.Point(188, 77)
$txtSearchVendor.Size = New-Object System.Drawing.Size(228, 24)
$grpSource.Controls.Add($txtSearchVendor)

$cmbVendor = New-Object System.Windows.Forms.ComboBox
$cmbVendor.Location = New-Object System.Drawing.Point(10, 105)
$cmbVendor.Size = New-Object System.Drawing.Size(406, 24)
$cmbVendor.DropDownStyle = "DropDownList"
$grpSource.Controls.Add($cmbVendor)

$lblAlert = New-Object System.Windows.Forms.Label
$lblAlert.Location = New-Object System.Drawing.Point(10, 134)
$lblAlert.Size = New-Object System.Drawing.Size(406, 36)
$lblAlert.BackColor = [System.Drawing.Color]::FromArgb(241, 245, 249)
$lblAlert.ForeColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$lblAlert.Padding = New-Object System.Windows.Forms.Padding(6, 3, 6, 3)
$lblAlert.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
$lblAlert.Text = "เลือกรายการงบหรือบริษัทด้านบน ข้อมูลจะถูกเติมพร้อมกรอกทันที"
$grpSource.Controls.Add($lblAlert)

$y += 184

# --- Section 2: 3-Tab Oracle Forms Mirror ---
$tabs = New-Object System.Windows.Forms.TabControl
$tabs.Location = New-Object System.Drawing.Point(10, $y)
$tabs.Size = New-Object System.Drawing.Size(430, 388)
$body.Controls.Add($tabs)

# Helper to create quick-inject button beside each field (uses Tag — 100% PS 5.1 safe)
function Add-QuickPasteBtn($parent, [int]$x, [int]$yPos, $targetControl, [bool]$isMultiline = $false) {
    $b = New-Object System.Windows.Forms.Button
    $b.Text = "📋"
    $b.Location = New-Object System.Drawing.Point($x, $yPos)
    $b.Size = New-Object System.Drawing.Size(34, 24)
    $b.BackColor = [System.Drawing.Color]::FromArgb(224, 242, 254)
    $b.FlatStyle = "Flat"
    $b.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(125, 211, 252)
    $b.Tag = @{ Control = $targetControl; Multi = $isMultiline }
    $tip = New-Object System.Windows.Forms.ToolTip
    $tip.SetToolTip($b, "คลิกช่องใน Oracle Forms แล้วกดปุ่มนี้เพื่อวางข้อความลงช่องทันที")
    $b.Add_Click({
        param($sender, $e)
        $meta = $sender.Tag
        $val = ([string]$meta.Control.Text).Trim()
        if ([string]::IsNullOrWhiteSpace($val)) {
            $statusBar.Text = "⚠️ ไม่มีข้อมูลในช่องนี้ให้วาง"
            return
        }
        $ok = Invoke-PasteAtCurrentCursor -text $val -isMultiline ([bool]$meta.Multi)
        if ($ok) {
            $statusBar.Text = "✓ วางข้อความลงช่องที่เลือกใน Oracle Forms แล้ว"
        } else {
            Set-ClipboardSafe $val | Out-Null
            $statusBar.Text = "📋 คัดลอกลงคลิปบอร์ดแล้ว (กด Ctrl+V ใน Oracle Forms)"
        }
    })
    $parent.Controls.Add($b)
    return $b
}

# ===================== TAB 1: ขั้นที่ 1 อ้างอิงใบตรวจรับ =====================
$tab1 = New-Object System.Windows.Forms.TabPage
$tab1.Text = "ขั้น 1: ใบตรวจรับ"
$tab1.BackColor = [System.Drawing.Color]::White
$tabs.TabPages.Add($tab1)

$lblRcv = New-Object System.Windows.Forms.Label
$lblRcv.Text = "เอกสารตรวจรับงานซื้อ/จ้าง (เลขที่ / ปี):"
$lblRcv.Location = New-Object System.Drawing.Point(12, 16)
$lblRcv.Size = New-Object System.Drawing.Size(260, 20)
$lblRcv.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$tab1.Controls.Add($lblRcv)

$txtRcvNo = New-Object System.Windows.Forms.TextBox
$txtRcvNo.Location = New-Object System.Drawing.Point(12, 40)
$txtRcvNo.Size = New-Object System.Drawing.Size(110, 25)
$txtRcvNo.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$tab1.Controls.Add($txtRcvNo)
Add-QuickPasteBtn $tab1 126 40 $txtRcvNo $false | Out-Null

$lblSlash = New-Object System.Windows.Forms.Label
$lblSlash.Text = "/"
$lblSlash.Location = New-Object System.Drawing.Point(168, 42)
$lblSlash.Size = New-Object System.Drawing.Size(16, 24)
$lblSlash.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$tab1.Controls.Add($lblSlash)

$txtRcvYear = New-Object System.Windows.Forms.TextBox
$txtRcvYear.Text = [string]$script:Config["fiscalYear"]
$txtRcvYear.Location = New-Object System.Drawing.Point(188, 40)
$txtRcvYear.Size = New-Object System.Drawing.Size(60, 25)
$txtRcvYear.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$tab1.Controls.Add($txtRcvYear)
Add-QuickPasteBtn $tab1 252 40 $txtRcvYear $false | Out-Null

$lblItemSummary = New-Object System.Windows.Forms.Label
$lblItemSummary.Location = New-Object System.Drawing.Point(12, 72)
$lblItemSummary.Size = New-Object System.Drawing.Size(396, 86)
$lblItemSummary.BackColor = [System.Drawing.Color]::FromArgb(248, 250, 252)
$lblItemSummary.BorderStyle = "FixedSingle"
$lblItemSummary.Padding = New-Object System.Windows.Forms.Padding(6)
$lblItemSummary.Text = "สรุปรายการจาก Google Sheets:`r`n- เลขที่ใบสั่งซื้อ: -  |  ยอดเงิน: -`r`n- บริษัท: -`r`n- เรื่อง: -"
$tab1.Controls.Add($lblItemSummary)

$lblVat = New-Object System.Windows.Forms.Label
$lblVat.Text = "ภาษีมูลค่าเพิ่ม (7%):"
$lblVat.Location = New-Object System.Drawing.Point(12, 166)
$lblVat.Size = New-Object System.Drawing.Size(118, 20)
$lblVat.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
$tab1.Controls.Add($lblVat)

$txtVatAmount = New-Object System.Windows.Forms.TextBox
$txtVatAmount.Location = New-Object System.Drawing.Point(132, 163)
$txtVatAmount.Size = New-Object System.Drawing.Size(102, 23)
$txtVatAmount.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$tab1.Controls.Add($txtVatAmount)
Add-QuickPasteBtn $tab1 238 163 $txtVatAmount $false | Out-Null

$lblWht = New-Object System.Windows.Forms.Label
$lblWht.Text = "หักภาษีเงินได้ (1%):"
$lblWht.Location = New-Object System.Drawing.Point(12, 194)
$lblWht.Size = New-Object System.Drawing.Size(118, 20)
$lblWht.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
$tab1.Controls.Add($lblWht)

$txtWhtAmount = New-Object System.Windows.Forms.TextBox
$txtWhtAmount.Location = New-Object System.Drawing.Point(132, 191)
$txtWhtAmount.Size = New-Object System.Drawing.Size(102, 23)
$txtWhtAmount.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$tab1.Controls.Add($txtWhtAmount)
Add-QuickPasteBtn $tab1 238 191 $txtWhtAmount $false | Out-Null

$lblWhtBadge = New-Object System.Windows.Forms.Label
$lblWhtBadge.Location = New-Object System.Drawing.Point(278, 163)
$lblWhtBadge.Size = New-Object System.Drawing.Size(130, 51)
$lblWhtBadge.BackColor = [System.Drawing.Color]::FromArgb(241, 245, 249)
$lblWhtBadge.ForeColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$lblWhtBadge.BorderStyle = "FixedSingle"
$lblWhtBadge.TextAlign = "MiddleCenter"
$lblWhtBadge.Font = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Bold)
$lblWhtBadge.Text = "สุทธิที่จ่าย:`r`n-"
$tab1.Controls.Add($lblWhtBadge)

$btnRunStep1 = New-Object System.Windows.Forms.Button
$btnRunStep1.Text = "⚡ ขั้นที่ 1: กรอกเลขใบตรวจรับ + กดแว่นขยาย 🔍"
$btnRunStep1.Location = New-Object System.Drawing.Point(12, 224)
$btnRunStep1.Size = New-Object System.Drawing.Size(396, 38)
$btnRunStep1.BackColor = [System.Drawing.Color]::FromArgb(2, 132, 199)
$btnRunStep1.ForeColor = [System.Drawing.Color]::White
$btnRunStep1.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$btnRunStep1.FlatStyle = "Flat"
$btnRunStep1.FlatAppearance.BorderSize = 0
$tab1.Controls.Add($btnRunStep1)

$btnRunStep15 = New-Object System.Windows.Forms.Button
$btnRunStep15.Text = "⚡ ขั้นที่ 1.5: กด 'รายละเอียด' → ติ๊กงบประมาณ → กด 'ตกลง'"
$btnRunStep15.Location = New-Object System.Drawing.Point(12, 268)
$btnRunStep15.Size = New-Object System.Drawing.Size(396, 35)
$btnRunStep15.BackColor = [System.Drawing.Color]::FromArgb(14, 116, 144)
$btnRunStep15.ForeColor = [System.Drawing.Color]::White
$btnRunStep15.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$btnRunStep15.FlatStyle = "Flat"
$btnRunStep15.FlatAppearance.BorderSize = 0
$tab1.Controls.Add($btnRunStep15)

$btnRunStep16 = New-Object System.Windows.Forms.Button
$btnRunStep16.Text = "⚡ ขั้นที่ 1.6: กรอกภาษีมูลค่าเพิ่ม (7%) + หักภาษีเงินได้ (1%)"
$btnRunStep16.Location = New-Object System.Drawing.Point(12, 309)
$btnRunStep16.Size = New-Object System.Drawing.Size(396, 38)
$btnRunStep16.BackColor = [System.Drawing.Color]::FromArgb(3, 105, 161)
$btnRunStep16.ForeColor = [System.Drawing.Color]::White
$btnRunStep16.Font = New-Object System.Drawing.Font("Segoe UI", 9.2, [System.Drawing.FontStyle]::Bold)
$btnRunStep16.FlatStyle = "Flat"
$btnRunStep16.FlatAppearance.BorderSize = 0
$tab1.Controls.Add($btnRunStep16)

# ===================== TAB 2: ขั้นที่ 2 แท็บผู้รับเงิน =====================
$tab2 = New-Object System.Windows.Forms.TabPage
$tab2.Text = "ขั้น 2: ผู้รับเงิน"
$tab2.BackColor = [System.Drawing.Color]::White
$tab2.AutoScroll = $true
$tabs.TabPages.Add($tab2)

$af = $script:Config["autoFillFields"]
function Get-AfBool([string]$k, [bool]$def) {
    if ($null -eq $af) { return $def }
    if ($af -is [hashtable] -and $af.ContainsKey($k)) { return [bool]$af[$k] }
    if ($af.PSObject.Properties[$k]) { return [bool]$af.$k }
    return $def
}

$t2y = 12
function Add-PayeeRow([string]$chkKey, [string]$label, [bool]$defChecked, [bool]$isMulti = $false) {
    $chk = New-Object System.Windows.Forms.CheckBox
    $chk.Text = $label
    $chk.Checked = Get-AfBool $chkKey $defChecked
    $chk.Location = New-Object System.Drawing.Point(8, $script:t2y)
    $chk.Size = New-Object System.Drawing.Size(128, 22)
    $chk.Font = New-Object System.Drawing.Font("Segoe UI", 8.5)
    $tab2.Controls.Add($chk)

    $tb = New-Object System.Windows.Forms.TextBox
    $tb.Location = New-Object System.Drawing.Point(138, ($script:t2y - 1))
    if ($isMulti) {
        $tb.Multiline = $true
        $tb.ScrollBars = "Vertical"
        $tb.Size = New-Object System.Drawing.Size(222, 42)
    } else {
        $tb.Size = New-Object System.Drawing.Size(222, 23)
    }
    $tab2.Controls.Add($tb)
    Add-QuickPasteBtn $tab2 364 ($script:t2y - 1) $tb $isMulti | Out-Null

    $script:t2y += if ($isMulti) { 47 } else { 32 }
    return @{ Check = $chk; Box = $tb }
}

$lblPayeeNote = New-Object System.Windows.Forms.Label
$lblPayeeNote.Location = New-Object System.Drawing.Point(8, $t2y)
$lblPayeeNote.Size = New-Object System.Drawing.Size(390, 32)
$lblPayeeNote.BackColor = [System.Drawing.Color]::FromArgb(241, 245, 249)
$lblPayeeNote.ForeColor = [System.Drawing.Color]::FromArgb(71, 85, 105)
$lblPayeeNote.Padding = New-Object System.Windows.Forms.Padding(6, 4, 6, 4)
$lblPayeeNote.Font = New-Object System.Drawing.Font("Segoe UI", 8)
$lblPayeeNote.Text = "* ชื่อเจ้าหนี้ / เลขผู้เสียภาษี / ทะเบียนการค้า / ที่อยู่ ระบบ MIS2 ขึ้นให้อัตโนมัติอยู่แล้ว`r`n  ด้านล่างคือ 5 ช่องที่ต้องกรอกเพิ่มจาก ทะเบียนบริษัท (EGP+MIS):"
$tab2.Controls.Add($lblPayeeNote)
$t2y += 40

$rPayTo = Add-PayeeRow "payTo" "จ่ายให้ (Col A)" $true $false

# โดยมอบให้ (ComboBox with presets)
$chkAssign = New-Object System.Windows.Forms.CheckBox
$chkAssign.Text = "โดยมอบให้"
$chkAssign.Checked = Get-AfBool "assignTo" $true
$chkAssign.Location = New-Object System.Drawing.Point(8, $t2y)
$chkAssign.Size = New-Object System.Drawing.Size(128, 22)
$chkAssign.Font = New-Object System.Drawing.Font("Segoe UI", 8.5)
$tab2.Controls.Add($chkAssign)

$cmbAssign = New-Object System.Windows.Forms.ComboBox
$cmbAssign.Location = New-Object System.Drawing.Point(138, ($t2y - 1))
$cmbAssign.Size = New-Object System.Drawing.Size(222, 23)
foreach ($p in $script:Config["assignToPresets"]) { $cmbAssign.Items.Add($p) | Out-Null }
$cmbAssign.Text = [string]$script:Config["defaultAssignTo"]
$tab2.Controls.Add($cmbAssign)
Add-QuickPasteBtn $tab2 364 ($t2y - 1) $cmbAssign $false | Out-Null
$t2y += 32

# Bank Code + Branch Code + Account No + Branch Info Strip
$rBankCode   = Add-PayeeRow "bankCode"   "รหัสธนาคาร (Col B)" $true $false
$rBranchCode = Add-PayeeRow "branchCode" "รหัสสาขา (4 หลัก)"  $true $false
$rAccountNo  = Add-PayeeRow "accountNo"  "เลขที่บัญชี (Col E)" $true $false

$lblBankBranchInfo = New-Object System.Windows.Forms.Label
$lblBankBranchInfo.Location = New-Object System.Drawing.Point(8, ($t2y + 2))
$lblBankBranchInfo.Size = New-Object System.Drawing.Size(390, 36)
$lblBankBranchInfo.BackColor = [System.Drawing.Color]::FromArgb(254, 249, 195)
$lblBankBranchInfo.ForeColor = [System.Drawing.Color]::FromArgb(133, 77, 14)
$lblBankBranchInfo.BorderStyle = "FixedSingle"
$lblBankBranchInfo.Padding = New-Object System.Windows.Forms.Padding(6, 4, 6, 4)
$lblBankBranchInfo.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
$lblBankBranchInfo.Text = "🏦 ธนาคาร (B): -  |  สาขา (C): -"
$tab2.Controls.Add($lblBankBranchInfo)
$t2y += 44

$btnRunStep2 = New-Object System.Windows.Forms.Button
$btnRunStep2.Text = "⚡ ขั้นที่ 2: กรอกแท็บ 'ผู้รับเงิน' (5 ช่อง)"
$btnRunStep2.Location = New-Object System.Drawing.Point(8, ($t2y + 4))
$btnRunStep2.Size = New-Object System.Drawing.Size(390, 40)
$btnRunStep2.BackColor = [System.Drawing.Color]::FromArgb(13, 148, 136)
$btnRunStep2.ForeColor = [System.Drawing.Color]::White
$btnRunStep2.Font = New-Object System.Drawing.Font("Segoe UI", 9.8, [System.Drawing.FontStyle]::Bold)
$btnRunStep2.FlatStyle = "Flat"
$btnRunStep2.FlatAppearance.BorderSize = 0
$tab2.Controls.Add($btnRunStep2)

# ===================== TAB 3: ขั้นที่ 3 รายละเอียดเงินเบิกจ่าย =====================
$tab3 = New-Object System.Windows.Forms.TabPage
$tab3.Text = "ขั้น 3: รายละเอียดเบิก"
$tab3.BackColor = [System.Drawing.Color]::White
$tabs.TabPages.Add($tab3)

$lblReq = New-Object System.Windows.Forms.Label
$lblReq.Text = "ชื่อผู้เบิก (รอง ผอ.ฝ่ายการแพทย์ ปัจจุบัน — แก้ไขได้และจำค่าอัตโนมัติ):"
$lblReq.Location = New-Object System.Drawing.Point(12, 14)
$lblReq.Size = New-Object System.Drawing.Size(396, 20)
$tab3.Controls.Add($lblReq)

$txtRequester = New-Object System.Windows.Forms.TextBox
$txtRequester.Location = New-Object System.Drawing.Point(12, 35)
$txtRequester.Size = New-Object System.Drawing.Size(356, 24)
$txtRequester.Text = [string]$script:Config["defaultRequester"]
$tab3.Controls.Add($txtRequester)
Add-QuickPasteBtn $tab3 374 35 $txtRequester $false | Out-Null

$lblPayDate = New-Object System.Windows.Forms.Label
$lblPayDate.Text = "วันที่เบิก (dd/MM/yyyy พ.ศ.):"
$lblPayDate.Location = New-Object System.Drawing.Point(12, 68)
$lblPayDate.Size = New-Object System.Drawing.Size(180, 20)
$tab3.Controls.Add($lblPayDate)

$txtPayDate = New-Object System.Windows.Forms.TextBox
$txtPayDate.Text = Get-TodayThaiSlash
$txtPayDate.Location = New-Object System.Drawing.Point(12, 89)
$txtPayDate.Size = New-Object System.Drawing.Size(115, 24)
$tab3.Controls.Add($txtPayDate)
Add-QuickPasteBtn $tab3 131 89 $txtPayDate $false | Out-Null

$btnDateToday = New-Object System.Windows.Forms.Button
$btnDateToday.Text = "วันนี้"
$btnDateToday.Location = New-Object System.Drawing.Point(170, 89)
$btnDateToday.Size = New-Object System.Drawing.Size(55, 24)
$btnDateToday.FlatStyle = "Flat"
$btnDateToday.Add_Click({ $txtPayDate.Text = Get-TodayThaiSlash })
$tab3.Controls.Add($btnDateToday)

$btnDateRcv = New-Object System.Windows.Forms.Button
$btnDateRcv.Text = "วันตรวจรับ"
$btnDateRcv.Location = New-Object System.Drawing.Point(229, 89)
$btnDateRcv.Size = New-Object System.Drawing.Size(78, 24)
$btnDateRcv.FlatStyle = "Flat"
$btnDateRcv.Add_Click({
    if ($script:SelectedItem -and $script:SelectedItem.rcvDate) {
        $txtPayDate.Text = [string]$script:SelectedItem.rcvDate
    }
})
$tab3.Controls.Add($btnDateRcv)

$lblDesc = New-Object System.Windows.Forms.Label
$lblDesc.Text = "คำอธิบายรายการเบิก (ลิงก์จาก MISS70 คอลัมน์ J -> (ค่า...)):"
$lblDesc.Location = New-Object System.Drawing.Point(12, 122)
$lblDesc.Size = New-Object System.Drawing.Size(360, 20)
$tab3.Controls.Add($lblDesc)

$txtDesc = New-Object System.Windows.Forms.TextBox
$txtDesc.Multiline = $true
$txtDesc.ScrollBars = "Vertical"
$txtDesc.Location = New-Object System.Drawing.Point(12, 144)
$txtDesc.Size = New-Object System.Drawing.Size(356, 74)
$tab3.Controls.Add($txtDesc)
Add-QuickPasteBtn $tab3 374 144 $txtDesc $true | Out-Null

$btnRunStep3 = New-Object System.Windows.Forms.Button
$btnRunStep3.Text = "⚡ ขั้นที่ 3: กรอกแท็บ 'รายละเอียดเงินเบิกจ่าย'"
$btnRunStep3.Location = New-Object System.Drawing.Point(12, 228)
$btnRunStep3.Size = New-Object System.Drawing.Size(396, 42)
$btnRunStep3.BackColor = [System.Drawing.Color]::FromArgb(79, 70, 229)
$btnRunStep3.ForeColor = [System.Drawing.Color]::White
$btnRunStep3.Font = New-Object System.Drawing.Font("Segoe UI", 10, [System.Drawing.FontStyle]::Bold)
$btnRunStep3.FlatStyle = "Flat"
$btnRunStep3.FlatAppearance.BorderSize = 0
$tab3.Controls.Add($btnRunStep3)

$lblManualSaveBox = New-Object System.Windows.Forms.Label
$lblManualSaveBox.Location = New-Object System.Drawing.Point(12, 280)
$lblManualSaveBox.Size = New-Object System.Drawing.Size(396, 68)
$lblManualSaveBox.BackColor = [System.Drawing.Color]::FromArgb(254, 243, 199)
$lblManualSaveBox.ForeColor = [System.Drawing.Color]::FromArgb(146, 64, 14)
$lblManualSaveBox.BorderStyle = "FixedSingle"
$lblManualSaveBox.Padding = New-Object System.Windows.Forms.Padding(8)
$lblManualSaveBox.Font = New-Object System.Drawing.Font("Segoe UI", 8.8, [System.Drawing.FontStyle]::Bold)
$lblManualSaveBox.Text = "🛑 หยุดก่อนบันทึกเสมอ (Human-in-the-Loop):`r`nโปรแกรมจะไม่กดบันทึกให้อัตโนมัติเด็ดขาด — กรุณาตรวจสอบตัวเลข ภาษี และชื่อบัญชีในหน้าจอ MIS2 แล้วกดปุ่ม บันทึก (💾) เองทุกครั้ง"
$tab3.Controls.Add($lblManualSaveBox)

$y += 394

# --- Section 3: Writeback เลขที่ใบขอเบิก to MISS70 Column H ---
$grpWriteback = New-Object System.Windows.Forms.GroupBox
$grpWriteback.Text = " บันทึก 'เลขที่ใบขอเบิก.../70' กลับลงชีต MISS70 (คอลัมน์ H) หลังคนกดบันทึกเอง "
$grpWriteback.Location = New-Object System.Drawing.Point(10, $y)
$grpWriteback.Size = New-Object System.Drawing.Size(430, 66)
$grpWriteback.BackColor = [System.Drawing.Color]::White
$body.Controls.Add($grpWriteback)

$lblPayDoc = New-Object System.Windows.Forms.Label
$lblPayDoc.Text = "เลขที่ใบขอเบิกที่ได้:"
$lblPayDoc.Location = New-Object System.Drawing.Point(10, 28)
$lblPayDoc.Size = New-Object System.Drawing.Size(112, 20)
$grpWriteback.Controls.Add($lblPayDoc)

$txtPayDocNo = New-Object System.Windows.Forms.TextBox
$txtPayDocNo.Location = New-Object System.Drawing.Point(124, 25)
$txtPayDocNo.Size = New-Object System.Drawing.Size(120, 24)
$grpWriteback.Controls.Add($txtPayDocNo)

$btnSavePayDoc = New-Object System.Windows.Forms.Button
$btnSavePayDoc.Text = "💾 บันทึกลง MISS70"
$btnSavePayDoc.Location = New-Object System.Drawing.Point(252, 24)
$btnSavePayDoc.Size = New-Object System.Drawing.Size(166, 27)
$btnSavePayDoc.BackColor = [System.Drawing.Color]::FromArgb(22, 163, 74)
$btnSavePayDoc.ForeColor = [System.Drawing.Color]::White
$btnSavePayDoc.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$btnSavePayDoc.FlatStyle = "Flat"
$btnSavePayDoc.FlatAppearance.BorderSize = 0
$grpWriteback.Controls.Add($btnSavePayDoc)

# ==============================================================================
# 8. UI Logic & Event Wiring
# ==============================================================================
function Update-TargetStatusLabel {
    if ($script:TargetHwnd -eq [IntPtr]::Zero -or -not [Mis2Win32]::IsWindow($script:TargetHwnd)) {
        $auto = Find-OracleFormsWindow
        if ($auto) {
            $script:TargetHwnd = $auto.Hwnd
            $script:TargetWinTitle = $auto.Title
        }
    }
    if ($script:TargetHwnd -ne [IntPtr]::Zero -and [Mis2Win32]::IsWindow($script:TargetHwnd)) {
        $info = [Mis2Win32]::GetWindowInfo($script:TargetHwnd)
        $t = if ($info.Title.Length -gt 45) { $info.Title.Substring(0, 45) + "..." } else { $info.Title }
        $lblTargetStatus.Text = "🪟 เป้าหมาย: $t (พิกัดที่ตั้งแล้ว: $($script:Calibration.Count)/$($script:CalibDefinitions.Count))"
        $lblTargetStatus.BackColor = [System.Drawing.Color]::FromArgb(220, 252, 231)
        $lblTargetStatus.ForeColor = [System.Drawing.Color]::FromArgb(22, 101, 52)
    } else {
        $lblTargetStatus.Text = "⚠️ ยังไม่พบหน้าต่าง Oracle Forms — เปิดระบบการเงินจ่ายแล้วกด 'เลือกหน้าต่าง'"
        $lblTargetStatus.BackColor = [System.Drawing.Color]::FromArgb(254, 243, 199)
        $lblTargetStatus.ForeColor = [System.Drawing.Color]::FromArgb(146, 64, 14)
    }
}

function Test-IsWhtExempt([string]$companyName) {
    if ([string]::IsNullOrWhiteSpace($companyName)) { return $false }
    $kws = $script:Config["whtExemptKeywords"]
    if (-not $kws) {
        $kws = @("สภากาชาด", "เอเบิ้ล", "เอเบิล", "A-ble", "Abel", "องค์การเภสัชกรรม", "GPO", "ยูนีซัน", "Unison")
    }
    foreach ($kw in $kws) {
        if ($companyName -match [regex]::Escape([string]$kw)) { return $true }
    }
    return $false
}

function Update-TaxFieldsFromCurrent([double]$amountVal, [string]$companyName) {
    if ($amountVal -le 0) {
        $txtVatAmount.Text = "0.00"
        $txtWhtAmount.Text = "0.00"
        $lblWhtBadge.BackColor = [System.Drawing.Color]::FromArgb(241, 245, 249)
        $lblWhtBadge.ForeColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
        $lblWhtBadge.Text = "สุทธิที่จ่าย:`r`n-"
        return
    }
    $base = [Math]::Round($amountVal / 1.07, 2, [MidpointRounding]::AwayFromZero)
    $vat7 = [Math]::Round($amountVal - $base, 2, [MidpointRounding]::AwayFromZero)
    $exempt = Test-IsWhtExempt $companyName
    $wht1 = if ($exempt) { 0.0 } else { [Math]::Round($base * 0.01, 2, [MidpointRounding]::AwayFromZero) }
    $net  = [Math]::Round($amountVal - $wht1, 2, [MidpointRounding]::AwayFromZero)

    $txtVatAmount.Text = $vat7.ToString("0.00", [System.Globalization.CultureInfo]::InvariantCulture)
    $txtWhtAmount.Text = $wht1.ToString("0.00", [System.Globalization.CultureInfo]::InvariantCulture)

    if ($exempt) {
        $lblWhtBadge.BackColor = [System.Drawing.Color]::FromArgb(254, 243, 199)
        $lblWhtBadge.ForeColor = [System.Drawing.Color]::FromArgb(146, 64, 14)
        $lblWhtBadge.Text = "ยกเว้นหัก 1% (0.00)`r`nสุทธิ: " + $net.ToString("#,##0.00")
    } else {
        $lblWhtBadge.BackColor = [System.Drawing.Color]::FromArgb(220, 252, 231)
        $lblWhtBadge.ForeColor = [System.Drawing.Color]::FromArgb(22, 101, 52)
        $lblWhtBadge.Text = "หัก 1% ปกติ`r`nสุทธิ: " + $net.ToString("#,##0.00")
    }
}

$script:BranchOverridesPath = Join-Path $script:AppDir "branch-codes.json"
$script:BranchOverrides = @{}
if (Test-Path $script:BranchOverridesPath) {
    try {
        $boObj = ([System.IO.File]::ReadAllText($script:BranchOverridesPath, [System.Text.Encoding]::UTF8)) | ConvertFrom-Json
        foreach ($p in $boObj.PSObject.Properties) { $script:BranchOverrides[$p.Name] = [string]$p.Value }
    } catch {}
}

function Get-BranchCodeForVendor($v) {
    if (-not $v) { return "" }
    $cKey = ([string]$v.company).Trim()
    if ($cKey -and $script:BranchOverrides.ContainsKey($cKey) -and $script:BranchOverrides[$cKey]) {
        return $script:BranchOverrides[$cKey]
    }
    if ($v.PSObject.Properties["branchCode"] -and -not [string]::IsNullOrWhiteSpace([string]$v.branchCode)) {
        return ([string]$v.branchCode).Trim()
    }
    $digits = [regex]::Replace((Convert-ThaiDigits ([string]$v.accountNo)), "\D", "")
    if ($digits.Length -ge 3) { return ("0" + $digits.Substring(0, 3)) }
    return ""
}

function Save-BranchCodeOverride([string]$company, [string]$code) {
    if ([string]::IsNullOrWhiteSpace($company) -or [string]::IsNullOrWhiteSpace($code)) { return }
    $script:BranchOverrides[$company.Trim()] = $code.Trim()
    try {
        $json = $script:BranchOverrides | ConvertTo-Json -Depth 3
        [System.IO.File]::WriteAllText($script:BranchOverridesPath, $json, (New-Object System.Text.UTF8Encoding($false)))
    } catch {}
}

function Test-IsAidsBudget($item) {
    if (-not $item) { return $false }
    if ($item.PSObject.Properties["isAidsBudget"] -and [bool]$item.isAidsBudget) { return $true }
    $codeStr = [string]$item.code
    $bType   = [string]$item.budgetType
    return ($codeStr -match "งบเอดส์|เอดส์|aids" -or $bType -match "เอดส์|อุดหนุน")
}

function Apply-VendorToFields($v) {
    if (-not $v) { return }
    $script:SelectedVendor = $v
    $rPayTo.Box.Text      = [string]$v.company
    $rBankCode.Box.Text   = [string]$v.bankCode
    $rBranchCode.Box.Text = Get-BranchCodeForVendor $v
    $rAccountNo.Box.Text  = [string]$v.accountNo
    if (Test-IsAidsBudget $script:SelectedItem) {
        $cmbAssign.Text = [string]$v.company
    } else {
        $cmbAssign.Text = [string]$script:Config["defaultAssignTo"]
    }
    $bName   = if ($v.bank) { $v.bank } else { "-" }
    $bBranch = if ($v.branch) { $v.branch } else { "-" }
    $lblBankBranchInfo.Text = "🏦 ธนาคาร (B): $bName ($($v.bankCode))`r`n📍 สาขา (C): $bBranch"

    $amtNow = if ($script:SelectedItem -and $script:SelectedItem.amount) { [double]$script:SelectedItem.amount } else { 0.0 }
    Update-TaxFieldsFromCurrent -amountVal $amtNow -companyName ([string]$v.company)

    # Highlight WHT 1% exemption for the 4 exempt companies
    if ((Test-IsWhtExempt ([string]$v.company)) -and (-not ($script:SelectedItem -and $script:SelectedItem.payDocNo))) {
        $lblAlert.BackColor = [System.Drawing.Color]::FromArgb(254, 243, 199)
        $lblAlert.ForeColor = [System.Drawing.Color]::FromArgb(146, 64, 14)
        $lblAlert.Text = "✓ ยกเว้นหักภาษีเงินได้ 1%: '$($v.company)' (สภากาชาด/เอเบิ้ล/อภ./ยูนีซัน) — ระบบตั้งหัก 1% เป็น 0.00 ให้อัตโนมัติ"
    }
}

function Apply-ItemToFields($item) {
    if (-not $item) { return }
    $script:SelectedItem = $item
    $txtRcvNo.Text   = [string]$item.rcvNo
    $txtRcvYear.Text = [string]$script:Config["fiscalYear"]
    $txtPayDocNo.Text = [string]$item.payDocNo

    $poDisplay = if ($item.poNo) { "$($item.poNo)/$($script:Config['fiscalYear'])" } else { "-" }
    $rcvDisplay = if ($item.rcvNo) { "$($item.rcvNo)/$($script:Config['fiscalYear'])" } else { "(ยังไม่มีเลขใบตรวจรับใน MISS70)" }
    $amtDisplay = if ($item.amountFormatted) { "$($item.amountFormatted) บาท" } else { "-" }
    $lblItemSummary.Text = "รหัส: $($item.code)  |  ใบตรวจรับ: $rcvDisplay`r`nใบสั่งซื้อ: $poDisplay  |  ยอดเงิน: $amtDisplay`r`nบริษัท: $($item.vendorName)`r`nเรื่อง: $($item.subject)"

    # Calculate VAT 7% and WHT 1% from project amount (0.00 for 4 exempt companies)
    $amtVal = if ($item.amount) { [double]$item.amount } else { 0.0 }
    Update-TaxFieldsFromCurrent -amountVal $amtVal -companyName ([string]$item.vendorName)

    # Description template (linked directly from MISS70 Column J: ชื่อโครงการ -> (ค่า...))
    $subjRaw = if ($item.missSubject) { ([string]$item.missSubject).Trim() } else { ([string]$item.subject).Trim() }
    $tpl = [string]$script:Config["descriptionTemplate"]
    if ([string]::IsNullOrWhiteSpace($tpl)) { $tpl = "(ค่า{subject})" }
    if ($tpl -eq "(ค่า{subject})" -and $subjRaw.StartsWith("ค่า")) {
        $desc = "($subjRaw)"
    } else {
        $desc = $tpl.Replace("{subject}", $subjRaw)
        $desc = $desc.Replace("{poNo}", [string]$item.poNo)
        $desc = $desc.Replace("{rcvNo}", [string]$item.rcvNo)
        $desc = $desc.Replace("{year}", [string]$script:Config["fiscalYear"])
        $desc = $desc.Replace("{poSignDate}", [string]$item.poSignDate)
        $desc = $desc.Replace("{rcvDate}", [string]$item.rcvDate)
    }
    $txtDesc.Text = $desc

    if ($script:Config["defaultDateMode"] -eq "rcvDate" -and $item.rcvDate) {
        $txtPayDate.Text = [string]$item.rcvDate
    } else {
        $txtPayDate.Text = Get-TodayThaiSlash
    }

    # Alert status: duplicate check vs ready
    if (-not [string]::IsNullOrWhiteSpace([string]$item.payDocNo)) {
        $lblAlert.BackColor = [System.Drawing.Color]::FromArgb(254, 226, 226)
        $lblAlert.ForeColor = [System.Drawing.Color]::FromArgb(185, 28, 28)
        $lblAlert.Text = "⛔ มีประวัติการขอเบิกแล้วใน MISS70 (เลขที่ใบขอเบิก: $($item.payDocNo)) — ระวังการเบิกซ้ำ!"
    } elseif ([string]::IsNullOrWhiteSpace([string]$item.rcvNo)) {
        $lblAlert.BackColor = [System.Drawing.Color]::FromArgb(254, 243, 199)
        $lblAlert.ForeColor = [System.Drawing.Color]::FromArgb(146, 64, 14)
        $lblAlert.Text = "⚠️ รายการนี้ยังไม่มี 'เลขที่ใบตรวจรับ' ในชีต MISS70 (คอลัมน์ D) — สามารถพิมพ์เองด้านล่างได้"
    } else {
        $lblAlert.BackColor = [System.Drawing.Color]::FromArgb(220, 252, 231)
        $lblAlert.ForeColor = [System.Drawing.Color]::FromArgb(22, 101, 52)
        $lblAlert.Text = "✓ พร้อมเบิกจ่าย ($($item.code) | ใบตรวจรับ $($item.rcvNo)/$($script:Config['fiscalYear']) | ยอด $amtDisplay)"
    }

    # Match vendor profile from EGP+MIS ทะเบียนบริษัท
    $matched = $null
    if ($item.vendorProfile -and $item.vendorProfile.company) {
        $matched = $item.vendorProfile
    } else {
        $matched = Find-MatchingVendor -vendorName ([string]$item.vendorName) -taxId ([string]$item.vendorTaxId)
    }

    if ($matched) {
        Apply-VendorToFields $matched
        # Sync vendor combobox visual selection
        for ($i = 0; $i -lt $script:FilteredVendors.Count; $i++) {
            if ($script:FilteredVendors[$i].company -eq $matched.company) {
                $cmbVendor.SelectedIndex = $i
                break
            }
        }
    } else {
        $rPayTo.Box.Text      = [string]$item.vendorName
        $rBankCode.Box.Text   = ""
        $rBranchCode.Box.Text = ""
        $rAccountNo.Box.Text  = ""
        if (Test-IsAidsBudget $item) {
            $cmbAssign.Text = [string]$item.vendorName
        } else {
            $cmbAssign.Text = [string]$script:Config["defaultAssignTo"]
        }
        $lblBankBranchInfo.Text = "⚠️ ไม่พบบริษัทนี้ในชีต 'ทะเบียนบริษัท' — ค้นหาและเลือกจากช่องบริษัทด้านบนได้"
    }
}

function Refresh-ItemCombo {
    $q = $txtSearchCode.Text.Trim()
    $cmbItem.Items.Clear()
    $script:FilteredItems = @()
    if ([string]::IsNullOrWhiteSpace($q)) {
        $script:FilteredItems = @($script:Items)
    } else {
        # Exact code match first (e.g. "7งบ" matches only 7งบ, not 17งบ/27งบ)
        $exact = @($script:Items | Where-Object { ([string]$_.code).ToLower() -eq $q.ToLower() })
        if ($exact.Count -gt 0) {
            $script:FilteredItems = $exact
        } else {
            $ql = $q.ToLower()
            $script:FilteredItems = @($script:Items | Where-Object {
                ([string]$_.code).ToLower().Contains($ql) -or
                ([string]$_.subject).ToLower().Contains($ql) -or
                ([string]$_.vendorName).ToLower().Contains($ql) -or
                ([string]$_.rcvNo) -eq $q
            })
        }
    }
    foreach ($it in $script:FilteredItems) {
        $tag = if ($it.payDocNo) { "[เบิกแล้ว:$($it.payDocNo)] " } elseif ($it.rcvNo) { "[รับ:$($it.rcvNo)] " } else { "[รอรับ] " }
        $shortSub = if (([string]$it.subject).Length -gt 28) { ([string]$it.subject).Substring(0, 28) + "..." } else { [string]$it.subject }
        $cmbItem.Items.Add("$($it.code) $tag$shortSub ($($it.amountFormatted))") | Out-Null
    }
    if ($cmbItem.Items.Count -gt 0) {
        $cmbItem.SelectedIndex = 0
    }
}

function Refresh-VendorCombo {
    $q = $txtSearchVendor.Text.Trim().ToLower()
    $cmbVendor.Items.Clear()
    $script:FilteredVendors = @()
    if ([string]::IsNullOrWhiteSpace($q)) {
        $script:FilteredVendors = @($script:Vendors)
    } else {
        $script:FilteredVendors = @($script:Vendors | Where-Object {
            ([string]$_.company).ToLower().Contains($q) -or
            ([string]$_.bank).ToLower().Contains($q) -or
            ([string]$_.accountNo).Contains($q) -or
            ([string]$_.taxId).Contains($q)
        })
    }
    foreach ($v in $script:FilteredVendors) {
        $bInfo = if ($v.bank) { " [$($v.bankCode) $($v.bank)]" } else { "" }
        $cmbVendor.Items.Add("$($v.company)$bInfo") | Out-Null
    }
}

function Persist-UserPreferences {
    if (-not (Test-IsAidsBudget $script:SelectedItem)) {
        $script:Config["defaultAssignTo"] = $cmbAssign.Text.Trim()
    }
    $script:Config["defaultRequester"] = $txtRequester.Text.Trim()
    $script:Config["fiscalYear"]       = $txtRcvYear.Text.Trim()
    $script:Config["autoFillFields"]   = @{
        payTo      = $rPayTo.Check.Checked
        assignTo   = $chkAssign.Checked
        bankCode   = $rBankCode.Check.Checked
        branchCode = $rBranchCode.Check.Checked
        accountNo  = $rAccountNo.Check.Checked
    }
    Save-Config
}

function Ensure-CalibratedOrGuide([string[]]$requiredKeys) {
    $missing = @()
    foreach ($k in $requiredKeys) {
        if (-not $script:Calibration.ContainsKey($k)) { $missing += $k }
    }
    if ($missing.Count -gt 0) {
        $res = [System.Windows.Forms.MessageBox]::Show(
            "ยังไม่ได้ตั้งพิกัดหน้าจอ Oracle Forms สำหรับขั้นตอนนี้ (ทำเพียงครั้งเดียวต่อเครื่อง)`r`n`r`nต้องการเปิดหน้าต่างตั้งพิกัดตอนนี้เลยไหมครับ?`r`n(หรือหากไม่ตั้งพิกัด สามารถคลิกช่องใน Oracle Forms แล้วกดปุ่ม 📋 ข้างแต่ละช่องเพื่อวางทีละช่องได้ทันที)",
            "ตั้งพิกัดหน้าจอ Oracle Forms",
            [System.Windows.Forms.MessageBoxButtons]::YesNo,
            [System.Windows.Forms.MessageBoxIcon]::Information
        )
        if ($res -eq [System.Windows.Forms.DialogResult]::Yes) {
            Show-CalibrationDialog
            Update-TargetStatusLabel
        }
        return $false
    }
    return $true
}

# --- Wire Events ---
$txtSearchCode.Add_TextChanged({ Refresh-ItemCombo })
$btnClearCode.Add_Click({ $txtSearchCode.Text = ""; Refresh-ItemCombo })
$cmbItem.Add_SelectedIndexChanged({
    if ($cmbItem.SelectedIndex -ge 0 -and $cmbItem.SelectedIndex -lt $script:FilteredItems.Count) {
        Apply-ItemToFields $script:FilteredItems[$cmbItem.SelectedIndex]
    }
})

$txtSearchVendor.Add_TextChanged({ Refresh-VendorCombo })
$cmbVendor.Add_SelectedIndexChanged({
    if ($cmbVendor.SelectedIndex -ge 0 -and $cmbVendor.SelectedIndex -lt $script:FilteredVendors.Count) {
        Apply-VendorToFields $script:FilteredVendors[$cmbVendor.SelectedIndex]
    }
})

$btnReload.Add_Click({
    $statusBar.Text = "🔄 กำลังดึงข้อมูลล่าสุดจาก Google Sheets..."
    [System.Windows.Forms.Application]::DoEvents()
    $msg = Sync-GoogleSheetsData
    Refresh-VendorCombo
    Refresh-ItemCombo
    Update-TargetStatusLabel
    $statusBar.Text = "✓ โหลดสำเร็จ — $msg"
})

$btnTarget.Add_Click({
    if (Show-WindowPickerDialog) {
        Update-TargetStatusLabel
        $statusBar.Text = "✓ ล็อกหน้าต่างเป้าหมาย: $($script:TargetWinTitle)"
    }
})

$btnCalib.Add_Click({
    Show-CalibrationDialog
    Update-TargetStatusLabel
})

# --- Step 1 Auto-Fill: เอกสารตรวจรับ + กดแว่นขยาย 🔍 ---
$btnRunStep1.Add_Click({
    Persist-UserPreferences
    if ([string]::IsNullOrWhiteSpace($txtRcvNo.Text)) {
        [System.Windows.Forms.MessageBox]::Show("กรุณาระบุเลขที่ใบตรวจรับก่อนครับ", "ข้อมูลไม่ครบ")
        return
    }
    if (-not (Ensure-CalibratedOrGuide @("rcvNo", "rcvYear", "rcvSearchBtn"))) { return }

    try {
        $statusBar.Text = "⚡ กำลังกรอกเลขใบตรวจรับ $($txtRcvNo.Text)/$($txtRcvYear.Text) ..."
        [System.Windows.Forms.Application]::DoEvents()

        Invoke-FillCalibratedField -key "rcvNo"        -text $txtRcvNo.Text.Trim()   -isMultiline $false | Out-Null
        Invoke-FillCalibratedField -key "rcvYear"      -text $txtRcvYear.Text.Trim() -isMultiline $false | Out-Null
        Invoke-FillCalibratedField -key "rcvSearchBtn" -text ""                      -clickOnly   $true  | Out-Null

        $statusBar.Text = "✓ ขั้นที่ 1 เสร็จแล้ว — เลือกรายการใน Popup อ้างอิงจัดซื้อ/จัดจ้าง (หรือกดขั้น 1.5)"
    } catch {
        if ($_.Exception.Message -eq "EMERGENCY_STOP") {
            $statusBar.Text = "🛑 หยุดฉุกเฉินแล้ว (กด ESC)"
        } else {
            $statusBar.Text = "❌ เกิดข้อผิดพลาด: $($_.Exception.Message)"
        }
    }
})

# --- Step 1.5 Auto-Fill: รายละเอียด -> ติ๊กงบประมาณ -> ตกลง ---
$btnRunStep15.Add_Click({
    if (-not (Ensure-CalibratedOrGuide @("popupDetail", "popupBudgetChk", "popupOkBtn"))) { return }
    try {
        $statusBar.Text = "⚡ กำลังกด รายละเอียด → ติ๊กงบประมาณ → ตกลง ..."
        [System.Windows.Forms.Application]::DoEvents()

        Invoke-FillCalibratedField -key "popupDetail"    -text "" -clickOnly $true | Out-Null
        Start-Sleep -Milliseconds 450
        Invoke-FillCalibratedField -key "popupBudgetChk" -text "" -clickOnly $true | Out-Null
        Start-Sleep -Milliseconds 250
        Invoke-FillCalibratedField -key "popupOkBtn"     -text "" -clickOnly $true | Out-Null

        $statusBar.Text = "✓ ขั้นที่ 1.5 เสร็จแล้ว — กด 'ขั้นที่ 1.6' เพื่อกรอกภาษี 7% / หัก 1% (หรือไปขั้นที่ 2)"
    } catch {
        if ($_.Exception.Message -eq "EMERGENCY_STOP") {
            $statusBar.Text = "🛑 หยุดฉุกเฉินแล้ว (กด ESC)"
        } else {
            $statusBar.Text = "❌ เกิดข้อผิดพลาด: $($_.Exception.Message)"
        }
    }
})

# --- Step 1.6 Auto-Fill: ภาษีมูลค่าเพิ่ม (7%) + หักภาษีเงินได้ (1%) ---
$btnRunStep16.Add_Click({
    if (-not (Ensure-CalibratedOrGuide @("vatAmount", "whtAmount"))) { return }
    try {
        $vatTxt = $txtVatAmount.Text.Trim()
        $whtTxt = $txtWhtAmount.Text.Trim()
        $statusBar.Text = "⚡ กำลังกรอกภาษีมูลค่าเพิ่ม ($vatTxt) และหักภาษีเงินได้ ($whtTxt)..."
        [System.Windows.Forms.Application]::DoEvents()

        Invoke-FillCalibratedField -key "vatAmount" -text $vatTxt -isMultiline $false | Out-Null
        Invoke-FillCalibratedField -key "whtAmount" -text $whtTxt -isMultiline $false | Out-Null

        $statusBar.Text = "✓ ขั้นที่ 1.6 เสร็จแล้ว (VAT=$vatTxt | หัก 1%=$whtTxt) — ไปต่อขั้นที่ 2"
        $tabs.SelectedIndex = 1
    } catch {
        if ($_.Exception.Message -eq "EMERGENCY_STOP") {
            $statusBar.Text = "🛑 หยุดฉุกเฉินแล้ว (กด ESC)"
        } else {
            $statusBar.Text = "❌ เกิดข้อผิดพลาด: $($_.Exception.Message)"
        }
    }
})

# --- Step 2 Auto-Fill: แท็บผู้รับเงิน (5 ช่องที่ต้องกรอกเพิ่ม) ---
$btnRunStep2.Add_Click({
    Persist-UserPreferences
    if ($rPayTo.Box.Text.Trim() -and $rBranchCode.Box.Text.Trim()) {
        Save-BranchCodeOverride -company $rPayTo.Box.Text.Trim() -code $rBranchCode.Box.Text.Trim()
    }
    $queue = @()
    if ($rPayTo.Check.Checked      -and $rPayTo.Box.Text.Trim())      { $queue += @{ Key="payTo";      Val=$rPayTo.Box.Text.Trim();      Multi=$false } }
    if ($chkAssign.Checked         -and $cmbAssign.Text.Trim())       { $queue += @{ Key="assignTo";   Val=$cmbAssign.Text.Trim();       Multi=$false } }
    if ($rBankCode.Check.Checked   -and $rBankCode.Box.Text.Trim())   { $queue += @{ Key="bankCode";   Val=$rBankCode.Box.Text.Trim();   Multi=$false } }
    if ($rBranchCode.Check.Checked -and $rBranchCode.Box.Text.Trim()) { $queue += @{ Key="branchCode"; Val=$rBranchCode.Box.Text.Trim(); Multi=$false } }
    if ($rAccountNo.Check.Checked  -and $rAccountNo.Box.Text.Trim())  { $queue += @{ Key="accountNo";  Val=$rAccountNo.Box.Text.Trim();  Multi=$false } }

    if ($queue.Count -eq 0) {
        [System.Windows.Forms.MessageBox]::Show("ไม่มีช่องที่ติ๊กถูกและมีข้อมูลให้กรอกในแท็บผู้รับเงินครับ", "แจ้งเตือน")
        return
    }

    $calibratedQueue = @($queue | Where-Object { $script:Calibration.ContainsKey($_.Key) })
    if ($calibratedQueue.Count -eq 0) {
        Ensure-CalibratedOrGuide @($queue[0].Key) | Out-Null
        return
    }

    try {
        $statusBar.Text = "⚡ กำลังกรอกแท็บผู้รับเงิน ($($calibratedQueue.Count) ช่อง)..."
        [System.Windows.Forms.Application]::DoEvents()

        if ($script:Calibration.ContainsKey("tabPayee")) {
            Invoke-FillCalibratedField -key "tabPayee" -text "" -clickOnly $true | Out-Null
            Start-Sleep -Milliseconds 300
        }

        $filled = 0
        foreach ($step in $calibratedQueue) {
            Invoke-FillCalibratedField -key $step.Key -text $step.Val -isMultiline $step.Multi | Out-Null
            $filled++
        }

        $statusBar.Text = "✓ ขั้นที่ 2 เสร็จแล้ว ($filled ช่อง) — ตรวจสอบสาขาธนาคาร แล้วไปต่อขั้นที่ 3"
        $tabs.SelectedIndex = 2
    } catch {
        if ($_.Exception.Message -eq "EMERGENCY_STOP") {
            $statusBar.Text = "🛑 หยุดฉุกเฉินแล้ว (กด ESC)"
        } else {
            $statusBar.Text = "❌ เกิดข้อผิดพลาด: $($_.Exception.Message)"
        }
    }
})

# --- Step 3 Auto-Fill: แท็บรายละเอียดเงินเบิกจ่าย (ข้ามจำนวนเอกสาร และหยุดก่อนบันทึก!) ---
$btnRunStep3.Add_Click({
    Persist-UserPreferences
    $queue = @()
    if ($txtRequester.Text.Trim()) { $queue += @{ Key="requesterName"; Val=$txtRequester.Text.Trim(); Multi=$false } }
    if ($txtPayDate.Text.Trim())   { $queue += @{ Key="payDate";       Val=$txtPayDate.Text.Trim();   Multi=$false } }
    if ($txtDesc.Text.Trim())      { $queue += @{ Key="description";   Val=$txtDesc.Text.Trim();      Multi=$true  } }

    $calibratedQueue = @($queue | Where-Object { $script:Calibration.ContainsKey($_.Key) })
    if ($calibratedQueue.Count -eq 0) {
        Ensure-CalibratedOrGuide @("tabDetail", "requesterName", "payDate", "description") | Out-Null
        return
    }

    try {
        $statusBar.Text = "⚡ กำลังกรอกแท็บรายละเอียดเงินเบิกจ่าย..."
        [System.Windows.Forms.Application]::DoEvents()

        if ($script:Calibration.ContainsKey("tabDetail")) {
            Invoke-FillCalibratedField -key "tabDetail" -text "" -clickOnly $true | Out-Null
            Start-Sleep -Milliseconds 300
        }

        $filled = 0
        foreach ($step in $calibratedQueue) {
            Invoke-FillCalibratedField -key $step.Key -text $step.Val -isMultiline $step.Multi | Out-Null
            $filled++
        }

        # HARD STOP — NEVER SEND SAVE / F10 / CTRL+S!
        [System.Media.SystemSounds]::Exclamation.Play()
        $statusBar.Text = "🛑 กรอกครบแล้ว ($filled ช่อง) — กรุณาตรวจสอบและกดปุ่ม บันทึก (💾) ใน MIS2 เอง!"
    } catch {
        if ($_.Exception.Message -eq "EMERGENCY_STOP") {
            $statusBar.Text = "🛑 หยุดฉุกเฉินแล้ว (กด ESC)"
        } else {
            $statusBar.Text = "❌ เกิดข้อผิดพลาด: $($_.Exception.Message)"
        }
    }
})

# --- Fiscal Year Selector & Target File Sync ---
$script:SuppressFyEvent = $false

function Refresh-FiscalYearUi {
    $script:SuppressFyEvent = $true
    try {
        $cmbFiscalYear.Items.Clear()
        $sortedKeys = @($script:Config["fiscalYears"].Keys | Sort-Object { [int]$_ })
        foreach ($k in $sortedKeys) {
            $cmbFiscalYear.Items.Add([string]$k) | Out-Null
        }
        $curFy = [string]$script:Config["fiscalYear"]
        if ([string]::IsNullOrWhiteSpace($curFy) -or -not $cmbFiscalYear.Items.Contains($curFy)) {
            $curFy = if ($cmbFiscalYear.Items.Count -gt 0) { [string]$cmbFiscalYear.Items[0] } else { "70" }
            $script:Config["fiscalYear"] = $curFy
        }
        $cmbFiscalYear.SelectedItem = $curFy
        $txtRcvYear.Text = $curFy

        $ent = Get-FiscalYearEntry $curFy
        $hasFile = -not [string]::IsNullOrWhiteSpace([string]$ent["missSheetId"])
        if ($hasFile) {
            $lblFyFileStatus.Text = "✓ ไฟล์ MISS$curFy"
            $lblFyFileStatus.ForeColor = [System.Drawing.Color]::FromArgb(15, 118, 110)
        } else {
            $lblFyFileStatus.Text = "⚠️ ยังไม่ใส่ลิงก์"
            $lblFyFileStatus.ForeColor = [System.Drawing.Color]::FromArgb(180, 83, 9)
        }
        $grpSource.Text    = " 1. ค้นหารายการเบิกจ่าย (Auto Crat-EGP$curFy + MISS$curFy + ทะเบียนบริษัท) "
        $grpWriteback.Text = " บันทึก 'เลขที่ใบขอเบิก.../$curFy' กลับลงชีต MISS$curFy (คอลัมน์ H) หลังคนกดบันทึกเอง "
        $btnSavePayDoc.Text = "💾 บันทึกลง MISS$curFy"
    } finally {
        $script:SuppressFyEvent = $false
    }
}

$cmbFiscalYear.Add_SelectedIndexChanged({
    if ($script:SuppressFyEvent) { return }
    $chosenFy = [string]$cmbFiscalYear.SelectedItem
    if ([string]::IsNullOrWhiteSpace($chosenFy)) { return }
    $script:Config["fiscalYear"] = $chosenFy
    Save-Config
    Refresh-FiscalYearUi

    $ent = Get-FiscalYearEntry $chosenFy
    if ([string]::IsNullOrWhiteSpace([string]$ent["missSheetId"])) {
        $res = [System.Windows.Forms.MessageBox]::Show(
            "ปีงบประมาณ $chosenFy ยังไม่ได้ตั้งค่าลิงก์ไฟล์ MISS$chosenFy ปลายทาง`r`nต้องการเปิดหน้าตั้งค่าเพื่อวางลิงก์ Google Sheets ตอนนี้เลยไหมครับ?",
            "ตั้งค่าไฟล์ปีงบประมาณ $chosenFy",
            [System.Windows.Forms.MessageBoxButtons]::YesNo,
            [System.Windows.Forms.MessageBoxIcon]::Question
        )
        if ($res -eq [System.Windows.Forms.DialogResult]::Yes) {
            if (Show-FiscalYearSettingsDialog $chosenFy) {
                Refresh-FiscalYearUi
            }
        }
    }

    $statusBar.Text = "🔄 กำลังโหลดข้อมูลปีงบประมาณ $chosenFy (MISS$chosenFy)..."
    [System.Windows.Forms.Application]::DoEvents()
    $msg = Sync-GoogleSheetsData
    Refresh-VendorCombo
    Refresh-ItemCombo
    $statusBar.Text = "✓ สลับเป็นปีงบประมาณ $chosenFy แล้ว — $msg"
})

$btnFyConfig.Add_Click({
    $curFy = [string]$script:Config["fiscalYear"]
    if (Show-FiscalYearSettingsDialog $curFy) {
        Refresh-FiscalYearUi
        $statusBar.Text = "🔄 กำลังโหลดข้อมูลปีงบประมาณ $($script:Config['fiscalYear'])..."
        [System.Windows.Forms.Application]::DoEvents()
        $msg = Sync-GoogleSheetsData
        Refresh-VendorCombo
        Refresh-ItemCombo
        $statusBar.Text = "✓ บันทึกและโหลดข้อมูลปีงบประมาณ $($script:Config['fiscalYear']) สำเร็จ — $msg"
    }
})

# --- Writeback เลขที่ใบขอเบิก to Active MISS{YY} Col H ---
$btnSavePayDoc.Add_Click({
    $fy = [string]$script:Config["fiscalYear"]
    if ([string]::IsNullOrWhiteSpace($fy)) { $fy = "70" }
    $fyEnt = Get-FiscalYearEntry $fy
    $payNo = $txtPayDocNo.Text.Trim()
    if ([string]::IsNullOrWhiteSpace($payNo)) {
        [System.Windows.Forms.MessageBox]::Show("กรุณาพิมพ์ 'เลขที่ใบขอเบิก' ที่ได้หลังจากกดบันทึกใน MIS2 ก่อนครับ", "แจ้งเตือน")
        return
    }
    if (-not $script:SelectedItem -or -not $script:SelectedItem.missRowIndex) {
        [System.Windows.Forms.MessageBox]::Show("รายการนี้ยังไม่ได้เชื่อมแถวในชีต MISS$fy กรุณาเลือกรายการงบจากด้านบนก่อนครับ", "แจ้งเตือน")
        return
    }
    try {
        $statusBar.Text = "💾 กำลังบันทึกเลขที่ใบขอเบิก '$payNo' ลงชีต MISS$fy คอลัมน์ H..."
        [System.Windows.Forms.Application]::DoEvents()
        $resp = Post-Utf8Json -url ([string]$script:Config["gasWebAppUrl"]) -payload @{
            action       = "updatePayDocNo"
            missRowIndex = [int]$script:SelectedItem.missRowIndex
            payDocNo     = $payNo
            missSheetId  = [string]$fyEnt["missSheetId"]
            missTabName  = [string]$fyEnt["missTabName"]
        }
        $parsed = $resp | ConvertFrom-Json
        if ($parsed.ok) {
            $script:SelectedItem | Add-Member -NotePropertyName payDocNo -NotePropertyValue $payNo -Force
            $statusBar.Text = "✓ บันทึกเลขที่ใบขอเบิก '$payNo' ลง MISS$fy แถว $($script:SelectedItem.missRowIndex) เรียบร้อยแล้ว!"
            [System.Windows.Forms.MessageBox]::Show("บันทึกเลขที่ใบขอเบิก '$payNo' ลงชีต MISS$fy คอลัมน์ H เรียบร้อยแล้วครับ", "บันทึกสำเร็จ")
        } else {
            throw ([string]$parsed.error)
        }
    } catch {
        [System.Windows.Forms.MessageBox]::Show("บันทึกไม่สำเร็จ: $($_.Exception.Message)`r`n`r`n(หากยังไม่เคยอัปเดตโค้ด google-apps-script.gs ล่าสุดใน Apps Script กรุณา Deploy เวอร์ชันใหม่ก่อนครับ)", "แจ้งเตือน")
        $statusBar.Text = "❌ บันทึก MISS$fy ไม่สำเร็จ"
    }
})

# --- Initial Load on Form Shown ---
$form.Add_Shown({
    $form.TopMost = $true
    [Mis2Win32]::ForceTopMost($form.Handle)
    $form.BringToFront()
    $form.Activate()
    Refresh-FiscalYearUi
    $statusBar.Text = "🔄 กำลังโหลดฐานข้อมูลจาก Google Sheets..."
    [System.Windows.Forms.Application]::DoEvents()
    $msg = Sync-GoogleSheetsData
    Refresh-VendorCombo
    Refresh-ItemCombo
    Update-TargetStatusLabel
    $statusBar.Text = "✓ พร้อมใช้งาน — $msg"
})

$form.Add_FormClosing({ Persist-UserPreferences })

[System.Windows.Forms.Application]::Run($form)
