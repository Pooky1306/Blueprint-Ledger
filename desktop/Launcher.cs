using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

internal static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        string data = Path.Combine(root, "data");
        foreach (string arg in args) if (arg.StartsWith("--data-dir=")) data = Path.GetFullPath(arg.Substring(11));
        string identity;
        using (var hash = SHA256.Create()) identity = BitConverter.ToString(hash.ComputeHash(Encoding.UTF8.GetBytes(data.ToUpperInvariant()))).Replace("-", "").Substring(0, 24);
        bool first;
        using (var mutex = new Mutex(true, "Local\\BlueprintLedger-" + identity, out first))
        {
            if (!first) { MessageBox.Show("Blueprint Ledger is already open for this data folder.", "Blueprint Ledger"); return; }
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            try { Application.Run(new LedgerWindow(root, data)); }
            catch (Exception ex) { MessageBox.Show(ex.Message, "Blueprint Ledger could not start", MessageBoxButtons.OK, MessageBoxIcon.Error); }
        }
    }
}

internal sealed class LedgerWindow : Form
{
    readonly string root, data, token = Guid.NewGuid().ToString("N");
    readonly CancellationTokenSource lifetime = new CancellationTokenSource();
    readonly Label status;
    WebView2 web;
    Process backend;
    ProcessJob job;
    string origin;
    bool closing, canClose;

    public LedgerWindow(string root, string data)
    {
        this.root = root; this.data = data;
        Text = "Blueprint Ledger"; Width = 1400; Height = 920;
        FormBorderStyle = FormBorderStyle.None;
        Padding = new Padding(6);
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);
        MinimumSize = new Size(760, 560); StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(9, 13, 16);
        status = new Label { Dock = DockStyle.Fill, TextAlign = ContentAlignment.MiddleCenter,
            ForeColor = Color.FromArgb(73, 210, 227), Font = new Font("Segoe UI", 13), Text = "Opening Blueprint Ledger…" };
        Controls.Add(status);
        Shown += async delegate { await Initialize(); };
        FormClosing += ClosingWindow;
        FormClosed += delegate { Cleanup(); };
        Resize += delegate {
            Padding = new Padding(WindowState == FormWindowState.Maximized ? 0 : 6);
            PublishWindowState();
        };
    }

    async Task Initialize()
    {
        try
        {
            CoreWebView2Environment.GetAvailableBrowserVersionString();
            string node = Path.Combine(root, "runtime", "node.exe");
            if (!File.Exists(node)) throw new Exception("The bundled runtime is missing. Keep the executable in its Blueprint Ledger folder.");
            // An older Start.cmd server does not participate in the new file lock.
            if (Path.GetFullPath(data).TrimEnd('\\') == Path.GetFullPath(Path.Combine(root, "data")).TrimEnd('\\') && await LegacyServerRunning())
                throw new Exception("Close the previous Start.cmd / browser-server window first, then open Blueprint Ledger.exe again. This prevents two backends from editing the same inventory.");
            if (closing) return;
            job = new ProcessJob();
            var start = new ProcessStartInfo(node, "\"" + Path.Combine(root, "server.mjs") + "\"") {
                WorkingDirectory = root, UseShellExecute = false, CreateNoWindow = true,
                RedirectStandardOutput = true, RedirectStandardError = true
            };
            start.EnvironmentVariables["LEDGER_PORT"] = "0";
            start.EnvironmentVariables["LEDGER_DATA_DIR"] = data;
            start.EnvironmentVariables["LEDGER_DESKTOP_TOKEN"] = token;
            backend = Process.Start(start);
            job.Add(backend);
            Task<string> errors = backend.StandardError.ReadToEndAsync();
            Task<string> ready = backend.StandardOutput.ReadLineAsync();
            if (await Task.WhenAny(ready, Task.Delay(20000, lifetime.Token)) != ready) throw new Exception("The local backend did not start in time.");
            string line = await ready;
            if (String.IsNullOrEmpty(line) || !line.StartsWith("Blueprint inventory: http://127.0.0.1:"))
                throw new Exception(backend.HasExited ? (await errors) : "The local backend could not start.");
            origin = line.Substring("Blueprint inventory: ".Length).Trim();
            if (closing) return;
            web = new WebView2 { Dock = DockStyle.Fill, DefaultBackgroundColor = BackColor };
            Controls.Add(web); web.BringToFront();
            var environment = await CoreWebView2Environment.CreateAsync(null, Path.Combine(data, ".desktop-cache"), null);
            if (closing) return;
            await web.EnsureCoreWebView2Async(environment);
            if (closing) return;
            web.CoreWebView2.Settings.AreDefaultContextMenusEnabled = false;
            web.CoreWebView2.Settings.IsStatusBarEnabled = false;
            web.CoreWebView2.Settings.AreDevToolsEnabled = false;
            web.CoreWebView2.Settings.IsNonClientRegionSupportEnabled = true;
            web.CoreWebView2.WebMessageReceived += WindowCommand;
            web.CoreWebView2.NewWindowRequested += delegate(object sender, CoreWebView2NewWindowRequestedEventArgs e) { e.Handled = true; OpenExternal(e.Uri); };
            web.CoreWebView2.NavigationStarting += delegate(object sender, CoreWebView2NavigationStartingEventArgs e) {
                if (e.Uri == origin || e.Uri.StartsWith(origin + "/") || e.Uri == "about:blank") return;
                e.Cancel = true; OpenExternal(e.Uri);
            };
            web.CoreWebView2.PermissionRequested += delegate(object sender, CoreWebView2PermissionRequestedEventArgs e) {
                e.State = CoreWebView2PermissionState.Deny;
            };
            web.CoreWebView2.DownloadStarting += delegate(object sender, CoreWebView2DownloadStartingEventArgs e) {
                using (var save = new SaveFileDialog { FileName = Path.GetFileName(e.ResultFilePath), Filter = "JSON backup (*.json)|*.json|All files (*.*)|*.*" }) {
                    if (save.ShowDialog(this) != DialogResult.OK) e.Cancel = true;
                    else { e.ResultFilePath = save.FileName; e.Handled = true; }
                }
            };
            web.CoreWebView2.ProcessFailed += delegate { if (!closing) { MessageBox.Show(this, "The display process stopped. Reopen the app; your saved data is retained.", "Blueprint Ledger"); Close(); } };
            backend.EnableRaisingEvents = true;
            backend.Exited += delegate { if (!closing && IsHandleCreated) BeginInvoke((Action)delegate { MessageBox.Show(this, "The local backend stopped. Reopen the app to continue.", "Blueprint Ledger"); Close(); }); };
            if (backend.HasExited) throw new Exception("The local backend stopped during startup.");
            web.CoreWebView2.Navigate(origin + "/");
            status.Hide();
        }
        catch (Exception ex)
        {
            if (!closing) { MessageBox.Show(this, ex.Message + "\n\nIf WebView2 is missing, install the Microsoft Edge WebView2 Evergreen Runtime.", "Blueprint Ledger could not start", MessageBoxButtons.OK, MessageBoxIcon.Error); Close(); }
        }
    }

    void WindowCommand(object sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        Uri source, local;
        if (closing || !Uri.TryCreate(e.Source, UriKind.Absolute, out source) ||
            !Uri.TryCreate(origin, UriKind.Absolute, out local) || source.GetLeftPart(UriPartial.Authority) != local.GetLeftPart(UriPartial.Authority)) return;
        string command;
        try { command = e.TryGetWebMessageAsString(); } catch { return; }
        switch (command) {
            case "ledger:minimize": WindowState = FormWindowState.Minimized; break;
            case "ledger:maximize":
                MaximizedBounds = Screen.FromHandle(Handle).WorkingArea;
                WindowState = WindowState == FormWindowState.Maximized ? FormWindowState.Normal : FormWindowState.Maximized;
                break;
            case "ledger:close": Close(); break;
            case "ledger:ready": PublishWindowState(); break;
        }
    }

    void PublishWindowState()
    {
        if (closing || web == null || web.CoreWebView2 == null) return;
        try { web.CoreWebView2.PostWebMessageAsJson("{\"type\":\"ledger-window-state\",\"maximized\":" + (WindowState == FormWindowState.Maximized ? "true" : "false") + "}"); } catch { }
    }

    protected override void WndProc(ref Message m)
    {
        // The six-pixel host border remains outside WebView2 for native edge resizing.
        if (m.Msg == 0x84 && WindowState == FormWindowState.Normal) {
            long pos = m.LParam.ToInt64();
            Point p = PointToClient(new Point((short)(pos & 0xffff), (short)((pos >> 16) & 0xffff)));
            bool left = p.X < 6, right = p.X >= ClientSize.Width - 6, top = p.Y < 6, bottom = p.Y >= ClientSize.Height - 6;
            int hit = top ? (left ? 13 : right ? 14 : 12) : bottom ? (left ? 16 : right ? 17 : 15) : left ? 10 : right ? 11 : 0;
            if (hit != 0) { m.Result = (IntPtr)hit; return; }
        }
        if (m.Msg == 0x24) MaximizedBounds = Screen.FromHandle(Handle).WorkingArea;
        base.WndProc(ref m);
    }

    async Task<bool> LegacyServerRunning()
    {
        return await Task.Run(() => {
            try {
                var request = (HttpWebRequest)WebRequest.Create("http://127.0.0.1:8765/api/state");
                request.Timeout = 600; request.Proxy = null;
                using (var response = request.GetResponse()) using (var reader = new StreamReader(response.GetResponseStream())) {
                    char[] prefix = new char[200]; int count = reader.Read(prefix, 0, prefix.Length);
                    return new String(prefix, 0, count).Contains("\"catalogue\"");
                }
            } catch { return false; }
        });
    }

    void OpenExternal(string url)
    {
        Uri uri;
        if (Uri.TryCreate(url, UriKind.Absolute, out uri) && (uri.Scheme == "https" || uri.Scheme == "http"))
            try { Process.Start(new ProcessStartInfo(uri.AbsoluteUri) { UseShellExecute = true }); } catch { }
    }

    async void ClosingWindow(object sender, FormClosingEventArgs e)
    {
        if (canClose) return;
        e.Cancel = true;
        if (closing) return;
        closing = true; lifetime.Cancel(); Enabled = false; Text = "Blueprint Ledger — closing…";
        try {
            if (!String.IsNullOrEmpty(origin) && backend != null && !backend.HasExited)
                await Task.Run(() => {
                    try {
                        var request = (HttpWebRequest)WebRequest.Create(origin + "/api/desktop/shutdown");
                        request.Method = "POST"; request.ContentLength = 0; request.Timeout = 8000; request.Proxy = null;
                        request.Headers["Origin"] = origin; request.Headers["X-Ledger-Control"] = token;
                        using (request.GetResponse()) { }
                        backend.WaitForExit(2000);
                    } catch { }
                });
        } finally { Cleanup(); canClose = true; Close(); }
    }

    void Cleanup()
    {
        if (web != null) { web.Dispose(); web = null; }
        if (job != null) { job.Dispose(); job = null; }
        if (backend != null) { try { if (!backend.HasExited) backend.Kill(); } catch { } backend.Dispose(); backend = null; }
    }
}

internal sealed class ProcessJob : IDisposable
{
    IntPtr handle;
    public ProcessJob()
    {
        handle = CreateJobObject(IntPtr.Zero, null);
        if (handle == IntPtr.Zero) throw new Win32Exception();
        var info = new ExtendedLimits(); info.BasicLimitInformation.LimitFlags = 0x2000; // KILL_ON_JOB_CLOSE
        if (!SetInformationJobObject(handle, 9, ref info, (uint)Marshal.SizeOf(typeof(ExtendedLimits)))) { Dispose(); throw new Win32Exception(); }
    }
    public void Add(Process process) { if (!AssignProcessToJobObject(handle, process.Handle)) throw new Win32Exception(); }
    public void Dispose() { if (handle != IntPtr.Zero) { CloseHandle(handle); handle = IntPtr.Zero; } }
    [StructLayout(LayoutKind.Sequential)] struct BasicLimits { public long PerProcessUserTimeLimit, PerJobUserTimeLimit; public uint LimitFlags; public UIntPtr MinimumWorkingSetSize, MaximumWorkingSetSize; public uint ActiveProcessLimit; public UIntPtr Affinity; public uint PriorityClass, SchedulingClass; }
    [StructLayout(LayoutKind.Sequential)] struct IoCounters { public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount, ReadTransferCount, WriteTransferCount, OtherTransferCount; }
    [StructLayout(LayoutKind.Sequential)] struct ExtendedLimits { public BasicLimits BasicLimitInformation; public IoCounters IoInfo; public UIntPtr ProcessMemoryLimit, JobMemoryLimit, PeakProcessMemoryUsed, PeakJobMemoryUsed; }
    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)] static extern IntPtr CreateJobObject(IntPtr attributes, string name);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool SetInformationJobObject(IntPtr job, int infoClass, ref ExtendedLimits info, uint length);
    [DllImport("kernel32.dll", SetLastError = true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);
    [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr handle);
}
