// Small real executable launcher: browsers do not support a manifest "args" field.
// Uses the installed Electron runtime in Node mode; no external Node installation.
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Threading.Tasks;
using System.Web.Script.Serialization;

internal static class NativeHost {
    private static string Quote(string value) {
        if (value.IndexOf('"') >= 0 || value.IndexOf('\0') >= 0) throw new ArgumentException("Invalid launcher path");
        return "\"" + value.TrimEnd('\\') + "\"";
    }
    private static async Task Relay(Stream source, Stream destination) {
        var buffer = new byte[16384];
        int count;
        while ((count = await source.ReadAsync(buffer, 0, buffer.Length)) != 0) {
            await destination.WriteAsync(buffer, 0, count);
            // Pipe FileStreams may buffer a small native frame indefinitely.
            // A hello must reach the JS bridge without waiting for pipe EOF.
            await destination.FlushAsync();
        }
    }
    public static int Main() {
        try {
            var folder = AppDomain.CurrentDomain.BaseDirectory;
            var file = Path.Combine(folder, "bridge-config.json");
            var config = new JavaScriptSerializer().Deserialize<Dictionary<string, object>>(File.ReadAllText(file));
            var start = new ProcessStartInfo((string)config["executable"], Quote((string)config["script"]) + " --config " + Quote(file));
            start.UseShellExecute = false;
            start.CreateNoWindow = true;
            start.RedirectStandardInput = true;
            start.RedirectStandardOutput = true;
            start.RedirectStandardError = true;
            start.EnvironmentVariables["ELECTRON_RUN_AS_NODE"] = "1";
            using (var process = Process.Start(start)) {
                var incoming = Relay(Console.OpenStandardInput(), process.StandardInput.BaseStream).ContinueWith(t => { try { process.StandardInput.Close(); } catch {} });
                var outgoing = Relay(process.StandardOutput.BaseStream, Console.OpenStandardOutput());
                var errors = Relay(process.StandardError.BaseStream, Console.OpenStandardError());
                process.WaitForExit();
                Task.WaitAll(outgoing, errors);
                return process.ExitCode;
            }
        } catch (Exception error) {
            Console.Error.WriteLine("GetANNY native host: " + error.Message);
            return 1;
        }
    }
}
