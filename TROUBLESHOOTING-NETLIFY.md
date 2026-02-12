# Troubleshooting Netlify Functions (Email & WhatsApp)

## ✅ What to Check in Netlify Dashboard

### 1. Environment Variables Scope
**Go to:** Site settings → Environment variables

Check that EACH variable has the right scope:
- ❌ NOT just "Dev" 
- ✅ Select "Production" or "All contexts"

**Critical Variables:**
```
TWILIO_ACCOUNT_SID → Production ✓
TWILIO_AUTH_TOKEN → Production ✓
TWILIO_SMS_FROM → Production ✓
TWILIO_WHATSAPP_FROM → Production ✓
SMTP_HOST → Production ✓
SMTP_PORT → Production ✓
SMTP_USER → Production ✓
SMTP_PASS → Production ✓
SMTP_FROM → Production ✓
```

### 2. Check Function Logs
**Go to:** Functions → Logs

Look for errors:
- "Missing environment variable"
- "TWILIO_xxx is undefined"
- "SMTP authentication failed"
- "Network timeout"

### 3. WhatsApp Specific Issues

**Problem:** Twilio Sandbox might not work in production

**Fix:** Add your production domain to Twilio:
1. Go to: https://console.twilio.com/us1/develop/sms/settings/whatsapp-sandbox
2. Click "Sandbox Configuration"
3. Add your Netlify domain: `https://neonvotingsystem.netlify.app`

### 4. Email/SMTP Issues

**Problem:** Gmail might block Netlify server IPs

**Check:**
1. Go to: https://myaccount.google.com/security
2. Check for "Blocked sign-in attempt" notifications
3. If blocked, allow "Less secure app access" OR
4. Verify the app password is still valid

### 5. Test Functions Directly

Test your functions via URL:

**WhatsApp:**
```bash
curl -X POST https://neonvotingsystem.netlify.app/.netlify/functions/send-whatsapp \
  -H "Content-Type: application/json" \
  -d '{"to":"+233247654381","message":"Test","voterName":"Test","voterPin":"1234","orgId":"test"}'
```

**Email:**
```bash
curl -X POST https://neonvotingsystem.netlify.app/.netlify/functions/send-email \
  -H "Content-Type: application/json" \
  -d '{"to":"test@example.com","subject":"Test","message":"Test message"}'
```

### 6. Redeploy After Fixing

After making changes:
1. Go to: Deploys
2. Click "Trigger deploy" → "Deploy site"
3. Wait for deployment to complete
4. Test again

## 🔍 Quick Diagnostic Commands

Run these in browser console on your live site:

```javascript
// Test WhatsApp function
fetch('/.netlify/functions/send-whatsapp', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    to: '+233247654381',
    message: 'Test from production',
    voterName: 'Test',
    voterPin: '1234',
    orgId: 'test'
  })
}).then(r => r.json()).then(console.log).catch(console.error);

// Test Email function
fetch('/.netlify/functions/send-invite', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    to: 'gabiondavidselorm@gmail.com',
    recipientType: 'ec',
    orgName: 'Test Org',
    orgId: 'test-123',
    credentials: {password: 'test123'},
    recipientName: 'Test User'
  })
}).then(r => r.json()).then(console.log).catch(console.error);
```

## 📝 Most Likely Solution

**Environment Variable Scopes are set to "Dev" only**

1. Go to Site settings → Environment variables
2. For EACH variable, click the "⋮" menu
3. Click "Edit"
4. Under "Scopes", select **"Production"** or **"All"**
5. Click "Save"
6. Redeploy site

This is the #1 cause of "works locally but not in production"!
