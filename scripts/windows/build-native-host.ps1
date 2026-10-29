$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $compiler)) { throw '.NET Framework C# compiler is required to build the native-host launcher.' }
New-Item (Join-Path $root 'bin') -ItemType Directory -Force | Out-Null
& $compiler /nologo /target:exe /platform:anycpu /optimize+ /reference:System.Web.Extensions.dll "/win32icon:$root\assets\icon.ico" "/out:$root\bin\GetANNY.NativeHost.exe" "$PSScriptRoot\NativeHost.cs"
if ($LASTEXITCODE -ne 0) { throw 'Native host compilation failed.' }
