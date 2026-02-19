# ✅ Twilio WhatsApp Template SIDs - Production

## Your Approved Template SIDs (from Twilio Console)

These are the **real Content SIDs** from your Twilio WhatsApp Business API account.

---

## 📋 Template Configuration

### 1. neon_voter_invite
**Purpose:** Send secure voting link to voters  
**Template SID:** `HXa983202069576634425fcb660637bbf2`  
**Variables:**
- `{{1}}` = Voter Name
- `{{2}}` = Voting Link

**Example:**
```javascript
contentSid: "HXa983202069576634425fcb660637bbf2",
contentVariables: JSON.stringify({
  "1": "John Doe",
  "2": "https://neonvotingsystem.netlify.app?role=voter&org=abc123"
})
```

---

### 2. neon_voter_otp
**Purpose:** Send one-time password for voter authentication  
**Template SID:** `HXb6fcfe35d3d99f6c5d25a451c2c4541`  
**Variables:**
- `{{1}}` = OTP Code

**Example:**
```javascript
contentSid: "HXb6fcfe35d3d99f6c5d25a451c2c4541",
contentVariables: JSON.stringify({
  "1": "123456"
})
```

---

### 3. neon_ec_access
**Purpose:** Send EC login credentials  
**Template SID:** `HX1676adf374c6d631780eef257d7bb90`  
**Variables:**
- `{{1}}` = EC Name
- `{{2}}` = Login Link

**Example:**
```javascript
contentSid: "HX1676adf374c6d631780eef257d7bb90",
contentVariables: JSON.stringify({
  "1": "Alice Johnson",
  "2": "https://neonvotingsystem.netlify.app?role=ec&org=abc123"
})
```

---

### 4. neon_election_approved
**Purpose:** Notify EC when election is approved by Super Admin  
**Template SID:** `HXd063fa11220f698c13a45355a4ae322f6`  
**Variables:** None

**Example:**
```javascript
contentSid: "HXd063fa11220f698c13a45355a4ae322f6"
// No contentVariables needed
```

---

### 5. neon_results_published
**Purpose:** Alert voters/ECs when results are available  
**Template SID:** `HX45ced42e762375f8bad755c9ca7bb00e`  
**Variables:** None

**Example:**
```javascript
contentSid: "HX45ced42e762375f8bad755c9ca7bb00e"
// No contentVariables needed
```

---

## 🔧 Environment Variables for Netlify

Add these to **Netlify Dashboard → Site Settings → Environment Variables**:

```bash
# Single sender number used for BOTH SMS + WhatsApp (E.164)
TWILIO_SENDER_E164=+233504541224

# Template SIDs
TWILIO_TEMPLATE_VOTER_INVITE=HXa983202069576634425fcb660637bbf2
TWILIO_TEMPLATE_VOTER_OTP=HXb6fcfe35d3d99f6c5d25a451c2c4541
TWILIO_TEMPLATE_EC_ACCESS=HX1676adf374c6d631780eef257d7bb90
TWILIO_TEMPLATE_ELECTION_APPROVED=HXd063fa11220f698c13a45355a4ae322f6
TWILIO_TEMPLATE_RESULTS_PUBLISHED=HX45ced42e762375f8bad755c9ca7bb00e
```

---

## 📞 Usage in Your Code

### Example 1: Send Voter Invite via WhatsApp

```javascript
const response = await fetch('/.netlify/functions/send-whatsapp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: '+233247654321',
    templateType: 'voter_invite',
    templateVariables: {
      voterName: 'John Doe',
      votingLink: 'https://neonvotingsystem.netlify.app?role=voter&org=abc123'
    },
    orgId: 'abc123'
  })
});

const result = await response.json();
console.log(result.sid); // Message SID
```

### Example 2: Send OTP via WhatsApp

```javascript
const response = await fetch('/.netlify/functions/send-whatsapp', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    to: '+233247654321',
    templateType: 'voter_otp',
    templateVariables: {
      otpCode: '123456'
    },
    orgId: 'abc123'
  })
});
```

### Example 3: Send EC Access via Unified Service

```javascript
const response = await fetch('/.netlify/functions/send-notification', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    notificationType: 'ec_access',
    recipientEmail: 'ec@example.com',
    recipientPhone: '+233247654321',
    recipientName: 'Alice Johnson',
    orgId: 'abc123',
    orgName: 'Test Organization',
    variables: {
      ecName: 'Alice Johnson',
      loginLink: 'https://neonvotingsystem.netlify.app?role=ec&org=abc123',
      password: 'temp123'
    },
    channels: ['email', 'whatsapp', 'sms']
  })
});
```

---

## ✅ Quick Test Script

Test all templates instantly:

```powershell
# Test voter invite
curl -X POST https://your-site.netlify.app/.netlify/functions/send-whatsapp `
  -H "Content-Type: application/json" `
  -d '{
    "to": "+233247654321",
    "templateType": "voter_invite",
    "templateVariables": {
      "voterName": "Test User",
      "votingLink": "https://neonvotingsystem.netlify.app?test=true"
    },
    "orgId": "test123"
  }'
```

Or use the provided script:
```powershell
.\test-whatsapp-api.ps1
```

---

## 🚨 Important Reminders

1. **Always use `contentSid`** - Never use `body` for production WhatsApp
2. **Variables start at {{1}}** - Not {{0}}
3. **Phone format**: E.164 with `+` prefix: `+233247654321`
4. **WhatsApp prefix**: Sender must be `whatsapp:+233504541224`
5. **Templates must be APPROVED** - Check Twilio Console for green checkmark

---

## 🔍 Verify Template Status

Go to: [Twilio Console](https://console.twilio.com/) → **Messaging** → **Content Editor** → **Content**

Each template should show:
- ✅ **Status: Approved** (green checkmark)
- 📱 **WhatsApp Business API Initiated** (active)

---

## 📊 Cost Tracking

Monitor your WhatsApp usage:
- [Twilio Usage Dashboard](https://console.twilio.com/us1/monitor/logs/messages)
- Check Firestore collection: `message_logs`
- Set up cost alerts in Twilio Console

---

## 🆘 Troubleshooting

| Issue | Solution |
|-------|----------|
| Template not found | Verify Content SID is correct (copy from Twilio Console) |
| Variables not populating | Check variable order: `{{1}}`, `{{2}}` match your JSON keys |
| Message fails | Ensure template status is "Approved" (not pending) |
| Wrong format error | Use E.164 phone format: `+233247654321` |

---

**✅ Your templates are now configured and ready for production use!**

Save this file for quick reference when setting up new environments or debugging.
