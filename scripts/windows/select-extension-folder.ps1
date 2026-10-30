# Test-only UI automation for Chrome's NORMAL "Load unpacked" folder dialog.
# Only the disposable browser profile launched by test-extension.js is targeted.
# No policy/registry/profile/signing changes; never used by the application.
param([Parameter(Mandatory=$true)][int]$BrowserPid,[Parameter(Mandatory=$true)][string]$Directory)
$ErrorActionPreference='Stop'
if(-not(Test-Path -LiteralPath (Join-Path $Directory 'manifest.json'))){throw 'Prepared extension manifest missing.'}
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class GetANNYTestForeground {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr window);
}
'@
$automation=[System.Windows.Automation.AutomationElement]
$condition=[System.Windows.Automation.PropertyCondition]::new($automation::ProcessIdProperty,$BrowserPid)
$deadline=(Get-Date).AddSeconds(25)
$dialog=$null
while((Get-Date) -lt $deadline) {
  $windows=$automation::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children,$condition)
  foreach($window in $windows) {if($window.Current.ClassName -eq '#32770'){$dialog=$window;break}}
  if($dialog){break}
  Start-Sleep -Milliseconds 100
}
if(-not $dialog){throw 'Chrome did not expose its normal extension folder-selection dialog.'}
[GetANNYTestForeground]::SetForegroundWindow([IntPtr]$dialog.Current.NativeWindowHandle) | Out-Null
$dialog.SetFocus()
[System.Windows.Forms.SendKeys]::SendWait('%d')
Start-Sleep -Milliseconds 150
$address=$automation::FocusedElement
if($address.Current.ProcessId -ne $BrowserPid -or $address.Current.ControlType -ne [System.Windows.Automation.ControlType]::Edit){throw 'Folder-dialog address field is not focused; refusing to send a path to another window.'}
$value=$address.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
$value.SetValue($Directory)
[System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
Start-Sleep -Milliseconds 250
$select=$dialog.FindFirst([System.Windows.Automation.TreeScope]::Descendants,[System.Windows.Automation.PropertyCondition]::new($automation::AutomationIdProperty,'1'))
if(-not $select -or $select.Current.ControlType -ne [System.Windows.Automation.ControlType]::Button){throw 'Folder-dialog selection button missing.'}
$select.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke()
Write-Output 'Selected the prepared extension using the actual browser folder dialog.'
