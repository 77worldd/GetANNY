# Native messaging setup

The EXE and MSI installers include the native host, its JavaScript bridge, its `ws` dependency, and the Electron runtime. Use **Browser integration** in the installed GetANNY application to prepare the appropriate extension and register the host for your Windows user. Loading the extension in the browser still requires your consent; host registration alone does not install it.

Alternatively, in PowerShell run `./Setup-Browsers.ps1 -InstalledApp "C:\path\to\installed\GetANNY.exe"`. The executable path must be the installed application, not the portable launcher. Verify the real connection in GetANNY and in the extension popup.

The host executable and bridge JavaScript included here are supplied for inspection and recovery; they are not standalone. They require the application's runtime, `ws`, and a per-user configuration containing a private pairing key. Do not copy or share that configuration. If setup fails, use `Documentation/BROWSERS.md` for troubleshooting. Firefox's ZIP is unsigned and requires temporary loading unless Mozilla signs it.
