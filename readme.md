# Neon Voting App

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/YOUR_USERNAME/voting-app)

## Quick Deploy

1. Click the "Deploy to Netlify" button above
2. Connect your GitHub repository
3. Set environment variables (SMTP/Twilio/Firebase, see below)
4. Deploy!

## Netlify Environment Setup

Run in your project root after `netlify init`:

```powershell
netlify env:set SMTP_HOST your-smtp-host
netlify env:set SMTP_PORT 587
netlify env:set SMTP_USER your-smtp-user
netlify env:set SMTP_PASS your-smtp-pass
netlify env:set SMTP_FROM noreply@yourdomain.com

netlify env:set TWILIO_ACCOUNT_SID your-sid
netlify env:set TWILIO_AUTH_TOKEN your-token
netlify env:set TWILIO_SMS_FROM +1XXXXXXXXXX

netlify env:set TWILIO_WHATSAPP_FROM whatsapp:+1XXXXXXXXXX
netlify env:set APP_URL https://your-app-name.netlify.app
```

## Local Development (Functions + Static Site)

```powershell
netlify login
netlify init
netlify dev
```

This serves the static site and runs serverless functions at `/.netlify/functions/*`. Use the EC dashboard to send invites (email/SMS) and verify provider responses.

## Firebase Configuration

- Edit [firebase-config.js](firebase-config.js) with your project values; `script.js` will prefer `window.firebaseConfig` if present.
- Firestore rules in [firestore.rules](firestore.rules) are development-permissive (read/write true). Tighten for production.

## Functions

- Email: [netlify/functions/send-invite.js](netlify/functions/send-invite.js), [netlify/functions/send-email.js](netlify/functions/send-email.js)
- SMS: [netlify/functions/send-invite-sms.js](netlify/functions/send-invite-sms.js), [netlify/functions/send-sms.js](netlify/functions/send-sms.js)
- WhatsApp: [netlify/functions/send-whatsapp.js](netlify/functions/send-whatsapp.js)
- Runtime check: [netlify/functions/test-runtime.js](netlify/functions/test-runtime.js)

## Triggering Invites

- From the EC dashboard in the app:
  - Send single email via `Send Invite`
  - Send SMS via `Send SMS Invite`
  - Use `Bulk Invite` to send multiple (100ms spacing)
  - Invites are recorded under `organizations/{orgId}/invites`

## Local Test Checklist (Invites)

1. Start local dev:

   ```powershell
   netlify dev
   ```

   This exposes functions at `http://localhost:8888/.netlify/functions/*`.

2. Seed Firestore (optional): open the app and run [firebase-setup.js](firebase-setup.js) in browser console to create `meta/superAdmin` and a test organization.

3. Test email function directly (PowerShell):

   ```powershell
   $body = {
     to = "recipient@example.com"
     recipientType = "voter"
     orgName = "Test Org"
     orgId = "test-org-123"
     recipientName = "Test Voter"
     credentials = @{ credential = "recipient@example.com"; type = "email" }
   } | ConvertTo-Json
   Invoke-RestMethod -Uri "http://localhost:8888/.netlify/functions/send-invite" -Method Post -ContentType "application/json" -Body $body
   ```

4. Test SMS function directly (PowerShell):

   ```powershell
   $body = {
     phone = "+1XXXXXXXXXX"
     message = "Test invite via SMS"
     recipientType = "voter"
     orgId = "test-org-123"
     recipientName = "Test Voter"
   } | ConvertTo-Json
   Invoke-RestMethod -Uri "http://localhost:8888/.netlify/functions/send-invite-sms" -Method Post -ContentType "application/json" -Body $body
   ```

5. End-to-end via UI:
   - Login as EC, add a voter, click `Send Invite` or `Send SMS Invite`.
   - Confirm toast success and a new document under `organizations/{orgId}/invites`.

6. Quick runtime check:
   ```powershell
   Invoke-RestMethod -Uri "http://localhost:8888/.netlify/functions/test-runtime" -Method Get
   ```

```

```
