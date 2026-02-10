# WhatsApp Setup Guide

## Quick Fix

The error `"Twilio could not find a Channel with the specified From address"` means your **Twilio WhatsApp sandbox is not configured**.

### Option 1: Set Up Twilio WhatsApp Sandbox (Recommended for Testing)

1. **Go to Twilio Console**: https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn
2. **Join the Sandbox**: Send the join code to the Twilio WhatsApp number
3. **Get Your Sandbox Number**: Copy the number (e.g., `+1 415 523 8886`)
4. **Set Environment Variable**:

   ```bash
   # In your terminal (or add to .env file):
   netlify env:set TWILIO_WHATSAPP_FROM "whatsapp:+14155238886"
   ```

5. **Restart Netlify Dev**:
   ```bash
   netlify dev
   ```

### Option 2: Use Email or SMS Instead

If you don't need WhatsApp immediately:
- Click the **send button** dropdown on any voter
- Choose **Email** or **SMS** instead
- WhatsApp can be set up later

### Option 3: Get Approved WhatsApp Business Number (Production)

For production use with custom numbers:
1. Apply for WhatsApp Business API access in Twilio
2. Submit your business for approval
3. Get your approved "From" number
4. Set it: `netlify env:set TWILIO_WHATSAPP_FROM "whatsapp:+233XXXXXXXXX"`

## Current Environment Variables Needed

Check your Netlify environment variables:

```bash
netlify env:list
```

**Required for WhatsApp:**
- `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
- `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token
- `TWILIO_WHATSAPP_FROM` - Your WhatsApp-enabled number (format: `whatsapp:+14155238886`)

**Required for SMS:**
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_SMS_FROM` - Your SMS phone number (format: `+15017122661`)

**Required for Email:**
- `SMTP_HOST` - Your SMTP server
- `SMTP_PORT` - Usually 587 or 465
- `EMAIL_USER` - Your email username
- `EMAIL_PASS` - Your email password
- `SMTP_FROM` - Sender email address

## Testing WhatsApp

Once configured, test with:
1. Your own phone number first
2. Make sure you've joined the sandbox (if using sandbox)
3. Check phone number format is correct (+233...)

## Phone Number Formats Supported

The app automatically handles these formats:
- `+233247654381` ✅ (E.164 format - preferred)
- `0247654381` ✅ (Local Ghana format - auto-converts)
- `233247654381` ✅ (Country code without +)
- `+233 24 765 4381` ✅ (Spaces removed automatically)

All formats are converted to E.164 before sending to Twilio.
