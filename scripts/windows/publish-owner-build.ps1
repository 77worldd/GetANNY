# Explicit owner request: publish the existing build without waiting for test
# completion. Check provenance and bytes, but do not claim runtime verification.
$ErrorActionPreference = 'Stop'
$version = '2.0.0'
$tag = "v$version"
$source = $env:BUILD_SHA
$run = $env:BUILD_RUN
if ($source -cne '010b2e0f25e5aa32a9abb536055a41bcae5a99ff' -or $run -cne '41108662586') { throw 'Unexpected source or run.' }
$release = gh release view $tag --json tagName,isDraft,isPrerelease,targetCommitish,assets | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or -not $release.isDraft -or $release.isPrerelease -or $release.tagName -cne $tag -or $release.targetCommitish -cne $source -or @($release.assets).Count -ne 0) { throw 'The reserved draft is missing, has changed, or already contains assets.' }
# Reject changes in every repository file used to create the companion bundle.
git diff --exit-code $source HEAD -- docs scripts/windows/Setup-Browsers.ps1 scripts/windows/build-native-host.ps1 scripts/windows/NativeHost.cs src/main/browser-integration/native-host.js package.json package-lock.json LICENSE assets/icon.ico
if ($LASTEXITCODE -ne 0) { throw 'Bundle support files do not match the built source.' }
$build = (Resolve-Path owner-build).Path
$checks = @(Get-Content (Join-Path $build 'SHA256SUMS.txt'))
if ($checks.Count -lt 12) { throw 'Build checksums are incomplete.' }
foreach ($line in $checks) {
  if ($line -notmatch '^([a-f0-9]{64})  ([^\\/]+)$') { throw "Invalid build checksum entry: $line" }
  $expected = $Matches[1]; $name = $Matches[2]
  $file = Join-Path $build $name
  if (-not (Test-Path -LiteralPath $file -PathType Leaf) -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $expected) { throw "Build artifact hash mismatch: $name" }
}
$extensions = @(Get-ChildItem -LiteralPath $build -File -Filter "GetANNY-*-$version.zip")
if ($extensions.Count -ne 8) { throw "Expected eight extension packages, found $($extensions.Count)." }
foreach ($required in @('GetANNY Setup.exe','GetANNY Setup.msi','GetANNY Portable.exe','BUILD_STATUS.txt')) {
  if (-not (Test-Path -LiteralPath (Join-Path $build $required) -PathType Leaf)) { throw "Missing build artifact: $required" }
}
# Compile the ancillary recovery helper from the identical checked-in source.
# Install locked JS dependencies with scripts disabled; this step does not test the app.
npm ci --ignore-scripts
if ($LASTEXITCODE -ne 0) { throw 'Cannot prepare locked bundle dependencies.' }
./scripts/windows/build-native-host.ps1
New-Item release-assets -ItemType Directory -Force | Out-Null
Get-ChildItem release-assets -File | Remove-Item -Force
Copy-Item -LiteralPath (Join-Path $build 'GetANNY Setup.exe') -Destination 'release-assets/GetANNY-2.0.0-Setup.exe'
Copy-Item -LiteralPath (Join-Path $build 'GetANNY Setup.msi') -Destination 'release-assets/GetANNY-2.0.0-Setup.msi'
Copy-Item -LiteralPath (Join-Path $build 'GetANNY Portable.exe') -Destination 'release-assets/GetANNY-2.0.0-Portable.exe'
$extensions | Copy-Item -Destination release-assets
Copy-Item 'docs/INSTALL_WINDOWS.md','docs/BROWSERS.md','docs/PORTABLE_WINDOWS.md','docs/CHANGELOG.md' release-assets
@(
  '# GetANNY 2.0.0: important release information',
  '',
  'Published as an official release at the owner''s explicit request without waiting for installed Windows and real-browser verification.',
  'The desktop binaries are unsigned. Windows may warn before installation.',
  'Complete English/Arabic RTL/French/Spanish localization is not included.',
  'Firefox is an unsigned temporary development extension; Chromium extensions require developer-mode installation.',
  'The portable app cannot register a persistent native host. Pair over WebSocket while the portable app is running, or use an installed edition.',
  'Not all requested browser, authentication, and recovery scenarios have been verified. This release is not a claim of complete functionality or certification.',
  "Built from commit $source; build run: https://github.com/$env:REPO/actions/runs/$run",
  'See RELEASE_NOTES.md and SHA256SUMS.txt for additional limitations and file hashes.'
) | Set-Content -Encoding utf8 'release-assets/RELEASE_STATUS.md'
# Remove references to a measured report that is not available in this release.
$notes = Get-Content docs/RELEASE_NOTES.md -Raw
$notes = $notes.Replace('Read the appended `MEASURED_RESULTS.md`, source/run identity, SHA-256 sums and raw evidence for the actual result.', 'Windows installer and real-browser verification had not completed at publication. See `RELEASE_STATUS.md` for the source/run identity and `SHA256SUMS.txt` for file hashes.')
Set-Content -Encoding utf8 'release-assets/RELEASE_NOTES.md' $notes
$folder = "GetANNY-v$version-Windows"
$stage = Join-Path $env:RUNNER_TEMP $folder
foreach ($sub in @('Installers','Portable','Browser-Extensions','Native-Messaging','Documentation')) { New-Item (Join-Path $stage $sub) -ItemType Directory -Force | Out-Null }
Copy-Item 'release-assets/GetANNY-2.0.0-Setup.exe','release-assets/GetANNY-2.0.0-Setup.msi' (Join-Path $stage 'Installers')
Copy-Item 'release-assets/GetANNY-2.0.0-Portable.exe' (Join-Path $stage 'Portable')
Get-ChildItem release-assets -File -Filter "GetANNY-*-$version.zip" | Copy-Item -Destination (Join-Path $stage 'Browser-Extensions')
Copy-Item 'bin/GetANNY.NativeHost.exe','src/main/browser-integration/native-host.js','scripts/windows/Setup-Browsers.ps1' (Join-Path $stage 'Native-Messaging')
New-Item (Join-Path $stage 'Native-Messaging/node_modules') -ItemType Directory -Force | Out-Null
Copy-Item 'node_modules/ws' (Join-Path $stage 'Native-Messaging/node_modules') -Recurse
Copy-Item 'docs/NATIVE_MESSAGING.md' (Join-Path $stage 'Native-Messaging/README.md')
Copy-Item 'release-assets/INSTALL_WINDOWS.md','release-assets/BROWSERS.md','release-assets/PORTABLE_WINDOWS.md','release-assets/CHANGELOG.md','release-assets/RELEASE_STATUS.md','release-assets/RELEASE_NOTES.md','docs/THIRD_PARTY.md','LICENSE' (Join-Path $stage 'Documentation')
Set-Content (Join-Path $stage 'VERSION.txt') $version
Compress-Archive -Path $stage -DestinationPath "release-assets/$folder.zip" -CompressionLevel Optimal
# Verify actual bytes of every item in the bundle against its staging file.
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path "release-assets/$folder.zip").Path)
try {
  foreach ($file in Get-ChildItem $stage -File -Recurse) {
    $relative = $file.FullName.Substring($stage.Length + 1).Replace('\','/')
    $entry = $zip.GetEntry("$folder/$relative")
    if (-not $entry) { throw "Bundle missing $relative" }
    $stream = $entry.Open(); $sha = [System.Security.Cryptography.SHA256]::Create()
    try { $actual = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
    finally { $stream.Dispose(); $sha.Dispose() }
    if ($actual -cne (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()) { throw "Bundle mismatch: $relative" }
  }
} finally { $zip.Dispose() }
node scripts/checksums.js
if ($LASTEXITCODE -ne 0) { throw 'Release checksum generation failed.' }
$labeled = @(Get-ChildItem release-assets -File | ForEach-Object { "$($_.FullName)#$($_.Name)" })
gh release upload $tag @labeled
if ($LASTEXITCODE -ne 0) { throw 'Asset upload failed. The release remains a draft.' }
$releases = gh api "repos/$env:REPO/releases?per_page=100" | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect uploaded draft.' }
$match = @($releases | Where-Object { $_.tag_name -ceq $tag })
if ($match.Count -ne 1) { throw 'Expected exactly one draft.' }
$releaseFile = Join-Path $env:RUNNER_TEMP 'owner-release.json'
$match[0] | ConvertTo-Json -Depth 30 | Set-Content -Encoding utf8 $releaseFile
node scripts/verify-release-assets.js $releaseFile release-assets $tag $source
if ($LASTEXITCODE -ne 0) { throw 'Uploaded asset verification failed. The release remains a draft.' }
$publicNotes = @(
  (Get-Content 'release-assets/RELEASE_STATUS.md' -Raw),
  (Get-Content 'release-assets/RELEASE_NOTES.md' -Raw),
  '## SHA-256',
  '```text',
  (Get-Content 'release-assets/SHA256SUMS.txt' -Raw),
  '```'
) -join "`n"
$notesFile = Join-Path $env:RUNNER_TEMP 'owner-release-notes.md'
Set-Content -Encoding utf8 $notesFile $publicNotes
# Draft stays private until all uploads and byte checks above are complete.
gh release edit $tag --draft=false --prerelease=false --latest --notes-file $notesFile
if ($LASTEXITCODE -ne 0) { throw 'Draft promotion failed; inspect the draft state.' }
$published = gh release view $tag --json isDraft,isPrerelease,tagName,url,targetCommitish | ConvertFrom-Json
if ($LASTEXITCODE -ne 0 -or $published.isDraft -or $published.isPrerelease -or $published.tagName -cne $tag -or $published.targetCommitish -cne $source) { throw 'Release promotion state did not match the request.' }
Write-Host "Official release published: $($published.url)"
