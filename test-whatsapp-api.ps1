# Test WhatsApp Business API Setup
# This script tests your production WhatsApp configuration

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  WhatsApp Business API - Test Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get Netlify site URL
Write-Host "Enter your Netlify site URL:" -ForegroundColor Yellow
$siteUrl = Read-Host "(e.g., https://neonvotingsystem.netlify.app)"

if (-not $siteUrl) {
    $siteUrl = "https://neonvotingsystem.netlify.app"
    Write-Host "Using default: $siteUrl" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Enter test recipient phone number:" -ForegroundColor Yellow
$testPhone = Read-Host "(E.164 format, e.g., +233247654321)"

if (-not $testPhone) {
    Write-Host "❌ Phone number required" -ForegroundColor Red
    exit
}

Write-Host ""
Write-Host "Select test type:" -ForegroundColor Yellow
Write-Host "1. Voter Invite (neon_voter_invite) - HXa983202069576634425fcb660637bbf2" -ForegroundColor White
Write-Host "2. Voter OTP (neon_voter_otp) - HXb6fcfe35d3d99f6c5d25a451c2c4541" -ForegroundColor White
Write-Host "3. EC Access (neon_ec_access) - HX1676adf374c6d631780eef257d7bb90" -ForegroundColor White
Write-Host "4. Election Approved (neon_election_approved) - HXd063fa11220f698c13a45355a4ae322f6" -ForegroundColor White
Write-Host "5. Results Published (neon_results_published) - HX45ced42e762375f8bad755c9ca7bb00e" -ForegroundColor White
Write-Host "6. Test Unified Notification Service" -ForegroundColor Cyan
Write-Host ""
$testChoice = Read-Host "Choice (1-6)"

# Prepare test payload based on choice
$endpoint = ""
$payload = @{}

switch ($testChoice) {
    "1" {
        $endpoint = "send-whatsapp"
        $payload = @{
            type = "invite"
            phone = $testPhone
            data = @{
                "1" = "Test Voter"
                "2" = "$siteUrl?role=voter&org=test123"
            }
            orgId = "test123"
        }
        Write-Host "Testing: Voter Invite Template" -ForegroundColor Cyan
    }
    "2" {
        $endpoint = "send-whatsapp"
        $payload = @{
            type = "otp"
            phone = $testPhone
            data = @{
                "1" = "123456"
            }
            orgId = "test123"
        }
        Write-Host "Testing: Voter OTP Template" -ForegroundColor Cyan
    }
    "3" {
        $endpoint = "send-whatsapp"
        $payload = @{
            type = "ec"
            phone = $testPhone
            data = @{
                "1" = "Test EC"
                "2" = "$siteUrl?role=ec&org=test123"
            }
            orgId = "test123"
        }
        Write-Host "Testing: EC Access Template" -ForegroundColor Cyan
    }
    "4" {
        $endpoint = "send-whatsapp"
        $payload = @{
            type = "approved"
            phone = $testPhone
            data = @{}
            orgId = "test123"
        }
        Write-Host "Testing: Election Approved Template" -ForegroundColor Cyan
    }
    "5" {
        $endpoint = "send-whatsapp"
        $payload = @{
            type = "results"
            phone = $testPhone
            data = @{}
            orgId = "test123"
        }
        Write-Host "Testing: Results Published Template" -ForegroundColor Cyan
    }
    "6" {
        $endpoint = "send-notification"
        $payload = @{
            notificationType = "voter_invite"
            recipientPhone = $testPhone
            recipientName = "Test User"
            orgId = "test123"
            orgName = "Test Organization"
            variables = @{
                voterName = "Test User"
                votingLink = "$siteUrl?role=voter&org=test123"
            }
            channels = @("whatsapp", "sms")
        }
        Write-Host "Testing: Unified Notification Service" -ForegroundColor Cyan
    }
    default {
        Write-Host "❌ Invalid choice" -ForegroundColor Red
        exit
    }
}

# Convert payload to JSON
$jsonPayload = $payload | ConvertTo-Json -Depth 10

Write-Host ""
Write-Host "📤 Sending request to:" -ForegroundColor Yellow
Write-Host "$siteUrl/.netlify/functions/$endpoint" -ForegroundColor White
Write-Host ""
Write-Host "📋 Payload:" -ForegroundColor Yellow
Write-Host $jsonPayload -ForegroundColor Gray
Write-Host ""

# Send request
try {
    $response = Invoke-RestMethod `
        -Uri "$siteUrl/.netlify/functions/$endpoint" `
        -Method POST `
        -ContentType "application/json" `
        -Body $jsonPayload

    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  ✅ SUCCESS!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Response:" -ForegroundColor Cyan
    Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor White
    Write-Host ""
    
    if ($response.ok) {
        Write-Host "✅ Message sent successfully!" -ForegroundColor Green
        Write-Host "   Channel: $($response.channel)" -ForegroundColor White
        Write-Host "   SID: $($response.sid)" -ForegroundColor White
        Write-Host "   Provider: $($response.provider)" -ForegroundColor White
        Write-Host ""
        Write-Host "📱 Check your WhatsApp for the message!" -ForegroundColor Cyan
        Write-Host "🔍 Check Firestore 'message_logs' collection for delivery record" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Message failed" -ForegroundColor Red
        Write-Host "   Error: $($response.error)" -ForegroundColor Red
    }
    
} catch {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "  ❌ ERROR" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 Troubleshooting:" -ForegroundColor Yellow
    Write-Host "   1. Verify environment variables are set in Netlify" -ForegroundColor White
    Write-Host "   2. Check Template SIDs are correct (Twilio Console)" -ForegroundColor White
    Write-Host "   3. Ensure phone number is in E.164 format (+233...)" -ForegroundColor White
    Write-Host "   4. Verify templates are APPROVED in Twilio Console" -ForegroundColor White
    Write-Host "   5. Check Netlify function logs for details" -ForegroundColor White
    Write-Host ""
    Write-Host "📄 See: WHATSAPP_SETUP_PRODUCTION.md" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
