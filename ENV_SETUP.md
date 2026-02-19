# Environment Variables Setup Guide

## Required Variables for Neon Voting System

### 1. SMTP/Email Variables (for sending email invites)
```bash
netlify env:set SMTP_HOST "smtp.gmail.com"
netlify env:set EMAIL_USER "your-email@gmail.com"
netlify env:set EMAIL_PASS "your-app-password"
netlify env:set SMTP_FROM "your-email@gmail.com"
```

**How to get Gmail App Password:**
1. Go to Google Account → Security
2. Enable 2-Step Verification
3. Go to App Passwords
4. Generate password for "Mail"
5. Use that 16-character password

### 2. Twilio Variables (for SMS/WhatsApp)
```bash
netlify env:set TWILIO_ACCOUNT_SID "your-account-sid"
netlify env:set TWILIO_AUTH_TOKEN "your-auth-token"
# Single canonical sender for BOTH SMS + WhatsApp (E.164)
netlify env:set TWILIO_SENDER_E164 "+1234567890"
```

**Get Twilio credentials:**
1. Sign up at https://www.twilio.com
2. Get Account SID and Auth Token from dashboard
3. Get a Twilio phone number

### 3. App URL
```bash
netlify env:set APP_URL "https://neonvotingsystemz.netlify.app"
```

### 4. Add all at once (fill in your values):
```powershell
netlify env:set SMTP_HOST "smtp.gmail.com"
netlify env:set EMAIL_USER "YOUR_EMAIL"
netlify env:set EMAIL_PASS "YOUR_APP_PASSWORD"
netlify env:set SMTP_FROM "YOUR_EMAIL"
netlify env:set APP_URL "https://neonvotingsystemz.netlify.app"
netlify env:set TWILIO_ACCOUNT_SID "YOUR_SID"
netlify env:set TWILIO_AUTH_TOKEN "YOUR_TOKEN"
netlify env:set TWILIO_SENDER_E164 "+YOUR_TWILIO_NUMBER"
```

## After adding variables:
Run `netlify deploy --prod` to apply changes.
