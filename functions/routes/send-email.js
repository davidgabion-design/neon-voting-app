/**
 * Firebase Function Route: /api/send-email
 * Sends email using nodemailer with SMTP
 */
const nodemailer = require("nodemailer");

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

  const { to, subject, text, html } = body;

  if (!to || (!text && !html)) {
    return json(res, 400, { ok: false, error: "Missing email content" });
  }

  // Get SMTP config from environment
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || "587");
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.error("Missing SMTP configuration");
    return json(res, 500, {
      ok: false,
      error: "Server email configuration incomplete"
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

  try {
    const info = await transporter.sendMail({
      from: `"Neon Voting System" <${smtpUser}>`,
      to,
      subject,
      text,
      html
    });

    // Force confirmation
    if (!info || !info.messageId) {
      throw new Error("SMTP did not confirm email delivery");
    }

    return json(res, 200, {
      ok: true,
      provider: "smtp",
      messageId: info.messageId
    });
  } catch (error) {
    console.error("Email send error:", error);
    return json(res, 500, {
      ok: false,
      error: error.message || "Failed to send email"
    });
  }
};
