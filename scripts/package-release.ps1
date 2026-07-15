param(
  [string]$Version = "0.2.1"
)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$releaseRoot = Join-Path $root "release\v$Version"
$chromeDir = Join-Path $releaseRoot "chrome"
$firefoxDir = Join-Path $releaseRoot "firefox"
$chromeZip = Join-Path $root "release\ai-prompt-enhancer-chrome-v$Version.zip"
$firefoxZip = Join-Path $root "release\ai-prompt-enhancer-firefox-v$Version.zip"

New-Item -ItemType Directory -Force $chromeDir, $firefoxDir | Out-Null
Copy-Item manifest.json, src, dist, assets -Destination $chromeDir -Recurse -Force
Copy-Item manifest.json, src, dist, assets -Destination $firefoxDir -Recurse -Force

$firefoxManifestPath = Join-Path $firefoxDir "manifest.json"
$firefoxManifest = Get-Content $firefoxManifestPath -Raw | ConvertFrom-Json
$firefoxManifest | Add-Member -NotePropertyName browser_specific_settings -NotePropertyValue ([pscustomobject]@{
  gecko = [pscustomobject]@{
    id = "prompt-enhancer@likheet"
    strict_min_version = "109.0"
  }
})
$firefoxManifest.background | Add-Member -NotePropertyName scripts -NotePropertyValue @("dist/service-worker.js")
$firefoxManifest | ConvertTo-Json -Depth 20 | Set-Content $firefoxManifestPath -Encoding utf8

Compress-Archive -Path "$chromeDir\*" -DestinationPath $chromeZip -Force
Compress-Archive -Path "$firefoxDir\*" -DestinationPath $firefoxZip -Force

Write-Output $chromeZip
Write-Output $firefoxZip
