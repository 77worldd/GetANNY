$ErrorActionPreference = 'Stop'
if($env:CI -ne 'true' -or -not $env:RUNNER_TEMP){throw 'Installer tests modify the default app profile and require a disposable Windows CI account.'}
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
  Write-Host ("::notice title=Installed app {0}::{1} actual packaged Windows checks passed" -f $Name,$result.checks.Count)
  foreach ($check in $result.checks) {
    Write-Host "PASS $Name : $($check.name)"
    if ($check.name -eq 'Rendered layouts at 1320, 1024 and 760 pixel windows') {
      foreach ($screenshot in $check.detail) { Copy-Item $screenshot (Join-Path $results "$Name-$(Split-Path $screenshot -Leaf)") }
    }
  }
}
function Assert-Shortcuts([string] $InstalledExe) {
  $shell = New-Object -ComObject WScript.Shell
  $found = [System.Collections.Generic.List[object]]::new()
  try {
    foreach ($location in @(
      @{kind='desktop';path=[Environment]::GetFolderPath('DesktopDirectory')},
      @{kind='desktop';path=[Environment]::GetFolderPath('CommonDesktopDirectory')},
      @{kind='startMenu';path=[Environment]::GetFolderPath('Programs')},
      @{kind='startMenu';path=[Environment]::GetFolderPath('CommonPrograms')}
    )) {
      if (-not $location.path -or -not (Test-Path $location.path)) { continue }
      foreach ($file in Get-ChildItem $location.path -Filter '*GetANNY*.lnk' -File -Recurse -ErrorAction SilentlyContinue) {
        $link=$shell.CreateShortcut($file.FullName)
        try { if ($link.TargetPath -ieq $InstalledExe) { $found.Add(@{kind=$location.kind;path=$file.FullName;target=$link.TargetPath}) } }
        finally { [Runtime.InteropServices.Marshal]::FinalReleaseComObject($link) | Out-Null }
      }
    }
  } finally { [Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell) | Out-Null }
  if (-not ($found | Where-Object kind -eq 'desktop')) { throw 'Default desktop shortcut missing or targets the wrong application.' }
  if (-not ($found | Where-Object kind -eq 'startMenu')) { throw 'Start Menu shortcut missing or targets the wrong application.' }
  return $found.ToArray()
}
function Desktop-Lifecycle([string] $InstalledExe, [string] $Name, [string] $Data, $Shortcuts) {
  $desktop=$Shortcuts | Where-Object kind -eq 'desktop' | Select-Object -First 1
  $startMenu=$Shortcuts | Where-Object kind -eq 'startMenu' | Select-Object -First 1
  & node "$PSScriptRoot\test-desktop-lifecycle.js" $InstalledExe $Data (Join-Path $results "$Name-desktop-lifecycle.json") $desktop.path $startMenu.path
  if($LASTEXITCODE -ne 0){throw 'Installed cold native / actual shell shortcut lifecycle test failed.'}
  Write-Host ("::notice title=Desktop lifecycle {0}::Compiled-native cold launch, real output hash, no resurrection and both actual shell shortcut launches passed" -f $Name)
}
function Profile-Snapshot([string] $Data) {
  $json=& node "$PSScriptRoot\snapshot-profile.js" (Join-Path $Data 'getanny.db')
  if ($LASTEXITCODE -ne 0) { throw 'Cannot read real default-profile retention snapshot.' }
  return ($json | ConvertFrom-Json)
}
function Owned-NativeEntries([string] $Data) {
  $found=[System.Collections.Generic.List[object]]::new()
  foreach($vendor in @('Google\Chrome','Chromium','Mozilla','Vivaldi','Microsoft\Edge')) {
    $key="HKCU:\Software\$vendor\NativeMessagingHosts\com.getanny.native"
    if(-not(Test-Path $key)){continue}
    $value=(Get-Item $key).GetValue('')
    if($value -and $value.StartsWith("$Data\native-messaging\",[StringComparison]::OrdinalIgnoreCase)) { $found.Add(@{key=$key;value=$value}) }
  }
  return $found.ToArray()
}
function Assert-Uninstalled([string] $InstalledExe, $Shortcuts, [string] $Data, $Before, $NativeEntries) {
  if (Test-Path $InstalledExe) { throw 'Uninstallation left the application executable.' }
  foreach ($link in $Shortcuts) { if (Test-Path $link.path) { throw "Uninstallation left shortcut $($link.path)" } }
  foreach($directory in @('native-messaging','extensions')) {if(Test-Path (Join-Path $Data $directory)){throw "Uninstall left owned prepared directory $directory"}}
  $after=Profile-Snapshot $Data
  foreach($entry in $NativeEntries) {
    if((Test-Path $entry.key) -and (Get-Item $entry.key).GetValue('') -ieq $entry.value) {throw "Owned native registry entry survived uninstall: $($entry.key)"}
  }
  if($after.missingCompletedFiles -gt $Before.missingCompletedFiles) {throw 'Uninstallation removed a real completed output from the default profile.'}
  if ($after.history -lt 1 -or $Before.sha256 -cne $after.sha256) { throw 'Uninstallation changed or removed actual default-profile history/settings.' }
  return @{history=$after.history;settings=$after.settings;sha256=$after.sha256;retained=$true;missingCompletedFiles=$after.missingCompletedFiles;ownedNativeEntries=$NativeEntries.Count;nativeCleanupVerified=($NativeEntries.Count -gt 0)}
}
$defaultData = Join-Path $env:APPDATA 'getanny'
$exeDir = Join-Path $installRoot 'exe-app'
$exeData = Join-Path $installRoot 'exe-data'
Write-Host 'Installing the actual NSIS EXE package...'
Run-Checked $exePackage @('/S','/currentuser',"/D=$exeDir")
$installedExe = Join-Path $exeDir 'GetANNY.exe'
$exeShortcuts=@(Assert-Shortcuts $installedExe)
Self-Test $installedExe 'exe-first-install' $exeData
Write-Host 'Reinstalling EXE (upgrade / repair preservation test)...'
Run-Checked $exePackage @('/S','/currentuser',"/D=$exeDir")
Self-Test $installedExe 'exe-upgrade-restart' $exeData
$restart = Get-Content (Join-Path $results 'exe-upgrade-restart.json') -Raw | ConvertFrom-Json
if (-not ($restart.checks | Where-Object name -eq 'Persisted history, settings and actual process restart marker').detail.priorRunObserved) { throw 'EXE reinstall destroyed persisted data.' }
Self-Test $installedExe 'exe-actual-default-profile' $defaultData
Run-Checked $installedExe @('--setup-browser-hosts','--quiet')
Desktop-Lifecycle $installedExe 'exe' $defaultData $exeShortcuts
$exeNativeEntries=@(Owned-NativeEntries $defaultData)
$exeDefaultBefore=Profile-Snapshot $defaultData
$uninstaller = Get-ChildItem $exeDir -Filter '*Uninstall*.exe' | Select-Object -First 1
if (-not $uninstaller) { throw 'EXE uninstaller not found.' }
Run-Checked $uninstaller.FullName @('/S')
Start-Sleep -Seconds 2
if (Test-Path $installedExe) { throw 'EXE uninstallation left the application executable.' }
if (-not (Test-Path (Join-Path $exeData 'getanny.db'))) { throw 'Uninstaller destroyed isolated test history.' }
$exeDefaultRetained=Assert-Uninstalled $installedExe $exeShortcuts $defaultData $exeDefaultBefore $exeNativeEntries
@{passed=$true;exe=@{installed=$true;reinstalled=$true;uninstalled=$true};defaultProfileRetention=@{exe=$exeDefaultRetained};shortcuts=@{exe=$exeShortcuts;createdAndTargetsVerified=$true;removedOnUninstall=$true;shellLaunch='passed-in-exe-desktop-lifecycle.json'}} | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $results 'exe-uninstall.json')
Write-Host 'Installing the actual MSI package...'
$msiDir = Join-Path $installRoot 'msi-app'
$msiData = Join-Path $installRoot 'msi-data'
Run-Checked 'msiexec.exe' @('/i',"`"$msiPackage`"",'/qn','/norestart',"APPLICATIONFOLDER=`"$msiDir`"",'ALLUSERS=2','MSIINSTALLPERUSER=1',"/l*v `"$results\msi-install.log`"")
$installedMsiExe = Join-Path $msiDir 'GetANNY.exe'
$msiShortcuts=@(Assert-Shortcuts $installedMsiExe)
Self-Test $installedMsiExe 'msi-first-install' $msiData
Run-Checked 'msiexec.exe' @('/i',"`"$msiPackage`"",'/qn','/norestart',"APPLICATIONFOLDER=`"$msiDir`"",'ALLUSERS=2','MSIINSTALLPERUSER=1',"/l*v `"$results\msi-reinstall.log`"")
Self-Test $installedMsiExe 'msi-upgrade-restart' $msiData
$restart = Get-Content (Join-Path $results 'msi-upgrade-restart.json') -Raw | ConvertFrom-Json
if (-not ($restart.checks | Where-Object name -eq 'Persisted history, settings and actual process restart marker').detail.priorRunObserved) { throw 'MSI reinstall destroyed persisted data.' }
Write-Host 'Testing an actual Chromium extension with the installed MSI application...'
& node "$PSScriptRoot\test-extension.js" $installedMsiExe "$results\browser"
if ($LASTEXITCODE -ne 0) { throw 'Installed-app Chromium extension test failed.' }
Write-Host 'Testing other available real browser brands (never personal profiles)...'
$matrixError=$null
try { & "$PSScriptRoot\test-browser-matrix.ps1" -InstalledExe $installedMsiExe -Results "$results\browser-matrix" }
catch { $matrixError=$_.Exception.Message;Write-Warning "Browser gate failed; continue independent MSI retention/uninstall checks, then fail overall: $matrixError" }
Self-Test $installedMsiExe 'msi-actual-default-profile' $defaultData
Run-Checked $installedMsiExe @('--setup-browser-hosts','--quiet')
Desktop-Lifecycle $installedMsiExe 'msi' $defaultData $msiShortcuts
$msiNativeEntries=@(Owned-NativeEntries $defaultData)
$msiDefaultBefore=Profile-Snapshot $defaultData
Run-Checked 'msiexec.exe' @('/x',"`"$msiPackage`"",'/qn','/norestart',"/l*v `"$results\msi-uninstall.log`"")
if (Test-Path $installedMsiExe) { throw 'MSI uninstallation left the application executable.' }
if (-not (Test-Path (Join-Path $msiData 'getanny.db'))) { throw 'MSI uninstall destroyed isolated test history.' }
$msiDefaultRetained=Assert-Uninstalled $installedMsiExe $msiShortcuts $defaultData $msiDefaultBefore $msiNativeEntries
$signatures = @($exePackage,$msiPackage) | ForEach-Object { $sig = Get-AuthenticodeSignature $_; @{file=(Split-Path $_ -Leaf);status=$sig.Status.ToString()} }
@{passed=($null -eq $matrixError);browserMatrixError=$matrixError;date=(Get-Date -Format o);exe=@{installed=$true;reinstalled=$true;uninstalled=$true};msi=@{installed=$true;reinstalled=$true;uninstalled=$true};signatures=$signatures;defaultProfileRetention=@{exe=$exeDefaultRetained;msi=$msiDefaultRetained};shortcuts=@{exe=$exeShortcuts;msi=$msiShortcuts;createdAndTargetsVerified=$true;removedOnUninstall=$true;shellLaunch='passed-in-desktop-lifecycle-reports'};limitations=@('GitHub-hosted Windows runner is not a pristine consumer Windows installation.','Same-version reinstall tested; migration from the old v1 installer requires manual validation.','Shortcut files, targets, removal and actual shell launches checked; interactive options dialogs still require manual inspection.','See browser-matrix/matrix.json for actual per-brand results; Production browser-UI consent and permanent store/signed installation remain manual.')} | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $results 'installer-report.json')
if($matrixError){throw "Available browser gate failed: $matrixError. Independent installer/retention results are preserved in installer-report.json."}
Write-Host 'EXE, MSI, installed downloads, restart preservation, native chain and available-browser extension checks passed.'
