param(
  [Parameter(Mandatory=$true)]
  [string] $InstalledApp
)
$ErrorActionPreference = 'Stop'
$app = (Resolve-Path -LiteralPath $InstalledApp).Path
if ((Split-Path $app -Leaf) -ine 'GetANNY.exe') {
  throw 'Select the installed GetANNY.exe, not the self-extracting portable launcher. See README.md.'
}
$process = Start-Process -FilePath $app -ArgumentList @('--setup-browser-hosts','--quiet') -PassThru
if (-not $process.WaitForExit(120000)) {
  & taskkill.exe /PID $process.Id /T /F | Out-Null
  throw 'Browser setup timed out. Open Browser integration in GetANNY for troubleshooting.'
}
if ($process.ExitCode -ne 0) { throw "Browser setup failed (exit code $($process.ExitCode))." }
Write-Host 'Browser host setup completed. Load the appropriate extension and verify its connection in GetANNY.'
