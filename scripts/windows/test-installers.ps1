$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$results = Join-Path $root 'test-results\windows'
$installRoot = Join-Path $env:RUNNER_TEMP 'GetANNYInstallerTests'
New-Item $results -ItemType Directory -Force | Out-Null
New-Item $installRoot -ItemType Directory -Force | Out-Null
$exePackage = Join-Path $root 'dist\GetANNY Setup.exe'
$msiPackage = Join-Path $root 'dist\GetANNY Setup.msi'
function Run-Checked([string] $File, [string[]] $Arguments, [int] $Timeout = 420000) {
  $p = Start-Process -FilePath $File -ArgumentList $Arguments -PassThru
  if (-not $p.WaitForExit($Timeout)) { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue; throw "Timed out: $File" }
  if ($p.ExitCode -notin @(0, 3010)) { throw "$File exited $($p.ExitCode)" }
}
function Self-Test([string] $InstalledExe, [string] $Name, [string] $Data) {
  if (-not (Test-Path $InstalledExe)) { throw "Installed application missing: $InstalledExe" }
  $report = Join-Path $results "$Name.json"
  Run-Checked $InstalledExe @('--self-test','--test-user-data',"`"$Data`"",'--report',"`"$report`"")
  $result = Get-Content $report -Raw | ConvertFrom-Json
  if (-not $result.passed -or -not $result.packaged -or $result.platform -ne 'win32') { throw "Installed-app self-test failed: $report" }
  foreach ($check in $result.checks) {
    Write-Host "PASS $Name : $($check.name)"
    if ($check.name -eq 'Rendered layouts at 1320, 1024 and 760 pixel windows') {
      foreach ($screenshot in $check.detail) { Copy-Item $screenshot (Join-Path $results "$Name-$(Split-Path $screenshot -Leaf)") }
    }
  }
}
$exeDir = Join-Path $installRoot 'exe-app'
$exeData = Join-Path $installRoot 'exe-data'
Write-Host 'Installing the actual NSIS EXE package...'
Run-Checked $exePackage @('/S','/currentuser',"/D=$exeDir")
$installedExe = Join-Path $exeDir 'GetANNY.exe'
Self-Test $installedExe 'exe-first-install' $exeData
Write-Host 'Reinstalling EXE (upgrade / repair preservation test)...'
Run-Checked $exePackage @('/S','/currentuser',"/D=$exeDir")
Self-Test $installedExe 'exe-upgrade-restart' $exeData
$restart = Get-Content (Join-Path $results 'exe-upgrade-restart.json') -Raw | ConvertFrom-Json
if (-not ($restart.checks | Where-Object name -eq 'Persisted history, settings and actual process restart marker').detail.priorRunObserved) { throw 'EXE reinstall destroyed persisted data.' }
$uninstaller = Get-ChildItem $exeDir -Filter '*Uninstall*.exe' | Select-Object -First 1
if (-not $uninstaller) { throw 'EXE uninstaller not found.' }
Run-Checked $uninstaller.FullName @('/S')
Start-Sleep -Seconds 2
if (Test-Path $installedExe) { throw 'EXE uninstallation left the application executable.' }
if (-not (Test-Path (Join-Path $exeData 'getanny.db'))) { throw 'Uninstaller destroyed user history.' }
Write-Host 'Installing the actual MSI package...'
$msiDir = Join-Path $installRoot 'msi-app'
$msiData = Join-Path $installRoot 'msi-data'
Run-Checked 'msiexec.exe' @('/i',"`"$msiPackage`"",'/qn','/norestart',"APPLICATIONFOLDER=`"$msiDir`"",'ALLUSERS=2','MSIINSTALLPERUSER=1',"/l*v `"$results\msi-install.log`"")
$installedMsiExe = Join-Path $msiDir 'GetANNY.exe'
Self-Test $installedMsiExe 'msi-first-install' $msiData
Run-Checked 'msiexec.exe' @('/i',"`"$msiPackage`"",'/qn','/norestart',"APPLICATIONFOLDER=`"$msiDir`"",'ALLUSERS=2','MSIINSTALLPERUSER=1',"/l*v `"$results\msi-reinstall.log`"")
Self-Test $installedMsiExe 'msi-upgrade-restart' $msiData
$restart = Get-Content (Join-Path $results 'msi-upgrade-restart.json') -Raw | ConvertFrom-Json
if (-not ($restart.checks | Where-Object name -eq 'Persisted history, settings and actual process restart marker').detail.priorRunObserved) { throw 'MSI reinstall destroyed persisted data.' }
Write-Host 'Testing an actual Chromium extension with the installed MSI application...'
& node "$PSScriptRoot\test-extension.js" $installedMsiExe "$results\browser"
if ($LASTEXITCODE -ne 0) { throw 'Installed-app Chromium extension test failed.' }
Write-Host 'Testing other available real browser brands (never personal profiles)...'
& "$PSScriptRoot\test-browser-matrix.ps1" -InstalledExe $installedMsiExe -Results "$results\browser-matrix"
Run-Checked 'msiexec.exe' @('/x',"`"$msiPackage`"",'/qn','/norestart',"/l*v `"$results\msi-uninstall.log`"")
if (Test-Path $installedMsiExe) { throw 'MSI uninstallation left the application executable.' }
if (-not (Test-Path (Join-Path $msiData 'getanny.db'))) { throw 'MSI uninstall destroyed user history.' }
$signatures = @($exePackage,$msiPackage) | ForEach-Object { $sig = Get-AuthenticodeSignature $_; @{file=(Split-Path $_ -Leaf);status=$sig.Status.ToString()} }
@{passed=$true;date=(Get-Date -Format o);exe=@{installed=$true;reinstalled=$true;uninstalled=$true};msi=@{installed=$true;reinstalled=$true;uninstalled=$true};signatures=$signatures;limitations=@('GitHub-hosted Windows runner is not a pristine consumer Windows installation.','Same-version reinstall tested; migration from the old v1 installer requires manual validation.','Interactive shortcut/options dialogs need manual inspection.','See browser-matrix/matrix.json for actual per-brand results; Google Chrome manual approval and permanent store/signed installation remain unverified.')} | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $results 'installer-report.json')
Write-Host 'EXE, MSI, installed downloads, restart preservation, native chain and Chromium extension checks passed.'
