#requires -Version 5.1
<#
.SYNOPSIS
    BMA MIS2 Local Oracle Forms Bridge (for Unified Opera / Chrome / IE Extension)
    ผู้พัฒนา: ARISSARA.K — กลุ่มงานเภสัชกรรม โรงพยาบาลเจริญกรุงประชารักษ์

    สะพานเชื่อมเบื้องหลังบน Windows (http://127.0.0.1:47291)
    - ใช้ TcpListener บน 127.0.0.1 ไม่ต้องใช้สิทธิ์ Administrator
    - รันเงียบใน System Tray (มุมขวาล่างใกล้เวลา)
    - รับคำสั่งจากส่วนขยาย Opera / Chrome และ IE เพื่อกรอกลงหน้าต่าง Oracle Forms (FRM_PAY_DOC)
    - กติกาความปลอดภัย: หยุดก่อนบันทึกทุกครั้ง (ไม่มีคำสั่ง Save / Ctrl+S / F10 เด็ดขาด) | กด ESC หยุดทันที
#>

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# Prevent duplicate instances
$script:BridgeMutex = New-Object System.Threading.Mutex($false, "Local\BmaMis2OracleBridge_ARISSARA_47291")
if (-not $script:BridgeMutex.WaitOne(0, $false)) {
    [System.Windows.Forms.MessageBox]::Show(
        "ตัวช่วย Oracle Forms (BMA MIS2 Bridge) เปิดทำงานอยู่แล้วในแถบ System Tray มุมขวาล่างครับ`r`nสามารถกดใช้งานจากส่วนขยาย Opera / IE ได้เลย",
        "BMA MIS2 Oracle Forms Bridge",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
    exit 0
}

# ==============================================================================
# 1. Win32 Automation + Lightweight Localhost TCP HTTP Server (No Admin Needed!)
# ==============================================================================
$bridgeCs = @"
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public class Mis2BridgeWin32 {
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

    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern bool IsIconic(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] private static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")] private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] private static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("kernel32.dll")] private static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] private static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT lpPoint);
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] private static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")] private static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, UIntPtr dwExtraInfo);
    [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vKey);
    [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT Point);
    [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr hwnd, uint gaFlags);

    private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    private const uint MOUSEEVENTF_LEFTUP   = 0x0004;
    private const uint KEYEVENTF_KEYUP      = 0x0002;
    private const int  SW_RESTORE           = 9;
    private const uint GA_ROOT              = 2;

    public const byte VK_BACK    = 0x08;
    public const byte VK_SHIFT   = 0x10;
    public const byte VK_CONTROL = 0x11;
    public const byte VK_ESCAPE  = 0x1B;
    public const byte VK_END     = 0x23;
    public const byte VK_HOME    = 0x24;
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
        if (IsIconic(hWnd)) ShowWindow(hWnd, SW_RESTORE);
        IntPtr fg = GetForegroundWindow();
        uint curThread = GetCurrentThreadId();
        uint dummy;
        uint fgThread = fg != IntPtr.Zero ? GetWindowThreadProcessId(fg, out dummy) : 0;
        uint targetThread = GetWindowThreadProcessId(hWnd, out dummy);

        bool attachedFg = false;
        bool attachedTarget = false;
        if (fgThread != 0 && fgThread != curThread) attachedFg = AttachThreadInput(curThread, fgThread, true);
        if (targetThread != 0 && targetThread != curThread) attachedTarget = AttachThreadInput(curThread, targetThread, true);

        BringWindowToTop(hWnd);
        bool ok = SetForegroundWindow(hWnd);

        if (attachedTarget) AttachThreadInput(curThread, targetThread, false);
        if (attachedFg) AttachThreadInput(curThread, fgThread, false);
        return ok;
    }

    public static void LeftClick(int x, int y) {
        SetCursorPos(x, y);
        Thread.Sleep(45);
        mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, UIntPtr.Zero);
        Thread.Sleep(35);
        mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, UIntPtr.Zero);
    }

    public static void TapKey(byte vk) {
        keybd_event(vk, 0, 0, UIntPtr.Zero);
        Thread.Sleep(20);
        keybd_event(vk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }

    public static void KeyCombo(byte modVk, byte keyVk) {
        keybd_event(modVk, 0, 0, UIntPtr.Zero);
        Thread.Sleep(25);
        keybd_event(keyVk, 0, 0, UIntPtr.Zero);
        Thread.Sleep(30);
        keybd_event(keyVk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
        Thread.Sleep(25);
        keybd_event(modVk, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
    }

    public static void SelectAllAndClear(bool isMultiline) {
        if (isMultiline) {
            KeyCombo(VK_CONTROL, VK_A);
            Thread.Sleep(40);
            TapKey(VK_BACK);
            Thread.Sleep(30);
            KeyCombo(VK_CONTROL, VK_HOME);
            Thread.Sleep(25);
            keybd_event(VK_CONTROL, 0, 0, UIntPtr.Zero);
            keybd_event(VK_SHIFT, 0, 0, UIntPtr.Zero);
            TapKey(VK_END);
            keybd_event(VK_SHIFT, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, UIntPtr.Zero);
            Thread.Sleep(25);
            TapKey(VK_BACK);
        } else {
            TapKey(VK_HOME);
            Thread.Sleep(25);
            KeyCombo(VK_SHIFT, VK_END);
            Thread.Sleep(30);
            TapKey(VK_BACK);
            Thread.Sleep(25);
            KeyCombo(VK_CONTROL, VK_A);
            Thread.Sleep(25);
            TapKey(VK_BACK);
        }
    }

    public static void HardwarePaste() {
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

public class Mis2BridgeJob {
    public string Method;
    public string Path;
    public string Query;
    public string Body;
    public string ResponseJson;
    public string ContentType;
    public ManualResetEventSlim Done = new ManualResetEventSlim(false);
}

public class Mis2BridgeHttpServer {
    private TcpListener _listener;
    private Thread _thread;
    private volatile bool _running;
    public ConcurrentQueue<Mis2BridgeJob> Queue = new ConcurrentQueue<Mis2BridgeJob>();

    public void Start(int port) {
        _listener = new TcpListener(IPAddress.Loopback, port);
        _listener.Start();
        _running = true;
        _thread = new Thread(AcceptLoop);
        _thread.IsBackground = true;
        _thread.Start();
    }

    public void Stop() {
        _running = false;
        try { if (_listener != null) _listener.Stop(); } catch {}
    }

    private void AcceptLoop() {
        while (_running) {
            try {
                TcpClient client = _listener.AcceptTcpClient();
                ThreadPool.QueueUserWorkItem(HandleClient, client);
            } catch {
                if (!_running) break;
                Thread.Sleep(50);
            }
        }
    }

    private void HandleClient(object state) {
        TcpClient client = (TcpClient)state;
        try {
            client.ReceiveTimeout = 5000;
            client.SendTimeout = 5000;
            using (client)
            using (NetworkStream stream = client.GetStream()) {
                byte[] buf = new byte[65536];
                var ms = new MemoryStream();
                int headerEnd = -1;
                int contentLength = 0;

                while (headerEnd < 0) {
                    int n = stream.Read(buf, 0, buf.Length);
                    if (n <= 0) return;
                    ms.Write(buf, 0, n);
                    byte[] arr = ms.ToArray();
                    headerEnd = FindHeaderEnd(arr);
                    if (arr.Length > 1048576) return;
                }

                byte[] allBytes = ms.ToArray();
                string headerText = Encoding.ASCII.GetString(allBytes, 0, headerEnd);
                string[] lines = headerText.Split(new string[] { "\r\n" }, StringSplitOptions.None);
                if (lines.Length == 0) return;

                string[] reqParts = lines[0].Split(' ');
                if (reqParts.Length < 2) return;
                string method = reqParts[0].ToUpperInvariant();
                string rawPath = reqParts[1];
                int qIdx = rawPath.IndexOf('?');
                string path = qIdx >= 0 ? rawPath.Substring(0, qIdx) : rawPath;
                string query = qIdx >= 0 ? rawPath.Substring(qIdx + 1) : "";

                for (int i = 1; i < lines.Length; i++) {
                    if (lines[i].StartsWith("Content-Length:", StringComparison.OrdinalIgnoreCase)) {
                        int.TryParse(lines[i].Substring(15).Trim(), out contentLength);
                    }
                }

                int bodyStart = headerEnd + 4;
                int bodyAlready = allBytes.Length - bodyStart;
                var bodyMs = new MemoryStream();
                if (bodyAlready > 0) bodyMs.Write(allBytes, bodyStart, bodyAlready);
                while (bodyMs.Length < contentLength) {
                    int toRead = (int)Math.Min(buf.Length, contentLength - bodyMs.Length);
                    int n = stream.Read(buf, 0, toRead);
                    if (n <= 0) break;
                    bodyMs.Write(buf, 0, n);
                }

                if (method == "OPTIONS") {
                    WriteResponse(stream, "204 No Content", "", "application/json; charset=utf-8");
                    return;
                }

                string bodyStr = contentLength > 0 ? Encoding.UTF8.GetString(bodyMs.ToArray(), 0, (int)bodyMs.Length) : "";
                var job = new Mis2BridgeJob { Method = method, Path = path, Query = query, Body = bodyStr };
                Queue.Enqueue(job);

                int waitMs = (path == "/calibrate" || path == "/pick-window" || query.IndexOf("calibrate") >= 0 || query.IndexOf("pick-window") >= 0) ? 300000 : 45000;
                if (job.Done.Wait(waitMs)) {
                    WriteResponse(stream, "200 OK", job.ResponseJson ?? "{\"ok\":true}", string.IsNullOrEmpty(job.ContentType) ? "application/json; charset=utf-8" : job.ContentType);
                } else {
                    WriteResponse(stream, "504 Gateway Timeout", "{\"ok\":false,\"error\":\"timeout\"}", "application/json; charset=utf-8");
                }
            }
        } catch {}
    }

    private int FindHeaderEnd(byte[] arr) {
        for (int i = 0; i <= arr.Length - 4; i++) {
            if (arr[i] == 13 && arr[i + 1] == 10 && arr[i + 2] == 13 && arr[i + 3] == 10) return i;
        }
        return -1;
    }

    private void WriteResponse(NetworkStream stream, string status, string body, string contentType) {
        byte[] bodyBytes = Encoding.UTF8.GetBytes(body ?? "");
        string headers =
            "HTTP/1.1 " + status + "\r\n" +
            "Content-Type: " + contentType + "\r\n" +
            "Content-Length: " + bodyBytes.Length + "\r\n" +
            "Access-Control-Allow-Origin: *\r\n" +
            "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" +
            "Access-Control-Allow-Headers: Content-Type\r\n" +
            "Access-Control-Allow-Private-Network: true\r\n" +
            "Cache-Control: no-store\r\n" +
            "Connection: close\r\n\r\n";
        byte[] headerBytes = Encoding.ASCII.GetBytes(headers);
        stream.Write(headerBytes, 0, headerBytes.Length);
        if (bodyBytes.Length > 0) stream.Write(bodyBytes, 0, bodyBytes.Length);
        stream.Flush();
    }
}
"@

Add-Type -TypeDefinition $bridgeCs -Language CSharp
[Mis2BridgeWin32]::SetProcessDPIAware() | Out-Null

# ==============================================================================
# 2. Calibration Definitions & Persistence (NEVER includes Save!)
# ==============================================================================
$script:BridgePort      = 47291
$script:AppDir          = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:CalibrationPath = Join-Path $script:AppDir "calibration.json"
$script:LegacyCalibPath = Join-Path (Split-Path -Parent $script:AppDir) "bma-mis2-pay-autofill\calibration.json"
$script:Calibration     = @{}
$script:TargetHwnd      = [IntPtr]::Zero
$script:TargetWinTitle  = ""
$script:StepDelayMs     = 220

$script:CalibDefinitions = @(
    @{ Key = "rcvNo";          Group = "ขั้นที่ 1 (ใบตรวจรับ)";      Label = "ช่อง เลขที่เอกสารตรวจรับ (ซ้ายของ /)";  Note = "ช่องกรอกเลขใบตรวจรับ เช่น 54" },
    @{ Key = "rcvYear";        Group = "ขั้นที่ 1 (ใบตรวจรับ)";      Label = "ช่อง ปีงบประมาณตรวจรับ (ขวาของ /)";    Note = "ช่องปี 2 หลัก เช่น 70" },
    @{ Key = "rcvSearchBtn";   Group = "ขั้นที่ 1 (ใบตรวจรับ)";      Label = "ปุ่ม แว่นขยาย 🔍 (อ้างอิงจัดซื้อ/จัดจ้าง)"; Note = "ปุ่มค้นหาข้างช่องปี" },
    @{ Key = "popupDetail";    Group = "ขั้นที่ 1.5 (Popup เลือกงบ)"; Label = "ปุ่ม 'รายละเอียด' แถวที่ 1 ใน Popup";  Note = "ข้ามได้ (F9) ถ้าต้องการกดเอง" },
    @{ Key = "popupBudgetChk"; Group = "ขั้นที่ 1.5 (Popup เลือกงบ)"; Label = "ช่องติ๊กถูก ☑ แถวที่ 1 (งบประมาณ)";     Note = "ข้ามได้ (F9) ถ้าต้องการติ๊กเอง" },
    @{ Key = "popupOkBtn";     Group = "ขั้นที่ 1.5 (Popup เลือกงบ)"; Label = "ปุ่ม 'ตกลง' ด้านล่าง Popup";          Note = "ข้ามได้ (F9) ถ้าต้องการกดเอง" },
    @{ Key = "vatAmount";      Group = "ขั้นที่ 1.6 (ตารางภาษี)";     Label = "ช่อง 'ภาษีมูลค่าเพิ่ม' (7%) แถวที่ 1"; Note = "ในตารางแท็บข้อมูลฎีกาเบิกเงิน" },
    @{ Key = "whtAmount";      Group = "ขั้นที่ 1.6 (ตารางภาษี)";     Label = "ช่อง 'หักภาษีเงินได้' (1%) แถวที่ 1";  Note = "0.00 สำหรับ สภากาชาด/เอเบิ้ล/อภ./ยูนีซัน" },
    @{ Key = "tabPayee";       Group = "ขั้นที่ 2 (แท็บผู้รับเงิน)"; Label = "หัวแท็บ 'ผู้รับเงิน'";                  Note = "แท็บที่ 3 ของฟอร์ม FRM_PAY_DOC" },
    @{ Key = "payTo";          Group = "ขั้นที่ 2 (แท็บผู้รับเงิน)"; Label = "ช่อง 'จ่ายให้'";                       Note = "ชื่อบริษัทจากคอลัมน์ A (ทะเบียนบริษัท)" },
    @{ Key = "assignTo";       Group = "ขั้นที่ 2 (แท็บผู้รับเงิน)"; Label = "ช่อง 'โดยมอบให้'";                     Note = "สำนักงานบริหารการเงินการคลังฯ โอนเข้าบัญชี รพจ." },
    @{ Key = "bankCode";       Group = "ขั้นที่ 2 (แท็บผู้รับเงิน)"; Label = "ช่อง 'รหัสธนาคาร' (3 หลัก)";           Note = "เช่น 004, 006, 014, 031 (จากคอลัมน์ B)" },
    @{ Key = "branchCode";     Group = "ขั้นที่ 2 (แท็บผู้รับเงิน)"; Label = "ช่อง 'รหัสสาขา' (4 หลัก)";             Note = "เช่น 0001 (ดึงจาก 0+3 หลักแรกของบัญชี)" },
    @{ Key = "accountNo";      Group = "ขั้นที่ 2 (แท็บผู้รับเงิน)"; Label = "ช่อง 'เลขที่บัญชี'";                   Note = "เลขบัญชีจากคอลัมน์ E (MIs2)" },
    @{ Key = "tabDetail";      Group = "ขั้นที่ 3 (รายละเอียดเบิก)"; Label = "หัวแท็บ 'รายละเอียดเงินเบิกจ่าย'";      Note = "แท็บที่ 4 ของฟอร์ม FRM_PAY_DOC" },
    @{ Key = "requesterName";  Group = "ขั้นที่ 3 (รายละเอียดเบิก)"; Label = "ช่อง 'ชื่อผู้เบิก'";                    Note = "กล่องใหญ่ด้านล่างจำนวนเงินที่จ่าย" },
    @{ Key = "payDate";        Group = "ขั้นที่ 3 (รายละเอียดเบิก)"; Label = "ช่อง 'วันที่เบิก'";                     Note = "รูปแบบ dd/MM/yyyy พ.ศ." },
    @{ Key = "description";    Group = "ขั้นที่ 3 (รายละเอียดเบิก)"; Label = "ช่อง 'คำอธิบายรายการเบิก'";            Note = "กล่องใหญ่ด้านล่างสุด (ข้ามจำนวนเอกสาร)" }
)

function Load-Calibration {
    $script:Calibration = @{}
    $srcPath = $script:CalibrationPath
    if (-not (Test-Path $srcPath) -and (Test-Path $script:LegacyCalibPath)) {
        try {
            Copy-Item -Path $script:LegacyCalibPath -Destination $script:CalibrationPath -Force
        } catch {}
    }
    if (Test-Path $script:CalibrationPath) {
        try {
            $raw = [System.IO.File]::ReadAllText($script:CalibrationPath, [System.Text.Encoding]::UTF8)
            $obj = $raw | ConvertFrom-Json
            foreach ($p in $obj.PSObject.Properties) {
                $script:Calibration[$p.Name] = @{
                    dx = [int]$p.Value.dx
                    dy = [int]$p.Value.dy
                }
            }
        } catch {}
    }
}

function Save-Calibration {
    try {
        $json = $script:Calibration | ConvertTo-Json -Depth 4
        [System.IO.File]::WriteAllText($script:CalibrationPath, $json, (New-Object System.Text.UTF8Encoding($false)))
    } catch {}
}

# ==============================================================================
# 3. Oracle Forms Window Finder & Win32 Injection Engine
# ==============================================================================
function Find-OracleFormsWindow {
    $wins = [Mis2BridgeWin32]::GetVisibleWindows()
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
    # Priority 3: Other Oracle / Hospital non-browser window
    foreach ($w in $wins) {
        if ($w.Title -match "โรงพยาบาลเจริญกรุง|สำนักการแพทย์|Oracle" -and $w.Title -notmatch "$selfExcl|Internet Explorer|Opera|Chrome|Edge") {
            return $w
        }
    }
    return $null
}

function Open-FloatingPayPanel {
    # If already open, restore and force on top of maximized Oracle Forms immediately
    try {
        $existing = [Mis2BridgeWin32]::GetVisibleWindows() | Where-Object { $_.Title -match "BMA MIS2 เบิกจ่ายอัตโนมัติ" } | Select-Object -First 1
        if ($existing) {
            [Mis2BridgeWin32]::ForceTopMost($existing.Hwnd)
            return $true
        }
    } catch {}

    $candidates = @(
        (Join-Path $script:AppDir "mis2_pay_autofill.ps1"),
        (Join-Path (Split-Path -Parent $script:AppDir) "bma-mis2-pay-autofill\mis2_pay_autofill.ps1")
    )
    $panelScript = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($panelScript) {
        try {
            $argStr = "-NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File `"$panelScript`""
            Start-Process -FilePath "powershell.exe" -ArgumentList $argStr -WindowStyle Hidden
            return $true
        } catch {}
    }
    return $false
}

function Get-ActiveTargetInfo {
    if ($script:TargetHwnd -eq [IntPtr]::Zero -or -not [Mis2BridgeWin32]::IsWindow($script:TargetHwnd)) {
        $auto = Find-OracleFormsWindow
        if ($auto) {
            $script:TargetHwnd = $auto.Hwnd
            $script:TargetWinTitle = $auto.Title
        }
    }
    if ($script:TargetHwnd -ne [IntPtr]::Zero -and [Mis2BridgeWin32]::IsWindow($script:TargetHwnd)) {
        return [Mis2BridgeWin32]::GetWindowInfo($script:TargetHwnd)
    }
    return $null
}

function Set-ClipboardSafe([string]$text) {
    if ($null -eq $text) { $text = "" }
    for ($i = 0; $i -lt 6; $i++) {
        try {
            [System.Windows.Forms.Clipboard]::SetText($text, [System.Windows.Forms.TextDataFormat]::UnicodeText)
            return $true
        } catch {
            Start-Sleep -Milliseconds 40
        }
    }
    return $false
}

function Assert-NotEmergencyStopped {
    if ([Mis2BridgeWin32]::IsEmergencyStopTriggered()) {
        throw "EMERGENCY_STOP"
    }
}

function Invoke-PasteAtCurrentCursor([string]$text, [bool]$isMultiline = $false) {
    Set-ClipboardSafe $text | Out-Null
    $info = Get-ActiveTargetInfo
    if ($null -eq $info) { return $false }
    [Mis2BridgeWin32]::FocusWindow($info.Hwnd) | Out-Null
    Start-Sleep -Milliseconds 130
    [Mis2BridgeWin32]::SelectAllAndClear($isMultiline)
    Start-Sleep -Milliseconds 70
    [Mis2BridgeWin32]::HardwarePaste()
    Start-Sleep -Milliseconds 90
    return $true
}

function Invoke-FillCalibratedField([string]$key, [string]$text, [bool]$isMultiline = $false, [bool]$clickOnly = $false) {
    Assert-NotEmergencyStopped
    if (-not $script:Calibration.ContainsKey($key)) { return $false }
    $info = Get-ActiveTargetInfo
    if ($null -eq $info) { throw "ไม่พบหน้าต่าง Oracle Forms (กรุณาเปิดหน้า FRM_PAY_DOC แล้วกด 'เลือกหน้าต่าง')" }

    $pt = $script:Calibration[$key]
    $absX = $info.Left + [int]$pt.dx
    $absY = $info.Top  + [int]$pt.dy

    [Mis2BridgeWin32]::FocusWindow($info.Hwnd) | Out-Null
    Start-Sleep -Milliseconds 90
    Assert-NotEmergencyStopped

    [Mis2BridgeWin32]::LeftClick($absX, $absY)
    Start-Sleep -Milliseconds 110
    Assert-NotEmergencyStopped

    if (-not $clickOnly) {
        [Mis2BridgeWin32]::SelectAllAndClear($isMultiline)
        Start-Sleep -Milliseconds 70
        Assert-NotEmergencyStopped

        Set-ClipboardSafe $text | Out-Null
        Start-Sleep -Milliseconds 45
        [Mis2BridgeWin32]::HardwarePaste()
        Start-Sleep -Milliseconds $script:StepDelayMs
    } else {
        Start-Sleep -Milliseconds $script:StepDelayMs
    }
    return $true
}

function Open-Mis2InIE([string]$url = "http://bmasso.bma.go.th/MIS2DirectLogins/index2.jsp") {
    $iePaths = @(
        "$env:ProgramFiles\Internet Explorer\iexplore.exe",
        "${env:ProgramFiles(x86)}\Internet Explorer\iexplore.exe"
    )
    $ieExe = $iePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
    if ($ieExe) {
        try { Start-Process -FilePath $ieExe -ArgumentList $url; return $true } catch {}
    }
    try { Start-Process $url; return $true } catch { return $false }
}

# ==============================================================================
# 4. WinForms Dialogs (Window Picker & F8 Calibration)
# ==============================================================================
function Show-WindowPickerDialog {
    $dlg = New-Object System.Windows.Forms.Form
    $dlg.Text = "เลือกหน้าต่าง Oracle Forms (MIS2)"
    $dlg.Size = New-Object System.Drawing.Size(520, 380)
    $dlg.StartPosition = "CenterScreen"
    $dlg.TopMost = $true
    $dlg.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)

    $lbl = New-Object System.Windows.Forms.Label
    $lbl.Text = "เลือกหน้าต่าง Oracle Forms (ระบบการเงินจ่าย / FRM_PAY_DOC) ที่เปิดอยู่:"
    $lbl.Location = New-Object System.Drawing.Point(12, 12)
    $lbl.Size = New-Object System.Drawing.Size(480, 22)
    $dlg.Controls.Add($lbl)

    $lb = New-Object System.Windows.Forms.ListBox
    $lb.Location = New-Object System.Drawing.Point(12, 40)
    $lb.Size = New-Object System.Drawing.Size(480, 240)
    $dlg.Controls.Add($lb)

    $wins = [Mis2BridgeWin32]::GetVisibleWindows() | Where-Object { $_.Title -notmatch "เลือกหน้าต่าง Oracle Forms" }
    foreach ($w in $wins) { $lb.Items.Add($w) | Out-Null }
    if ($lb.Items.Count -gt 0) { $lb.SelectedIndex = 0 }

    $btnOk = New-Object System.Windows.Forms.Button
    $btnOk.Text = "✓ ล็อกหน้าต่างนี้"
    $btnOk.Location = New-Object System.Drawing.Point(290, 292)
    $btnOk.Size = New-Object System.Drawing.Size(120, 32)
    $btnOk.BackColor = [System.Drawing.Color]::FromArgb(2, 132, 199)
    $btnOk.ForeColor = [System.Drawing.Color]::White
    $btnOk.FlatStyle = "Flat"
    $btnOk.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $dlg.Controls.Add($btnOk)

    $btnCancel = New-Object System.Windows.Forms.Button
    $btnCancel.Text = "ยกเลิก"
    $btnCancel.Location = New-Object System.Drawing.Point(416, 292)
    $btnCancel.Size = New-Object System.Drawing.Size(76, 32)
    $btnCancel.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $dlg.Controls.Add($btnCancel)

    $dlg.AcceptButton = $btnOk
    $dlg.CancelButton = $btnCancel

    if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK -and $lb.SelectedItem) {
        $chosen = $lb.SelectedItem
        $script:TargetHwnd = $chosen.Hwnd
        $script:TargetWinTitle = $chosen.Title
        return $true
    }
    return $false
}

function Show-CalibrationDialog {
    $calForm = New-Object System.Windows.Forms.Form
    $calForm.Text = "🎯 ตั้งพิกัดหน้าจอ Oracle Forms (ทำเพียง 1 ครั้งต่อเครื่อง) — ARISSARA.K"
    $calForm.Size = New-Object System.Drawing.Size(650, 550)
    $calForm.StartPosition = "CenterScreen"
    $calForm.TopMost = $true
    $calForm.Font = New-Object System.Drawing.Font("Segoe UI", 9.5)
    $calForm.BackColor = [System.Drawing.Color]::FromArgb(248, 250, 252)

    $lblHelp = New-Object System.Windows.Forms.Label
    $lblHelp.Text = "วิธีตั้งพิกัด:`r`n1. เปิดหน้าต่าง Oracle Forms (FRM_PAY_DOC) ไว้ข้างๆ`r`n2. เลือกรายการช่องในตาราง -> เลื่อนเมาส์ไปวางกลางช่องนั้น -> กด F8 เพื่อบันทึก (กด F9 เพื่อข้าม)`r`n* ระบบไม่มีการตั้งพิกัดปุ่มบันทึก (Save) เพื่อให้คนตรวจสอบและกดบันทึกเองทุกครั้ง"
    $lblHelp.Location = New-Object System.Drawing.Point(14, 12)
    $lblHelp.Size = New-Object System.Drawing.Size(606, 76)
    $lblHelp.BackColor = [System.Drawing.Color]::FromArgb(224, 242, 254)
    $lblHelp.ForeColor = [System.Drawing.Color]::FromArgb(12, 74, 110)
    $lblHelp.Padding = New-Object System.Windows.Forms.Padding(8)
    $calForm.Controls.Add($lblHelp)

    $lv = New-Object System.Windows.Forms.ListView
    $lv.Location = New-Object System.Drawing.Point(14, 96)
    $lv.Size = New-Object System.Drawing.Size(606, 330)
    $lv.View = "Details"
    $lv.FullRowSelect = $true
    $lv.GridLines = $true
    $lv.HideSelection = $false
    $lv.Columns.Add("ขั้นตอน", 155) | Out-Null
    $lv.Columns.Add("ช่องเป้าหมายใน Oracle Forms", 255) | Out-Null
    $lv.Columns.Add("พิกัดสัมพัทธ์", 95) | Out-Null
    $lv.Columns.Add("สถานะ", 78) | Out-Null
    $calForm.Controls.Add($lv)

    $refreshList = {
        $selIdx = if ($lv.SelectedIndices.Count -gt 0) { $lv.SelectedIndices[0] } else { 0 }
        $lv.Items.Clear()
        foreach ($d in $script:CalibDefinitions) {
            $item = New-Object System.Windows.Forms.ListViewItem($d.Group)
            $item.SubItems.Add($d.Label) | Out-Null
            if ($script:Calibration.ContainsKey($d.Key)) {
                $p = $script:Calibration[$d.Key]
                $item.SubItems.Add("($($p.dx), $($p.dy))") | Out-Null
                $item.SubItems.Add("✓ ตั้งแล้ว") | Out-Null
                $item.BackColor = [System.Drawing.Color]::FromArgb(220, 252, 231)
            } else {
                $item.SubItems.Add("-") | Out-Null
                $item.SubItems.Add("ยังไม่ตั้ง") | Out-Null
            }
            $item.Tag = $d
            $lv.Items.Add($item) | Out-Null
        }
        if ($lv.Items.Count -gt 0) {
            $idx = [Math]::Min($selIdx, $lv.Items.Count - 1)
            $lv.Items[$idx].Selected = $true
            $lv.Items[$idx].EnsureVisible()
        }
    }
    & $refreshList

    $lblLive = New-Object System.Windows.Forms.Label
    $lblLive.Location = New-Object System.Drawing.Point(14, 434)
    $lblLive.Size = New-Object System.Drawing.Size(606, 26)
    $lblLive.Font = New-Object System.Drawing.Font("Consolas", 9.5, [System.Drawing.FontStyle]::Bold)
    $lblLive.ForeColor = [System.Drawing.Color]::FromArgb(30, 64, 175)
    $lblLive.Text = "กำลังรอจับพิกัด... เอาเมาส์ชี้ช่องใน Oracle Forms แล้วกด F8"
    $calForm.Controls.Add($lblLive)

    $btnClear = New-Object System.Windows.Forms.Button
    $btnClear.Text = "ล้างพิกัดช่องที่เลือก"
    $btnClear.Location = New-Object System.Drawing.Point(14, 468)
    $btnClear.Size = New-Object System.Drawing.Size(150, 32)
    $btnClear.Add_Click({
        if ($lv.SelectedItems.Count -gt 0) {
            $k = $lv.SelectedItems[0].Tag.Key
            $script:Calibration.Remove($k)
            Save-Calibration
            & $refreshList
        }
    })
    $calForm.Controls.Add($btnClear)

    $btnClose = New-Object System.Windows.Forms.Button
    $btnClose.Text = "✓ บันทึกและปิดหน้าต่าง"
    $btnClose.Location = New-Object System.Drawing.Point(450, 468)
    $btnClose.Size = New-Object System.Drawing.Size(170, 32)
    $btnClose.BackColor = [System.Drawing.Color]::FromArgb(22, 163, 74)
    $btnClose.ForeColor = [System.Drawing.Color]::White
    $btnClose.FlatStyle = "Flat"
    $btnClose.Add_Click({ Save-Calibration; $calForm.Close() })
    $calForm.Controls.Add($btnClose)

    $script:lastF8 = $false
    $script:lastF9 = $false
    $tmr = New-Object System.Windows.Forms.Timer
    $tmr.Interval = 60
    $tmr.Add_Tick({
        $pt = New-Object Mis2BridgeWin32+POINT
        [Mis2BridgeWin32]::GetCursorPos([ref]$pt) | Out-Null
        $tInfo = Get-ActiveTargetInfo
        if ($tInfo) {
            $rx = $pt.X - $tInfo.Left
            $ry = $pt.Y - $tInfo.Top
            $lblLive.Text = "เมาส์: ($($pt.X), $($pt.Y)) | สัมพัทธ์กับ Oracle Forms: ($rx, $ry)  [กด F8 บันทึก / F9 ข้าม]"
        } else {
            $lblLive.Text = "เมาส์: ($($pt.X), $($pt.Y)) | เอาเมาส์ชี้บน Oracle Forms แล้วกด F8 (ระบบจะล็อกหน้าต่างให้อัตโนมัติ)"
        }

        $f8 = [Mis2BridgeWin32]::IsKeyDown([Mis2BridgeWin32]::VK_F8)
        $f9 = [Mis2BridgeWin32]::IsKeyDown([Mis2BridgeWin32]::VK_F9)

        if ($f8 -and -not $script:lastF8 -and $lv.SelectedItems.Count -gt 0) {
            $curIdx = $lv.SelectedIndices[0]
            $def = $lv.SelectedItems[0].Tag
            $winUnder = [Mis2BridgeWin32]::GetTopWindowAtCursor()
            if ($winUnder -ne [IntPtr]::Zero -and $winUnder -ne $calForm.Handle) {
                $wInfo = [Mis2BridgeWin32]::GetWindowInfo($winUnder)
                if ($wInfo) {
                    $script:TargetHwnd = $wInfo.Hwnd
                    $script:TargetWinTitle = $wInfo.Title
                    $script:Calibration[$def.Key] = @{
                        dx = ($pt.X - $wInfo.Left)
                        dy = ($pt.Y - $wInfo.Top)
                    }
                    Save-Calibration
                    [System.Media.SystemSounds]::Asterisk.Play()
                    & $refreshList
                    if ($curIdx + 1 -lt $lv.Items.Count) {
                        $lv.Items[$curIdx + 1].Selected = $true
                        $lv.Items[$curIdx + 1].EnsureVisible()
                    }
                }
            }
        } elseif ($f9 -and -not $script:lastF9 -and $lv.SelectedItems.Count -gt 0) {
            $curIdx = $lv.SelectedIndices[0]
            if ($curIdx + 1 -lt $lv.Items.Count) {
                $lv.Items[$curIdx + 1].Selected = $true
                $lv.Items[$curIdx + 1].EnsureVisible()
            }
        }
        $script:lastF8 = $f8
        $script:lastF9 = $f9
    })
    $calForm.Add_FormClosing({ $tmr.Stop(); $tmr.Dispose() })
    $tmr.Start()
    $calForm.ShowDialog() | Out-Null
}

# ==============================================================================
# 5. Bridge Request Dispatcher (Runs safely on WinForms STA Thread)
# ==============================================================================
function Get-StatusPayload {
    $info = Get-ActiveTargetInfo
    $keys = @($script:Calibration.Keys)
    return @{
        ok              = $true
        running         = $true
        version         = "2.2.0"
        targetFound     = ($null -ne $info)
        targetTitle     = if ($info) { [string]$info.Title } else { "" }
        calibratedCount = $script:Calibration.Count
        totalCalibCount = $script:CalibDefinitions.Count
        calibratedKeys  = $keys
    }
}

function Parse-QueryString([string]$qs) {
    $map = @{}
    if ([string]::IsNullOrWhiteSpace($qs)) { return $map }
    foreach ($part in $qs.Split('&')) {
        if ([string]::IsNullOrWhiteSpace($part)) { continue }
        $idx = $part.IndexOf('=')
        if ($idx -ge 0) {
            $k = [Uri]::UnescapeDataString($part.Substring(0, $idx).Replace('+', ' '))
            $v = [Uri]::UnescapeDataString($part.Substring($idx + 1).Replace('+', ' '))
            $map[$k] = $v
        } else {
            $map[[Uri]::UnescapeDataString($part.Replace('+', ' '))] = ""
        }
    }
    return $map
}

function Process-BridgeJob($job) {
    $path = [string]$job.Path

    if ($path -eq "/jsonp") {
        $qMap = Parse-QueryString ([string]$job.Query)
        $cb = if ($qMap.ContainsKey("cb")) { ([string]$qMap["cb"]) -replace '[^a-zA-Z0-9_]', '' } else { "" }
        $innerPath = if ($qMap.ContainsKey("path")) { [string]$qMap["path"] } else { "/status" }
        $innerBody = ""
        if ($qMap.ContainsKey("b64") -and -not [string]::IsNullOrWhiteSpace($qMap["b64"])) {
            try {
                $b64Str = ([string]$qMap["b64"]).Replace('-', '+').Replace('_', '/')
                $pad = $b64Str.Length % 4
                if ($pad -gt 0) { $b64Str += ('=' * (4 - $pad)) }
                $innerBody = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($b64Str))
            } catch {
                $innerBody = ""
            }
        } elseif ($qMap.ContainsKey("data")) {
            $innerBody = [string]$qMap["data"]
        }
        $innerJob = New-Object Mis2BridgeJob
        $innerJob.Method = if ($innerBody) { "POST" } else { "GET" }
        $innerJob.Path = $innerPath
        $innerJob.Body = $innerBody
        Process-BridgeJob $innerJob
        $rawJson = if ([string]::IsNullOrWhiteSpace($innerJob.ResponseJson)) { '{"ok":false}' } else { $innerJob.ResponseJson }
        $safeJson = $rawJson.Replace([string][char]0x2028, '\u2028').Replace([string][char]0x2029, '\u2029')
        $job.ContentType = "application/javascript; charset=utf-8"
        if ($cb) {
            $job.ResponseJson = "try{$cb($safeJson);}catch(e){}"
        } else {
            $job.ResponseJson = $safeJson
        }
        return
    }

    $bodyObj = $null
    if (-not [string]::IsNullOrWhiteSpace($job.Body)) {
        try { $bodyObj = $job.Body | ConvertFrom-Json } catch {}
    }

    try {
        if ($path -eq "/status") {
            $res = Get-StatusPayload
            $job.ResponseJson = ($res | ConvertTo-Json -Depth 4 -Compress)
            return
        }

        if ($path -eq "/vendors-cache") {
            $vFile = Join-Path $script:AppDir "vendors-cache.json"
            if (Test-Path $vFile) {
                $job.ResponseJson = [System.IO.File]::ReadAllText($vFile, [System.Text.Encoding]::UTF8)
            } else {
                $job.ResponseJson = '{"vendors":[]}'
            }
            return
        }

        if ($path -eq "/ie-autofill.js") {
            $ieFile = Join-Path $script:AppDir "ie-autofill.js"
            $job.ContentType = "application/javascript; charset=utf-8"
            if (Test-Path $ieFile) {
                $job.ResponseJson = [System.IO.File]::ReadAllText($ieFile, [System.Text.Encoding]::UTF8)
            } else {
                $job.ResponseJson = "alert('ไม่พบไฟล์ ie-autofill.js ในเครื่อง กรุณากด UPDATE_FROM_GITHUB.bat');"
            }
            return
        }

        if ($path -eq "/fetch-gas") {
            $targetUrl = if ($bodyObj -and $bodyObj.url) { [string]$bodyObj.url } else { "" }
            if (-not $targetUrl.StartsWith("https://script.google.com/")) {
                $job.ResponseJson = (@{ ok = $false; error = "Invalid GAS URL" } | ConvertTo-Json -Compress)
                return
            }
            $wc = New-Object System.Net.WebClient
            $wc.Encoding = [System.Text.Encoding]::UTF8
            $m = if ($bodyObj -and $bodyObj.method) { ([string]$bodyObj.method).ToUpperInvariant() } else { "GET" }
            if ($m -eq "POST") {
                $wc.Headers.Add("Content-Type", "application/json; charset=utf-8")
                $postBody = if ($bodyObj.payload) { ($bodyObj.payload | ConvertTo-Json -Depth 6 -Compress) } else { "{}" }
                $rawResp = $wc.UploadString($targetUrl, "POST", $postBody)
            } else {
                $rawResp = $wc.DownloadString($targetUrl)
            }
            $job.ResponseJson = $rawResp
            return
        }

        if ($path -eq "/open-mis2-ie") {
            $url = if ($bodyObj -and $bodyObj.url) { [string]$bodyObj.url } else { "http://bmasso.bma.go.th/MIS2DirectLogins/index2.jsp" }
            $opened = Open-Mis2InIE $url
            $job.ResponseJson = (@{ ok = $opened; url = $url } | ConvertTo-Json -Compress)
            return
        }

        if ($path -eq "/open-floating-pay") {
            $opened = Open-FloatingPayPanel
            $job.ResponseJson = (@{ ok = $opened } | ConvertTo-Json -Compress)
            return
        }

        if ($path -eq "/pick-window") {
            $picked = Show-WindowPickerDialog
            $st = Get-StatusPayload
            $st["picked"] = $picked
            $job.ResponseJson = ($st | ConvertTo-Json -Depth 4 -Compress)
            return
        }

        if ($path -eq "/calibrate") {
            Show-CalibrationDialog
            $st = Get-StatusPayload
            $job.ResponseJson = ($st | ConvertTo-Json -Depth 4 -Compress)
            return
        }

        if ($path -eq "/paste") {
            $txt = if ($bodyObj -and $null -ne $bodyObj.text) { [string]$bodyObj.text } else { "" }
            $multi = if ($bodyObj -and $null -ne $bodyObj.isMultiline) { [bool]$bodyObj.isMultiline } else { $false }
            if ([string]::IsNullOrWhiteSpace($txt)) {
                $job.ResponseJson = (@{ ok = $false; error = "ไม่มีข้อความให้วาง" } | ConvertTo-Json -Compress)
                return
            }
            $pasted = Invoke-PasteAtCurrentCursor -text $txt -isMultiline $multi
            $job.ResponseJson = (@{ ok = $true; pasted = $pasted; copied = $true } | ConvertTo-Json -Compress)
            return
        }

        if ($path -eq "/run-step") {
            $step = if ($bodyObj -and $bodyObj.step) { [string]$bodyObj.step } else { "" }
            $p    = if ($bodyObj -and $bodyObj.payload) { $bodyObj.payload } else { $bodyObj }

            if ($step -eq "1") {
                $missing = @("rcvNo", "rcvYear", "rcvSearchBtn") | Where-Object { -not $script:Calibration.ContainsKey($_) }
                if ($missing.Count -gt 0) {
                    $job.ResponseJson = (@{ ok = $false; needCalibration = $true; missing = $missing; error = "ยังไม่ได้ตั้งพิกัดขั้นที่ 1 (กดปุ่ม 🎯 ตั้งพิกัด ก่อนครับ)" } | ConvertTo-Json -Depth 4 -Compress)
                    return
                }
                Invoke-FillCalibratedField -key "rcvNo"        -text ([string]$p.rcvNo).Trim()   -isMultiline $false | Out-Null
                Invoke-FillCalibratedField -key "rcvYear"      -text ([string]$p.rcvYear).Trim() -isMultiline $false | Out-Null
                Invoke-FillCalibratedField -key "rcvSearchBtn" -text ""                          -clickOnly   $true  | Out-Null
                $job.ResponseJson = (@{ ok = $true; message = "ขั้นที่ 1 เสร็จแล้ว — เลือกรายการใน Popup (หรือกดขั้น 1.5)" } | ConvertTo-Json -Compress)
                return
            }

            if ($step -eq "1.5") {
                $missing = @("popupDetail", "popupBudgetChk", "popupOkBtn") | Where-Object { -not $script:Calibration.ContainsKey($_) }
                if ($missing.Count -gt 0) {
                    $job.ResponseJson = (@{ ok = $false; needCalibration = $true; missing = $missing; error = "ยังไม่ได้ตั้งพิกัดขั้นที่ 1.5 (Popup เลือกงบ)" } | ConvertTo-Json -Depth 4 -Compress)
                    return
                }
                Invoke-FillCalibratedField -key "popupDetail"    -text "" -clickOnly $true | Out-Null
                Start-Sleep -Milliseconds 450
                Invoke-FillCalibratedField -key "popupBudgetChk" -text "" -clickOnly $true | Out-Null
                Start-Sleep -Milliseconds 250
                Invoke-FillCalibratedField -key "popupOkBtn"     -text "" -clickOnly $true | Out-Null
                $job.ResponseJson = (@{ ok = $true; message = "ขั้นที่ 1.5 เสร็จแล้ว — กดขั้นที่ 1.6 เพื่อกรอกภาษี 7% / หัก 1%" } | ConvertTo-Json -Compress)
                return
            }

            if ($step -eq "1.6") {
                $missing = @("vatAmount", "whtAmount") | Where-Object { -not $script:Calibration.ContainsKey($_) }
                if ($missing.Count -gt 0) {
                    $job.ResponseJson = (@{ ok = $false; needCalibration = $true; missing = $missing; error = "ยังไม่ได้ตั้งพิกัดช่อง VAT 7% / หัก 1%" } | ConvertTo-Json -Depth 4 -Compress)
                    return
                }
                Invoke-FillCalibratedField -key "vatAmount" -text ([string]$p.vatAmount).Trim() -isMultiline $false | Out-Null
                Invoke-FillCalibratedField -key "whtAmount" -text ([string]$p.whtAmount).Trim() -isMultiline $false | Out-Null
                $job.ResponseJson = (@{ ok = $true; message = "ขั้นที่ 1.6 เสร็จแล้ว — ไปต่อขั้นที่ 2 (แท็บผู้รับเงิน)" } | ConvertTo-Json -Compress)
                return
            }

            if ($step -eq "2") {
                $queue = @()
                foreach ($k in @("payTo", "assignTo", "bankCode", "branchCode", "accountNo")) {
                    $val = if ($p.PSObject.Properties[$k]) { ([string]$p.$k).Trim() } else { "" }
                    if ($val -and $script:Calibration.ContainsKey($k)) {
                        $queue += @{ Key = $k; Val = $val }
                    }
                }
                if ($queue.Count -eq 0) {
                    $job.ResponseJson = (@{ ok = $false; needCalibration = $true; error = "ยังไม่ได้ตั้งพิกัดช่องในแท็บ 'ผู้รับเงิน' หรือไม่มีข้อมูลที่ติ๊กเลือก" } | ConvertTo-Json -Compress)
                    return
                }
                if ($script:Calibration.ContainsKey("tabPayee")) {
                    Invoke-FillCalibratedField -key "tabPayee" -text "" -clickOnly $true | Out-Null
                    Start-Sleep -Milliseconds 300
                }
                $filled = 0
                foreach ($s in $queue) {
                    Invoke-FillCalibratedField -key $s.Key -text $s.Val -isMultiline $false | Out-Null
                    $filled++
                }
                $job.ResponseJson = (@{ ok = $true; filled = $filled; message = "ขั้นที่ 2 เสร็จแล้ว ($filled ช่อง) — ตรวจรหัสสาขา แล้วไปต่อขั้นที่ 3" } | ConvertTo-Json -Compress)
                return
            }

            if ($step -eq "3") {
                $queue = @()
                if ($p.PSObject.Properties["requesterName"] -and ([string]$p.requesterName).Trim() -and $script:Calibration.ContainsKey("requesterName")) {
                    $queue += @{ Key = "requesterName"; Val = ([string]$p.requesterName).Trim(); Multi = $false }
                }
                if ($p.PSObject.Properties["payDate"] -and ([string]$p.payDate).Trim() -and $script:Calibration.ContainsKey("payDate")) {
                    $queue += @{ Key = "payDate"; Val = ([string]$p.payDate).Trim(); Multi = $false }
                }
                if ($p.PSObject.Properties["description"] -and ([string]$p.description).Trim() -and $script:Calibration.ContainsKey("description")) {
                    $queue += @{ Key = "description"; Val = ([string]$p.description).Trim(); Multi = $true }
                }
                if ($queue.Count -eq 0) {
                    $job.ResponseJson = (@{ ok = $false; needCalibration = $true; error = "ยังไม่ได้ตั้งพิกัดช่องในแท็บ 'รายละเอียดเงินเบิกจ่าย'" } | ConvertTo-Json -Compress)
                    return
                }
                if ($script:Calibration.ContainsKey("tabDetail")) {
                    Invoke-FillCalibratedField -key "tabDetail" -text "" -clickOnly $true | Out-Null
                    Start-Sleep -Milliseconds 300
                }
                $filled = 0
                foreach ($s in $queue) {
                    Invoke-FillCalibratedField -key $s.Key -text $s.Val -isMultiline ([bool]$s.Multi) | Out-Null
                    $filled++
                }
                # HARD STOP — NEVER SEND SAVE / F10 / CTRL+S!
                [System.Media.SystemSounds]::Exclamation.Play()
                $job.ResponseJson = (@{ ok = $true; filled = $filled; message = "🛑 กรอกครบแล้ว ($filled ช่อง) — ตรวจสอบและกดปุ่ม บันทึก (💾) ใน MIS2 เอง!" } | ConvertTo-Json -Compress)
                return
            }

            $job.ResponseJson = (@{ ok = $false; error = "ไม่รู้จักขั้นตอน: $step" } | ConvertTo-Json -Compress)
            return
        }

        $job.ResponseJson = (@{ ok = $false; error = "Unknown endpoint: $path" } | ConvertTo-Json -Compress)
    } catch {
        $errMsg = if ($_.Exception.Message -eq "EMERGENCY_STOP") { "🛑 หยุดฉุกเฉินแล้ว (กด ESC)" } else { [string]$_.Exception.Message }
        $job.ResponseJson = (@{ ok = $false; error = $errMsg } | ConvertTo-Json -Compress)
    }
}

# ==============================================================================
# 6. System Tray Host + Event Loop
# ==============================================================================
Load-Calibration
[System.Windows.Forms.Application]::EnableVisualStyles()

$script:HttpServer = New-Object Mis2BridgeHttpServer
try {
    $script:HttpServer.Start($script:BridgePort)
} catch {
    [System.Windows.Forms.MessageBox]::Show(
        "ไม่สามารถเปิดพอร์ต $($script:BridgePort) ได้: $($_.Exception.Message)",
        "BMA MIS2 Oracle Forms Bridge",
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
    exit 1
}

$trayMenu = New-Object System.Windows.Forms.ContextMenuStrip
$miHeader = $trayMenu.Items.Add("💊 BMA MIS2 Oracle Forms Bridge (ARISSARA.K)")
$miHeader.Enabled = $false
$trayMenu.Items.Add("-") | Out-Null

$miOpenIE = $trayMenu.Items.Add("🌐 เปิดหน้าเว็บ MIS2 ใน Internet Explorer (IE)")
$miOpenIE.Add_Click({ Open-Mis2InIE | Out-Null })

$miPick = $trayMenu.Items.Add("🪟 เลือกหน้าต่าง Oracle Forms...")
$miPick.Add_Click({ Show-WindowPickerDialog | Out-Null })

$miOpenPayPanel = $trayMenu.Items.Add("📌 เปิดแผงลอยเบิกจ่าย (ทับ Oracle Forms)")
$miOpenPayPanel.Add_Click({ Open-FloatingPayPanel | Out-Null })

$miCalib = $trayMenu.Items.Add("🎯 ตั้งพิกัดหน้าจอ Oracle Forms (F8)...")
$miCalib.Add_Click({ Show-CalibrationDialog })

$script:AutoInjectIE = $true
$miAutoIe = New-Object System.Windows.Forms.ToolStripMenuItem("✓ เปิดแผงอัตโนมัติใน IE ทุกหน้า (Auto-Inject)")
$miAutoIe.Checked = $true
$miAutoIe.Add_Click({
    $script:AutoInjectIE = -not $script:AutoInjectIE
    $miAutoIe.Checked = $script:AutoInjectIE
})
$trayMenu.Items.Add($miAutoIe) | Out-Null

$script:AutoPopOraclePay = $true
$miAutoPop = New-Object System.Windows.Forms.ToolStripMenuItem("✓ เปิดแผงเบิกจ่ายลอยทับ Oracle Forms อัตโนมัติ")
$miAutoPop.Checked = $true
$miAutoPop.Add_Click({
    $script:AutoPopOraclePay = -not $script:AutoPopOraclePay
    $miAutoPop.Checked = $script:AutoPopOraclePay
})
$trayMenu.Items.Add($miAutoPop) | Out-Null

$trayMenu.Items.Add("-") | Out-Null
$miExit = $trayMenu.Items.Add("❌ ปิดตัวช่วย Oracle Forms")
$miExit.Add_Click({
    $script:TrayIcon.Visible = $false
    $script:HttpServer.Stop()
    [System.Windows.Forms.Application]::Exit()
})

$script:TrayIcon = New-Object System.Windows.Forms.NotifyIcon
$script:TrayIcon.Icon = [System.Drawing.SystemIcons]::Application
$script:TrayIcon.Text = "BMA MIS & MIS2 Bridge (127.0.0.1:47291) — ARISSARA.K"
$script:TrayIcon.ContextMenuStrip = $trayMenu
$script:TrayIcon.Visible = $true
$script:TrayIcon.Add_DoubleClick({ Open-FloatingPayPanel | Out-Null })
$script:TrayIcon.ShowBalloonTip(
    3500,
    "BMA MIS & MIS2 Bridge พร้อมทำงาน",
    "เปิดแผงอัตโนมัติใน IE ทุกหน้า และเปิดแผงลอยทับ Oracle Forms (ระบบการเงินจ่าย) ให้อัตโนมัติ",
    [System.Windows.Forms.ToolTipIcon]::Info
)

# Hidden ApplicationContext + STA Queue Pump Timer + Global Hotkey (Ctrl+Shift+M -> Open Floating Pay Panel)
$script:LastHotkeyPop = $false
$pumpTimer = New-Object System.Windows.Forms.Timer
$pumpTimer.Interval = 40
$pumpTimer.Add_Tick({
    $job = $null
    while ($script:HttpServer.Queue.TryDequeue([ref]$job)) {
        try {
            Process-BridgeJob $job
        } finally {
            $job.Done.Set()
        }
    }
    $hkNow = ([Mis2BridgeWin32]::IsKeyDown(0x11) -and [Mis2BridgeWin32]::IsKeyDown(0x10) -and [Mis2BridgeWin32]::IsKeyDown(0x4D))
    if ($hkNow -and -not $script:LastHotkeyPop) {
        Open-FloatingPayPanel | Out-Null
    }
    $script:LastHotkeyPop = $hkNow
})
$pumpTimer.Start()

# Unified Watcher:
# 1) Auto-injects ie-autofill.js into IE pages on bma.go.th across step navigations
# 2) Auto-launches Always-on-Top MIS2 Pay panel whenever Oracle Developer Forms Runtime opens
$script:IeScriptFile = Join-Path $script:AppDir "ie-autofill.js"
$script:LastOracleHwnd = [IntPtr]::Zero
$ieWatchTimer = New-Object System.Windows.Forms.Timer
$ieWatchTimer.Interval = 1500
$ieWatchTimer.Add_Tick({
    # 1. Detect Oracle Developer Forms Runtime (Java Applet window) -> auto-float MIS2 Pay panel on top!
    if ($script:AutoPopOraclePay) {
        try {
            $oraWin = Find-OracleFormsWindow
            if ($null -ne $oraWin) {
                if ($oraWin.Hwnd -ne $script:LastOracleHwnd) {
                    $script:LastOracleHwnd = $oraWin.Hwnd
                    $script:TargetHwnd = $oraWin.Hwnd
                    $script:TargetWinTitle = $oraWin.Title
                    Open-FloatingPayPanel | Out-Null
                }
            } else {
                $script:LastOracleHwnd = [IntPtr]::Zero
            }
        } catch {}
    }

    # 2. Auto-inject ie-autofill.js into open IE windows on bma.go.th
    if (-not $script:AutoInjectIE) { return }
    if (-not (Test-Path $script:IeScriptFile)) { return }
    try {
        $shell = New-Object -ComObject Shell.Application
        $wins = $shell.Windows()
        $codeCache = $null
        foreach ($w in $wins) {
            try {
                $u = [string]$w.LocationURL
                if ($u -match "bmamisapp11\.bma\.go\.th|misweb\.bma\.go\.th|bmasso\.bma\.go\.th") {
                    if ($w.ReadyState -eq 4 -and $w.Document -and $w.Document.body) {
                        $existing = $w.Document.getElementById("bma-ie-panel")
                        if ($null -eq $existing) {
                            if ($null -eq $codeCache) {
                                $codeCache = [System.IO.File]::ReadAllText($script:IeScriptFile, [System.Text.Encoding]::UTF8)
                            }
                            $w.Document.parentWindow.execScript($codeCache, "javascript")
                        }
                    }
                }
            } catch {}
        }
    } catch {}
})
$ieWatchTimer.Start()

try {
    [System.Windows.Forms.Application]::Run()
} finally {
    $ieWatchTimer.Stop()
    $ieWatchTimer.Dispose()
    $pumpTimer.Stop()
    $pumpTimer.Dispose()
    $script:TrayIcon.Visible = $false
    $script:TrayIcon.Dispose()
    $script:HttpServer.Stop()
    try { $script:BridgeMutex.ReleaseMutex() } catch {}
    $script:BridgeMutex.Dispose()
}
