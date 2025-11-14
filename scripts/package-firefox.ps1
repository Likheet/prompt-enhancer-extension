param(
  [string]$Output = "prompt-enhancer-firefox.zip"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir
Set-Location $root

$chromeManifest = "manifest.json"
$backupManifest = "manifest.chrome.json"
$firefoxManifest = "manifest.firefox.json"

if (-Not (Test-Path $firefoxManifest)) {
  throw "Firefox manifest not found at $firefoxManifest"
}

if (Test-Path $backupManifest) {
  Remove-Item $backupManifest -Force
}

Copy-Item $chromeManifest $backupManifest -Force
Copy-Item $firefoxManifest $chromeManifest -Force

if (Test-Path $Output) {
  Remove-Item $Output -Force
}

Compress-Archive -Path manifest.json,dist,assets,src,firefox-background.js -DestinationPath $Output -Force

Copy-Item $backupManifest $chromeManifest -Force
Remove-Item $backupManifest -Force
