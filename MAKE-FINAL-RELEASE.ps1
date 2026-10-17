Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'PREVIEW-ONLY.txt')) { throw 'Preview source: Stable publication is disabled.' }

Add-Type -AssemblyName System.IO.Compression.FileSystem

function Get-Sha256Hex {
  param([Parameter(Mandatory=$true)][string]$Path)
  $stream = [System.IO.File]::OpenRead($Path)
  try {
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
      $hash = $sha.ComputeHash($stream)
    } finally {
      $sha.Dispose()
    }
  } finally {
    $stream.Dispose()
  }
  return ([System.BitConverter]::ToString($hash) -replace '-', '').ToLowerInvariant()
}

function New-ZipFromDirectory {
  param(
    [Parameter(Mandatory=$true)][string]$SourceDir,
    [Parameter(Mandatory=$true)][string]$DestinationZip
  )
  if (Test-Path -LiteralPath $DestinationZip) {
    throw "Refusing to overwrite existing ZIP: $DestinationZip"
  }
  [System.IO.Compression.ZipFile]::CreateFromDirectory(
    $SourceDir,
    $DestinationZip,
    [System.IO.Compression.CompressionLevel]::Optimal,
    $false
  )
}

function Expand-ZipToDirectory {
  param(
    [Parameter(Mandatory=$true)][string]$ZipPath,
    [Parameter(Mandatory=$true)][string]$DestinationDir
  )
  if (Test-Path -LiteralPath $DestinationDir) {
    Remove-Item -LiteralPath $DestinationDir -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $DestinationDir | Out-Null
  [System.IO.Compression.ZipFile]::ExtractToDirectory($ZipPath, $DestinationDir)
}

$releaseName = 'Igroteka_Standalone_v1.1_Stable'
$portable = Join-Path $PSScriptRoot ('Release\' + $releaseName)
$artifacts = Join-Path $PSScriptRoot 'Artifacts'
$artifactsStage = Join-Path $PSScriptRoot ('.release-artifacts-stage-' + [guid]::NewGuid().ToString('N'))
$portableZip = Join-Path $artifactsStage ($releaseName + '_Portable.zip')
$sourceZip = Join-Path $artifactsStage ($releaseName + '_Source.zip')
$sourceStage = Join-Path $PSScriptRoot ('.release-source-stage-' + [guid]::NewGuid().ToString('N'))
$verifyStage = Join-Path $PSScriptRoot ('.release-verify-stage-' + [guid]::NewGuid().ToString('N'))
$sourceVerifyStage = Join-Path $PSScriptRoot ('.release-source-verify-stage-' + [guid]::NewGuid().ToString('N'))

if (Test-Path -LiteralPath $portable) { throw "Refusing to overwrite existing Release Portable: $portable" }
if (Test-Path -LiteralPath $artifacts) { throw 'Refusing to overwrite existing Artifacts; use a fresh source folder.' }
Write-Host '=== IGROTEKA STANDALONE v1.1 Stable / FINAL RELEASE ===' -ForegroundColor Magenta

& (Join-Path $PSScriptRoot 'BUILD-RELEASE.ps1')
if ($LASTEXITCODE -ne 0) { throw "BUILD-RELEASE failed: $LASTEXITCODE" }

New-Item -ItemType Directory -Force -Path $artifactsStage | Out-Null
Write-Host "`n[1/4] Packing portable ZIP..." -ForegroundColor Cyan
New-ZipFromDirectory -SourceDir $portable -DestinationZip $portableZip

Write-Host "`n[2/4] Packing clean source ZIP..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $sourceStage | Out-Null
foreach ($dir in @('app','scripts','data','seed-data')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot $dir) -Destination (Join-Path $sourceStage $dir) -Recurse -Force
}
$srcTauriStage = Join-Path $sourceStage 'src-tauri'
New-Item -ItemType Directory -Force -Path $srcTauriStage | Out-Null
foreach ($file in @('build.rs','Cargo.toml','Cargo.lock','tauri.conf.json','tauri.release.conf.json')) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot ('src-tauri\' + $file)) -Destination (Join-Path $srcTauriStage $file) -Force
}
foreach ($dir in @('src','icons','gen')) {
  $src = Join-Path $PSScriptRoot ('src-tauri\' + $dir)
  if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination (Join-Path $srcTauriStage $dir) -Recurse -Force }
}

$rootFiles = @(
  '.gitignore','package.json','package-lock.json',
  'BUILD-DEV.cmd','BUILD-DEV.ps1','BUILD-RELEASE.cmd','BUILD-RELEASE.ps1',
  'MAKE-FINAL-RELEASE.cmd','MAKE-FINAL-RELEASE.ps1',
  'MIGRATE-FROM-LOST-HEAVEN.cmd','MIGRATE-FROM-LOST-HEAVEN.ps1',
  'START-HERE.txt','README.md','CHANGELOG.md','RELEASE-CHECKLIST.md','RELEASE_NOTES_v1.1_STABLE.md'
)
foreach ($file in $rootFiles) {
  $src = Join-Path $PSScriptRoot $file
  if (Test-Path -LiteralPath $src) { Copy-Item -LiteralPath $src -Destination (Join-Path $sourceStage $file) -Force }
}
node --no-warnings (Join-Path $sourceStage 'scripts\verify-standalone.js')
if ($LASTEXITCODE -ne 0) { throw "source staging verification failed: $LASTEXITCODE" }
New-ZipFromDirectory -SourceDir $sourceStage -DestinationZip $sourceZip

Write-Host "`n[3/4] Re-extracting and verifying ZIPs..." -ForegroundColor Cyan
Expand-ZipToDirectory -ZipPath $portableZip -DestinationDir $verifyStage
node --no-warnings scripts\verify-release-artifact.js $verifyStage
if ($LASTEXITCODE -ne 0) { throw "re-extracted portable verification failed: $LASTEXITCODE" }

Expand-ZipToDirectory -ZipPath $sourceZip -DestinationDir $sourceVerifyStage
node --no-warnings (Join-Path $sourceVerifyStage 'scripts\verify-standalone.js')
if ($LASTEXITCODE -ne 0) { throw "re-extracted source verification failed: $LASTEXITCODE" }

Write-Host "`n[4/4] Writing hashes and metadata..." -ForegroundColor Cyan
$portableHash = Get-Sha256Hex -Path $portableZip
$sourceHash = Get-Sha256Hex -Path $sourceZip
@(
  "$portableHash  $([IO.Path]::GetFileName($portableZip))",
  "$sourceHash  $([IO.Path]::GetFileName($sourceZip))"
) | Set-Content -LiteralPath (Join-Path $artifactsStage 'SHA256SUMS.txt') -Encoding ASCII

$meta = [ordered]@{
  product = 'Igroteka Standalone'
  version = '1.1.0'
  channel = 'Stable'
  release = 'v1.1 Stable'
  generated_at = (Get-Date).ToString('o')
  portable_sha256 = $portableHash
  source_sha256 = $sourceHash
}
$meta | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $artifactsStage 'RELEASE-METADATA.json') -Encoding UTF8

foreach ($tmp in @($sourceStage,$verifyStage,$sourceVerifyStage)) {
  if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Recurse -Force }
}

if (Test-Path -LiteralPath $artifacts) { throw 'Refusing to overwrite existing Artifacts.' }
Move-Item -LiteralPath $artifactsStage -Destination $artifacts
$portableZip = Join-Path $artifacts ($releaseName + '_Portable.zip')
$sourceZip = Join-Path $artifacts ($releaseName + '_Source.zip')
Write-Host "`n=== FINAL RELEASE READY ===" -ForegroundColor Green
Write-Host "Portable ZIP: $portableZip"
Write-Host "Source ZIP:   $sourceZip"
Write-Host "SHA256SUMS:   $(Join-Path $artifacts 'SHA256SUMS.txt')"
