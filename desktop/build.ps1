param([Parameter(Mandatory=$true)][string]$SdkRoot,[Parameter(Mandatory=$true)][string]$NodeExecutable)
$ErrorActionPreference='Stop'
$appRoot=Split-Path -Parent $PSScriptRoot
$sdk=Join-Path $SdkRoot 'lib/net462'
$compiler=Join-Path $env:WINDIR 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
New-Item -ItemType Directory -Force (Join-Path $appRoot 'runtime'),(Join-Path $appRoot 'licenses') | Out-Null
Copy-Item -LiteralPath $NodeExecutable -Destination (Join-Path $appRoot 'runtime/node.exe') -Force
foreach($name in @('Microsoft.Web.WebView2.Core.dll','Microsoft.Web.WebView2.WinForms.dll')){Copy-Item -LiteralPath (Join-Path $sdk $name) -Destination (Join-Path $appRoot $name) -Force}
Copy-Item -LiteralPath (Join-Path $SdkRoot 'runtimes/win-x64/native/WebView2Loader.dll') -Destination (Join-Path $appRoot 'WebView2Loader.dll') -Force
Copy-Item -LiteralPath (Join-Path $SdkRoot 'LICENSE.txt') -Destination (Join-Path $appRoot 'licenses/WebView2-LICENSE.txt') -Force
Copy-Item -LiteralPath (Join-Path $SdkRoot 'NOTICE.txt') -Destination (Join-Path $appRoot 'licenses/WebView2-NOTICE.txt') -Force
& (Join-Path $PSScriptRoot 'build-icon.ps1') | Out-Null
$icon=Join-Path $appRoot 'assets/app-icon.ico'
$source=Join-Path $PSScriptRoot 'Launcher.cs'
$manifest=Join-Path $PSScriptRoot 'app.manifest'
$executable=Join-Path $appRoot 'Blueprint Ledger.exe'
$core=Join-Path $sdk 'Microsoft.Web.WebView2.Core.dll'
$forms=Join-Path $sdk 'Microsoft.Web.WebView2.WinForms.dll'
& $compiler /nologo /target:winexe /platform:x64 /optimize+ "/out:$executable" "/win32manifest:$manifest" "/win32icon:$icon" /reference:System.dll /reference:System.Core.dll /reference:System.Drawing.dll /reference:System.Windows.Forms.dll "/reference:$core" "/reference:$forms" $source
if($LASTEXITCODE -ne 0){throw 'Desktop build failed'}
@'
<?xml version="1.0" encoding="utf-8"?>
<configuration><startup useLegacyV2RuntimeActivationPolicy="true"><supportedRuntime version="v4.0" sku=".NETFramework,Version=v4.8"/></startup></configuration>
'@ | Set-Content (Join-Path $appRoot 'Blueprint Ledger.exe.config') -Encoding UTF8
Write-Output (Join-Path $appRoot 'Blueprint Ledger.exe')
