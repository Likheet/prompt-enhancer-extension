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

function New-PortableZip([string]$sourceDir, [string]$destination) {
  if (Test-Path $destination) { Remove-Item $destination -Force }
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  $archive = [System.IO.Compression.ZipFile]::Open($destination, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    Get-ChildItem $sourceDir -Recurse -File | ForEach-Object {
      $rootPrefix = ((Resolve-Path $sourceDir).Path.TrimEnd('\') + '\')
      $relative = $_.FullName.Substring($rootPrefix.Length).Replace('\', '/')
      $entry = $archive.CreateEntry($relative, [System.IO.Compression.CompressionLevel]::Optimal)
      $input = [IO.File]::OpenRead($_.FullName)
      $output = $entry.Open()
      try { $input.CopyTo($output) } finally { $output.Dispose(); $input.Dispose() }
    }
  } finally {
    $archive.Dispose()
  }
}

New-PortableZip $chromeDir $chromeZip
New-PortableZip $firefoxDir $firefoxZip

Write-Output $chromeZip
Write-Output $firefoxZip
