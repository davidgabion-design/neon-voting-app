/**
 * Unified Notification Service for Neon Voting System
 * 
 * This function provides multi-channel messaging with automatic fallback:
 * Primary → Email (secure, reliable, low cost)
 * Secondary → WhatsApp (approved templates only)
 * Tertiary → SMS (emergency fallback)
 * 
 * Production-Ready WhatsApp Business API Integration
 * Uses approved Content SIDs from Twilio WhatsApp Business API
 */

const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const twilio = require('twilio');
const {
  getSmtpConfig,
  getAppUrl,
  getTwilioAuth,
  getTwilioFromSms,
  getTwilioFromWhatsapp,
  getTwilioTemplateSids,
  getTwilioStatusCallbackUrl,
  normalizeE164
} = require('./_shared/env');

// Initialize Firebase Admin
if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      console.error('Missing Firebase Admin environment variables');
    } else {
      privateKey = privateKey.replace(/\\n/g, '\n');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });

      console.log('Firebase Admin initialized successfully');
    }
  } catch (err) {
    console.error('Firebase Admin initialization failed:', err);
  }
}

// ✅ WhatsApp Approved Templates (Production)
// NOTE: Content SIDs are configured via environment variables (no hardcoded defaults)
const WHATSAPP_TEMPLATE_META = {
  voter_invite: {
    name: 'neon_voter_invite',
    env: 'TWILIO_TEMPLATE_VOTER_INVITE',
    variables: ['voterName', 'votingLink']
  },
  voter_otp: {
    name: 'neon_voter_otp',
    env: 'TWILIO_TEMPLATE_VOTER_OTP',
    variables: ['otpCode']
  },
  ec_access: {
    name: 'neon_ec_access',
    env: 'TWILIO_TEMPLATE_EC_ACCESS',
    variables: ['ecName', 'loginLink']
  },
  election_approved: {
    name: 'neon_election_approved',
    env: 'TWILIO_TEMPLATE_ELECTION_APPROVED',
    variables: []
  },
  results_published: {
    name: 'neon_results_published',
    env: 'TWILIO_TEMPLATE_RESULTS_PUBLISHED',
    variables: []
  }
};

/**
 * Main handler
 */
exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ok: false, error: "POST only" })
    };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (err) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ok: false, error: "Invalid JSON" })
    };
  }

  const {
    notificationType,    // 'voter_invite', 'voter_otp', 'ec_access', 'election_approved', 'results_published'
    recipientEmail,      // Email address
    recipientPhone,      // Phone number (E.164 format: +233...)
    recipientName,       // Recipient name
    orgId,               // Organization ID
    orgName,             // Organization name
    variables,           // Template variables (voterName, votingLink, otpCode, etc.)
    channels,            // ['email', 'whatsapp', 'sms'] - order determines priority
    forceChannel         // Optional: force specific channel (skip fallback)
  } = body;

  // Validation
  if (!notificationType) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ok: false, error: "Missing notificationType" })
    };
  }

  if (!recipientEmail && !recipientPhone) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ok: false, error: "Missing recipientEmail or recipientPhone" })
    };
  }

  // Default channel priority: Email → WhatsApp → SMS
  const channelPriority = channels || ['email', 'whatsapp', 'sms'];
  const results = [];

  // Try each channel in order until one succeeds
  for (const channel of channelPriority) {
    if (forceChannel && channel !== forceChannel) continue;

    let result = null;

    try {
      if (channel === 'email' && recipientEmail) {
        result = await sendEmail(notificationType, recipientEmail, recipientName, orgId, orgName, variables);
      } else if (channel === 'whatsapp' && recipientPhone) {
        result = await sendWhatsApp(notificationType, recipientPhone, recipientName, orgId, variables);
      } else if (channel === 'sms' && recipientPhone) {
        result = await sendSMS(notificationType, recipientPhone, recipientName, orgId, variables);
      }

      if (result && result.ok) {
        // Success! Log and return
        await logNotification(channel, notificationType, orgId, recipientEmail || recipientPhone, result);
        
        return {
          statusCode: 200,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            ok: true,
            channel: channel,
            notificationType: notificationType,
            provider: result.provider,
            sid: result.sid,
            timestamp: new Date().toISOString(),
            fallbackAttempts: results.length
          })
        };
      } else {
        results.push({ channel, ok: false, error: result?.error || 'Unknown error' });
      }
    } catch (err) {
      results.push({ channel, ok: false, error: err.message });
    }
  }

  // All channels failed
  return {
    statusCode: 500,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      ok: false,
      error: "All notification channels failed",
      attempts: results
    })
  };
};

/**
 * Send Email
 */
async function sendEmail(notificationType, recipientEmail, recipientName, orgId, orgName, variables) {
  let smtp;
  let appUrl;
  try {
    smtp = getSmtpConfig();
    appUrl = getAppUrl();
  } catch {
    return { ok: false, error: 'SMTP not configured' };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: false,
    auth: { user: smtp.user, pass: smtp.pass }
  });
  let subject, html;

  switch (notificationType) {
    case 'voter_invite':
      subject = `🗳️ Neon Voting - ${orgName} Election Invitation`;
      html = generateVoterInviteEmail(recipientName, orgName, orgId, variables.votingLink || `${appUrl}?role=voter&org=${orgId}`);
      break;

    case 'voter_otp':
      subject = `🔐 Your Neon Voting OTP Code`;
      html = generateOTPEmail(variables.otpCode);
      break;

    case 'ec_access':
      subject = `🔑 Neon Voting - EC Access for ${orgName}`;
      html = generateECAccessEmail(recipientName, orgName, orgId, variables.loginLink || `${appUrl}?role=ec&org=${orgId}`, variables.password);
      break;

    case 'election_approved':
      subject = `✅ Election Approved - ${orgName}`;
      html = generateElectionApprovedEmail(orgName);
      break;

    case 'results_published':
      subject = `📊 Election Results Published - ${orgName}`;
      html = generateResultsPublishedEmail(orgName, orgId, appUrl);
      break;

    case 'election_rejected':
      subject = `❌ Election Returned for Correction - ${orgName}`;
      html = generateElectionRejectedEmail(recipientName, orgName, variables.rejectionReason, appUrl);
      break;

    case 'voting_reminder':
      subject = `⏰ Voting Reminder - ${orgName}`;
      html = generateVotingReminderEmail(recipientName, orgName, orgId, variables.votingLink || `${appUrl}?role=voter&org=${orgId}`, 'reminder');
      break;

    case 'voting_open':
      subject = `🗳️ Voting Is Now Open! - ${orgName}`;
      html = generateVotingReminderEmail(recipientName, orgName, orgId, variables.votingLink || `${appUrl}?role=voter&org=${orgId}`, 'open');
      break;

    default:
      return { ok: false, error: 'Unknown notification type' };
  }

  try {
    const info = await transporter.sendMail({
      from: `"Neon Voting System" <${smtp.from}>`,
      to: recipientEmail,
      subject,
      html
    });

    return { ok: true, provider: 'email', messageId: info.messageId };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Send WhatsApp (using approved templates)
 */
async function sendWhatsApp(notificationType, recipientPhone, recipientName, orgId, variables) {
  const templateMeta = WHATSAPP_TEMPLATE_META[notificationType];
  if (!templateMeta) {
    return { ok: false, error: 'WhatsApp template not configured for this notification type' };
  }

  let accountSid;
  let authToken;
  let formattedFrom;
  let formattedTo;
  let contentSid;
  try {
    ({ accountSid, authToken } = getTwilioAuth());
    formattedFrom = getTwilioFromWhatsapp();
    const toE164 = normalizeE164(recipientPhone, { fieldName: 'recipientPhone', allowWhatsappPrefix: true });
    formattedTo = `whatsapp:${toE164}`;
    const sids = getTwilioTemplateSids();
    contentSid = sids[templateMeta.env];
  } catch (envErr) {
    return { ok: false, error: envErr.message };
  }

  const client = twilio(accountSid, authToken);

  // Map variables to template positions {{1}}, {{2}}, etc.
  const contentVariables = {};
  if (templateMeta.variables && templateMeta.variables.length > 0) {
    templateMeta.variables.forEach((varName, index) => {
      contentVariables[(index + 1).toString()] = variables[varName] || '';
    });
  }

  try {
    const msg = await client.messages.create({
      from: formattedFrom,
      to: formattedTo,
      contentSid,
      contentVariables: templateMeta.variables.length > 0 ? JSON.stringify(contentVariables) : undefined,
      statusCallback: getTwilioStatusCallbackUrl()
    });

    return { ok: true, provider: 'whatsapp', sid: msg.sid };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Send SMS (emergency fallback)
 */
async function sendSMS(notificationType, recipientPhone, recipientName, orgId, variables) {
  let accountSid;
  let authToken;
  let smsFrom;
  let toE164;
  try {
    ({ accountSid, authToken } = getTwilioAuth());
    smsFrom = getTwilioFromSms();
    toE164 = normalizeE164(recipientPhone, { fieldName: 'recipientPhone', allowWhatsappPrefix: true });
  } catch (envErr) {
    return { ok: false, error: envErr.message };
  }

  const client = twilio(accountSid, authToken);

  let messageText;
  switch (notificationType) {
    case 'voter_invite':
      messageText = `Hello ${recipientName}! You're invited to vote. Visit: ${variables.votingLink}`;
      break;
    case 'voter_otp':
      messageText = `Your Neon Voting OTP: ${variables.otpCode}. Valid for 5 minutes.`;
      break;
    case 'ec_access':
      messageText = `Hello ${recipientName}! You're now an Election Commissioner. Login: ${variables.loginLink}`;
      break;
    default:
      messageText = `Neon Voting System notification. Check your email for details.`;
  }

  try {
    const msg = await client.messages.create({
      from: smsFrom,
      to: toE164,
      body: messageText
    });

    return { ok: true, provider: 'sms', sid: msg.sid };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Log notification to Firestore
 */
async function logNotification(channel, notificationType, orgId, recipient, result) {
  if (!admin.apps.length || !orgId) return;

  try {
    await admin.firestore().collection('message_logs').add({
      channel: channel,
      notificationType: notificationType,
      provider: result.provider,
      orgId: orgId,
      recipient: recipient,
      messageSid: result.sid || result.messageId,
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'sent',
      cost: null // Update later from Twilio webhook
    });
  } catch (err) {
    console.error('Failed to log notification:', err);
  }
}

/**
 * Email Templates — Dark Neon Theme
 * All templates use a deep dark background (#050816) with neon cyan/purple/green accents,
 * glowing box shadows, and high-contrast text so they render well across all email clients.
 */

/** Shared wrapper — dark full-page background */
function wrapEmail(innerHtml, accentColor = '#00C3FF') {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#050816;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050816;min-height:100vh;">
    <tr>
      <td align="center" style="padding:30px 16px;">
        <!-- Card -->
        <table width="100%" style="max-width:600px;background:#0a0f2e;border-radius:14px;border:1px solid ${accentColor};box-shadow:0 0 40px rgba(0,195,255,0.12),0 0 80px rgba(0,0,0,0.6);overflow:hidden;" cellpadding="0" cellspacing="0">
          <!-- Top accent bar -->
          <tr><td style="height:4px;background:linear-gradient(90deg,${accentColor},#9D00FF,${accentColor});"></td></tr>
          <!-- Body -->
          <tr><td style="padding:32px 36px 28px;">
            ${innerHtml}
          </td></tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 36px 20px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
              <p style="margin:0;font-size:11px;color:#3a4a6b;letter-spacing:0.5px;">
                Neon Voting System &nbsp;|&nbsp; Secure Digital Elections
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function generateVoterInviteEmail(name, orgName, orgId, votingLink) {
  const inner = `
    <!-- Header -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:rgba(0,195,255,0.08);border:1px solid rgba(0,195,255,0.25);border-radius:50%;width:64px;height:64px;line-height:64px;font-size:30px;margin-bottom:12px;">🗳️</div>
      <h1 style="margin:0;font-size:26px;font-weight:700;color:#00C3FF;letter-spacing:1px;text-shadow:0 0 20px rgba(0,195,255,0.5);">
        You're Invited to Vote!
      </h1>
      <p style="margin:6px 0 0;color:#5a7a9a;font-size:13px;letter-spacing:0.5px;">NEON VOTING SYSTEM</p>
    </div>

    <!-- Greeting -->
    <p style="margin:0 0 8px;font-size:16px;color:#c8e0f0;">Hello, <span style="color:#00ffaa;font-weight:700;">${name}</span></p>
    <p style="margin:0 0 24px;font-size:15px;color:#8aaec8;line-height:1.6;">
      You have been registered as an eligible voter for the
      <strong style="color:#ffffff;">${orgName}</strong> election.
      Your participation matters — cast your vote today!
    </p>

    <!-- Org ID badge -->
    <div style="background:rgba(0,0,0,0.35);border:1px solid rgba(0,195,255,0.15);border-radius:8px;padding:12px 16px;margin-bottom:24px;">
      <span style="font-size:11px;color:#3a5a7a;text-transform:uppercase;letter-spacing:1px;">Organisation ID</span><br>
      <span style="font-size:15px;color:#00C3FF;font-family:monospace;letter-spacing:2px;">${orgId}</span>
    </div>

    <!-- CTA Button -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${votingLink}"
         style="display:inline-block;background:linear-gradient(135deg,#00C3FF 0%,#00ffaa 100%);color:#050816;padding:14px 36px;border-radius:30px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.5px;box-shadow:0 0 24px rgba(0,195,255,0.45);">
        ➜ &nbsp; Go to Voting Portal
      </a>
    </div>

    <!-- Note -->
    <p style="margin:0;font-size:12px;color:#2a3a5a;text-align:center;line-height:1.6;">
      If the button doesn't work, copy this link into your browser:<br>
      <a href="${votingLink}" style="color:#006080;word-break:break-all;">${votingLink}</a>
    </p>
  `;
  return wrapEmail(inner, '#00C3FF');
}

function generateOTPEmail(otpCode) {
  const inner = `
    <!-- Header -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:rgba(157,0,255,0.1);border:1px solid rgba(157,0,255,0.3);border-radius:50%;width:64px;height:64px;line-height:64px;font-size:30px;margin-bottom:12px;">🔐</div>
      <h1 style="margin:0;font-size:24px;font-weight:700;color:#be6cff;letter-spacing:1px;text-shadow:0 0 20px rgba(157,0,255,0.5);">
        Verification Code
      </h1>
      <p style="margin:6px 0 0;color:#5a4a7a;font-size:13px;letter-spacing:0.5px;">NEON VOTING SYSTEM</p>
    </div>

    <p style="margin:0 0 24px;font-size:15px;color:#8aaec8;line-height:1.6;text-align:center;">
      Use the code below to complete your login. Do not share it with anyone.
    </p>

    <!-- OTP Display -->
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:rgba(0,0,0,0.45);border:2px solid rgba(157,0,255,0.5);border-radius:12px;padding:20px 40px;box-shadow:0 0 30px rgba(157,0,255,0.25);">
        <span style="font-size:42px;font-weight:700;color:#00ffaa;letter-spacing:10px;font-family:monospace;">${otpCode}</span>
      </div>
    </div>

    <!-- Expiry warning -->
    <div style="background:rgba(255,170,0,0.07);border:1px solid rgba(255,170,0,0.2);border-radius:8px;padding:12px 16px;text-align:center;">
      <span style="font-size:13px;color:#ffaa00;">⏱ This code expires in <strong>5 minutes</strong></span>
    </div>
  `;
  return wrapEmail(inner, '#9D00FF');
}

function generateECAccessEmail(name, orgName, orgId, loginLink, password) {
  const inner = `
    <!-- Header -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:rgba(157,0,255,0.1);border:1px solid rgba(157,0,255,0.3);border-radius:50%;width:64px;height:64px;line-height:64px;font-size:30px;margin-bottom:12px;">🔑</div>
      <h1 style="margin:0;font-size:24px;font-weight:700;color:#be6cff;letter-spacing:1px;text-shadow:0 0 20px rgba(157,0,255,0.5);">
        EC Access Granted
      </h1>
      <p style="margin:6px 0 0;color:#5a4a7a;font-size:13px;letter-spacing:0.5px;">NEON VOTING SYSTEM</p>
    </div>

    <p style="margin:0 0 8px;font-size:16px;color:#c8e0f0;">Hello, <span style="color:#be6cff;font-weight:700;">${name}</span></p>
    <p style="margin:0 0 24px;font-size:15px;color:#8aaec8;line-height:1.6;">
      You've been appointed as an <strong style="color:#ffffff;">Election Commissioner</strong> for
      <strong style="color:#ffffff;">${orgName}</strong>. Use the credentials below to log in.
    </p>

    <!-- Credentials Box -->
    <div style="background:rgba(0,0,0,0.4);border:1px solid rgba(157,0,255,0.25);border-radius:10px;padding:20px;margin-bottom:24px;font-family:monospace;">
      <div style="margin-bottom:10px;">
        <span style="font-size:11px;color:#5a4a7a;text-transform:uppercase;letter-spacing:1px;">Organisation ID</span><br>
        <span style="font-size:16px;color:#00C3FF;letter-spacing:2px;">${orgId}</span>
      </div>
      ${password ? `
      <div>
        <span style="font-size:11px;color:#5a4a7a;text-transform:uppercase;letter-spacing:1px;">Temporary Password</span><br>
        <span style="font-size:16px;color:#00ffaa;letter-spacing:2px;">${password}</span>
      </div>` : ''}
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${loginLink}"
         style="display:inline-block;background:linear-gradient(135deg,#9D00FF 0%,#00C3FF 100%);color:#ffffff;padding:14px 36px;border-radius:30px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.5px;box-shadow:0 0 24px rgba(157,0,255,0.4);">
        ➜ &nbsp; Log In to Dashboard
      </a>
    </div>

    <p style="margin:0;font-size:12px;color:#2a3a5a;text-align:center;">
      Change your password after first login for security.
    </p>
  `;
  return wrapEmail(inner, '#9D00FF');
}

function generateElectionApprovedEmail(orgName) {
  const inner = `
    <!-- Header -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:rgba(0,255,170,0.1);border:1px solid rgba(0,255,170,0.3);border-radius:50%;width:64px;height:64px;line-height:64px;font-size:30px;margin-bottom:12px;">✅</div>
      <h1 style="margin:0;font-size:26px;font-weight:700;color:#00ffaa;letter-spacing:1px;text-shadow:0 0 20px rgba(0,255,170,0.4);">
        Election Approved!
      </h1>
      <p style="margin:6px 0 0;color:#2a6a5a;font-size:13px;letter-spacing:0.5px;">NEON VOTING SYSTEM</p>
    </div>

    <!-- Status Badge -->
    <div style="text-align:center;margin-bottom:24px;">
      <div style="display:inline-block;background:rgba(0,255,170,0.08);border:1px solid rgba(0,255,170,0.3);border-radius:30px;padding:8px 24px;">
        <span style="color:#00ffaa;font-size:13px;font-weight:700;letter-spacing:1px;">LIVE &nbsp;•&nbsp; VOTING NOW ACTIVE</span>
      </div>
    </div>

    <p style="margin:0 0 16px;font-size:15px;color:#8aaec8;line-height:1.6;text-align:center;">
      The <strong style="color:#ffffff;">${orgName}</strong> election has been approved by the Super Admin.
      Registered voters can now cast their ballots.
    </p>

    <!-- Divider -->
    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(0,255,170,0.3),transparent);margin:20px 0;"></div>

    <p style="margin:0;font-size:13px;color:#3a5a4a;text-align:center;">
      Log in to your EC Dashboard to monitor live voting progress.
    </p>
  `;
  return wrapEmail(inner, '#00ffaa');
}

function generateResultsPublishedEmail(orgName, orgId, appUrl) {
  const inner = `
    <!-- Header -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:rgba(0,195,255,0.1);border:1px solid rgba(0,195,255,0.3);border-radius:50%;width:64px;height:64px;line-height:64px;font-size:30px;margin-bottom:12px;">📊</div>
      <h1 style="margin:0;font-size:26px;font-weight:700;color:#00C3FF;letter-spacing:1px;text-shadow:0 0 20px rgba(0,195,255,0.5);">
        Election Results Are In!
      </h1>
      <p style="margin:6px 0 0;color:#2a4a6a;font-size:13px;letter-spacing:0.5px;">NEON VOTING SYSTEM</p>
    </div>

    <p style="margin:0 0 24px;font-size:15px;color:#8aaec8;line-height:1.6;text-align:center;">
      The official results for the <strong style="color:#ffffff;">${orgName}</strong> election
      have been declared and are now publicly available.
    </p>

    <!-- Org ID badge -->
    <div style="background:rgba(0,0,0,0.35);border:1px solid rgba(0,195,255,0.15);border-radius:8px;padding:12px 16px;margin-bottom:24px;text-align:center;">
      <span style="font-size:11px;color:#3a5a7a;text-transform:uppercase;letter-spacing:1px;">Organisation ID</span><br>
      <span style="font-size:15px;color:#00C3FF;font-family:monospace;letter-spacing:2px;">${orgId}</span>
    </div>

    <!-- CTA Button -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${appUrl}?role=results&org=${orgId}"
         style="display:inline-block;background:linear-gradient(135deg,#00C3FF 0%,#00ffaa 100%);color:#050816;padding:14px 36px;border-radius:30px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.5px;box-shadow:0 0 24px rgba(0,195,255,0.45);">
        📊 &nbsp; View Full Results
      </a>
    </div>

    <p style="margin:0;font-size:12px;color:#2a3a5a;text-align:center;">
      Results are live and publicly accessible. No login required to view.
    </p>
  `;
  return wrapEmail(inner, '#00C3FF');
}

function generateElectionRejectedEmail(ecName, orgName, rejectionReason, appUrl) {
  const inner = `
    <!-- Header -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:rgba(255,80,80,0.1);border:1px solid rgba(255,80,80,0.3);border-radius:50%;width:64px;height:64px;line-height:64px;font-size:30px;margin-bottom:12px;">❌</div>
      <h1 style="margin:0;font-size:24px;font-weight:700;color:#ff6b6b;letter-spacing:1px;text-shadow:0 0 20px rgba(255,80,80,0.4);">
        Election Returned for Correction
      </h1>
      <p style="margin:6px 0 0;color:#6a3a3a;font-size:13px;letter-spacing:0.5px;">NEON VOTING SYSTEM</p>
    </div>

    <p style="margin:0 0 8px;font-size:16px;color:#c8e0f0;">Hello, <span style="color:#ff9999;font-weight:700;">${ecName}</span></p>
    <p style="margin:0 0 24px;font-size:15px;color:#8aaec8;line-height:1.6;">
      Your election submission for <strong style="color:#ffffff;">${orgName}</strong> has been
      reviewed and returned for corrections by the Super Admin.
    </p>

    <!-- Feedback Box -->
    <div style="background:rgba(255,68,68,0.06);border:1px solid rgba(255,107,107,0.3);border-left:4px solid #ff4444;border-radius:10px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 8px;font-size:12px;color:#6a3a3a;text-transform:uppercase;letter-spacing:1px;">📝 Feedback from Super Admin</p>
      <p style="margin:0;font-size:15px;color:#eaf2ff;line-height:1.7;">${rejectionReason}</p>
    </div>

    <!-- Steps -->
    <div style="background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:20px;margin-bottom:24px;">
      <p style="margin:0 0 12px;font-size:13px;color:#5a6a8a;text-transform:uppercase;letter-spacing:1px;">What to do next</p>
      <ol style="margin:0;padding-left:20px;color:#9baec8;line-height:2;font-size:14px;">
        <li>Log in to your <span style="color:#00C3FF;">EC Dashboard</span></li>
        <li>Make the corrections based on the feedback above</li>
        <li>Go to the <strong style="color:#ffffff;">Approval</strong> tab</li>
        <li>Click <strong style="color:#00ffaa;">"Resubmit for Approval"</strong></li>
      </ol>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin-bottom:24px;">
      <a href="${appUrl}?role=ec"
         style="display:inline-block;background:linear-gradient(135deg,#9D00FF 0%,#00C3FF 100%);color:#ffffff;padding:14px 36px;border-radius:30px;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.5px;box-shadow:0 0 24px rgba(157,0,255,0.4);">
        ➜ &nbsp; Log In to Dashboard
      </a>
    </div>

    <p style="margin:0;font-size:12px;color:#2a3a5a;text-align:center;line-height:1.7;">
      Your election is now unlocked for editing.<br>
      Contact your Super Admin if you have questions about the feedback.
    </p>
  `;
  return wrapEmail(inner, '#ff6b6b');
}

function generateVotingReminderEmail(name, orgName, orgId, votingLink, reminderType = 'reminder') {
  const isOpen = reminderType === 'open';
  const icon = isOpen ? '🗳️' : '⏰';
  const title = isOpen ? 'Voting Is Now Open!' : 'Voting Reminder';
  const accentColor = isOpen ? '#00ffaa' : '#ffaa00';
  const borderColor = isOpen ? 'rgba(0,255,170,0.4)' : 'rgba(255,170,0,0.4)';
  const glowColor = isOpen ? 'rgba(0,255,170,0.2)' : 'rgba(255,170,0,0.2)';
  const message = isOpen
    ? `Voting is now <strong style="color:#00ffaa;">LIVE</strong>! Cast your vote for <strong style="color:#ffffff;">${orgName}</strong> now before it closes.`
    : `Don't forget — voting is open for <strong style="color:#ffffff;">${orgName}</strong>. Click below to cast your vote now!`;

  const inner = `
    <!-- Header Icon -->
    <div style="text-align:center;margin-bottom:28px;">
      <div style="display:inline-block;background:rgba(0,0,0,0.3);border:2px solid ${borderColor};border-radius:50%;width:72px;height:72px;line-height:72px;font-size:34px;margin-bottom:14px;box-shadow:0 0 24px ${glowColor};">
        ${icon}
      </div>
      <h1 style="margin:0;font-size:28px;font-weight:700;color:${accentColor};letter-spacing:1px;text-shadow:0 0 24px ${glowColor};">
        ${title}
      </h1>
      <p style="margin:8px 0 0;font-size:13px;color:#3a5a7a;letter-spacing:1px;text-transform:uppercase;">
        ${orgName}
      </p>
    </div>

    ${name ? `<p style="margin:0 0 20px;font-size:15px;color:#c8e0f0;">Hi <strong style="color:${accentColor};">${name}</strong>,</p>` : ''}

    <!-- Message Box -->
    <div style="background:rgba(0,0,0,0.35);border:1px solid ${borderColor};border-radius:12px;padding:20px 22px;margin-bottom:28px;text-align:center;">
      <p style="margin:0;font-size:16px;color:#d0eaff;line-height:1.8;">
        ${message}
      </p>
    </div>

    <!-- CTA Button -->
    <div style="text-align:center;margin-bottom:28px;">
      <a href="${votingLink}"
         style="display:inline-block;background:linear-gradient(135deg,${accentColor} 0%,#00C3FF 100%);color:#050816;padding:16px 44px;border-radius:30px;text-decoration:none;font-weight:700;font-size:17px;letter-spacing:0.5px;box-shadow:0 0 28px ${glowColor};">
        🗳️ &nbsp; Go to Voting Portal
      </a>
    </div>

    <!-- Divider -->
    <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.08),transparent);margin-bottom:20px;"></div>

    <!-- Org Info -->
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td style="padding:4px 0;">
          <span style="font-size:12px;color:#3a5a7a;">Organisation ID:&nbsp;</span>
          <span style="font-size:12px;color:#00C3FF;font-family:monospace;letter-spacing:1px;">${orgId}</span>
        </td>
      </tr>
      <tr>
        <td style="padding:4px 0;">
          <span style="font-size:12px;color:#3a5a7a;">If you have questions, contact your Election Commissioner.</span>
        </td>
      </tr>
    </table>
  `;
  return wrapEmail(inner, accentColor);
}
