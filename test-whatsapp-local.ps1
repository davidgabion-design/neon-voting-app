param(
    [string]$Phone = ""
)

Set-StrictMode -Version Latest

# Test WhatsApp Function Locally
# Make sure to run 'netlify dev --port 8889' first in another terminal

Write-Host "Testing WhatsApp Function (New API)" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$baseUrl = "http://localhost:8889"  # Netlify Dev port
$endpoint = "/.netlify/functions/send-whatsapp"
$url = "$baseUrl$endpoint"

# Test phone number (replace with your actual WhatsApp number)
if ([string]::IsNullOrWhiteSpace($Phone)) {
    $Phone = Read-Host "Enter test WhatsApp phone number (E.164 format, e.g., +233501234567)"
}

if ([string]::IsNullOrWhiteSpace($Phone)) {
    Write-Host "Phone number required" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Testing with phone: $Phone" -ForegroundColor Yellow
Write-Host ""

# Test 1: Voter Invite Template
Write-Host "Test 1: Voter Invite Template" -ForegroundColor Green
Write-Host "------------------------------"

$invitePayload = @{
    type  = "invite"
    phone = $Phone
    data  = @{
        "1" = "John Doe"
        "2" = "https://vote.app/login?org=test123"
    }
    orgId = "test-org-123"
} | ConvertTo-Json

Write-Host "Payload:" -ForegroundColor Gray
Write-Host $invitePayload -ForegroundColor Gray
Write-Host ""

try {
    $params = @{ Uri = $url; Method = 'Post'; ContentType = 'application/json'; Body = $invitePayload; ErrorAction = 'Stop' }
    $response = Invoke-RestMethod @params
  
    Write-Host "SUCCESS" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    Write-Host ($response | ConvertTo-Json -Depth 5) -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "FAILED" -ForegroundColor Red
    Write-Host ("Error: {0}" -f $_.Exception.Message) -ForegroundColor Red
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__) {
        Write-Host ("Status: {0}" -f $_.Exception.Response.StatusCode.value__) -ForegroundColor Red
    }
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
        Write-Host ("Details: {0}" -f $_.ErrorDetails.Message) -ForegroundColor Red
    }
    Write-Host ""
}

# Test 2: OTP Template
Write-Host "Test 2: OTP Template" -ForegroundColor Green
Write-Host "--------------------"

$otpPayload = @{
    type  = "otp"
    phone = $Phone
    data  = @{
        "1" = "John Doe"
        "2" = "123456"
    }
    orgId = "test-org-123"
} | ConvertTo-Json

Write-Host "Payload:" -ForegroundColor Gray
Write-Host $otpPayload -ForegroundColor Gray
Write-Host ""

try {
    $params = @{ Uri = $url; Method = 'Post'; ContentType = 'application/json'; Body = $otpPayload; ErrorAction = 'Stop' }
    $response = Invoke-RestMethod @params
  
    Write-Host "SUCCESS" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Gray
    Write-Host ($response | ConvertTo-Json -Depth 5) -ForegroundColor Gray
    Write-Host ""
} catch {
    Write-Host "FAILED" -ForegroundColor Red
    Write-Host ("Error: {0}" -f $_.Exception.Message) -ForegroundColor Red
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode.value__) {
        Write-Host ("Status: {0}" -f $_.Exception.Response.StatusCode.value__) -ForegroundColor Red
    }
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
        Write-Host ("Details: {0}" -f $_.ErrorDetails.Message) -ForegroundColor Red
    }
    Write-Host ""
}

# Test 3: Invalid Type (should fail)
Write-Host "Test 3: Invalid Type (should fail gracefully)" -ForegroundColor Green
Write-Host "---------------------------------------------"

$invalidPayload = @{
    type  = "invalid_type"
    phone = $Phone
    data  = @{
        "1" = "Test"
    }
    orgId = "test-org-123"
} | ConvertTo-Json

try {
    $params = @{ Uri = $url; Method = 'Post'; ContentType = 'application/json'; Body = $invalidPayload; ErrorAction = 'Stop' }
    $response = Invoke-RestMethod @params
  
    Write-Host "WARNING: Should have failed but didn't" -ForegroundColor Yellow
} catch {
    Write-Host "Correctly rejected invalid type" -ForegroundColor Green
    Write-Host ("Error: {0}" -f $_.Exception.Message) -ForegroundColor Gray
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) {
        Write-Host ("Details: {0}" -f $_.ErrorDetails.Message) -ForegroundColor Gray
    }
    Write-Host ""
}

Write-Host ""
Write-Host "Testing Complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Tips:" -ForegroundColor Yellow
Write-Host "  - Check Firestore message_logs collection for logged messages" -ForegroundColor Gray
Write-Host "  - Check Twilio console for message delivery status" -ForegroundColor Gray
Write-Host "  - Valid types: otp, invite, results, ec, approved" -ForegroundColor Gray
