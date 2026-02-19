# Netlify Environment Variable Verification Script
# Run this to check if all required environment variables are set

Write-Host ""
Write-Host "Netlify Environment Variable Checker" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if netlify CLI is installed
try {
    $netlifyVersion = netlify --version
    Write-Host "[OK] Netlify CLI installed: $netlifyVersion" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "[ERROR] Netlify CLI not found. Install with: npm install -g netlify-cli" -ForegroundColor Red
    Write-Host ""
    exit 1
}

Write-Host "Checking environment variables..." -ForegroundColor Yellow
Write-Host ""

# Required environment variables
$requiredVars = @{
    # Firebase Admin
    "FIREBASE_PROJECT_ID" = "Firebase project ID"
    "FIREBASE_CLIENT_EMAIL" = "Firebase service account email"
    "FIREBASE_PRIVATE_KEY" = "Firebase private key (should contain \\n)"
    
    # Twilio Core
    "TWILIO_ACCOUNT_SID" = "Twilio Account SID (starts with AC)"
    "TWILIO_AUTH_TOKEN" = "Twilio Auth Token"
    "TWILIO_SENDER_E164" = "Sender number (+233504541224)"
    
    # WhatsApp Templates
    "TWILIO_TEMPLATE_VOTER_INVITE" = "Template SID: HXa983202069576634425fcb660637bbf2"
    "TWILIO_TEMPLATE_VOTER_OTP" = "Template SID: HXb6fcfe35d3d99f6c5d25a451c2c4541"
    "TWILIO_TEMPLATE_EC_ACCESS" = "Template SID: HX1676adf374c6d631780eef257d7bb90"
    "TWILIO_TEMPLATE_ELECTION_APPROVED" = "Template SID: HXd063fa11220f698c13a45355a4ae322f6"
    "TWILIO_TEMPLATE_RESULTS_PUBLISHED" = "Template SID: HX45ced42e762375f8bad755c9ca7bb00e"
    
    # SMTP Email
    "SMTP_HOST" = "Email SMTP host"
    "SMTP_PORT" = "Email SMTP port (587)"
    "SMTP_USER" = "Email username"
    "SMTP_PASS" = "Email password/app password"
    "SMTP_FROM" = "From email address"
    
    # Application
    "APP_URL" = "Application URL (https://...netlify.app)"
}

# Get all environment variables
Write-Host "Fetching environment variables from Netlify..." -ForegroundColor Yellow
Write-Host ""
try {
    $envOutput = netlify env:list --json 2>&1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to fetch environment variables." -ForegroundColor Red
        Write-Host "        Make sure you're logged in: netlify login" -ForegroundColor Yellow
        Write-Host ""
        exit 1
    }
    
    $envData = $envOutput | ConvertFrom-Json
    
    $missing = @()
    $present = @()
    $warnings = @()
    
    foreach ($var in $requiredVars.Keys) {
        $found = $false
        $value = $null
        $contexts = @()
        
        foreach ($env in $envData) {
            if ($env.key -eq $var) {
                $found = $true
                $value = $env.value
                $contexts += $env.context -join ", "
            }
        }
        
        if ($found) {
            $present += $var
            
            # Validate specific formats
            $issue = $null
            
            if ($var -like "TWILIO_TEMPLATE_*" -and $value -notmatch '^HX[a-f0-9]{32}$') {
                $issue = "Invalid format (should be HX + 32 hex chars)"
            }
            elseif ($var -eq "TWILIO_ACCOUNT_SID" -and $value -notmatch '^AC[a-f0-9]{32}$') {
                $issue = "Invalid format (should be AC + 32 hex chars)"
            }
            elseif ($var -eq "TWILIO_SENDER_E164" -and $value -notmatch '^\+\d{10,15}$') {
                $issue = "Invalid format (should be +233...)"
            }
            elseif ($var -eq "FIREBASE_PRIVATE_KEY" -and $value -notlike "*BEGIN PRIVATE KEY*") {
                $issue = "Might be missing or incorrectly formatted"
            }
            elseif ($var -eq "APP_URL" -and $value -notmatch '^https?://') {
                $issue = "Should start with https://"
            }
            
            if ($issue) {
                Write-Host "  ⚠️  $var" -ForegroundColor Yellow
                Write-Host "      Issue: $issue" -ForegroundColor DarkYellow
                Write-Host "      Current: $($value.Substring(0, [Math]::Min(40, $value.Length)))..." -ForegroundColor Gray
                Write-Host "      Expected: $($requiredVars[$var])" -ForegroundColor Gray
                Write-Host "      Contexts: $($contexts -join ', ')`n" -ForegroundColor Gray
                $warnings += $var
            } else {
                Write-Host "  ✅ $var" -ForegroundColor Green
                Write-Host "      Value: $($value.Substring(0, [Math]::Min(40, $value.Length)))..." -ForegroundColor Gray
                Write-Host "      Contexts: $($contexts -join ', ')`n" -ForegroundColor Gray
            }
        } else {
            Write-Host "  ❌ $var - MISSING" -ForegroundColor Red
            Write-Host "      Expected: $($requiredVars[$var])`n" -ForegroundColor Gray
            $missing += $var
        }
    }
    
    # Summary
    Write-Host "`n=========================================" -ForegroundColor Cyan
    Write-Host "Summary" -ForegroundColor Cyan
    Write-Host "=========================================`n" -ForegroundColor Cyan
    
    Write-Host "✅ Present: $($present.Count)/$($requiredVars.Count)" -ForegroundColor Green
    Write-Host "⚠️  Warnings: $($warnings.Count)" -ForegroundColor Yellow
    Write-Host "❌ Missing: $($missing.Count)" -ForegroundColor Red
    
    if ($missing.Count -gt 0) {
        Write-Host "`n❌ Missing Variables:" -ForegroundColor Red
        foreach ($var in $missing) {
            Write-Host "   - $var" -ForegroundColor Red
        }
        Write-Host "`nSet missing variables with:" -ForegroundColor Yellow
        Write-Host "   netlify env:set VARIABLE_NAME 'value'" -ForegroundColor Gray
    }
    
    if ($warnings.Count -gt 0) {
        Write-Host "`n⚠️  Variables with Issues:" -ForegroundColor Yellow
        foreach ($var in $warnings) {
            Write-Host "   - $var" -ForegroundColor Yellow
        }
    }
    
    if ($missing.Count -eq 0 -and $warnings.Count -eq 0) {
        Write-Host "`n🎉 All environment variables are correctly configured!" -ForegroundColor Green
    }
    
    Write-Host "`n💡 Remember to:" -ForegroundColor Cyan
    Write-Host "   1. Set scope to 'All deploy contexts' for Firebase/Twilio vars" -ForegroundColor Gray
    Write-Host "   2. Redeploy after making changes" -ForegroundColor Gray
    Write-Host "   3. Check Netlify Dashboard for deploy logs`n" -ForegroundColor Gray
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    exit 1
}
