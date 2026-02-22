/**
 * Firebase Function Route: /api/send-invite
 * Sends email invitations to voters or ECs
 */
const nodemailer = require("nodemailer");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderTemplateEmail(subject, bodyText) {
  const safeBody = escapeHtml(bodyText).replace(/\r\n|\r|\n/g, "<br/>");
  const safeSubject = escapeHtml(subject);

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; color: #00eaff; padding: 20px; border-radius: 12px; border: 2px solid #00C3FF;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #00C3FF; margin: 0;">${safeSubject}</h2>
      </div>
      <div style="background: rgba(0,255,255,0.05); padding: 16px; border-radius: 8px;">
        <div style="line-height: 1.6;">${safeBody}</div>
      </div>
    </div>
  `;
}

module.exports = async (req, res, { admin, json }) => {
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "POST only" });
  }

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return json(res, 400, { ok: false, error: "Invalid JSON body" });
  }

  const { to, recipientType, orgName, orgId, credentials, recipientName, emailTemplate } = body;

  if (!to || !recipientType) {
    return json(res, 400, { ok: false, error: "Missing required fields: to, recipientType" });
  }

  // Get SMTP config from environment
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const appUrl = process.env.APP_URL || "https://neon-voting-app.web.app";

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.error("Missing SMTP configuration");
    return json(res, 500, {
      ok: false,
      error: "Server email configuration incomplete. Please contact administrator."
    });
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass
    }
  });

  let subject = "";
  let html = "";

  if (recipientType === "ec") {
    if (emailTemplate?.subject && emailTemplate?.html) {
      subject = emailTemplate.subject;
      html = emailTemplate.html;
    } else if (emailTemplate?.subject && emailTemplate?.body) {
      subject = emailTemplate.subject;
      html = renderTemplateEmail(subject, emailTemplate.body);
    } else {
      subject = `🔐 Neon Voting System - EC Invitation for ${orgName}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; color: #00eaff; padding: 20px; border-radius: 12px; border: 2px solid #9D00FF;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #9D00FF; margin: 0;">🔐 Neon Voting System</h1>
            <p style="color: #00C3FF; margin: 5px 0;">Election Commissioner Invitation</p>
          </div>
          
          <div style="background: rgba(0,255,255,0.05); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #00C3FF; margin-top: 0;">Welcome, ${escapeHtml(recipientName || "Election Commissioner")}!</h2>
            <p>You have been invited to manage elections for:</p>
            <div style="background: rgba(157,0,255,0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #9D00FF; margin: 15px 0;">
              <strong style="color: #00ffaa;">${escapeHtml(orgName)}</strong>
              <div style="color: #888; font-size: 12px; margin-top: 5px;">Organization ID: ${escapeHtml(orgId)}</div>
            </div>
          </div>

          <div style="background: rgba(255,107,107,0.05); padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(255,107,107,0.3);">
            <h3 style="color: #ff6b6b; margin-top: 0;">Your EC Login Credentials:</h3>
            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; font-family: monospace; word-break: break-all;">
              <strong>Organization ID:</strong> <span style="color: #00ffaa;">${escapeHtml(orgId)}</span><br/>
              <strong>Password:</strong> <span style="color: #00ffaa;">${escapeHtml(credentials?.password || "N/A")}</span>
            </div>
            <p style="color: #ffcc80; font-size: 12px; margin-top: 10px;">⚠️ Keep this password safe and change it after first login.</p>
          </div>

          <div style="margin-bottom: 20px;">
            <a href="${appUrl}?role=ec&org=${encodeURIComponent(orgId)}" 
               style="display: inline-block; background: linear-gradient(135deg, #9D00FF, #00C3FF); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Log In to Dashboard
            </a>
          </div>
        </div>
      `;
    }
  } else if (recipientType === "voter") {
    if (emailTemplate?.subject && emailTemplate?.html) {
      subject = emailTemplate.subject;
      html = emailTemplate.html;
    } else {
      subject = `📮 ${orgName} - Voting Invitation`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; color: #00eaff; padding: 20px; border-radius: 12px; border: 2px solid #00C3FF;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #00C3FF; margin: 0;">📮 Neon Voting System</h1>
            <p style="color: #00ffaa; margin: 5px 0;">Voting Invitation</p>
          </div>
          
          <div style="background: rgba(0,255,255,0.05); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #00C3FF; margin-top: 0;">Hello ${escapeHtml(recipientName || "Voter")}!</h2>
            <p>You are invited to vote in:</p>
            <div style="background: rgba(0,195,255,0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #00C3FF; margin: 15px 0;">
              <strong style="color: #00ffaa;">${escapeHtml(orgName)}</strong>
            </div>
          </div>

          <div style="margin-bottom: 20px; text-align: center;">
            <a href="${appUrl}?role=voter&org=${encodeURIComponent(orgId)}&email=${encodeURIComponent(to)}" 
               style="display: inline-block; background: linear-gradient(135deg, #00C3FF, #00ffaa); color: #0a0e27; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Cast Your Vote
            </a>
          </div>
        </div>
      `;
    }
  }

  try {
    await transporter.sendMail({
      from: `"Neon Voting System" <${smtpUser}>`,
      to: to,
      subject: subject,
      html: html
    });

    // Log to Firestore
    if (orgId) {
      await admin.firestore()
        .collection("organizations").doc(orgId)
        .collection("invites").add({
          type: recipientType,
          email: to,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          status: "sent",
          method: "email"
        });
    }

    return json(res, 200, { ok: true, message: "Invitation sent successfully" });
  } catch (error) {
    console.error("Email send error:", error);
    return json(res, 500, { ok: false, error: error.message || "Failed to send email" });
  }
};
