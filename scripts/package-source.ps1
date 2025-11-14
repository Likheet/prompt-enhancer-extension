param(
  [string]$Output = "prompt-enhancer-source.zip"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$root = Split-Path -Parent $scriptDir
Set-Location $root

Write-Host "Packaging source code for AMO submission..." -ForegroundColor Cyan

# Remove existing source archive if present
if (Test-Path $Output) {
  Remove-Item $Output -Force
  Write-Host "Removed existing $Output" -ForegroundColor Yellow
}

# Files and directories to include in source archive
$sourceFiles = @(
  "src",
  "assets",
  "scripts",
  "manifest.json",
  "manifest.firefox.json",
  "firefox-background.js",
  "package.json",
  "package-lock.json",
  "build.js",
  "BUILD_INSTRUCTIONS.md",
  "README.md",
  "LICENSE",
  "ARCHITECTURE.md",
  "PLATFORM_INTEGRATION_GUIDE.md",
  "ADDING_NEW_PLATFORM.md",
  "V2_IMPLEMENTATION_SUMMARY.md",
  "V2_USAGE_GUIDE.md"
)

# Verify all critical files exist
$missing = @()
foreach ($file in $sourceFiles) {
  if (-Not (Test-Path $file)) {
    $missing += $file
  }
}

if ($missing.Count -gt 0) {
  Write-Host "Warning: Some files are missing:" -ForegroundColor Yellow
  $missing | ForEach-Object { Write-Host "  - $_" -ForegroundColor Yellow }
}

# Create the source archive
Write-Host "Creating source archive..." -ForegroundColor Cyan
Compress-Archive -Path $sourceFiles -DestinationPath $Output -Force

# Display result
if (Test-Path $Output) {
  $archiveInfo = Get-Item $Output
  $sizeMB = [math]::Round($archiveInfo.Length / 1MB, 2)
  Write-Host "`n✅ Source archive created successfully!" -ForegroundColor Green
  Write-Host "   File: $Output" -ForegroundColor White
  Write-Host "   Size: $sizeMB MB" -ForegroundColor White
  Write-Host "   Max allowed: 200 MB" -ForegroundColor Gray
  
  if ($sizeMB -gt 200) {
    Write-Host "`n⚠️  WARNING: Archive exceeds 200 MB limit!" -ForegroundColor Red
  }
  
  Write-Host "`nThis archive contains:" -ForegroundColor Cyan
  Write-Host "  - Complete source code (src/)" -ForegroundColor White
  Write-Host "  - Build scripts and package.json" -ForegroundColor White
  Write-Host "  - BUILD_INSTRUCTIONS.md with reproduction steps" -ForegroundColor White
  Write-Host "  - Documentation files" -ForegroundColor White
  Write-Host "`nSubmit this file as 'Source Code' on AMO." -ForegroundColor Green
} else {
  Write-Host "❌ Failed to create source archive" -ForegroundColor Red
  exit 1
}
