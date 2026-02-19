# 🚀 Neon Voting System - Notification API Integration Guide

## Overview

The Neon Voting System now uses a **unified notification service** with multi-channel delivery and automatic fallback.

**Channel Priority (Recommended):**
1. 📧 **Email** (Primary) - Reliable, low cost, detailed content
2. 💚 **WhatsApp** (Secondary) - High engagement, approved templates only
3. 📱 **SMS** (Emergency) - Universal fallback, higher cost

---

## 🎯 Available Notification Types

### 1. Voter Invite (`voter_invite`)
Sends secure voting link to voters when they are added to an election.

**Template Variables:**
- `voterName`: Voter's name
- `votingLink`: Secure URL to voting portal

### 2. Voter OTP (`voter_otp`)
Sends one-time password for voter authentication.

**Template Variables:**
- `otpCode`: 6-digit OTP code

### 3. EC Access (`ec_access`)
Sends login credentials to newly created Election Commissioners.

**Template Variables:**
- `ecName`: EC's name
- `loginLink`: URL to EC dashboard
- `password`: Initial password (email only)

### 4. Election Approved (`election_approved`)
Notifies EC when SuperAdmin approves their election.

**Template Variables:** None

### 5. Results Published (`results_published`)
Alerts voters/ECs when election results are available.

**Template Variables:** None

---

## 📞 API Endpoints

### Legacy Endpoints (Still Supported)
- `/.netlify/functions/send-email`
- `/.netlify/functions/send-sms`
- `/.netlify/functions/send-whatsapp`

### New Unified Endpoint (Recommended)
- `/.netlify/functions/send-notification`

---

## 🔧 How to Use: Frontend Integration

### Example 1: Send Voter Invite (Recommended Method)

```javascript
/**
 * Send voter invite using unified notification service
 * Automatically tries: Email → WhatsApp → SMS
 */
async function sendVoterInvite(voterEmail, voterPhone, voterName, orgId, orgName) {
  try {
    const response = await fetch('/.netlify/functions/send-notification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificationType: 'voter_invite',
        recipientEmail: voterEmail,
        recipientPhone: voterPhone,  // E.164 format: +233247654321
        recipientName: voterName,
        orgId: orgId,
        orgName: orgName,
        variables: {
          voterName: voterName,
          votingLink: `${window.location.origin}?role=voter&org=${orgId}`
        },
        channels: ['email', 'whatsapp', 'sms'] // Optional: default priority
      })
    });

    const result = await response.json();

    if (result.ok) {
      console.log(`✅ Invite sent via ${result.channel}`);
      showToast(`Invite sent to ${voterName} via ${result.channel}`, 'success');
      return { ok: true, channel: result.channel, sid: result.sid };
    } else {
      console.error('❌ All channels failed:', result.attempts);
      showToast('Failed to send invite. Please try again.', 'error');
      return { ok: false, error: result.error };
    }
  } catch (err) {
    console.error('Network error:', err);
    showToast('Network error. Check your connection.', 'error');
    return { ok: false, error: err.message };
  }
}
```

### Example 2: Force WhatsApp Only

```javascript
/**
 * Send voter OTP via WhatsApp only (no fallback)
 */
async function sendOTPWhatsApp(phone, otpCode, orgId) {
  const response = await fetch('/.netlify/functions/send-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      notificationType: 'voter_otp',
      recipientPhone: phone,
      orgId: orgId,
      variables: {
        otpCode: otpCode
      },
      forceChannel: 'whatsapp'  // Skip fallback, WhatsApp only
    })
  });

  return await response.json();
}
```

### Example 3: Send EC Access Credentials

```javascript
/**
 * Send EC login credentials via email (with WhatsApp/SMS fallback)
 */
async function sendECCredentials(ecEmail, ecPhone, ecName, orgId, orgName, password) {
  const response = await fetch('/.netlify/functions/send-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      notificationType: 'ec_access',
      recipientEmail: ecEmail,
      recipientPhone: ecPhone,
      recipientName: ecName,
      orgId: orgId,
      orgName: orgName,
      variables: {
        ecName: ecName,
        loginLink: `${window.location.origin}?role=ec&org=${orgId}`,
        password: password  // Only included in email, not WhatsApp/SMS
      }
    })
  });

  return await response.json();
}
```

### Example 4: Notify Election Approved

```javascript
/**
 * Notify EC when election is approved by SuperAdmin
 */
async function notifyElectionApproved(ecEmail, ecPhone, orgId, orgName) {
  const response = await fetch('/.netlify/functions/send-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      notificationType: 'election_approved',
      recipientEmail: ecEmail,
      recipientPhone: ecPhone,
      orgId: orgId,
      orgName: orgName,
      variables: {}  // This template has no variables
    })
  });

  return await response.json();
}
```

### Example 5: Legacy WhatsApp Direct (Deprecated)

```javascript
/**
 * ⚠️ LEGACY: Direct WhatsApp send (still supported but not recommended)
 * Use unified notification service instead for better reliability
 */
async function sendWhatsAppDirect(phone, templateType, variables, orgId) {
  const response = await fetch('/.netlify/functions/send-whatsapp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: phone,
      templateType: templateType,  // 'voter_invite', 'voter_otp', 'ec_access'
      templateVariables: variables,
      orgId: orgId
    })
  });

  return await response.json();
}
```

---

## 📝 Response Format

### Success Response
```json
{
  "ok": true,
  "channel": "whatsapp",
  "notificationType": "voter_invite",
  "provider": "twilio-whatsapp",
  "sid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "timestamp": "2026-02-13T10:30:00.000Z",
  "fallbackAttempts": 1
}
```

### Error Response
```json
{
  "ok": false,
  "error": "All notification channels failed",
  "attempts": [
    { "channel": "email", "ok": false, "error": "SMTP connection failed" },
    { "channel": "whatsapp", "ok": false, "error": "WhatsApp not configured" },
    { "channel": "sms", "ok": false, "error": "Invalid phone number" }
  ]
}
```

---

## 🔄 Updating Existing Code

### Before (Old Method)
```javascript
// Voters.js - Old voter invite flow
async function addVoterAndInvite(name, email, phone) {
  // ... add voter to Firestore ...
  
  // Send invite via email only
  const emailResponse = await fetch('/.netlify/functions/send-invite', {
    method: 'POST',
    body: JSON.stringify({
      to: email,
      recipientType: 'voter',
      orgName: orgName,
      orgId: orgId,
      credentials: { credential: email, type: 'email' }
    })
  });
  
  // Manually try WhatsApp if email fails
  if (!emailResponse.ok) {
    await fetch('/.netlify/functions/send-whatsapp', {
      method: 'POST',
      body: JSON.stringify({ to: phone, message: 'You are invited...' })
    });
  }
}
```

### After (New Method)
```javascript
// Voters.js - New voter invite flow with unified service
async function addVoterAndInvite(name, email, phone) {
  // ... add voter to Firestore ...
  
  // Send invite with automatic fallback
  const result = await fetch('/.netlify/functions/send-notification', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      notificationType: 'voter_invite',
      recipientEmail: email,
      recipientPhone: phone,
      recipientName: name,
      orgId: window.currentOrgId,
      orgName: window.currentOrgData?.name || 'Your Election',
      variables: {
        voterName: name,
        votingLink: `${window.location.origin}?role=voter&org=${window.currentOrgId}`
      }
    })
  });
  
  const response = await result.json();
  
  if (response.ok) {
    showToast(`✅ Invite sent to ${name} via ${response.channel}`, 'success');
  } else {
    showToast(`❌ Failed to send invite: ${response.error}`, 'error');
  }
}
```

---

## 🛡️ Best Practices

### 1. Always Provide Both Email and Phone
```javascript
// ✅ GOOD: Provides fallback options
{
  recipientEmail: 'voter@example.com',
  recipientPhone: '+233247654321',
  // ...
}

// ❌ BAD: Limited to one channel
{
  recipientEmail: 'voter@example.com',
  // No phone provided - can't fallback to WhatsApp/SMS
}
```

### 2. Use E.164 Phone Format
```javascript
// ✅ GOOD
recipientPhone: '+233247654321'  // International format with +

// ❌ BAD
recipientPhone: '0247654321'     // Local format without country code
recipientPhone: '233247654321'   // Missing + prefix
```

### 3. Provide Meaningful Variables
```javascript
// ✅ GOOD: Clear, complete variables
variables: {
  voterName: 'John Doe',
  votingLink: 'https://neonvotingsystem.netlify.app?role=voter&org=abc123&token=xyz'
}

// ❌ BAD: Generic or incomplete
variables: {
  voterName: 'Voter',
  votingLink: 'https://example.com'
}
```

### 4. Handle Errors Gracefully
```javascript
try {
  const response = await fetch('/.netlify/functions/send-notification', { ... });
  const result = await response.json();
  
  if (!result.ok) {
    console.error('Notification failed:', result.error);
    
    // Log to analytics/monitoring
    logError('notification_failed', {
      notificationType: 'voter_invite',
      error: result.error,
      attempts: result.attempts
    });
    
    // Show user-friendly message
    showToast('Unable to send invite. Please contact support.', 'error');
  }
} catch (err) {
  console.error('Network error:', err);
  showToast('Network error. Please check your connection.', 'error');
}
```

### 5. Log Successful Sends
```javascript
if (result.ok) {
  // Track delivery in your analytics
  analytics.track('notification_sent', {
    channel: result.channel,
    notificationType: result.notificationType,
    orgId: orgId,
    timestamp: result.timestamp
  });
  
  // Update UI
  showToast(`✅ Sent via ${result.channel}`, 'success');
}
```

---

## 📊 Monitoring & Logging

All messages are automatically logged to Firestore collection: `message_logs`

### Query Message Logs
```javascript
import { collection, query, where, getDocs } from 'firebase/firestore';

// Get all messages for an organization
const q = query(
  collection(db, 'message_logs'),
  where('orgId', '==', 'org123')
);
const snapshot = await getDocs(q);

snapshot.forEach(doc => {
  const log = doc.data();
  console.log(`${log.channel}: ${log.status} at ${log.sentAt}`);
});
```

### Dashboard Display
```javascript
// Example: Show recent notifications in admin dashboard
async function loadRecentNotifications(orgId) {
  const logs = await getDocs(
    query(
      collection(db, 'message_logs'),
      where('orgId', '==', orgId),
      orderBy('sentAt', 'desc'),
      limit(50)
    )
  );
  
  logs.forEach(doc => {
    const data = doc.data();
    displayNotification({
      channel: data.channel,
      type: data.notificationType,
      recipient: data.recipient,
      status: data.status,
      sentAt: data.sentAt.toDate()
    });
  });
}
```

---

## 🚨 Common Errors & Solutions

### Error: "Missing templateType or message"
**Solution**: Provide either `templateType` (recommended) or `message` (legacy)

### Error: "WhatsApp template not configured"
**Solution**: Check that `TWILIO_TEMPLATE_*` environment variables are set in Netlify

### Error: "SMTP not configured"
**Solution**: Verify `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` are set

### Error: "Invalid phone number format"
**Solution**: Use E.164 format with + prefix: `+233247654321`

### Error: "All notification channels failed"
**Solution**: Check Netlify function logs for specific channel failures

---

## 🎓 Migration Checklist

- [ ] Update voter invite flow to use `send-notification`
- [ ] Update OTP sending to use `send-notification`
- [ ] Update EC credential sending to use `send-notification`
- [ ] Add election approved notifications
- [ ] Add results published notifications
- [ ] Test email channel
- [ ] Test WhatsApp channel
- [ ] Test SMS fallback
- [ ] Verify Firestore logging working
- [ ] Update UI to show delivery channel
- [ ] Add retry logic for failed sends
- [ ] Set up monitoring dashboard

---

## 📞 Support

For issues with:
- **WhatsApp templates**: Check [WHATSAPP_SETUP_PRODUCTION.md](./WHATSAPP_SETUP_PRODUCTION.md)
- **Environment variables**: Check Netlify dashboard
- **Template SIDs**: Check Twilio Console → Messaging → Content Editor
- **Phone formats**: Use https://www.twilio.com/docs/glossary/what-e164

---

**✅ You're now ready to implement enterprise-level notifications!**
