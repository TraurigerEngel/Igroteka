param([Parameter(Mandatory=$true)][string]$ExePath)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $ExePath -PathType Leaf)) { throw 'EXE missing.' }
$bytes = [System.IO.File]::ReadAllBytes((Resolve-Path -LiteralPath $ExePath).Path)
if ($bytes.Length -lt 1024) { throw 'Invalid EXE length.' }
if ([System.BitConverter]::ToUInt16($bytes, 0) -ne 0x5A4D) { throw 'Not a Windows MZ binary.' }
$pe = [System.BitConverter]::ToInt32($bytes, 0x3C)
if ($pe -lt 0 -or ($pe + 100) -ge $bytes.Length) { throw 'Invalid PE header offset.' }
if ([System.BitConverter]::ToUInt32($bytes, $pe) -ne 0x00004550) { throw 'Invalid PE signature.' }
$subsystem = [System.BitConverter]::ToUInt16($bytes, $pe + 24 + 68)
if ($subsystem -ne 2) { throw "Expected Windows GUI subsystem (2), got $subsystem." }
Write-Host 'IGROTEKA EXE PE SUBSYSTEM: WINDOWS GUI (2) PASS' -ForegroundColor Green
