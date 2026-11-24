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
        public int ClientLeft;
        public int ClientTop;
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
    private static extern bool SetProcessDpiAwarenessContext(IntPtr dpiContext);

    public static void SetBestDpiAwareness() {
        try {
            if (SetProcessDpiAwarenessContext(new IntPtr(-4))) return;
        } catch {}
        try { SetProcessDPIAware(); } catch {}
    }

    [DllImport("user32.dll")]
    private static extern bool ClientToScreen(IntPtr hWnd, ref POINT lpPoint);

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

    public const int  VK_LBUTTON = 0x01;
    public const byte VK_BACK    = 0x08;
    public const byte VK_TAB     = 0x09;
    public const byte VK_RETURN  = 0x0D;
    public const byte VK_SHIFT   = 0x10;
    public const byte VK_CONTROL = 0x11;
    public const byte VK_ESCAPE  = 0x1B;
    public const int  VK_SPACE   = 0x20;
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
            POINT cp = new POINT { X = 0, Y = 0 };
            if (!ClientToScreen(hWnd, ref cp)) { cp.X = r.Left; cp.Y = r.Top; }
            list.Add(new WinInfo {
                Hwnd = hWnd,
                Title = sbTitle.ToString().Trim(),
                ClassName = sbClass.ToString().Trim(),
                Left = r.Left,
                Top = r.Top,
                ClientLeft = cp.X,
                ClientTop = cp.Y,
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
        POINT cp = new POINT { X = 0, Y = 0 };
        if (!ClientToScreen(hWnd, ref cp)) { cp.X = r.Left; cp.Y = r.Top; }
        return new WinInfo {
            Hwnd = hWnd,
            Title = sbTitle.ToString().Trim(),
            ClassName = sbClass.ToString().Trim(),
            Left = r.Left,
            Top = r.Top,
            ClientLeft = cp.X,
            ClientTop = cp.Y,
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
[Mis2Win32]::SetBestDpiAwareness()

$script:PanelMutex = New-Object System.Threading.Mutex($false, "Local\BmaMis2PayPanel_ARISSARA")
if (-not $script:PanelMutex.WaitOne(0, $false)) {
    try {
        $existing = [Mis2Win32]::GetVisibleWindows() | Where-Object { $_.Title -match "BMA MIS2 (เบิกจ่ายอัตโนมัติ|ข้อมูลช่วยกรอกเบิกจ่าย)" } | Select-Object -First 1
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
                $rm = if ($prop.Value.PSObject.Properties["refMode"]) { [string]$prop.Value.refMode } else { "window" }
                $script:Calibration[$prop.Name] = @{
                    dx      = [int]$prop.Value.dx
                    dy      = [int]$prop.Value.dy
                    winW    = [int]$prop.Value.winW
                    winH    = [int]$prop.Value.winH
                    refMode = $rm
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
                    $at = if ($v.PSObject.Properties["accountType"]) { ([string]$v.accountType).Trim() } else { "" }
                    $list += [PSCustomObject]@{
                        company     = [string]$v.company
                        bank        = [string]$v.bank
                        bankCode    = if ($v.bankCode) { [string]$v.bankCode } else { Get-BankCode ([string]$v.bank) }
                        branch      = [string]$v.branch
                        accountNo   = [string]$v.accountNo
                        accountType = $at
                        address     = [string]$v.address
                        taxId       = [string]$v.taxId
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
            $company  = ([regex]::Replace([string]$props[0].Value, "\s+", " ")).Trim()
            if ([string]::IsNullOrWhiteSpace($company)) { continue }
            $bank     = ([regex]::Replace([string]$props[1].Value, "\s+", " ")).Trim()
            $branch   = ([regex]::Replace([string]$props[2].Value, "\s+", " ")).Trim()
            $acctTh   = ([string]$props[3].Value).Trim()
            $acctMis  = (Convert-ThaiDigits (if ([string]::IsNullOrWhiteSpace([string]$props[4].Value)) { $acctTh } else { [string]$props[4].Value })).Trim()
            $acctType = ([regex]::Replace([string]$props[5].Value, "\s+", " ")).Trim()
            $addr     = ([regex]::Replace([string]$props[6].Value, "\s+", " ")).Trim()
            $taxRaw   = if ($props.Count -ge 8) { [string]$props[7].Value } else { "" }
            $taxId    = [regex]::Replace((Convert-ThaiDigits $taxRaw), "\D", "")
            if ($taxId -eq "000000") { $taxId = "" }
            $list += [PSCustomObject]@{
                company     = $company
                bank        = $bank
                bankCode    = Get-BankCode $bank
                branch      = $branch
                accountNo   = $acctMis
                accountType = $acctType
                address     = $addr
                taxId       = $taxId
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
                $cachedAtByTax = @{}
                $cachedAtByKey = @{}
                foreach ($cv in (Load-VendorsFromCache)) {
                    if (-not [string]::IsNullOrWhiteSpace([string]$cv.accountType)) {
                        $ctx = [regex]::Replace((Convert-ThaiDigits ([string]$cv.taxId)), "\D", "")
                        if ($ctx) { $cachedAtByTax[$ctx] = [string]$cv.accountType }
                        $ck = Normalize-CompanyKey ([string]$cv.company)
                        if ($ck) { $cachedAtByKey[$ck] = [string]$cv.accountType }
                    }
                }
                $script:Vendors = @()
                foreach ($v in $json.vendors) {
                    $at = if ($v.PSObject.Properties["accountType"] -and -not [string]::IsNullOrWhiteSpace([string]$v.accountType)) { ([string]$v.accountType).Trim() } else { "" }
                    if (-not $at) {
                        $vtx = [regex]::Replace((Convert-ThaiDigits ([string]$v.taxId)), "\D", "")
                        $vk = Normalize-CompanyKey ([string]$v.company)
                        if ($vtx -and $cachedAtByTax.ContainsKey($vtx)) { $at = $cachedAtByTax[$vtx] }
                        elseif ($vk -and $cachedAtByKey.ContainsKey($vk)) { $at = $cachedAtByKey[$vk] }
                    }
                    $script:Vendors += [PSCustomObject]@{
                        company     = [string]$v.company
                        bank        = [string]$v.bank
                        bankCode    = if ($v.bankCode) { [string]$v.bankCode } else { Get-BankCode ([string]$v.bank) }
                        branch      = [string]$v.branch
                        accountNo   = [string]$v.accountNo
                        accountType = $at
                        address     = [string]$v.address
                        taxId       = [string]$v.taxId
                    }
                }
                $loadedVendorsFromGas = $true
                # Refresh local cache (preserving accountType)
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
    if ($pt.ContainsKey("refMode") -and $pt["refMode"] -eq "client") {
        $absX = $info.ClientLeft + [int]$pt.dx
        $absY = $info.ClientTop  + [int]$pt.dy
    } else {
        $absX = $info.Left + [int]$pt.dx
        $absY = $info.Top  + [int]$pt.dy
    }
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
# 5. High-Precision Calibration Wizard (3x Magnifier + Click-to-Capture + Nudge)
# ==============================================================================
function Show-TargetMarker([int]$x, [int]$y) {
    try {
        $mk = New-Object System.Windows.Forms.Form
        $mk.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::None
        $mk.StartPosition = [System.Windows.Forms.FormStartPosition]::Manual
        $mk.Size = New-Object System.Drawing.Size(36, 36)
        $mk.Location = New-Object System.Drawing.Point(($x - 18), ($y - 18))
        $mk.BackColor = [System.Drawing.Color]::Magenta
        $mk.TransparencyKey = [System.Drawing.Color]::Magenta
        $mk.TopMost = $true
        $mk.ShowInTaskbar = $false
        $mk.Add_Paint({
            param($s, $e)
            $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::Red, 2.5)
            $e.Graphics.DrawEllipse($pen, 4, 4, 27, 27)
            $e.Graphics.DrawLine($pen, 18, 0, 18, 35)
            $e.Graphics.DrawLine($pen, 0, 18, 35, 18)
            $pen.Dispose()
        })
        $mkTimer = New-Object System.Windows.Forms.Timer
        $mkTimer.Interval = 1100
        $mkTimer.Add_Tick({
            $mkTimer.Stop()
            $mkTimer.Dispose()
            try { $mk.Close(); $mk.Dispose() } catch {}
        })
        $mk.Show()
        $mkTimer.Start()
    } catch {}
}

function Show-CalibrationDialog {
    if ($script:TargetHwnd -eq [IntPtr]::Zero -or -not [Mis2Win32]::IsWindow($script:TargetHwnd)) {
        $auto = Find-OracleFormsWindow
        if ($auto) {
            $script:TargetHwnd = $auto.Hwnd
            $script:TargetWinTitle = $auto.Title
        }
    }

    $dlg = New-Object System.Windows.Forms.Form
    $dlg.Text = "ตั้งพิกัดหน้าจอ Oracle Forms แบบแม่นยำสูง (แว่นขยาย 3x + คลิกจับจุด)"
    $dlg.Size = New-Object System.Drawing.Size(700, 595)
    $dlg.StartPosition = "CenterScreen"
    $dlg.TopMost = $true
    $dlg.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)
    $dlg.BackColor = [System.Drawing.Color]::FromArgb(245, 248, 252)

    $lblHelp = New-Object System.Windows.Forms.Label
    $lblHelp.Location = New-Object System.Drawing.Point(12, 10)
    $lblHelp.Size = New-Object System.Drawing.Size(660, 62)
    $lblHelp.BackColor = [System.Drawing.Color]::FromArgb(224, 242, 254)
    $lblHelp.ForeColor = [System.Drawing.Color]::FromArgb(12, 74, 110)
    $lblHelp.Padding = New-Object System.Windows.Forms.Padding(8)
    $lblHelp.Text = "วิธีตั้งพิกัดให้ตรงเป๊ะ 100% (ทำครั้งเดียวต่อเครื่อง):`r`n1. กดปุ่มสีส้ม [คลิกเพื่อจับพิกัด] แล้วเอาเมาส์ชี้กลางช่อง (ดูเป้ากากบาทแดงในจอขยาย 3x ด้านขวา) แล้วคลิกซ้าย 1 ที`r`n2. หรือเลื่อนเมาส์ชี้แล้วกด [F8] (กด [F9] เพื่อข้าม) • ปรับเลื่อนทีละ 2px ได้ด้วยปุ่มลูกศรด้านขวา"
    $dlg.Controls.Add($lblHelp)

    $lblWin = New-Object System.Windows.Forms.Label
    $lblWin.Location = New-Object System.Drawing.Point(12, 78)
    $lblWin.Size = New-Object System.Drawing.Size(660, 22)
    $lblWin.ForeColor = [System.Drawing.Color]::FromArgb(15, 118, 110)
    $lblWin.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    $lblWin.Text = if ($script:TargetWinTitle) { "หน้าต่างเป้าหมาย: $($script:TargetWinTitle)" } else { "ยังไม่ล็อกหน้าต่างเป้าหมาย — คลิกหรือกด F8 บน Oracle Forms ระบบจะจับให้อัตโนมัติ" }
    $dlg.Controls.Add($lblWin)

    $lv = New-Object System.Windows.Forms.ListView
    $lv.Location = New-Object System.Drawing.Point(12, 105)
    $lv.Size = New-Object System.Drawing.Size(498, 345)
    $lv.View = [System.Windows.Forms.View]::Details
    $lv.FullRowSelect = $true
    $lv.GridLines = $true
    $lv.HideSelection = $false
    $lv.Columns.Add("กลุ่ม", 132) | Out-Null
    $lv.Columns.Add("ช่องเป้าหมายใน Oracle Forms", 252) | Out-Null
    $lv.Columns.Add("สถานะพิกัด", 94) | Out-Null
    $dlg.Controls.Add($lv)

    # Right Side: 3x Live Pixel Magnifier + Nudge Pad
    $lblZoom = New-Object System.Windows.Forms.Label
    $lblZoom.Text = "จอขยาย 3x (เป้ากากบาทแดง)"
    $lblZoom.Location = New-Object System.Drawing.Point(520, 105)
    $lblZoom.Size = New-Object System.Drawing.Size(152, 20)
    $lblZoom.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
    $lblZoom.ForeColor = [System.Drawing.Color]::FromArgb(185, 28, 28)
    $dlg.Controls.Add($lblZoom)

    $picZoom = New-Object System.Windows.Forms.PictureBox
    $picZoom.Location = New-Object System.Drawing.Point(522, 127)
    $picZoom.Size = New-Object System.Drawing.Size(144, 144)
    $picZoom.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
    $picZoom.BackColor = [System.Drawing.Color]::White
    $dlg.Controls.Add($picZoom)

    $btnArmClick = New-Object System.Windows.Forms.Button
    $btnArmClick.Text = "คลิกจับพิกัดแถวนี้`r`n(ไม่ต้องกด F8)"
    $btnArmClick.Location = New-Object System.Drawing.Point(522, 280)
    $btnArmClick.Size = New-Object System.Drawing.Size(144, 46)
    $btnArmClick.BackColor = [System.Drawing.Color]::FromArgb(234, 88, 12)
    $btnArmClick.ForeColor = [System.Drawing.Color]::White
    $btnArmClick.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
    $btnArmClick.FlatStyle = "Flat"
    $dlg.Controls.Add($btnArmClick)

    $lblNudge = New-Object System.Windows.Forms.Label
    $lblNudge.Text = "ปรับละเอียดทีละ 2px:"
    $lblNudge.Location = New-Object System.Drawing.Point(522, 336)
    $lblNudge.Size = New-Object System.Drawing.Size(144, 20)
    $lblNudge.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
    $lblNudge.TextAlign = "MiddleCenter"
    $dlg.Controls.Add($lblNudge)

    $btnUp = New-Object System.Windows.Forms.Button
    $btnUp.Text = "▲"
    $btnUp.Location = New-Object System.Drawing.Point(574, 358)
    $btnUp.Size = New-Object System.Drawing.Size(40, 28)
    $btnUp.FlatStyle = "Flat"
    $dlg.Controls.Add($btnUp)

    $btnLeft = New-Object System.Windows.Forms.Button
    $btnLeft.Text = "◀"
    $btnLeft.Location = New-Object System.Drawing.Point(530, 388)
    $btnLeft.Size = New-Object System.Drawing.Size(40, 28)
    $btnLeft.FlatStyle = "Flat"
    $dlg.Controls.Add($btnLeft)

    $btnRight = New-Object System.Windows.Forms.Button
    $btnRight.Text = "▶"
    $btnRight.Location = New-Object System.Drawing.Point(618, 388)
    $btnRight.Size = New-Object System.Drawing.Size(40, 28)
    $btnRight.FlatStyle = "Flat"
    $dlg.Controls.Add($btnRight)

    $btnDown = New-Object System.Windows.Forms.Button
    $btnDown.Text = "▼"
    $btnDown.Location = New-Object System.Drawing.Point(574, 418)
    $btnDown.Size = New-Object System.Drawing.Size(40, 28)
    $btnDown.FlatStyle = "Flat"
    $dlg.Controls.Add($btnDown)

    $refreshCalibList = {
        $selIdx = if ($lv.SelectedIndices.Count -gt 0) { $lv.SelectedIndices[0] } else { 0 }
        $lv.Items.Clear()
        foreach ($def in $script:CalibDefinitions) {
            $item = New-Object System.Windows.Forms.ListViewItem($def.Group)
            $item.SubItems.Add($def.Label) | Out-Null
            if ($script:Calibration.ContainsKey($def.Key)) {
                $p = $script:Calibration[$def.Key]
                $item.SubItems.Add("OK ($($p.dx), $($p.dy))") | Out-Null
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

    $nudgeSelected = {
        param([int]$ddx, [int]$ddy)
        if ($lv.SelectedItems.Count -eq 0) { return }
        $def = $lv.SelectedItems[0].Tag
        if (-not $script:Calibration.ContainsKey($def.Key)) { return }
        $script:Calibration[$def.Key]["dx"] = [int]$script:Calibration[$def.Key]["dx"] + $ddx
        $script:Calibration[$def.Key]["dy"] = [int]$script:Calibration[$def.Key]["dy"] + $ddy
        Save-Calibration
        & $refreshCalibList
        $pos = Resolve-CalibPoint $def.Key
        if ($pos) {
            [Mis2Win32]::SetCursorPos($pos.X, $pos.Y) | Out-Null
            Show-TargetMarker $pos.X $pos.Y
        }
    }
    $btnUp.Add_Click({ & $nudgeSelected 0 -2 })
    $btnDown.Add_Click({ & $nudgeSelected 0 2 })
    $btnLeft.Add_Click({ & $nudgeSelected -2 0 })
    $btnRight.Add_Click({ & $nudgeSelected 2 0 })

    $lblLive = New-Object System.Windows.Forms.Label
    $lblLive.Location = New-Object System.Drawing.Point(12, 458)
    $lblLive.Size = New-Object System.Drawing.Size(660, 40)
    $lblLive.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
    $lblLive.ForeColor = [System.Drawing.Color]::FromArgb(30, 64, 175)
    $lblLive.Text = "กดปุ่มสีส้มด้านขวาแล้วคลิกกลางช่องใน Oracle Forms หรือวางเมาส์แล้วกด F8..."
    $dlg.Controls.Add($lblLive)

    $btnTest = New-Object System.Windows.Forms.Button
    $btnTest.Text = "ทดสอบชี้ตำแหน่ง + เป้าแดง"
    $btnTest.Location = New-Object System.Drawing.Point(12, 506)
    $btnTest.Size = New-Object System.Drawing.Size(200, 36)
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
        Show-TargetMarker $pos.X $pos.Y
    })
    $dlg.Controls.Add($btnTest)

    $btnDel = New-Object System.Windows.Forms.Button
    $btnDel.Text = "ล้างพิกัดแถวนี้"
    $btnDel.Location = New-Object System.Drawing.Point(220, 506)
    $btnDel.Size = New-Object System.Drawing.Size(125, 36)
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
    $btnClose.Text = "เสร็จสิ้น"
    $btnClose.Location = New-Object System.Drawing.Point(542, 506)
    $btnClose.Size = New-Object System.Drawing.Size(130, 36)
    $btnClose.BackColor = [System.Drawing.Color]::FromArgb(16, 185, 129)
    $btnClose.ForeColor = [System.Drawing.Color]::White
    $btnClose.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
    $btnClose.FlatStyle = "Flat"
    $btnClose.Add_Click({ $dlg.Close() })
    $dlg.Controls.Add($btnClose)

    $script:lastF8Down = $false
    $script:lastF9Down = $false
    $script:lastLBtnDown = $false
    $script:ArmClickCapture = $false
    $script:WaitReleaseBeforeArm = $false

    $btnArmClick.Add_Click({
        if ($lv.SelectedItems.Count -eq 0) { return }
        $script:ArmClickCapture = $true
        $script:WaitReleaseBeforeArm = $true
        $btnArmClick.BackColor = [System.Drawing.Color]::FromArgb(220, 38, 38)
        $btnArmClick.Text = "กำลังรอคลิกซ้าย...`r`n(คลิกกลางช่องได้เลย)"
    })

    $capturePointAtCursor = {
        param($ptObj)
        if ($lv.SelectedItems.Count -eq 0) { return }
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
                dx      = [int]($ptObj.X - $w.ClientLeft)
                dy      = [int]($ptObj.Y - $w.ClientTop)
                winW    = [int]$w.Width
                winH    = [int]$w.Height
                refMode = "client"
            }
            Save-Calibration
            [System.Media.SystemSounds]::Asterisk.Play()
            Show-TargetMarker $ptObj.X $ptObj.Y
            $nextIdx = $lv.SelectedIndices[0] + 1
            & $refreshCalibList
            if ($nextIdx -lt $lv.Items.Count) {
                $lv.Items[$nextIdx].Selected = $true
                $lv.Items[$nextIdx].EnsureVisible()
            }
        }
    }

    $zoomBmp = New-Object System.Drawing.Bitmap(144, 144)
    $capBmp  = New-Object System.Drawing.Bitmap(48, 48)
    $redPen  = New-Object System.Drawing.Pen([System.Drawing.Color]::Red, 2)

    $timer = New-Object System.Windows.Forms.Timer
    $timer.Interval = 70
    $timer.Add_Tick({
        $pt = New-Object Mis2Win32+POINT
        [Mis2Win32]::GetCursorPos([ref]$pt) | Out-Null

        # Update 3x live pixel magnifier with red crosshair
        try {
            $gCap = [System.Drawing.Graphics]::FromImage($capBmp)
            $gCap.CopyFromScreen(($pt.X - 24), ($pt.Y - 24), 0, 0, (New-Object System.Drawing.Size(48, 48)))
            $gCap.Dispose()

            $gZoom = [System.Drawing.Graphics]::FromImage($zoomBmp)
            $gZoom.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
            $gZoom.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
            $gZoom.DrawImage($capBmp, (New-Object System.Drawing.Rectangle(0, 0, 144, 144)))
            $gZoom.DrawLine($redPen, 72, 0, 72, 144)
            $gZoom.DrawLine($redPen, 0, 72, 144, 72)
            $gZoom.DrawRectangle($redPen, 68, 68, 8, 8)
            $gZoom.Dispose()
            $picZoom.Image = $zoomBmp
            $picZoom.Invalidate()
        } catch {}

        $relText = "เมาส์: ($($pt.X), $($pt.Y))"
        if ($script:TargetHwnd -ne [IntPtr]::Zero -and [Mis2Win32]::IsWindow($script:TargetHwnd)) {
            $w = [Mis2Win32]::GetWindowInfo($script:TargetHwnd)
            if ($w) {
                $relText += "  |  พิกัดภายใน Oracle: dx=$($pt.X - $w.ClientLeft), dy=$($pt.Y - $w.ClientTop)"
            }
        }
        $curLabel = if ($lv.SelectedItems.Count -gt 0) { $lv.SelectedItems[0].Tag.Label } else { "-" }
        $armHint = if ($script:ArmClickCapture) { "  [คลิกซ้ายกลางช่องเพื่อบันทึก!]" } else { "" }
        $lblLive.Text = "กำลังตั้ง: $curLabel$armHint`r`n$relText"

        # 1) Click-to-Capture mode (no F8 hand jitter!)
        $lBtnDown = [Mis2Win32]::IsKeyDown([Mis2Win32]::VK_LBUTTON)
        if ($script:ArmClickCapture) {
            if ($script:WaitReleaseBeforeArm) {
                if (-not $lBtnDown) { $script:WaitReleaseBeforeArm = $false }
            } elseif ($lBtnDown -and -not $script:lastLBtnDown) {
                $insideDlg = ($pt.X -ge $dlg.Left -and $pt.X -le $dlg.Right -and $pt.Y -ge $dlg.Top -and $pt.Y -le $dlg.Bottom)
                if (-not $insideDlg) {
                    $script:ArmClickCapture = $false
                    $btnArmClick.BackColor = [System.Drawing.Color]::FromArgb(234, 88, 12)
                    $btnArmClick.Text = "คลิกจับพิกัดแถวนี้`r`n(ไม่ต้องกด F8)"
                    & $capturePointAtCursor $pt
                }
            }
        }
        $script:lastLBtnDown = $lBtnDown

        # 2) F8 hotkey capture
        $f8Down = [Mis2Win32]::IsKeyDown([Mis2Win32]::VK_F8)
        if ($f8Down -and -not $script:lastF8Down) {
            & $capturePointAtCursor $pt
        }
        $script:lastF8Down = $f8Down

        # 3) F9 skip
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
    $dlg.Add_FormClosing({
        $timer.Stop()
        $timer.Dispose()
        try { $redPen.Dispose(); $capBmp.Dispose(); $zoomBmp.Dispose() } catch {}
    })
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

[System.Windows.Forms.Application]::EnableVisualStyles()

$form = New-Object System.Windows.Forms.Form
$form.Text = "BMA MIS2 ข้อมูลช่วยกรอกเบิกจ่าย (FRM_PAY_DOC) — พัฒนาโดย ARISSARA.K"
$screenArea = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$initH = [Math]::Min(695, [Math]::Max(520, $screenArea.Height - 24))
$form.Size = New-Object System.Drawing.Size(478, $initH)
$form.MinimumSize = New-Object System.Drawing.Size(440, [Math]::Min(520, $initH))
$form.AutoScroll = $true
$form.StartPosition = "Manual"
$form.Location = New-Object System.Drawing.Point(([Math]::Max(10, $screenArea.Right - 488)), 12)
$form.TopMost = $true
$form.BackColor = [System.Drawing.Color]::FromArgb(244, 247, 251)
$form.Font = New-Object System.Drawing.Font("Segoe UI", 9)

# --- Top Header Panel ---
$header = New-Object System.Windows.Forms.Panel
$header.Dock = "Top"
$header.Height = 92
$header.BackColor = [System.Drawing.Color]::FromArgb(15, 76, 129)
$form.Controls.Add($header)

$lblTitle = New-Object System.Windows.Forms.Label
$lblTitle.Text = "BMA MIS2 ข้อมูลช่วยกรอกเบิกจ่าย (FRM_PAY_DOC)"
$lblTitle.Location = New-Object System.Drawing.Point(12, 8)
$lblTitle.Size = New-Object System.Drawing.Size(356, 24)
$lblTitle.ForeColor = [System.Drawing.Color]::White
$lblTitle.Font = New-Object System.Drawing.Font("Segoe UI", 10.5, [System.Drawing.FontStyle]::Bold)
$header.Controls.Add($lblTitle)

$chkTopMost = New-Object System.Windows.Forms.CheckBox
$chkTopMost.Text = "ปักหมุด"
$chkTopMost.Checked = $true
$chkTopMost.Location = New-Object System.Drawing.Point(374, 9)
$chkTopMost.Size = New-Object System.Drawing.Size(78, 22)
$chkTopMost.ForeColor = [System.Drawing.Color]::FromArgb(186, 230, 253)
$chkTopMost.Add_CheckedChanged({ $form.TopMost = $chkTopMost.Checked })
$header.Controls.Add($chkTopMost)

$lblSafety = New-Object System.Windows.Forms.Label
$lblSafety.Text = "โหมดข้อมูลช่วยกรอก: กดปุ่ม [คัดลอก] ข้างแต่ละช่อง แล้วกด Ctrl+V วางใน FRM_PAY_DOC"
$lblSafety.Location = New-Object System.Drawing.Point(12, 34)
$lblSafety.Size = New-Object System.Drawing.Size(442, 18)
$lblSafety.ForeColor = [System.Drawing.Color]::FromArgb(254, 240, 138)
$lblSafety.Font = New-Object System.Drawing.Font("Segoe UI", 8.2, [System.Drawing.FontStyle]::Bold)
$header.Controls.Add($lblSafety)

$btnOpenWeb = New-Object System.Windows.Forms.Button
$btnOpenWeb.Text = "เปิดหน้าเว็บ MIS2 (IE)"
$btnOpenWeb.Location = New-Object System.Drawing.Point(12, 56)
$btnOpenWeb.Size = New-Object System.Drawing.Size(212, 28)
$btnOpenWeb.BackColor = [System.Drawing.Color]::FromArgb(2, 132, 199)
$btnOpenWeb.ForeColor = [System.Drawing.Color]::White
$btnOpenWeb.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
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
$btnReload.Text = "ซิงค์ข้อมูล Google Sheets"
$btnReload.Location = New-Object System.Drawing.Point(232, 56)
$btnReload.Size = New-Object System.Drawing.Size(214, 28)
$btnReload.BackColor = [System.Drawing.Color]::FromArgb(13, 148, 136)
$btnReload.ForeColor = [System.Drawing.Color]::White
$btnReload.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$btnReload.FlatStyle = "Flat"
$btnReload.FlatAppearance.BorderSize = 0
$header.Controls.Add($btnReload)

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

# --- Fiscal Year Selector Bar (starts at 70, expandable & per-year target files) ---
$pnlFy = New-Object System.Windows.Forms.Panel
$pnlFy.Location = New-Object System.Drawing.Point(10, $y)
$pnlFy.Size = New-Object System.Drawing.Size(434, 32)
$pnlFy.BackColor = [System.Drawing.Color]::FromArgb(224, 242, 254)
$body.Controls.Add($pnlFy)

$lblFy = New-Object System.Windows.Forms.Label
$lblFy.Text = "ปีงบประมาณ:"
$lblFy.Location = New-Object System.Drawing.Point(8, 7)
$lblFy.Size = New-Object System.Drawing.Size(88, 20)
$lblFy.ForeColor = [System.Drawing.Color]::FromArgb(12, 74, 110)
$lblFy.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$pnlFy.Controls.Add($lblFy)

$cmbFiscalYear = New-Object System.Windows.Forms.ComboBox
$cmbFiscalYear.Location = New-Object System.Drawing.Point(98, 4)
$cmbFiscalYear.Size = New-Object System.Drawing.Size(84, 24)
$cmbFiscalYear.DropDownStyle = "DropDownList"
$cmbFiscalYear.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$pnlFy.Controls.Add($cmbFiscalYear)

$lblFyFileStatus = New-Object System.Windows.Forms.Label
$lblFyFileStatus.Location = New-Object System.Drawing.Point(188, 7)
$lblFyFileStatus.Size = New-Object System.Drawing.Size(124, 20)
$lblFyFileStatus.ForeColor = [System.Drawing.Color]::FromArgb(15, 118, 110)
$lblFyFileStatus.Font = New-Object System.Drawing.Font("Segoe UI", 8.2, [System.Drawing.FontStyle]::Bold)
$lblFyFileStatus.Text = "ไฟล์: MISS70"
$pnlFy.Controls.Add($lblFyFileStatus)

$btnFyConfig = New-Object System.Windows.Forms.Button
$btnFyConfig.Text = "ตั้งค่าไฟล์ปีงบ"
$btnFyConfig.Location = New-Object System.Drawing.Point(316, 3)
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
$grpSource.Size = New-Object System.Drawing.Size(434, 174)
$grpSource.BackColor = [System.Drawing.Color]::White
$body.Controls.Add($grpSource)

$lblSearchCode = New-Object System.Windows.Forms.Label
$lblSearchCode.Text = "ค้นหารหัส ซ. (เช่น 1งบ, 7งบ):"
$lblSearchCode.Location = New-Object System.Drawing.Point(10, 22)
$lblSearchCode.Size = New-Object System.Drawing.Size(165, 20)
$grpSource.Controls.Add($lblSearchCode)

$txtSearchCode = New-Object System.Windows.Forms.TextBox
$txtSearchCode.Location = New-Object System.Drawing.Point(175, 19)
$txtSearchCode.Size = New-Object System.Drawing.Size(120, 24)
$grpSource.Controls.Add($txtSearchCode)

$btnClearCode = New-Object System.Windows.Forms.Button
$btnClearCode.Text = "แสดงทั้งหมด"
$btnClearCode.Location = New-Object System.Drawing.Point(300, 18)
$btnClearCode.Size = New-Object System.Drawing.Size(120, 25)
$btnClearCode.FlatStyle = "Flat"
$grpSource.Controls.Add($btnClearCode)

$cmbItem = New-Object System.Windows.Forms.ComboBox
$cmbItem.Location = New-Object System.Drawing.Point(10, 48)
$cmbItem.Size = New-Object System.Drawing.Size(410, 24)
$cmbItem.DropDownStyle = "DropDownList"
$grpSource.Controls.Add($cmbItem)

$lblSearchVendor = New-Object System.Windows.Forms.Label
$lblSearchVendor.Text = "หรือค้นหาบริษัท (ทะเบียนบริษัท):"
$lblSearchVendor.Location = New-Object System.Drawing.Point(10, 79)
$lblSearchVendor.Size = New-Object System.Drawing.Size(175, 20)
$grpSource.Controls.Add($lblSearchVendor)

$txtSearchVendor = New-Object System.Windows.Forms.TextBox
$txtSearchVendor.Location = New-Object System.Drawing.Point(188, 76)
$txtSearchVendor.Size = New-Object System.Drawing.Size(232, 24)
$grpSource.Controls.Add($txtSearchVendor)

$cmbVendor = New-Object System.Windows.Forms.ComboBox
$cmbVendor.Location = New-Object System.Drawing.Point(10, 104)
$cmbVendor.Size = New-Object System.Drawing.Size(410, 24)
$cmbVendor.DropDownStyle = "DropDownList"
$grpSource.Controls.Add($cmbVendor)

$lblAlert = New-Object System.Windows.Forms.Label
$lblAlert.Location = New-Object System.Drawing.Point(10, 132)
$lblAlert.Size = New-Object System.Drawing.Size(410, 34)
$lblAlert.BackColor = [System.Drawing.Color]::FromArgb(241, 245, 249)
$lblAlert.ForeColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$lblAlert.Padding = New-Object System.Windows.Forms.Padding(6, 3, 6, 3)
$lblAlert.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
$lblAlert.Text = "เลือกรายการงบหรือบริษัทด้านบน แล้วกดปุ่ม [คัดลอก] ข้างแต่ละช่องเพื่อนำไปวาง"
$grpSource.Controls.Add($lblAlert)

$y += 180

# --- Section 2: 3-Tab Data Helper (Copy-to-Clipboard ONLY — No Auto-Clicking!) ---
$tabs = New-Object System.Windows.Forms.TabControl
$tabs.Location = New-Object System.Drawing.Point(10, $y)
$tabs.Size = New-Object System.Drawing.Size(434, 272)
$body.Controls.Add($tabs)

# Helper to create pure 1-click Copy button beside each field
function Add-QuickPasteBtn($parent, [int]$x, [int]$yPos, $targetControl, [bool]$isMultiline = $false) {
    $b = New-Object System.Windows.Forms.Button
    $b.Text = "คัดลอก"
    $b.Location = New-Object System.Drawing.Point($x, $yPos)
    $b.Size = New-Object System.Drawing.Size(54, 24)
    $b.BackColor = [System.Drawing.Color]::FromArgb(224, 242, 254)
    $b.ForeColor = [System.Drawing.Color]::FromArgb(3, 105, 161)
    $b.Font = New-Object System.Drawing.Font("Segoe UI", 8.2, [System.Drawing.FontStyle]::Bold)
    $b.FlatStyle = "Flat"
    $b.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(125, 211, 252)
    $b.Tag = @{ Control = $targetControl; Multi = $isMultiline }
    $tip = New-Object System.Windows.Forms.ToolTip
    $tip.SetToolTip($b, "คัดลอกข้อมูลช่องนี้ลงคลิปบอร์ด แล้วนำไปกด Ctrl+V วางใน FRM_PAY_DOC")
    $b.Add_Click({
        param($sender, $e)
        $meta = $sender.Tag
        $val = ([string]$meta.Control.Text).Trim()
        if ([string]::IsNullOrWhiteSpace($val)) {
            $statusBar.Text = "[เตือน] ไม่มีข้อมูลในช่องนี้ให้คัดลอก"
            return
        }
        Set-ClipboardSafe $val | Out-Null
        $preview = if ($val.Length -gt 38) { $val.Substring(0, 38) + "..." } else { $val.Replace("`r`n", " / ") }
        $statusBar.Text = "คัดลอกแล้ว: $preview (กด Ctrl+V เพื่อวาง)"
    })
    $parent.Controls.Add($b)
    return $b
}

# ===================== TAB 1: ใบตรวจรับ & ภาษี =====================
$tab1 = New-Object System.Windows.Forms.TabPage
$tab1.Text = "1. ใบตรวจรับ & ภาษี"
$tab1.BackColor = [System.Drawing.Color]::White
$tabs.TabPages.Add($tab1)

$lblRcv = New-Object System.Windows.Forms.Label
$lblRcv.Text = "เอกสารตรวจรับงานซื้อ/จ้าง (เลขที่ / ปี):"
$lblRcv.Location = New-Object System.Drawing.Point(12, 12)
$lblRcv.Size = New-Object System.Drawing.Size(260, 20)
$lblRcv.Font = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$tab1.Controls.Add($lblRcv)

$txtRcvNo = New-Object System.Windows.Forms.TextBox
$txtRcvNo.Location = New-Object System.Drawing.Point(12, 35)
$txtRcvNo.Size = New-Object System.Drawing.Size(102, 25)
$txtRcvNo.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$tab1.Controls.Add($txtRcvNo)
Add-QuickPasteBtn $tab1 118 35 $txtRcvNo $false | Out-Null

$lblSlash = New-Object System.Windows.Forms.Label
$lblSlash.Text = "/"
$lblSlash.Location = New-Object System.Drawing.Point(178, 37)
$lblSlash.Size = New-Object System.Drawing.Size(16, 24)
$lblSlash.Font = New-Object System.Drawing.Font("Segoe UI", 12, [System.Drawing.FontStyle]::Bold)
$tab1.Controls.Add($lblSlash)

$txtRcvYear = New-Object System.Windows.Forms.TextBox
$txtRcvYear.Text = [string]$script:Config["fiscalYear"]
$txtRcvYear.Location = New-Object System.Drawing.Point(198, 35)
$txtRcvYear.Size = New-Object System.Drawing.Size(60, 25)
$txtRcvYear.Font = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$tab1.Controls.Add($txtRcvYear)
Add-QuickPasteBtn $tab1 262 35 $txtRcvYear $false | Out-Null

$lblItemSummary = New-Object System.Windows.Forms.Label
$lblItemSummary.Location = New-Object System.Drawing.Point(12, 68)
$lblItemSummary.Size = New-Object System.Drawing.Size(400, 92)
$lblItemSummary.BackColor = [System.Drawing.Color]::FromArgb(248, 250, 252)
$lblItemSummary.BorderStyle = "FixedSingle"
$lblItemSummary.Padding = New-Object System.Windows.Forms.Padding(6)
$lblItemSummary.Text = "สรุปรายการจาก Google Sheets:`r`n- เลขที่ใบสั่งซื้อ: -  |  ยอดเงิน: -`r`n- บริษัท: -`r`n- เรื่อง: -"
$tab1.Controls.Add($lblItemSummary)

$lblVat = New-Object System.Windows.Forms.Label
$lblVat.Text = "ภาษีมูลค่าเพิ่ม (7%):"
$lblVat.Location = New-Object System.Drawing.Point(12, 172)
$lblVat.Size = New-Object System.Drawing.Size(116, 20)
$lblVat.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
$tab1.Controls.Add($lblVat)

$txtVatAmount = New-Object System.Windows.Forms.TextBox
$txtVatAmount.Location = New-Object System.Drawing.Point(130, 169)
$txtVatAmount.Size = New-Object System.Drawing.Size(92, 23)
$txtVatAmount.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$tab1.Controls.Add($txtVatAmount)
Add-QuickPasteBtn $tab1 226 169 $txtVatAmount $false | Out-Null

$lblWht = New-Object System.Windows.Forms.Label
$lblWht.Text = "หักภาษีเงินได้ (1%):"
$lblWht.Location = New-Object System.Drawing.Point(12, 202)
$lblWht.Size = New-Object System.Drawing.Size(116, 20)
$lblWht.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
$tab1.Controls.Add($lblWht)

$txtWhtAmount = New-Object System.Windows.Forms.TextBox
$txtWhtAmount.Location = New-Object System.Drawing.Point(130, 199)
$txtWhtAmount.Size = New-Object System.Drawing.Size(92, 23)
$txtWhtAmount.Font = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
$tab1.Controls.Add($txtWhtAmount)
Add-QuickPasteBtn $tab1 226 199 $txtWhtAmount $false | Out-Null

$lblWhtBadge = New-Object System.Windows.Forms.Label
$lblWhtBadge.Location = New-Object System.Drawing.Point(286, 169)
$lblWhtBadge.Size = New-Object System.Drawing.Size(126, 54)
$lblWhtBadge.BackColor = [System.Drawing.Color]::FromArgb(241, 245, 249)
$lblWhtBadge.ForeColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$lblWhtBadge.BorderStyle = "FixedSingle"
$lblWhtBadge.TextAlign = "MiddleCenter"
$lblWhtBadge.Font = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Bold)
$lblWhtBadge.Text = "สุทธิที่จ่าย:`r`n-"
$tab1.Controls.Add($lblWhtBadge)

# ===================== TAB 2: ผู้รับเงิน =====================
$tab2 = New-Object System.Windows.Forms.TabPage
$tab2.Text = "2. ผู้รับเงิน"
$tab2.BackColor = [System.Drawing.Color]::White
$tab2.AutoScroll = $true
$tabs.TabPages.Add($tab2)

$t2y = 10
function Add-PayeeRow([string]$chkKey, [string]$label, [bool]$defChecked, [bool]$isMulti = $false) {
    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text = $label
    $lbl.Location = New-Object System.Drawing.Point(8, ($script:t2y + 3))
    $lbl.Size = New-Object System.Drawing.Size(116, 20)
    $lbl.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
    $lbl.ForeColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
    $tab2.Controls.Add($lbl)

    $tb = New-Object System.Windows.Forms.TextBox
    $tb.Location = New-Object System.Drawing.Point(126, $script:t2y)
    if ($isMulti) {
        $tb.Multiline = $true
        $tb.ScrollBars = "Vertical"
        $tb.Size = New-Object System.Drawing.Size(226, 42)
    } else {
        $tb.Size = New-Object System.Drawing.Size(226, 23)
    }
    $tab2.Controls.Add($tb)
    Add-QuickPasteBtn $tab2 356 $script:t2y $tb $isMulti | Out-Null

    $script:t2y += if ($isMulti) { 47 } else { 31 }
    return @{ Check = @{ Checked = $true }; Box = $tb }
}

$rPayTo = Add-PayeeRow "payTo" "จ่ายให้ (Col A)" $true $false

# โดยมอบให้ (ComboBox with presets)
$lblAssign = New-Object System.Windows.Forms.Label
$lblAssign.Text = "โดยมอบให้"
$lblAssign.Location = New-Object System.Drawing.Point(8, ($t2y + 3))
$lblAssign.Size = New-Object System.Drawing.Size(116, 20)
$lblAssign.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
$lblAssign.ForeColor = [System.Drawing.Color]::FromArgb(30, 41, 59)
$tab2.Controls.Add($lblAssign)
$chkAssign = @{ Checked = $true }

$cmbAssign = New-Object System.Windows.Forms.ComboBox
$cmbAssign.Location = New-Object System.Drawing.Point(126, $t2y)
$cmbAssign.Size = New-Object System.Drawing.Size(226, 23)
foreach ($p in $script:Config["assignToPresets"]) { $cmbAssign.Items.Add($p) | Out-Null }
$cmbAssign.Text = [string]$script:Config["defaultAssignTo"]
$tab2.Controls.Add($cmbAssign)
Add-QuickPasteBtn $tab2 356 $t2y $cmbAssign $false | Out-Null
$t2y += 31

# Bank Code + Branch Code + Account No + Branch Info Strip
$rBankCode   = Add-PayeeRow "bankCode"   "รหัสธนาคาร (B)" $true $false
$rBranchCode = Add-PayeeRow "branchCode" "รหัสสาขา (4 หลัก)" $true $false
$rAccountNo  = Add-PayeeRow "accountNo"  "เลขที่บัญชี (E)" $true $false

$rBranchCode.Box.Add_Leave({
    if ($rPayTo.Box.Text.Trim() -and $rBranchCode.Box.Text.Trim()) {
        Save-BranchCodeOverride -company $rPayTo.Box.Text.Trim() -code $rBranchCode.Box.Text.Trim()
    }
})

$lblBankBranchInfo = New-Object System.Windows.Forms.Label
$lblBankBranchInfo.Location = New-Object System.Drawing.Point(8, ($t2y + 4))
$lblBankBranchInfo.Size = New-Object System.Drawing.Size(402, 42)
$lblBankBranchInfo.BackColor = [System.Drawing.Color]::FromArgb(254, 249, 195)
$lblBankBranchInfo.ForeColor = [System.Drawing.Color]::FromArgb(133, 77, 14)
$lblBankBranchInfo.BorderStyle = "FixedSingle"
$lblBankBranchInfo.Padding = New-Object System.Windows.Forms.Padding(6, 4, 6, 4)
$lblBankBranchInfo.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
$lblBankBranchInfo.Text = "ธนาคาร (B): -  |  สาขา (C): -"
$tab2.Controls.Add($lblBankBranchInfo)

# ===================== TAB 3: รายละเอียดเบิก =====================
$tab3 = New-Object System.Windows.Forms.TabPage
$tab3.Text = "3. รายละเอียดเบิก"
$tab3.BackColor = [System.Drawing.Color]::White
$tabs.TabPages.Add($tab3)

$lblReq = New-Object System.Windows.Forms.Label
$lblReq.Text = "ชื่อผู้เบิก (แก้ไขได้และจำค่าอัตโนมัติ):"
$lblReq.Location = New-Object System.Drawing.Point(12, 10)
$lblReq.Size = New-Object System.Drawing.Size(396, 18)
$lblReq.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
$tab3.Controls.Add($lblReq)

$txtRequester = New-Object System.Windows.Forms.TextBox
$txtRequester.Location = New-Object System.Drawing.Point(12, 30)
$txtRequester.Size = New-Object System.Drawing.Size(342, 24)
$txtRequester.Text = [string]$script:Config["defaultRequester"]
$tab3.Controls.Add($txtRequester)
Add-QuickPasteBtn $tab3 358 30 $txtRequester $false | Out-Null

$lblPayDate = New-Object System.Windows.Forms.Label
$lblPayDate.Text = "วันที่เบิก (dd/MM/yyyy พ.ศ.):"
$lblPayDate.Location = New-Object System.Drawing.Point(12, 62)
$lblPayDate.Size = New-Object System.Drawing.Size(180, 18)
$lblPayDate.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
$tab3.Controls.Add($lblPayDate)

$txtPayDate = New-Object System.Windows.Forms.TextBox
$txtPayDate.Text = Get-TodayThaiSlash
$txtPayDate.Location = New-Object System.Drawing.Point(12, 82)
$txtPayDate.Size = New-Object System.Drawing.Size(115, 24)
$tab3.Controls.Add($txtPayDate)
Add-QuickPasteBtn $tab3 131 82 $txtPayDate $false | Out-Null

$btnDateToday = New-Object System.Windows.Forms.Button
$btnDateToday.Text = "วันนี้"
$btnDateToday.Location = New-Object System.Drawing.Point(192, 82)
$btnDateToday.Size = New-Object System.Drawing.Size(58, 24)
$btnDateToday.FlatStyle = "Flat"
$btnDateToday.Add_Click({ $txtPayDate.Text = Get-TodayThaiSlash })
$tab3.Controls.Add($btnDateToday)

$btnDateRcv = New-Object System.Windows.Forms.Button
$btnDateRcv.Text = "วันตรวจรับ"
$btnDateRcv.Location = New-Object System.Drawing.Point(255, 82)
$btnDateRcv.Size = New-Object System.Drawing.Size(80, 24)
$btnDateRcv.FlatStyle = "Flat"
$btnDateRcv.Add_Click({
    if ($script:SelectedItem -and $script:SelectedItem.rcvDate) {
        $txtPayDate.Text = [string]$script:SelectedItem.rcvDate
    }
})
$tab3.Controls.Add($btnDateRcv)

$lblDesc = New-Object System.Windows.Forms.Label
$lblDesc.Text = "คำอธิบายรายการเบิก ((ค่า...) + ประเภทบัญชี คอลัมน์ F):"
$lblDesc.Location = New-Object System.Drawing.Point(12, 114)
$lblDesc.Size = New-Object System.Drawing.Size(396, 18)
$lblDesc.Font = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Bold)
$tab3.Controls.Add($lblDesc)

$txtDesc = New-Object System.Windows.Forms.TextBox
$txtDesc.Multiline = $true
$txtDesc.ScrollBars = "Vertical"
$txtDesc.Location = New-Object System.Drawing.Point(12, 134)
$txtDesc.Size = New-Object System.Drawing.Size(342, 98)
$tab3.Controls.Add($txtDesc)
Add-QuickPasteBtn $tab3 358 134 $txtDesc $true | Out-Null

$y += 280

# --- Section 3: Writeback เลขที่ใบขอเบิก to MISS70 Column H ---
$grpWriteback = New-Object System.Windows.Forms.GroupBox
$grpWriteback.Text = " บันทึก 'เลขที่ใบขอเบิก.../70' กลับลงชีต MISS70 (คอลัมน์ H) "
$grpWriteback.Location = New-Object System.Drawing.Point(10, $y)
$grpWriteback.Size = New-Object System.Drawing.Size(434, 66)
$grpWriteback.BackColor = [System.Drawing.Color]::White
$body.Controls.Add($grpWriteback)

$lblPayDoc = New-Object System.Windows.Forms.Label
$lblPayDoc.Text = "เลขที่ใบขอเบิกที่ได้:"
$lblPayDoc.Location = New-Object System.Drawing.Point(10, 28)
$lblPayDoc.Size = New-Object System.Drawing.Size(112, 20)
$grpWriteback.Controls.Add($lblPayDoc)

$txtPayDocNo = New-Object System.Windows.Forms.TextBox
$txtPayDocNo.Location = New-Object System.Drawing.Point(124, 25)
$txtPayDocNo.Size = New-Object System.Drawing.Size(124, 24)
$grpWriteback.Controls.Add($txtPayDocNo)

$btnSavePayDoc = New-Object System.Windows.Forms.Button
$btnSavePayDoc.Text = "บันทึกลง MISS70"
$btnSavePayDoc.Location = New-Object System.Drawing.Point(254, 24)
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
    # Data-helper mode: no target window lock or calibration required
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

function Format-PayDescription($item, $vendor) {
    if (-not $item) { return "" }
    $subjRaw = if ($item.missSubject) { ([string]$item.missSubject).Trim() } else { ([string]$item.subject).Trim() }
    $tpl = [string]$script:Config["descriptionTemplate"]
    if ([string]::IsNullOrWhiteSpace($tpl)) { $tpl = "(ค่า{subject})" }
    if ($tpl -eq "(ค่า{subject})" -and $subjRaw.StartsWith("ค่า")) {
        $baseDesc = "($subjRaw)"
    } else {
        $baseDesc = $tpl.Replace("{subject}", $subjRaw)
        $baseDesc = $baseDesc.Replace("{poNo}", [string]$item.poNo)
        $baseDesc = $baseDesc.Replace("{rcvNo}", [string]$item.rcvNo)
        $baseDesc = $baseDesc.Replace("{year}", [string]$script:Config["fiscalYear"])
        $baseDesc = $baseDesc.Replace("{poSignDate}", [string]$item.poSignDate)
        $baseDesc = $baseDesc.Replace("{rcvDate}", [string]$item.rcvDate)
    }
    $acctType = ""
    if ($vendor -and $vendor.PSObject.Properties["accountType"]) {
        $acctType = ([string]$vendor.accountType).Trim()
    }
    if (-not [string]::IsNullOrWhiteSpace($acctType) -and -not [string]::IsNullOrWhiteSpace($baseDesc)) {
        return "$baseDesc`r`n$acctType"
    }
    if (-not [string]::IsNullOrWhiteSpace($baseDesc)) { return $baseDesc }
    return $acctType
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

    if ($script:SelectedItem) {
        $txtDesc.Text = Format-PayDescription $script:SelectedItem $v
    }

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

    # Description template (Column F ประเภทบัญชี on line 1 + MISS Column J (ค่า...) on line 2)
    $txtDesc.Text = Format-PayDescription $item $null

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

    # Match vendor profile from EGP+MIS ทะเบียนบริษัท (prefer enriched $script:Vendors with accountType)
    $matched = Find-MatchingVendor -vendorName ([string]$item.vendorName) -taxId ([string]$item.vendorTaxId)
    if (-not $matched -and $item.vendorProfile -and $item.vendorProfile.company) {
        $matched = $item.vendorProfile
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
    $statusBar.Text = "กำลังดึงข้อมูลล่าสุดจาก Google Sheets..."
    [System.Windows.Forms.Application]::DoEvents()
    $msg = Sync-GoogleSheetsData
    Refresh-VendorCombo
    Refresh-ItemCombo
    $statusBar.Text = "โหลดสำเร็จ — $msg"
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
