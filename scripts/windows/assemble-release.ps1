# Fail-closed release assembly from measured disposable-Windows results.
$ErrorActionPreference='Stop'
$evidenceRoot = 'test-results/windows'
$overall = Get-Content "$evidenceRoot/installer-report.json" -Raw | ConvertFrom-Json
if (-not $overall.passed) { throw 'Cannot assemble a release from failed installer/browser evidence.' }
foreach($format in @('exe','msi')) {
  $retention=$overall.defaultProfileRetention.$format
  if(-not $retention.retained -or -not $retention.nativeCleanupVerified -or $retention.ownedNativeEntries -lt 1 -or $retention.history -lt 1){throw "Default-profile/output/native-cleanup evidence incomplete: $format"}
}
$measured = [System.Collections.Generic.List[string]]::new()
$measured.Add('## Measured automated results for this build')
$measured.Add('')
[xml]$junit = Get-Content "$evidenceRoot/backend-junit.xml" -Raw
$cases = $junit.SelectNodes('//testcase').Count
$failures = $junit.SelectNodes('//failure').Count
$skipped = $junit.SelectNodes('//skipped').Count
if ($cases -eq 0 -or $failures -ne 0 -or $skipped -ne 0) { throw 'Backend evidence is missing, failed or skipped.' }
$measured.Add(('Windows backend: **{0} tests, {1} failures, {2} skipped**.' -f $cases,$failures,$skipped))
$nativeLog = Get-Content "$evidenceRoot/native-launcher.log" -Raw
$nativeCounts = @{}
foreach ($key in @('tests','pass','fail','skipped')) {
  $match = [regex]::Match($nativeLog,('(?m)^# '+$key+' (\d+)\s*$'))
  if (-not $match.Success) { throw ('Missing compiled-launcher evidence: '+$key) }
  $nativeCounts[$key] = [int]$match.Groups[1].Value
}
if ($nativeCounts.tests -eq 0 -or $nativeCounts.tests -ne $nativeCounts.pass -or $nativeCounts.fail -ne 0 -or $nativeCounts.skipped -ne 0) { throw 'Compiled-launcher evidence is incomplete, failed or skipped.' }
$measured.Add(('Compiled-launcher suite: **{0}/{1} passed, {2} skipped**.' -f $nativeCounts.pass,$nativeCounts.tests,$nativeCounts.skipped))
foreach ($recordName in @('portable-first-launch','exe-first-install','exe-upgrade-restart','exe-actual-default-profile','msi-first-install','msi-upgrade-restart','msi-actual-default-profile','exe-desktop-lifecycle','msi-desktop-lifecycle')) {
  $record = Get-Content "$evidenceRoot/$recordName.json" -Raw | ConvertFrom-Json
  $minimum = if ($recordName.EndsWith('desktop-lifecycle')) { 4 } else { 14 }
  if (-not $record.passed -or $record.checks.Count -lt $minimum -or ($record.checks | Where-Object passed -ne $true)) { throw "Incomplete installed evidence: $recordName" }
  $measured.Add(('- `{0}`: **{1}/{1} checks passed**.' -f $recordName,$record.checks.Count))
}
$measured.Add('')
$measured.Add('Both formats installed, reinstalled and uninstalled. Actual default-profile record digests/counts and physical outputs retained; owned native registrations, prepared folders and shell shortcuts removed. See `installer-report.json` for actual counts.')
$measured.Add('')
$measured.Add('| Actual browser | Result | Qualification |')
$measured.Add('| --- | --- | --- |')
$matrix = @(Get-Content "$evidenceRoot/browser-matrix/matrix.json" -Raw | ConvertFrom-Json)
if ($matrix.Count -ne 8 -or ($matrix | Where-Object status -eq 'failed')) { throw 'Incomplete or failed individual browser matrix.' }
foreach ($row in $matrix) {
  $qualification = $row.reason
  if ($row.status -eq 'passed') {
    $record = Get-Content (Join-Path "$evidenceRoot/browser-matrix" $row.report) -Raw | ConvertFrom-Json
    if (-not $record.passed) { throw ('Browser report disagrees with matrix: '+$row.browser) }
    $qualification = 'Real native handshake, popup file SHA-256, content detection and managed media download. Developer/temporary installation only.'
  }
  $measured.Add(('| {0} | **{1}** | {2} |' -f $row.browser,$row.status,($qualification -replace '[|\r\n]',' ')))
}
$measured.Add('')
foreach ($signature in $overall.signatures) { $measured.Add(('- Authenticode `{0}`: **{1}**.' -f $signature.file,$signature.status)) }
$measured -join "`n" | Set-Content 'release-assets/MEASURED_RESULTS.md'
Copy-Item 'dist/GetANNY Setup.exe' 'release-assets/GetANNY Setup.exe'
Copy-Item 'dist/GetANNY Setup.msi' 'release-assets/GetANNY Setup.msi'
Copy-Item 'dist/GetANNY Portable.exe' 'release-assets/GetANNY Portable.exe'
Copy-Item 'docs/INSTALL_WINDOWS.md' 'release-assets/INSTALL_WINDOWS.md'
Copy-Item 'docs/BROWSERS.md' 'release-assets/BROWSERS.md'
Copy-Item 'docs/RELEASE_NOTES.md' 'release-assets/RELEASE_NOTES.md'
Compress-Archive -Path test-results/windows/* -DestinationPath release-assets/Windows-test-evidence.zip
# Stage a single user-facing bundle only after all measured gates above pass.
$version = node -p "require('./package.json').version"
$bundleName = "GetANNY-v$version-Windows"
$stage = Join-Path $env:RUNNER_TEMP $bundleName
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
foreach($dir in @('Installers','Portable','Browser-Extensions','Native-Messaging','Documentation')) {
  New-Item (Join-Path $stage $dir) -ItemType Directory -Force | Out-Null
}
Copy-Item 'dist/GetANNY Setup.exe','dist/GetANNY Setup.msi' (Join-Path $stage 'Installers')
Copy-Item 'dist/GetANNY Portable.exe' (Join-Path $stage 'Portable')
Copy-Item "release-assets/GetANNY-*-$version.zip" (Join-Path $stage 'Browser-Extensions')
Copy-Item 'bin/GetANNY.NativeHost.exe' (Join-Path $stage 'Native-Messaging')
Copy-Item 'src/main/browser-integration/native-host.js' (Join-Path $stage 'Native-Messaging')
New-Item (Join-Path $stage 'Native-Messaging/node_modules') -ItemType Directory -Force | Out-Null
Copy-Item 'node_modules/ws' (Join-Path $stage 'Native-Messaging/node_modules') -Recurse
Copy-Item 'scripts/windows/Setup-Browsers.ps1' (Join-Path $stage 'Native-Messaging')
Copy-Item 'docs/NATIVE_MESSAGING.md' (Join-Path $stage 'Native-Messaging/README.md')
Copy-Item 'docs/INSTALL_WINDOWS.md','docs/BROWSERS.md','docs/RELEASE_NOTES.md','docs/PORTABLE_WINDOWS.md','docs/CHANGELOG.md','docs/THIRD_PARTY.md','LICENSE' (Join-Path $stage 'Documentation')
Set-Content (Join-Path $stage 'VERSION.txt') $version
$bundlePath = "release-assets/$bundleName.zip"
Compress-Archive -Path $stage -DestinationPath $bundlePath -CompressionLevel Optimal
# Verify the archive contains identical executable and extension bytes, not
# merely a readable central directory or a successful archive exit code.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $bundlePath).Path)
try {
  $toVerify = @(
    @{source='dist/GetANNY Setup.exe'; entry='Installers/GetANNY Setup.exe'},
    @{source='dist/GetANNY Setup.msi'; entry='Installers/GetANNY Setup.msi'},
    @{source='dist/GetANNY Portable.exe'; entry='Portable/GetANNY Portable.exe'},
    @{source='docs/NATIVE_MESSAGING.md'; entry='Native-Messaging/README.md'},
    @{source='scripts/windows/Setup-Browsers.ps1'; entry='Native-Messaging/Setup-Browsers.ps1'},
    @{source='bin/GetANNY.NativeHost.exe'; entry='Native-Messaging/GetANNY.NativeHost.exe'},
    @{source='src/main/browser-integration/native-host.js'; entry='Native-Messaging/native-host.js'},
    @{source='node_modules/ws/index.js'; entry='Native-Messaging/node_modules/ws/index.js'}
  )
  $extensions = @(Get-ChildItem "release-assets/GetANNY-*-$version.zip")
  if ($extensions.Count -ne 8) { throw 'Expected eight browser extension ZIPs in the distribution.' }
  $toVerify += @($extensions | ForEach-Object { @{source=$_.FullName; entry=('Browser-Extensions/' + $_.Name)} })
  foreach ($item in $toVerify) {
    $entry = $zip.GetEntry("$bundleName/$($item.entry)")
    if (-not $entry) { throw "Distribution ZIP is missing $($item.entry)." }
    $stream = $entry.Open()
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $actual = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
    finally { $stream.Dispose(); $sha.Dispose() }
    if ($actual -ne (Get-FileHash $item.source -Algorithm SHA256).Hash.ToLowerInvariant()) {
      throw "Distribution ZIP content mismatch: $($item.entry)."
    }
  }
} finally { $zip.Dispose() }
node scripts/checksums.js
if ($LASTEXITCODE -ne 0) { throw 'Release checksum generation failed.' }
