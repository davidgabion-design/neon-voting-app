# Quick WhatsApp API Test
# Usage: .\test-whatsapp-quick.ps1 "+233501234567"

param(
    [Parameter(Mandatory=$true)]
    [string]$Phone
)

$url = "http://localhost:8889/.netlify/functions/send-whatsapp"

Write-Host "`n🧪 Testing WhatsApp Function (New API)" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test: Voter Invite
Write-Host "📱 Sending voter invite to: $Phone" -ForegroundColor Yellow

$payload = @{
    type = "invite"
    phone = $Phone
    data = @{
        "1" = "Test Voter"
        "2" = "https://vote.app/login?org=test123"
    }
    orgId = "test-org-local"
} | ConvertTo-Json

Write-Host "`nPayload:" -ForegroundColor Gray
Write-Host $payload -ForegroundColor DarkGray

try {
    $response = Invoke-RestMethod -Uri $url -Method Post `
        -ContentType "application/json" `
        -Body $payload `
        -ErrorAction Stop
    
    Write-Host "`n✅ SUCCESS!" -ForegroundColor Green
    Write-Host "`nResponse:" -ForegroundColor Gray
    Write-Host "  - Success: $($response.success)" -ForegroundColor White
    Write-Host "  - SID: $($response.sid)" -ForegroundColor White
    Write-Host "  - Status: $($response.status)" -ForegroundColor White
    Write-Host "  - Type: $($response.type)" -ForegroundColor White
    Write-Host "  - Timestamp: $($response.timestamp)" -ForegroundColor White
    
    Write-Host "`n💡 Check:" -ForegroundColor Yellow
    Write-Host "  - Your WhatsApp for the message" -ForegroundColor Gray
    Write-Host "  - Firestore message_logs collection" -ForegroundColor Gray
    Write-Host "  - Twilio console for delivery status`n" -ForegroundColor Gray
    
} catch {
    Write-Host "`n❌ FAILED" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)`n" -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        $errorObj = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "Details:" -ForegroundColor Gray
        Write-Host ($errorObj | ConvertTo-Json -Depth 5) -ForegroundColor DarkGray
        Write-Host ""
    }
}
