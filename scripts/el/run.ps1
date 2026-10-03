# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File scripts\el\run.ps1 <script.ts> [args]
# Loads the env (names only), then runs node on the script. Never prints secrets.
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot '..\env.ps1')
$env:PYTHONUTF8 = '1'
& node @args
exit $LASTEXITCODE
