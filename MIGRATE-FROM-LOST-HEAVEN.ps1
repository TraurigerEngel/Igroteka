param([string]$SourceDb = '')
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

$portable = Join-Path $PSScriptRoot 'Portable\Igroteka_Standalone_v1.0_Stable_DEV'
$targetDir = Join-Path $portable 'data'
$target = Join-Path $targetDir 'igroteka.sqlite3'
$verifyDb = Join-Path $PSScriptRoot 'scripts\verify-sqlite-db.js'

if (-not (Test-Path -LiteralPath $portable)) {
  throw 'Build the DEV version first with .\BUILD-DEV.cmd'
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js is required for migration database verification.'
}
if (-not (Test-Path -LiteralPath $verifyDb)) {
  throw 'Migration verifier is missing: scripts\verify-sqlite-db.js'
}

# Do not migrate while either application can still be writing its database.
$running = @(
  Get-Process -Name 'igroteka' -ErrorAction SilentlyContinue
  Get-Process -Name 'lost-heaven-tauri' -ErrorAction SilentlyContinue
) | Where-Object { $_ }
if (@($running).Count -gt 0) {
  throw 'Close Igroteka and Lost Heaven before migration, then run this command again.'
}

$candidates = @()
if ($SourceDb) { $candidates += $SourceDb }
$parent = Split-Path -Parent $PSScriptRoot
$candidates += @(
  (Join-Path $parent 'LostHeavenDesktop_v3.00\Portable\LostHeaven_Desktop_v3.00_DEV\data\games\igroteka.sqlite3'),
  (Join-Path $parent 'LostHeavenDesktop_v3.00\data\games\igroteka.sqlite3')
)

$source = $candidates | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -First 1
if (-not $source) {
  throw 'Lost Heaven database was not found automatically. Run: .\MIGRATE-FROM-LOST-HEAVEN.ps1 -SourceDb "FULL_PATH\igroteka.sqlite3"'
}
$source = (Resolve-Path -LiteralPath $source).Path

$sourceWal = "$source-wal"
if ((Test-Path -LiteralPath $sourceWal) -and ((Get-Item -LiteralPath $sourceWal).Length -gt 0)) {
  throw 'The source SQLite WAL is active. Close Lost Heaven completely and retry.'
}

Write-Host 'Checking source database...'
& node --no-warnings $verifyDb $source
if ($LASTEXITCODE -ne 0) { throw 'Source database verification failed.' }

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupDir = Join-Path $targetDir 'migration-backups'
$backup = $null
if (Test-Path -LiteralPath $target) {
  New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
  $backup = Join-Path $backupDir "igroteka-before-migration-$stamp.sqlite3"
  Copy-Item -LiteralPath $target -Destination $backup -Force
}

$tmp = Join-Path $targetDir ".igroteka-migration-$PID.tmp"
try {
  Copy-Item -LiteralPath $source -Destination $tmp -Force
  Write-Host 'Checking copied database...'
  & node --no-warnings $verifyDb $tmp
  if ($LASTEXITCODE -ne 0) { throw 'Copied database verification failed.' }

  Move-Item -LiteralPath $tmp -Destination $target -Force

  & node --no-warnings $verifyDb $target
  if ($LASTEXITCODE -ne 0) { throw 'Target database verification failed.' }
}
catch {
  if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
  if ($backup -and (Test-Path -LiteralPath $backup)) {
    Copy-Item -LiteralPath $backup -Destination $target -Force
  }
  throw
}
finally {
  if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue }
}

Write-Host 'Migration completed successfully.' -ForegroundColor Green
Write-Host "Source: $source"
Write-Host "Target: $target"
if ($backup) { Write-Host "Previous standalone database backup: $backup" }
