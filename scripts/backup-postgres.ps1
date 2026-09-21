param(
  [string]$OutputDirectory = $(Join-Path (Get-Location) 'backups'),
  [int]$RetentionDays = 30
)

$ErrorActionPreference = 'Stop'
if (-not $env:DATABASE_URL) { throw 'DATABASE_URL is required' }
$pgDump = Get-Command pg_dump -ErrorAction SilentlyContinue
$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
if (-not $pgDump -or -not $pgRestore) { throw 'pg_dump and pg_restore must be installed and available on PATH' }

New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupPath = Join-Path $OutputDirectory "news-platform-$stamp.dump"
& $pgDump.Source --format=custom --no-owner --file=$backupPath $env:DATABASE_URL
if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }

& $pgRestore.Source --list $backupPath | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Backup verification failed: pg_restore could not read the dump' }

Get-ChildItem -Path $OutputDirectory -Filter '*.dump' | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$RetentionDays) } | Remove-Item -Force
Write-Output "Verified PostgreSQL backup: $backupPath"
