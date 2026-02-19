param(
  [Parameter(Mandatory = $true)]
  [string]$SiteUrl,

  [Parameter(Mandatory = $false)]
  [string]$Token
)

$ErrorActionPreference = 'Stop'

$base = $SiteUrl.Trim()
if (-not ($base -match '^https?://')) {
  throw "SiteUrl must be an absolute URL like https://your-site.netlify.app"
}
if ($base.EndsWith('/')) { $base = $base.Substring(0, $base.Length - 1) }
$endpoint = "$base/.netlify/functions/env-doctor"

if (-not $Token -and $env:ENV_DOCTOR_TOKEN) {
  $Token = $env:ENV_DOCTOR_TOKEN
}

$headers = @{}
if ($Token) {
  $headers['x-env-doctor-token'] = $Token
}

Write-Host "Calling: $endpoint" -ForegroundColor Cyan
if ($headers.ContainsKey('x-env-doctor-token')) {
  Write-Host "Auth: token header provided" -ForegroundColor DarkGray
} else {
  Write-Host "Auth: no token header" -ForegroundColor DarkGray
}

try {
  $resp = Invoke-RestMethod -Method GET -Uri $endpoint -Headers $headers -TimeoutSec 30
} catch {
  Write-Host "Request failed:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  exit 1
}

# Print summary without leaking secrets (function never returns values)
if ($resp.ok -eq $true) {
  Write-Host "✅ ENV OK" -ForegroundColor Green
  if ($resp.warnings -and $resp.warnings.Count -gt 0) {
    Write-Host "Warnings:" -ForegroundColor Yellow
    $resp.warnings | ForEach-Object { Write-Host "- $_" -ForegroundColor Yellow }
  }
  exit 0
}

Write-Host "❌ ENV NOT OK" -ForegroundColor Red
if ($resp.errors -and $resp.errors.Count -gt 0) {
  Write-Host "Errors:" -ForegroundColor Red
  $resp.errors | ForEach-Object { Write-Host "- $_" -ForegroundColor Red }
}

if ($resp.warnings -and $resp.warnings.Count -gt 0) {
  Write-Host "Warnings:" -ForegroundColor Yellow
  $resp.warnings | ForEach-Object { Write-Host "- $_" -ForegroundColor Yellow }
}

exit 2
