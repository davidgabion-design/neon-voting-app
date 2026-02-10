# set-firebase-vars.ps1
# Sets Firebase credentials as individual environment variables

$cred = Get-Content '.firebase-admin-key.json' | ConvertFrom-Json

Write-Host "Setting Firebase environment variables in Netlify..." -ForegroundColor Cyan
Write-Host ""

# Project ID
Write-Host "1. Setting FIREBASE_PROJECT_ID..." -ForegroundColor Yellow
netlify env:set FIREBASE_PROJECT_ID "$($cred.project_id)" --force | Out-Null
Write-Host "   ✓ FIREBASE_PROJECT_ID = $($cred.project_id)" -ForegroundColor Green

# Client Email
Write-Host "2. Setting FIREBASE_CLIENT_EMAIL..." -ForegroundColor Yellow
netlify env:set FIREBASE_CLIENT_EMAIL "$($cred.client_email)" --force | Out-Null
Write-Host "   ✓ FIREBASE_CLIENT_EMAIL = $($cred.client_email)" -ForegroundColor Green

# Private Key - save to temp file to handle newlines properly
Write-Host "3. Setting FIREBASE_PRIVATE_KEY..." -ForegroundColor Yellow
$tempFile = [System.IO.Path]::GetTempFileName()
$cred.private_key | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline

# Use PowerShell to read and set via stdin
$privateKeyValue = Get-Content $tempFile -Raw
$env:TEMP_PRIVATE_KEY = $privateKeyValue

# Use environment variable to pass the value
$processInfo = New-Object System.Diagnostics.ProcessStartInfo
$processInfo.FileName = "netlify"
$processInfo.Arguments = "env:set FIREBASE_PRIVATE_KEY `"$privateKeyValue`" --force"
$processInfo.RedirectStandardOutput = $true
$processInfo.RedirectStandardError = $true
$processInfo.UseShellExecute = $false
$processInfo.CreateNoWindow = $true
$processInfo.WorkingDirectory = $PWD

$process = New-Object System.Diagnostics.Process
$process.StartInfo = $processInfo
$process.Start() | Out-Null
$process.WaitForExit()

Remove-Item $tempFile -Force
Remove-Item Env:\TEMP_PRIVATE_KEY -ErrorAction SilentlyContinue

if ($process.ExitCode -eq 0) {
    Write-Host "   ✓ FIREBASE_PRIVATE_KEY set (length: $($cred.private_key.Length) chars)" -ForegroundColor Green
} else {
    Write-Host "   ✗ Failed to set FIREBASE_PRIVATE_KEY" -ForegroundColor Red
    $error = $process.StandardError.ReadToEnd()
    Write-Host "   Error: $error" -ForegroundColor Red
}

Write-Host ""
Write-Host "✅ Done! All Firebase credentials set as individual variables." -ForegroundColor Green
Write-Host ""
Write-Host "Next: Deploy with updated send-otp.js code" -ForegroundColor Yellow
