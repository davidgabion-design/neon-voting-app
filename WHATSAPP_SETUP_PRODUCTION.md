# WhatsApp Business API - Environment Variables Setup

## 🔥 Production WhatsApp Configuration

Your WhatsApp Business API is now **fully approved and production-ready**.

### Required Environment Variables

Add these to your **Netlify Environment Variables**:

```bash
# ============================================
# TWILIO CREDENTIALS
# ============================================
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here

# ============================================
# SENDER (Production)
# ============================================
# Single canonical sender used for BOTH SMS + WhatsApp (E.164)
# WhatsApp sender is derived internally as: whatsapp:${TWILIO_SENDER_E164}
TWILIO_SENDER_E164=+233504541224

# ============================================
# WHATSAPP APPROVED TEMPLATE SIDs
# ============================================
# ✅ These are your real, approved Template SIDs from Twilio Console
# Find/verify in: Twilio Console → Messaging → Content Editor → Content

# Template: neon_voter_invite
# Variables: {{1}} = voterName, {{2}} = votingLink
TWILIO_TEMPLATE_VOTER_INVITE=HXa983202069576634425fcb660637bbf2

# Template: neon_voter_otp
# Variables: {{1}} = otpCode
TWILIO_TEMPLATE_VOTER_OTP=HXb6fcfe35d3d99f6c5d25a451c2c4541

# Template: neon_ec_access
# Variables: {{1}} = ecName, {{2}} = loginLink
TWILIO_TEMPLATE_EC_ACCESS=HX1676adf374c6d631780eef257d7bb90

# Template: neon_election_approved
# Variables: None
TWILIO_TEMPLATE_ELECTION_APPROVED=HXd063fa11220f698c13a45355a4ae322f6

# Template: neon_results_published
# Variables: None
TWILIO_TEMPLATE_RESULTS_PUBLISHED=HX45ced42e762375f8bad755c9ca7bb00e

# FIREBASE ADMIN (For Logging)
# ============================================
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# ============================================
# SMTP EMAIL (Primary Channel)
# ============================================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourdomain.com

# ============================================
# APPLICATION URL
# ============================================
APP_URL=https://neonvotingsystem.netlify.app
```

---

## 📋 How to Find Your Template Content SIDs

1. Go to [Twilio Console](https://console.twilio.com/)
2. Navigate to: **Messaging** → **Content Editor** → **Content**
3. Click on each template (e.g., `neon_voter_invite`)
4. Copy the **Content SID** (starts with `HX...`)
5. Add it to your Netlify environment variables

---

## 🚀 How to Set Environment Variables in Netlify

### Option 1: Netlify Dashboard (Recommended)
1. Go to: **Netlify Dashboard** → **Your Site** → **Site Settings**
2. Click: **Environment Variables** (under Build & Deploy)
3. Click: **Add a variable**
4. Add each variable with its value
5. Deploy your site

### Option 2: Netlify CLI
```bash
netlify env:set TWILIO_SENDER_E164 "+233504541224"
netlify env:set TWILIO_TEMPLATE_VOTER_INVITE "HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
# ... repeat for all variables
```

### Option 3: netlify.toml (NOT Recommended for secrets)
```toml
[build.environment]
  APP_URL = "https://neonvotingsystem.netlify.app"
  TWILIO_WHATSAPP_FROM = "whatsapp:+233504541224"
```

⚠️ **Security Warning**: Never commit sensitive credentials (Account SID, Auth Token, Private Keys) to your repository.

---

## 🧪 Testing Your Setup

### 1. Test WhatsApp Template Send

Use this cURL command to test:

```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/send-whatsapp \
  -H "Content-Type: application/json" \
  -d '{
    "type": "invite",
    "phone": "+233247654321",
    "data": {
      "1": "John Doe",
      "2": "https://neonvotingsystem.netlify.app?role=voter&org=test123"
    },
    "orgId": "test123"
  }'
```

### 2. Test Unified Notification Service

```bash
curl -X POST https://your-site.netlify.app/.netlify/functions/send-notification \\
  -H "Content-Type: application/json" \\
  -d '{
    "notificationType": "voter_invite",
    "recipientEmail": "voter@example.com",
    "recipientPhone": "+233247654321",
    "recipientName": "John Doe",
    "orgId": "test123",
    "orgName": "Test Organization",
    "variables": {
      "voterName": "John Doe",
      "votingLink": "https://neonvotingsystem.netlify.app?role=voter&org=test123"
    },
    "channels": ["email", "whatsapp", "sms"]
  }'
```

---

## ⚠️ Important Production Notes

### 1. WhatsApp Number Format
- **ALWAYS** use `whatsapp:` prefix for sender: `whatsapp:+233504541224`
- **ALWAYS** use full E.164 format: `+[country_code][number]`
- Example: `+233247654321` (NOT `0247654321`)

### 2. Templates Only (No Free Text)
- Production WhatsApp Business API **requires approved templates**
- You **cannot** send free text messages
- Always use `contentSid` with `contentVariables`

### 3. Template Variables
- Variables are numbered: `{{1}}`, `{{2}}`, `{{3}}`, etc.
- Must pass as JSON: `{"1": "John", "2": "https://..."}`
- Order matters! Match your approved template structure

### 4. Rate Limiting
Twilio has rate limits. Implement these safeguards:

```javascript
// Add to your functions
const RATE_LIMIT = 10; // messages per minute
let messageCount = 0;
let resetTime = Date.now() + 60000;

if (Date.now() > resetTime) {
  messageCount = 0;
  resetTime = Date.now() + 60000;
}

if (messageCount >= RATE_LIMIT) {
  return { statusCode: 429, body: 'Rate limit exceeded' };
}

messageCount++;
```

### 5. Cost Control
- **Email**: ~$0 (SMTP is free/cheap)
- **WhatsApp**: ~$0.005 - $0.02 per message (depending on country)
- **SMS**: ~$0.01 - $0.10 per message (depending on country)

**Recommendation**: Primary = Email, Secondary = WhatsApp, Emergency = SMS

---

## 🛡️ Security Best Practices

1. **Never** expose your `TWILIO_AUTH_TOKEN` in client-side code
2. **Always** validate requests in Netlify functions
3. **Store** message logs in Firestore for audit trail
4. **Implement** rate limiting to prevent abuse
5. **Use** environment variables (never hardcode credentials)
6. **Enable** Twilio webhook authentication
7. **Monitor** usage in Twilio Console regularly

---

## 📊 Message Logging Structure

All messages are logged to Firestore in the `message_logs` collection:

```javascript
{
  channel: 'whatsapp' | 'email' | 'sms',
  notificationType: 'voter_invite' | 'voter_otp' | 'ec_access' | 'election_approved' | 'results_published',
  provider: 'twilio-whatsapp' | 'email' | 'twilio-sms',
  orgId: 'org123',
  recipient: '+233247654321' or 'email@example.com',
  messageSid: 'SMxxxxxxxxxxxxxxxx' or 'HXxxxxxxxxxxxxxxxx',
  contentSid: 'HXxxxxxxxxxxxxxxxx', // WhatsApp template used
  status: 'sent' | 'delivered' | 'failed',
  sentAt: Timestamp,
  cost: 0.005, // Updated from Twilio webhook
  metadata: {
    voterName: 'John Doe',
    templateVariables: {...}
  }
}
```

---

## 🔧 Troubleshooting

### Error: "Missing Twilio configuration"
- Check that all environment variables are set in Netlify
- Verify no typos in variable names
- Redeploy your site after adding variables

### Error: "Invalid phone number format"
- Ensure phone number uses E.164 format: `+233247654321`
- Remove spaces, dashes, parentheses
- Always include country code

### Error: "WhatsApp not enabled for this number"
- Verify sender is: `whatsapp:+233504541224`
- Check that recipient has WhatsApp installed
- Ensure recipient has opted in (first message rule)

### Error: "Template not found"
- Verify Content SID is correct (starts with `HX...`)
- Check template is **approved** in Twilio Console
- Ensure template variables match your payload

### Error: "Content template not approved"
- Template must have status: **Approved** (green checkmark)
- Wait for Meta/WhatsApp approval (can take 24-48 hours)
- Double-check template is in **Production** (not sandbox)

---

## 📞 Support

- **Twilio Support**: https://support.twilio.com/
- **WhatsApp Business API Docs**: https://www.twilio.com/docs/whatsapp
- **Netlify Functions Docs**: https://docs.netlify.com/functions/overview/

---

## ✅ Production Readiness Checklist

- [ ] All environment variables set in Netlify
- [ ] WhatsApp sender uses `whatsapp:` prefix
- [ ] All 5 template Content SIDs added
- [ ] Templates show **Approved** status in Twilio Console
- [ ] Firebase Admin initialized for logging
- [ ] Rate limiting implemented
- [ ] Cost alerts configured in Twilio Console
- [ ] Test message sent successfully
- [ ] Message logging to Firestore working
- [ ] Email fallback tested
- [ ] SMS fallback tested
- [ ] Production deployment verified

---

**🎉 You're now running enterprise-level WhatsApp Business API messaging!**
