# set-firebase-env.ps1
# This script safely sets the FIREBASE_ADMIN_SDK environment variable in Netlify

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Firebase Admin SDK Setup for Netlify" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Check if the JSON file exists
$jsonFile = ".firebase-admin-key.json"
if (-not (Test-Path $jsonFile)) {
    Write-Host "Step 1: Create the Firebase key file" -ForegroundColor Yellow
    Write-Host "Please paste your FULL Firebase service account JSON below." -ForegroundColor White
    Write-Host "Make sure to include the complete private key (between BEGIN and END)" -ForegroundColor White
    Write-Host ""
    Write-Host "Paste the JSON and press Enter twice when done:" -ForegroundColor Green
    
    $jsonContent = @()
    do {
        $line = Read-Host
        if ($line -ne "") {
            $jsonContent += $line
        }
    } while ($line -ne "")
    
    $json = $jsonContent -join "`n"
    $json | Out-File -FilePath $jsonFile -Encoding UTF8
    Write-Host "✓ JSON file created" -ForegroundColor Green
    Write-Host ""
}
else {
    Write-Host "✓ Found existing $jsonFile" -ForegroundColor Green
    $json = Get-Content $jsonFile -Raw
}

# Validate JSON
try {
    $parsed = $json | ConvertFrom-Json
    Write-Host "✓ JSON is valid" -ForegroundColor Green
    Write-Host "  Project ID: $($parsed.project_id)" -ForegroundColor Gray
    Write-Host "  Client Email: $($parsed.client_email)" -ForegroundColor Gray
    Write-Host ""
}
catch {
    Write-Host "✗ Invalid JSON format!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Minify JSON (remove extra whitespace)
$minified = $json -replace '\s+', ' ' -replace '\\n', '\n'

Write-Host "Step 2: Setting environment variable in Netlify..." -ForegroundColor Yellow
Write-Host "JSON length: $($minified.Length) characters" -ForegroundColor Gray
Write-Host ""

# Use netlify env:set with proper escaping
try {
    # Save to temp file to avoid command line length issues
    $tempFile = [System.IO.Path]::GetTempFileName()
    $minified | Out-File -FilePath $tempFile -Encoding UTF8 -NoNewline
    
    # Set using file redirection
    $result = & netlify env:set FIREBASE_ADMIN_SDK --value (Get-Content $tempFile -Raw) 2>&1
    
    Remove-Item $tempFile -Force
    
    Write-Host "✓ Environment variable set successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Step 3: Deploy to apply changes..." -ForegroundColor Yellow
    Write-Host "Running: netlify deploy --prod" -ForegroundColor Gray
    
    & netlify deploy --prod
    
}
catch {
    Write-Host "✗ Failed to set environment variable!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Set it manually via Netlify UI:" -ForegroundColor Yellow
    Write-Host "1. Go to: https://app.netlify.com/sites/neonvotingsystemz/configuration/env" -ForegroundColor Gray
    Write-Host "2. Find FIREBASE_ADMIN_SDK" -ForegroundColor Gray
    Write-Host "3. Paste this minified JSON (length: $($minified.Length)):" -ForegroundColor Gray
    Write-Host $minified -ForegroundColor DarkGray
}
