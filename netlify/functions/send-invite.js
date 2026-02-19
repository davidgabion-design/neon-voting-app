const nodemailer = require("nodemailer");
const { getSmtpConfig, getAppUrl } = require("./_shared/env");

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
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

  const { to, recipientType, orgName, orgId, credentials, recipientName, emailTemplate } = JSON.parse(event.body || "{}");

  if (!to || !recipientType) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ok: false, error: "Missing required fields" })
    };
  }

  let smtp;
  let appUrl;
  try {
    smtp = getSmtpConfig();
    appUrl = getAppUrl();
  } catch (envErr) {
    console.error("Missing configuration:", { error: envErr.message });
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ok: false,
        error: "Server email configuration incomplete. Please contact administrator."
      })
    };
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: false,
    auth: {
      user: smtp.user,
      pass: smtp.pass
    }
  });

  let subject = "";
  let html = "";

  if (recipientType === "ec") {
    if (emailTemplate?.subject && emailTemplate?.html) {
      // Use full HTML template directly (new format)
      subject = emailTemplate.subject;
      html = emailTemplate.html;
    } else if (emailTemplate?.subject && emailTemplate?.body) {
      // Legacy text template with basic wrapper
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
            <h2 style="color: #00C3FF; margin-top: 0;">Welcome, ${recipientName || "Election Commissioner"}!</h2>
            <p>You have been invited to manage elections for:</p>
            <div style="background: rgba(157,0,255,0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #9D00FF; margin: 15px 0;">
              <strong style="color: #00ffaa;">${orgName}</strong>
              <div style="color: #888; font-size: 12px; margin-top: 5px;">Organization ID: ${orgId}</div>
            </div>
          </div>

          <div style="background: rgba(255,107,107,0.05); padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(255,107,107,0.3);">
            <h3 style="color: #ff6b6b; margin-top: 0;">Your EC Login Credentials:</h3>
            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; font-family: monospace; word-break: break-all;">
              <strong>Organization ID:</strong> <span style="color: #00ffaa;">${orgId}</span><br/>
              <strong>Password:</strong> <span style="color: #00ffaa;">${credentials.password}</span>
            </div>
            <p style="color: #ffcc80; font-size: 12px; margin-top: 10px;">⚠️ Keep this password safe and change it after first login.</p>
          </div>

          <div style="margin-bottom: 20px;">
            <a href="${appUrl}?role=ec&org=${orgId}" 
               style="display: inline-block; background: linear-gradient(135deg, #9D00FF, #00C3FF); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Log In to Dashboard
            </a>
          </div>

          <div style="border-top: 1px solid rgba(0,255,255,0.2); padding-top: 15px; color: #888; font-size: 12px;">
            <p>Next Steps:</p>
            <ol style="padding-left: 20px;">
              <li>Log in with your Organization ID and the password provided above</li>
              <li>Add voters for your organization</li>
              <li>Create positions and candidates</li>
              <li>Configure election settings</li>
              <li>Request SuperAdmin approval to launch voting</li>
            </ol>
            <p style="margin-top: 20px; color: #666;">
              If you have any questions, contact your organization administrator.
            </p>
          </div>
        </div>
      `;
    }
  } else if (recipientType === "voter") {
    const isReminder = Boolean(credentials?.isReminder && credentials?.message);

    if (isReminder) {
      subject = `⏰ Voting Reminder - ${orgName}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; color: #00eaff; padding: 20px; border-radius: 12px; border: 2px solid #00C3FF;">
          <div style="text-align: center; margin-bottom: 24px;">
            <h1 style="color: #00C3FF; margin: 0;">⏰ Voting Reminder</h1>
            <p style="color: #00ffaa; margin: 5px 0;">${orgName}</p>
          </div>

          <div style="background: rgba(0,255,255,0.05); padding: 18px; border-radius: 8px; margin-bottom: 18px;">
            <p style="margin: 0; line-height: 1.6;">${credentials.message}</p>
          </div>

          <div style="margin-bottom: 20px;">
            <a href="${appUrl}?role=voter&org=${orgId}" 
               style="display: inline-block; background: linear-gradient(135deg, #00C3FF, #00ffaa); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Go to Voting Portal
            </a>
          </div>

          <div style="border-top: 1px solid rgba(0,255,255,0.2); padding-top: 12px; color: #888; font-size: 12px;">
            <div>Organization ID: ${orgId}</div>
            <div style="margin-top: 6px;">If you have questions, contact your Election Commissioner.</div>
          </div>
        </div>
      `;
    } else if (emailTemplate?.subject && emailTemplate?.html) {
      // Use full HTML template directly (new format)
      subject = emailTemplate.subject;
      html = emailTemplate.html;
    } else if (emailTemplate?.subject && emailTemplate?.body) {
      // Legacy text template with basic wrapper
      subject = emailTemplate.subject;
      html = renderTemplateEmail(subject, emailTemplate.body);
    } else {
      subject = `🗳️ Neon Voting System - Voter Invitation for ${orgName}`;
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e27; color: #00eaff; padding: 20px; border-radius: 12px; border: 2px solid #00C3FF;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #00C3FF; margin: 0;">🗳️ Neon Voting System</h1>
            <p style="color: #00ffaa; margin: 5px 0;">You're Invited to Vote!</p>
          </div>
          
          <div style="background: rgba(0,255,255,0.05); padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #00ffaa; margin-top: 0;">Hello, ${recipientName || "Voter"}!</h2>
            <p>You have been registered to vote in the election for:</p>
            <div style="background: rgba(0,255,170,0.1); padding: 15px; border-radius: 8px; border-left: 4px solid #00ffaa; margin: 15px 0;">
              <strong style="color: #00ffaa;">${orgName}</strong>
              <div style="color: #888; font-size: 12px; margin-top: 5px;">Organization ID: ${orgId}</div>
            </div>
          </div>

          <div style="background: rgba(255,193,7,0.05); padding: 20px; border-radius: 8px; margin-bottom: 20px; border: 1px solid rgba(255,193,7,0.3);">
            <h3 style="color: #ffc107; margin-top: 0;">Your Voter Credentials:</h3>
            <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; font-family: monospace; word-break: break-all;">
              <strong>Organization ID:</strong> <span style="color: #ffc107;">${orgId}</span><br/>
              <strong>Credential:</strong> <span style="color: #ffc107;">${credentials.credential}</span>
            </div>
            <p style="color: #ffcc80; font-size: 12px; margin-top: 10px;">📧 This is your ${credentials.type === 'email' ? 'email address' : 'phone number'} that you registered with.</p>
          </div>

          <div style="margin-bottom: 20px;">
            <a href="${appUrl}?role=voter&org=${orgId}" 
               style="display: inline-block; background: linear-gradient(135deg, #00C3FF, #00ffaa); color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
              Go to Voting Portal
            </a>
          </div>

          <div style="border-top: 1px solid rgba(0,255,255,0.2); padding-top: 15px; color: #888; font-size: 12px;">
            <p>How to Vote:</p>
            <ol style="padding-left: 20px;">
              <li>Visit the voting portal using the link above</li>
              <li>Enter your Organization ID</li>
              <li>Enter your credential (email/phone)</li>
              <li>Review and cast your vote</li>
              <li>Your vote is secure and confidential</li>
            </ol>
            <p style="margin-top: 20px; color: #666;">
              ⏰ Make sure to vote before the election ends. If you have questions, contact your organization's Election Commissioner.
            </p>
          </div>
        </div>
      `;
    }
  }

  try {
    const info = await transporter.sendMail({
      from: `"Neon Voting System" <${smtp.from}>`,
      to,
      subject,
      html
    });

    console.log("Email sent successfully:", {
      messageId: info.messageId,
      to: to,
      recipientType: recipientType,
      accepted: info.accepted,
      rejected: info.rejected
    });

    if (!info || !info.messageId) {
      throw new Error("SMTP did not confirm email delivery");
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ok: true,
        provider: "nodemailer",
        messageId: info.messageId,
        recipientType
      })
    };
  } catch (error) {
    console.error("Email send error:", {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode
    });
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ok: false,
        error: error.message || "Failed to send email",
        details: error.code || null
      })
    };
  }
};
