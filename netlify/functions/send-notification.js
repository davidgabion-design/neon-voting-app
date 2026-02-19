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
 * Email Templates
 */

function generateVoterInviteEmail(name, orgName, orgId, votingLink) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; color: #00eaff; padding: 20px; border-radius: 12px; border: 2px solid #00C3FF;">
      <h1 style="color: #00C3FF;">🗳️ You're Invited to Vote!</h1>
      <p>Hello <strong>${name}</strong>,</p>
      <p>You have been registered to vote in the <strong>${orgName}</strong> election.</p>
      <a href="${votingLink}" style="display: inline-block; background: linear-gradient(135deg, #00C3FF, #00ffaa); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">
        Go to Voting Portal
      </a>
      <p style="color: #888; font-size: 12px;">Organization ID: ${orgId}</p>
    </div>
  `;
}

function generateOTPEmail(otpCode) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; color: #00eaff; padding: 20px; border-radius: 12px;">
      <h2 style="color: #9D00FF;">Your OTP Code</h2>
      <p style="font-size: 32px; font-weight: bold; color: #00ffaa; letter-spacing: 4px;">${otpCode}</p>
      <p style="color: #888;">This code expires in 5 minutes.</p>
    </div>
  `;
}

function generateECAccessEmail(name, orgName, orgId, loginLink, password) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; color: #00eaff; padding: 20px; border-radius: 12px;">
      <h1 style="color: #9D00FF;">🔐 EC Access Granted</h1>
      <p>Hello <strong>${name}</strong>,</p>
      <p>You're now an Election Commissioner for <strong>${orgName}</strong>.</p>
      <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; font-family: monospace;">
        <strong>Organization ID:</strong> ${orgId}<br/>
        ${password ? `<strong>Password:</strong> ${password}` : ''}
      </div>
      <a href="${loginLink}" style="display: inline-block; background: linear-gradient(135deg, #9D00FF, #00C3FF); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">
        Log In to Dashboard
      </a>
    </div>
  `;
}

function generateElectionApprovedEmail(orgName) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; color: #00eaff; padding: 20px; border-radius: 12px;">
      <h1 style="color: #00ffaa;">✅ Election Approved!</h1>
      <p>The <strong>${orgName}</strong> election has been approved by the Super Admin.</p>
      <p>Voting is now <strong>active</strong> and voters can cast their ballots.</p>
    </div>
  `;
}

function generateResultsPublishedEmail(orgName, orgId, appUrl) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; color: #00eaff; padding: 20px; border-radius: 12px;">
      <h1 style="color: #00C3FF;">📊 Results Published</h1>
      <p>The results for the <strong>${orgName}</strong> election are now available.</p>
      <a href="${appUrl}?role=results&org=${orgId}" style="display: inline-block; background: linear-gradient(135deg, #00C3FF, #00ffaa); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; margin: 20px 0;">
        View Results
      </a>
    </div>
  `;
}

function generateElectionRejectedEmail(ecName, orgName, rejectionReason, appUrl) {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; color: #00eaff; padding: 20px; border-radius: 12px; border: 2px solid #ff6666;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #ff6b6b; margin: 0;">❌ Neon Voting System</h1>
        <p style="color: #ff9999; margin: 5px 0;">Election Returned for Correction</p>
      </div>
      
      <div style="background: rgba(255,68,68,0.1); padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ff4444;">
        <h2 style="color: #ff6b6b; margin-top: 0;">Hello ${ecName},</h2>
        <p>Your election submission for <strong style="color: #00eaff;">${orgName}</strong> has been reviewed and returned for corrections.</p>
      </div>

      <div style="background: rgba(255,107,107,0.05); padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(255,107,107,0.3);">
        <h3 style="color: #ff9999; margin-top: 0;">📝 Feedback from SuperAdmin:</h3>
        <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px;">
          <p style="color: #eaf2ff; margin: 0; line-height: 1.6;">${rejectionReason}</p>
        </div>
      </div>

      <div style="margin-bottom: 20px;">
        <h3 style="color: #00eaff;">What happens next?</h3>
        <ol style="color: #9beaff; line-height: 1.8;">
          <li>Login to your EC Dashboard</li>
          <li>Make the necessary corrections based on the feedback above</li>
          <li>Go to the <strong>Approval</strong> tab</li>
          <li>Click <strong>"Resubmit for Approval"</strong></li>
        </ol>
      </div>

      <div style="margin-bottom: 20px; text-align: center;">
        <a href="${appUrl}?role=ec" 
           style="display: inline-block; background: linear-gradient(135deg, #9D00FF, #00C3FF); color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px;">
          Log In to Dashboard
        </a>
      </div>

      <div style="border-top: 1px solid rgba(255,255,255,0.1); padding-top: 15px; color: #888; font-size: 12px;">
        <p><strong>Note:</strong> Your election is now unlocked for editing. Once you've made the required changes, you can resubmit for approval.</p>
        <p style="margin-top: 15px;">If you have questions about the feedback, please contact your SuperAdmin.</p>
      </div>
    </div>
  `;
}
