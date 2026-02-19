# Netlify Environment Variables Setup Script
# Run this script to configure all WhatsApp Business API variables

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Neon Voting - WhatsApp Production Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if netlify CLI is installed
$netlifyInstalled = Get-Command netlify -ErrorAction SilentlyContinue
if (-not $netlifyInstalled) {
    Write-Host "❌ Netlify CLI not found. Installing..." -ForegroundColor Red
    npm install -g netlify-cli
}

Write-Host "✅ Netlify CLI detected" -ForegroundColor Green
Write-Host ""

# Prompt for Twilio credentials
Write-Host "📋 Enter your Twilio credentials:" -ForegroundColor Yellow
Write-Host ""

$accountSid = Read-Host "TWILIO_ACCOUNT_SID (starts with AC)"
$authToken = Read-Host "TWILIO_AUTH_TOKEN" -AsSecureString
$authTokenPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($authToken))

Write-Host ""
Write-Host "📱 WhatsApp Configuration:" -ForegroundColor Yellow
$senderE164 = Read-Host "TWILIO_SENDER_E164 (E.164 format: +233504541224)"

Write-Host ""
Write-Host "📄 WhatsApp Approved Template SIDs:" -ForegroundColor Yellow
Write-Host "   (Find these in: Twilio Console → Messaging → Content Editor)" -ForegroundColor Gray
Write-Host "   ✅ Press Enter to use default values (already configured)" -ForegroundColor Green
Write-Host ""

$voterInviteSid = Read-Host "Template: neon_voter_invite [HXa983202069576634425fcb660637bbf2]"
if (-not $voterInviteSid) { $voterInviteSid = "HXa983202069576634425fcb660637bbf2" }

$voterOtpSid = Read-Host "Template: neon_voter_otp [HXb6fcfe35d3d99f6c5d25a451c2c4541]"
if (-not $voterOtpSid) { $voterOtpSid = "HXb6fcfe35d3d99f6c5d25a451c2c4541" }

$ecAccessSid = Read-Host "Template: neon_ec_access [HX1676adf374c6d631780eef257d7bb90]"
if (-not $ecAccessSid) { $ecAccessSid = "HX1676adf374c6d631780eef257d7bb90" }

$electionApprovedSid = Read-Host "Template: neon_election_approved [HXd063fa11220f698c13a45355a4ae322f6]"
if (-not $electionApprovedSid) { $electionApprovedSid = "HXd063fa11220f698c13a45355a4ae322f6" }

$resultsPublishedSid = Read-Host "Template: neon_results_published [HX45ced42e762375f8bad755c9ca7bb00e]"
if (-not $resultsPublishedSid) { $resultsPublishedSid = "HX45ced42e762375f8bad755c9ca7bb00e" }

Write-Host ""
Write-Host "🔧 Setting environment variables in Netlify..." -ForegroundColor Cyan
Write-Host ""

# Set variables using Netlify CLI
try {
    netlify env:set TWILIO_ACCOUNT_SID $accountSid
    Write-Host "✅ TWILIO_ACCOUNT_SID set" -ForegroundColor Green
    
    netlify env:set TWILIO_AUTH_TOKEN $authTokenPlain
    Write-Host "✅ TWILIO_AUTH_TOKEN set" -ForegroundColor Green
    
    netlify env:set TWILIO_SENDER_E164 $senderE164
    Write-Host "✅ TWILIO_SENDER_E164 set" -ForegroundColor Green
    
    if ($voterInviteSid) {
        netlify env:set TWILIO_TEMPLATE_VOTER_INVITE $voterInviteSid
        Write-Host "✅ TWILIO_TEMPLATE_VOTER_INVITE set" -ForegroundColor Green
    }
    
    if ($voterOtpSid) {
        netlify env:set TWILIO_TEMPLATE_VOTER_OTP $voterOtpSid
        Write-Host "✅ TWILIO_TEMPLATE_VOTER_OTP set" -ForegroundColor Green
    }
    
    if ($ecAccessSid) {
        netlify env:set TWILIO_TEMPLATE_EC_ACCESS $ecAccessSid
        Write-Host "✅ TWILIO_TEMPLATE_EC_ACCESS set" -ForegroundColor Green
    }
    
    if ($electionApprovedSid) {
        netlify env:set TWILIO_TEMPLATE_ELECTION_APPROVED $electionApprovedSid
        Write-Host "✅ TWILIO_TEMPLATE_ELECTION_APPROVED set" -ForegroundColor Green
    }
    
    if ($resultsPublishedSid) {
        netlify env:set TWILIO_TEMPLATE_RESULTS_PUBLISHED $resultsPublishedSid
        Write-Host "✅ TWILIO_TEMPLATE_RESULTS_PUBLISHED set" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ ALL VARIABLES SET SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Next Steps:" -ForegroundColor Cyan
    Write-Host "1. Deploy your site: netlify deploy --prod" -ForegroundColor White
    Write-Host "2. Test WhatsApp send using the test script" -ForegroundColor White
    Write-Host "3. Check Firestore for message logs" -ForegroundColor White
    Write-Host ""
    Write-Host "📄 Documentation:" -ForegroundColor Cyan
    Write-Host "   - WHATSAPP_SETUP_PRODUCTION.md" -ForegroundColor White
    Write-Host "   - NOTIFICATION_API_GUIDE.md" -ForegroundColor White
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "❌ Error setting variables:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Tip: Make sure you're logged in to Netlify:" -ForegroundColor Yellow
    Write-Host "   netlify login" -ForegroundColor White
    Write-Host "   netlify link" -ForegroundColor White
}

# Clear sensitive data from memory
$authTokenPlain = $null
[System.GC]::Collect()
