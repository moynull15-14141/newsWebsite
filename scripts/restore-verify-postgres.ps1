param(
  [Parameter(Mandatory = $true)][string]$BackupFile,
  [Parameter(Mandatory = $true)][string]$RestoreDatabaseUrl
)

$ErrorActionPreference = 'Stop'
$pgRestore = Get-Command pg_restore -ErrorAction SilentlyContinue
$psql = Get-Command psql -ErrorAction SilentlyContinue
if (-not $pgRestore -or -not $psql) { throw 'pg_restore and psql must be installed and available on PATH' }
if (-not (Test-Path $BackupFile)) { throw "Backup file not found: $BackupFile" }
if ($RestoreDatabaseUrl -eq $env:DATABASE_URL) { throw 'Refusing to restore verification into DATABASE_URL; use an isolated database' }

& $pgRestore.Source --clean --if-exists --no-owner --dbname=$RestoreDatabaseUrl $BackupFile
if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE" }

$checks = @(
  'SELECT 1 FROM information_schema.tables WHERE table_name = ''articles'';',
  'SELECT 1 FROM information_schema.tables WHERE table_name = ''locations'';',
  'SELECT 1 FROM information_schema.tables WHERE table_name = ''categories'';',
  'SELECT COUNT(*) FROM articles;',
  'SELECT COUNT(*) FROM locations;',
  'SELECT COUNT(*) FROM categories;'
)
foreach ($query in $checks) {
  & $psql.Source $RestoreDatabaseUrl --no-psqlrc --tuples-only --command=$query
  if ($LASTEXITCODE -ne 0) { throw "Restore verification query failed: $query" }
}
Write-Output 'Restore verification completed against the isolated database.'
