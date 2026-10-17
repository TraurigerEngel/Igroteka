Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$seed = Join-Path $root 'seed-data\igroteka.sqlite3'
$live = Join-Path $root 'data\igroteka.sqlite3'
$expected = '64699fdff58356482ab93effe6f3601d267b442306a0e10d8a0c29a5091d78c4'
if (-not (Test-Path -LiteralPath $seed -PathType Leaf)) { throw 'Clean demo seed database not found.' }
$actual = (Get-FileHash -LiteralPath $seed -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw 'Clean demo seed hash mismatch. Refusing to initialize.' }
if (Test-Path -LiteralPath $live -PathType Leaf) {
  Write-Host 'Existing local Igroteka database was NOT modified.' -ForegroundColor Green
  exit 0
}
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $live) | Out-Null
Copy-Item -LiteralPath $seed -Destination $live -ErrorAction Stop
Write-Host 'Empty demo Igroteka database initialized (0 games).' -ForegroundColor Green
