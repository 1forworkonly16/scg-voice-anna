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

$script:ScgEnvReport = @()
foreach ($n in $script:ScgEnvNames) {
  $v = [Environment]::GetEnvironmentVariable($n, 'User')
  $ok = $false
  if (-not [string]::IsNullOrWhiteSpace($v)) {
    Set-Item -Path ("env:" + $n) -Value $v.Trim()
    $ok = $true
  }
  $v = $null
  $state = 'missing'
  if ($ok) { $state = 'present' }
  $script:ScgEnvReport += New-Object PSObject -Property @{ Name = $n; State = $state }
}

if ($Check) {
  $script:ScgEnvReport | Select-Object Name, State | Format-Table -AutoSize | Out-String | Write-Host
}
