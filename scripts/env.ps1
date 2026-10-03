# Dot-source:  . .\scripts\env.ps1        (load User-scope secrets into this process)
#              . .\scripts\env.ps1 -Check (also print name -> present/missing; never values)
# ASCII only, Windows PowerShell 5.1 compatible. Never prints or writes secret values.
param([switch]$Check)

$script:ScgEnvNames = @(
  'ELEVENLABS_API_KEY',
  'CLOUDFLARE_API_TOKEN',
  'CLOUDFLARE_ACCOUNT_ID',
  'TELEGRAM_BOT_TOKEN',
  'GOOGLE_SA_KEY_JSON',
  'SCG_TOOL_KEY',
  'SCG_ADMIN_KEY',
  'ELEVENLABS_WEBHOOK_SECRET'
)

# Fallback: DV\.env (git-ignored, KEY=VALUE lines, # comments). User scope wins.
$script:ScgDotEnv = @{}
$script:ScgDotEnvPath = Join-Path (Split-Path -Parent $PSScriptRoot) '.env'
if (Test-Path -LiteralPath $script:ScgDotEnvPath) {
  foreach ($line in [IO.File]::ReadAllLines($script:ScgDotEnvPath, [Text.Encoding]::UTF8)) {
    $t = $line.Trim()
    if ($t -eq '' -or $t.StartsWith('#')) { continue }
    $i = $t.IndexOf('=')
    if ($i -lt 1) { continue }
    $k = $t.Substring(0, $i).Trim()
    $val = $t.Substring($i + 1).Trim()
    if ($val.Length -ge 2 -and (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'")))) {
      $val = $val.Substring(1, $val.Length - 2)
    }
    $script:ScgDotEnv[$k] = $val
  }
  $line = $null; $t = $null; $val = $null
}

$script:ScgEnvReport = @()
foreach ($n in $script:ScgEnvNames) {
  $v = [Environment]::GetEnvironmentVariable($n, 'User')
  $src = 'user'
  if ([string]::IsNullOrWhiteSpace($v) -and $script:ScgDotEnv.ContainsKey($n)) {
    $v = $script:ScgDotEnv[$n]
    $src = '.env'
  }
  $ok = $false
  if (-not [string]::IsNullOrWhiteSpace($v)) {
    Set-Item -Path ("env:" + $n) -Value $v.Trim()
    $ok = $true
  }
  $v = $null
  $state = 'missing'
  if ($ok) { $state = 'present (' + $src + ')' }
  $script:ScgEnvReport += New-Object PSObject -Property @{ Name = $n; State = $state }
}
$script:ScgDotEnv = $null

if ($Check) {
  $script:ScgEnvReport | Select-Object Name, State | Format-Table -AutoSize | Out-String | Write-Host
}
