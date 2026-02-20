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
  } catch (e) {
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



/** Shared wrapper — Gmail/iOS-compatible dark background using bgcolor table attributes */
function wrapEmail(innerHtml, accentColor) {
  accentColor = accentColor || '#00C3FF';
  return '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width,initial-scale=1">\n  <meta name="color-scheme" content="dark">\n  <meta name="supported-color-schemes" content="dark">\n  <style>\n    body, #body-table, #body-td { background-color: #050816 !important; }\n    .card-td { background-color: #0a0f2e !important; }\n    .footer-td { background-color: #070b1f !important; }\n  </style>\n</head>\n<body bgcolor="#050816" style="margin:0;padding:0;background-color:#050816;font-family:Arial,Helvetica,sans-serif;">\n  <table id="body-table" width="100%" cellpadding="0" cellspacing="0" bgcolor="#050816" style="background-color:#050816;">\n    <tr>\n      <td id="body-td" align="center" bgcolor="#050816" style="padding:30px 16px;background-color:#050816;">\n        <table width="100%" style="max-width:600px;border-radius:14px;border:2px solid ' + accentColor + ';" cellpadding="0" cellspacing="0" bgcolor="#0a0f2e">\n          <tr><td height="4" bgcolor="' + accentColor + '" style="background-color:' + accentColor + ';height:4px;font-size:1px;line-height:1px;">&nbsp;</td></tr>\n          <tr>\n            <td class="card-td" bgcolor="#0a0f2e" style="padding:32px 28px 28px;background-color:#0a0f2e;">\n              ' + innerHtml + '\n            </td>\n          </tr>\n          <tr>\n            <td class="footer-td" bgcolor="#070b1f" style="padding:14px 28px 18px;background-color:#070b1f;border-top:1px solid #0d1535;border-radius:0 0 12px 12px;text-align:center;">\n              <p style="margin:0;font-size:11px;color:#3a4a6b;letter-spacing:0.5px;">&#9889; Neon Voting System &nbsp;|&nbsp; Secure Digital Elections</p>\n            </td>\n          </tr>\n        </table>\n      </td>\n    </tr>\n  </table>\n</body>\n</html>';
}

function generateVoterInviteEmail(name, orgName, orgId, votingLink) {
  var inner = '\n'
    + '    <div style="text-align:center;margin-bottom:28px;">\n'
    + '      <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">\n'
    + '        <tr><td bgcolor="#0d1635" width="68" height="68" style="background-color:#0d1635;border:2px solid #00C3FF;border-radius:50%;text-align:center;vertical-align:middle;font-size:32px;width:68px;height:68px;">&#128379;</td></tr>\n'
    + '      </table>\n'
    + '      <h1 style="margin:0;font-size:26px;font-weight:700;color:#00C3FF;letter-spacing:1px;">You\'re Invited to Vote!</h1>\n'
    + '      <p style="margin:6px 0 0;color:#1a4a6a;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">Neon Voting System</p>\n'
    + '    </div>\n'
    + '\n'
    + '    <p style="margin:0 0 6px;font-size:16px;color:#c8dff0;">Hello, <strong style="color:#00ffaa;">' + (name || 'Voter') + '</strong></p>\n'
    + '    <p style="margin:0 0 24px;font-size:14px;color:#5a8aaa;line-height:1.7;">\n'
    + '      You have been registered as an eligible voter for the\n'
    + '      <strong style="color:#e0f0ff;">' + orgName + '</strong> election.\n'
    + '      Your participation matters &mdash; cast your vote today!\n'
    + '    </p>\n'
    + '\n'
    + '    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">\n'
    + '      <tr><td bgcolor="#080d20" style="background-color:#080d20;border:1px solid #0a3a5a;border-radius:8px;padding:14px 18px;">\n'
    + '        <p style="margin:0 0 4px;font-size:10px;color:#1a4a6a;text-transform:uppercase;letter-spacing:1.5px;">Organisation ID</p>\n'
    + '        <p style="margin:0;font-size:16px;color:#00C3FF;font-family:monospace;letter-spacing:3px;">' + orgId + '</p>\n'
    + '      </td></tr>\n'
    + '    </table>\n'
    + '\n'
    + '    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">\n'
    + '      <tr><td align="center">\n'
    + '        <a href="' + votingLink + '" style="display:inline-block;background-color:#00C3FF;color:#050816;padding:15px 40px;border-radius:30px;text-decoration:none;font-weight:700;font-size:16px;">\n'
    + '          &#x27A1;&nbsp; Go to Voting Portal\n'
    + '        </a>\n'
    + '      </td></tr>\n'
    + '    </table>\n'
    + '\n'
    + '    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">\n'
    + '      <tr><td bgcolor="#080d20" style="background-color:#080d20;border:1px solid #0a2a4a;border-radius:10px;padding:18px 20px;">\n'
    + '        <p style="margin:0 0 10px;font-size:10px;color:#1a3a5a;text-transform:uppercase;letter-spacing:1.5px;">How to Vote</p>\n'
    + '        <ol style="margin:0;padding-left:18px;color:#5a8aaa;font-size:13px;line-height:2.1;">\n'
    + '          <li>Click <strong style="color:#00C3FF;">"Go to Voting Portal"</strong> above</li>\n'
    + '          <li>Enter Organisation ID: <strong style="color:#00C3FF;font-family:monospace;">' + orgId + '</strong></li>\n'
    + '          <li>Enter your registered email address</li>\n'
    + '          <li>Review candidates and make your selections</li>\n'
    + '          <li>Submit your ballot securely</li>\n'
    + '        </ol>\n'
    + '      </td></tr>\n'
    + '    </table>\n'
    + '\n'
    + '    <p style="margin:0;font-size:11px;color:#1a3a5a;text-align:center;line-height:1.6;">\n'
    + '      Button not working? Copy this link:<br>\n'
    + '      <a href="' + votingLink + '" style="color:#005a7a;word-break:break-all;font-size:11px;">' + votingLink + '</a>\n'
    + '    </p>\n';
  return wrapEmail(inner, '#00C3FF');
}

function generateOTPEmail(otpCode) {
  var inner = '\n'
    + '    <div style="text-align:center;margin-bottom:28px;">\n'
    + '      <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">\n'
    + '        <tr><td bgcolor="#0d0820" width="68" height="68" style="background-color:#0d0820;border:2px solid #9D00FF;border-radius:50%;text-align:center;vertical-align:middle;font-size:32px;width:68px;height:68px;">&#128272;</td></tr>\n'
    + '      </table>\n'
    + '      <h1 style="margin:0;font-size:24px;font-weight:700;color:#be6cff;letter-spacing:1px;">Verification Code</h1>\n'
    + '      <p style="margin:6px 0 0;color:#2a1a4a;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">Neon Voting System</p>\n'
    + '    </div>\n'
    + '\n'
    + '    <p style="margin:0 0 24px;font-size:14px;color:#5a7aaa;line-height:1.7;text-align:center;">\n'
    + '      Use the code below to complete your login.<br>\n'
    + '      <strong style="color:#ff9999;">Do not share this code with anyone.</strong>\n'
    + '    </p>\n'
    + '\n'
    + '    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">\n'
    + '      <tr><td align="center">\n'
    + '        <table cellpadding="0" cellspacing="0">\n'
    + '          <tr><td bgcolor="#080520" style="background-color:#080520;border:2px solid #9D00FF;border-radius:14px;padding:24px 48px;text-align:center;">\n'
    + '            <p style="margin:0;font-size:46px;font-weight:700;color:#00ffaa;letter-spacing:12px;font-family:monospace;">' + otpCode + '</p>\n'
    + '          </td></tr>\n'
    + '        </table>\n'
    + '      </td></tr>\n'
    + '    </table>\n'
    + '\n'
    + '    <table width="100%" cellpadding="0" cellspacing="0">\n'
    + '      <tr><td bgcolor="#120a00" style="background-color:#120a00;border:1px solid #3a2a00;border-radius:8px;padding:12px 16px;text-align:center;">\n'
    + '        <p style="margin:0;font-size:13px;color:#ffaa00;">&#9201; This code expires in <strong>5 minutes</strong></p>\n'
    + '      </td></tr>\n'
    + '    </table>\n';
  return wrapEmail(inner, '#9D00FF');
}

function generateECAccessEmail(name, orgName, orgId, loginLink, password) {
  var passwordBlock = password
    ? '<p style="margin:0 0 4px;font-size:10px;color:#2a1a4a;text-transform:uppercase;letter-spacing:1.5px;">Temporary Password</p><p style="margin:0;font-size:17px;color:#00ffaa;font-family:monospace;letter-spacing:3px;">' + password + '</p>'
    : '';
  var inner = '\n'
    + '    <div style="text-align:center;margin-bottom:28px;">\n'
    + '      <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">\n'
    + '        <tr><td bgcolor="#0d0820" width="68" height="68" style="background-color:#0d0820;border:2px solid #9D00FF;border-radius:50%;text-align:center;vertical-align:middle;font-size:32px;width:68px;height:68px;">&#128273;</td></tr>\n'
    + '      </table>\n'
    + '      <h1 style="margin:0;font-size:24px;font-weight:700;color:#be6cff;letter-spacing:1px;">EC Access Granted</h1>\n'
    + '      <p style="margin:6px 0 0;color:#2a1a4a;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">Neon Voting System</p>\n'
    + '    </div>\n'
    + '\n'
    + '    <p style="margin:0 0 6px;font-size:16px;color:#c8dff0;">Hello, <strong style="color:#be6cff;">' + (name || 'Election Commissioner') + '</strong></p>\n'
    + '    <p style="margin:0 0 24px;font-size:14px;color:#5a7aaa;line-height:1.7;">\n'
    + '      You\'ve been appointed as an <strong style="color:#e0f0ff;">Election Commissioner</strong> for\n'
    + '      <strong style="color:#e0f0ff;">' + orgName + '</strong>. Use the credentials below to log in.\n'
    + '    </p>\n'
    + '\n'
    + '    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">\n'
    + '      <tr><td bgcolor="#080520" style="background-color:#080520;border:1px solid #2a1a4a;border-radius:10px;padding:20px;">\n'
    + '        <p style="margin:0 0 4px;font-size:10px;color:#2a1a4a;text-transform:uppercase;letter-spacing:1.5px;">Organisation ID</p>\n'
    + '        <p style="margin:0 0 16px;font-size:17px;color:#00C3FF;font-family:monospace;letter-spacing:3px;">' + orgId + '</p>\n'
    + '        ' + passwordBlock + '\n'
    + '      </td></tr>\n'
    + '    </table>\n'
    + '\n'
    + '    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">\n'
    + '      <tr><td bgcolor="#120a00" style="background-color:#120a00;border:1px solid #3a2a00;border-left:3px solid #ffaa00;border-radius:6px;padding:10px 14px;">\n'
    + '        <p style="margin:0;font-size:12px;color:#cc8800;">&#9888; Change your password after first login for security.</p>\n'
    + '      </td></tr>\n'
    + '    </table>\n'
    + '\n'
    + '    <table width="100%" cellpadding="0" cellspacing="0">\n'
    + '      <tr><td align="center">\n'
    + '        <a href="' + loginLink + '" style="display:inline-block;background-color:#9D00FF;color:#ffffff;padding:15px 40px;border-radius:30px;text-decoration:none;font-weight:700;font-size:16px;">\n'
    + '          &#x27A1;&nbsp; Log In to Dashboard\n'
    + '        </a>\n'
    + '      </td></tr>\n'
    + '    </table>\n';
  return wrapEmail(inner, '#9D00FF');
}

function generateElectionApprovedEmail(orgName) {
  var inner = '\n'
    + '    <div style="text-align:center;margin-bottom:28px;">\n'
    + '      <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">\n'
    + '        <tr><td bgcolor="#041a10" width="68" height="68" style="background-color:#041a10;border:2px solid #00ffaa;border-radius:50%;text-align:center;vertical-align:middle;font-size:32px;width:68px;height:68px;">&#9989;</td></tr>\n'
    + '      </table>\n'
    + '      <h1 style="margin:0;font-size:26px;font-weight:700;color:#00ffaa;letter-spacing:1px;">Election Approved!</h1>\n'
    + '      <p style="margin:6px 0 0;color:#0a3a1a;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">Neon Voting System</p>\n'
    + '    </div>\n'
    + '\n'
    + '    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">\n'
    + '      <tr><td align="center">\n'
    + '        <table cellpadding="0" cellspacing="0">\n'
    + '          <tr><td bgcolor="#041a10" style="background-color:#041a10;border:1px solid #00ffaa;border-radius:30px;padding:8px 28px;">\n'
    + '            <p style="margin:0;font-size:12px;color:#00ffaa;font-weight:700;letter-spacing:2px;">LIVE &nbsp;&#8226;&nbsp; VOTING NOW ACTIVE</p>\n'
    + '          </td></tr>\n'
    + '        </table>\n'
    + '      </td></tr>\n'
    + '    </table>\n'
    + '\n'
    + '    <p style="margin:0 0 20px;font-size:14px;color:#5a8a7a;line-height:1.7;text-align:center;">\n'
    + '      The <strong style="color:#e0f0ff;">' + orgName + '</strong> election has been approved by the Super Admin.<br>\n'
    + '      Registered voters can now cast their ballots.\n'
    + '    </p>\n'
    + '\n'
    + '    <p style="margin:0;font-size:12px;color:#1a3a2a;text-align:center;">\n'
    + '      Log in to your EC Dashboard to monitor live voting progress.\n'
    + '    </p>\n';
  return wrapEmail(inner, '#00ffaa');
}

function generateResultsPublishedEmail(orgName, orgId, appUrl) {
  var inner = '\n'
    + '    <div style="text-align:center;margin-bottom:28px;">\n'
    + '      <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">\n'
    + '        <tr><td bgcolor="#041520" width="68" height="68" style="background-color:#041520;border:2px solid #00C3FF;border-radius:50%;text-align:center;vertical-align:middle;font-size:32px;width:68px;height:68px;">&#128202;</td></tr>\n'
    + '      </table>\n'
    + '      <h1 style="margin:0;font-size:26px;font-weight:700;color:#00C3FF;letter-spacing:1px;">Election Results Are In!</h1>\n'
    + '      <p style="margin:6px 0 0;color:#1a3a5a;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">Neon Voting System</p>\n'
    + '    </div>\n'
    + '\n'
    + '    <p style="margin:0 0 24px;font-size:14px;color:#5a7aaa;line-height:1.7;text-align:center;">\n'
    + '      The official results for the <strong style="color:#e0f0ff;">' + orgName + '</strong> election\n'
    + '      have been declared and are now publicly available.\n'
    + '    </p>\n'
    + '\n'
    + '    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">\n'
    + '      <tr><td bgcolor="#080d20" style="background-color:#080d20;border:1px solid #0a3a5a;border-radius:8px;padding:14px 18px;text-align:center;">\n'
    + '        <p style="margin:0 0 4px;font-size:10px;color:#1a4a6a;text-transform:uppercase;letter-spacing:1.5px;">Organisation ID</p>\n'
    + '        <p style="margin:0;font-size:16px;color:#00C3FF;font-family:monospace;letter-spacing:3px;">' + orgId + '</p>\n'
    + '      </td></tr>\n'
    + '    </table>\n'
    + '\n'
    + '    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">\n'
    + '      <tr><td align="center">\n'
    + '        <a href="' + appUrl + '?role=results&org=' + orgId + '" style="display:inline-block;background-color:#00C3FF;color:#050816;padding:15px 40px;border-radius:30px;text-decoration:none;font-weight:700;font-size:16px;">\n'
    + '          &#128202;&nbsp; View Full Results\n'
    + '        </a>\n'
    + '      </td></tr>\n'
    + '    </table>\n'
    + '\n'
    + '    <p style="margin:0;font-size:11px;color:#1a3a5a;text-align:center;">\n'
    + '      Results are live and publicly accessible. No login required to view.\n'
    + '    </p>\n';
  return wrapEmail(inner, '#00C3FF');
}

function generateElectionRejectedEmail(ecName, orgName, rejectionReason, appUrl) {
  var inner = '\n'
    + '    <div style="text-align:center;margin-bottom:28px;">\n'
    + '      <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">\n'
    + '        <tr><td bgcolor="#200808" width="68" height="68" style="background-color:#200808;border:2px solid #ff6b6b;border-radius:50%;text-align:center;vertical-align:middle;font-size:32px;width:68px;height:68px;">&#10060;</td></tr>\n'
    + '      </table>\n'
    + '      <h1 style="margin:0;font-size:22px;font-weight:700;color:#ff6b6b;letter-spacing:1px;">Election Returned for Correction</h1>\n'
    + '      <p style="margin:6px 0 0;color:#4a1a1a;font-size:12px;letter-spacing:1.5px;text-transform:uppercase;">Neon Voting System</p>\n'
    + '    </div>\n'
    + '\n'
    + '    <p style="margin:0 0 6px;font-size:16px;color:#c8dff0;">Hello, <strong style="color:#ff9999;">' + (ecName || 'Election Commissioner') + '</strong></p>\n'
    + '    <p style="margin:0 0 24px;font-size:14px;color:#5a7aaa;line-height:1.7;">\n'
    + '      Your election submission for <strong style="color:#e0f0ff;">' + orgName + '</strong> has been\n'
    + '      reviewed and returned for corrections by the Super Admin.\n'
    + '    </p>\n'
    + '\n'
    + '    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">\n'
    + '      <tr><td bgcolor="#150505" style="background-color:#150505;border:1px solid #3a1010;border-left:4px solid #ff4444;border-radius:8px;padding:18px 20px;">\n'
    + '        <p style="margin:0 0 8px;font-size:10px;color:#4a1a1a;text-transform:uppercase;letter-spacing:1.5px;">&#128221; Feedback from Super Admin</p>\n'
    + '        <p style="margin:0;font-size:14px;color:#e0c8c8;line-height:1.8;">' + (rejectionReason || 'Please review and correct your election submission.') + '</p>\n'
    + '      </td></tr>\n'
    + '    </table>\n'
    + '\n'
    + '    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">\n'
    + '      <tr><td bgcolor="#080d20" style="background-color:#080d20;border:1px solid #0d1535;border-radius:10px;padding:18px 20px;">\n'
    + '        <p style="margin:0 0 10px;font-size:10px;color:#2a3a5a;text-transform:uppercase;letter-spacing:1.5px;">What to do next</p>\n'
    + '        <ol style="margin:0;padding-left:18px;color:#5a7aaa;font-size:13px;line-height:2.2;">\n'
    + '          <li>Log in to your <strong style="color:#00C3FF;">EC Dashboard</strong></li>\n'
    + '          <li>Make corrections based on the feedback above</li>\n'
    + '          <li>Go to the <strong style="color:#e0f0ff;">Approval</strong> tab</li>\n'
    + '          <li>Click <strong style="color:#00ffaa;">"Resubmit for Approval"</strong></li>\n'
    + '        </ol>\n'
    + '      </td></tr>\n'
    + '    </table>\n'
    + '\n'
    + '    <table width="100%" cellpadding="0" cellspacing="0">\n'
    + '      <tr><td align="center">\n'
    + '        <a href="' + appUrl + '?role=ec" style="display:inline-block;background-color:#9D00FF;color:#ffffff;padding:15px 40px;border-radius:30px;text-decoration:none;font-weight:700;font-size:16px;">\n'
    + '          &#x27A1;&nbsp; Log In to Dashboard\n'
    + '        </a>\n'
    + '      </td></tr>\n'
    + '    </table>\n';
  return wrapEmail(inner, '#ff6b6b');
}

function generateVotingReminderEmail(name, orgName, orgId, votingLink, reminderType) {
  reminderType = reminderType || 'reminder';
  var isOpen = reminderType === 'open';
  var icon = isOpen ? '&#128379;' : '&#9200;';
  var title = isOpen ? 'Voting Is Now Open!' : 'Voting Reminder';
  var accentColor = isOpen ? '#00ffaa' : '#ffaa00';
  var accentBorder = isOpen ? '#00ffaa' : '#ffaa00';
  var bgDark = isOpen ? '#041a10' : '#120a00';
  var msgBg = isOpen ? '#031208' : '#0e0800';
  var message = isOpen
    ? 'Voting is now <strong style="color:#00ffaa;">LIVE</strong>! Cast your vote for <strong style="color:#e0f0ff;">' + orgName + '</strong> before it closes.'
    : 'Don\'t forget &mdash; voting is open for <strong style="color:#e0f0ff;">' + orgName + '</strong>. Click below to cast your vote now!';

  var inner = '\n'
    + '    <div style="text-align:center;margin-bottom:28px;">\n'
    + '      <table cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">\n'
    + '        <tr><td bgcolor="' + bgDark + '" width="72" height="72" style="background-color:' + bgDark + ';border:2px solid ' + accentBorder + ';border-radius:50%;text-align:center;vertical-align:middle;font-size:34px;width:72px;height:72px;">' + icon + '</td></tr>\n'
    + '      </table>\n'
    + '      <h1 style="margin:0;font-size:28px;font-weight:700;color:' + accentColor + ';letter-spacing:1px;">' + title + '</h1>\n'
    + '      <p style="margin:8px 0 0;font-size:12px;color:#1a3a2a;letter-spacing:1.5px;text-transform:uppercase;">' + orgName + '</p>\n'
    + '    </div>\n'
    + '\n'
    + (name ? '    <p style="margin:0 0 20px;font-size:15px;color:#c8dff0;">Hi <strong style="color:' + accentColor + ';">' + name + '</strong>,</p>\n' : '')
    + '\n'
    + '    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">\n'
    + '      <tr><td bgcolor="' + msgBg + '" style="background-color:' + msgBg + ';border:1px solid ' + accentBorder + ';border-radius:12px;padding:20px 22px;text-align:center;">\n'
    + '        <p style="margin:0;font-size:16px;color:#d0eaff;line-height:1.9;">' + message + '</p>\n'
    + '      </td></tr>\n'
    + '    </table>\n'
    + '\n'
    + '    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">\n'
    + '      <tr><td align="center">\n'
    + '        <a href="' + votingLink + '" style="display:inline-block;background-color:' + accentColor + ';color:#050816;padding:16px 44px;border-radius:30px;text-decoration:none;font-weight:700;font-size:17px;">\n'
    + '          &#128379;&nbsp; Go to Voting Portal\n'
    + '        </a>\n'
    + '      </td></tr>\n'
    + '    </table>\n'
    + '\n'
    + '    <p style="margin:0 0 4px;font-size:12px;color:#2a4a3a;">\n'
    + '      Organisation ID: <strong style="color:#00C3FF;font-family:monospace;">' + orgId + '</strong>\n'
    + '    </p>\n'
    + '    <p style="margin:0;font-size:12px;color:#2a4a3a;">\n'
    + '      If you have questions, contact your Election Commissioner.\n'
    + '    </p>\n';
  return wrapEmail(inner, accentColor);
}

