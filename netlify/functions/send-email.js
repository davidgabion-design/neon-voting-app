const nodemailer = require("nodemailer");
const { getSmtpConfig } = require("./_shared/env");

exports.handler = async (event) => {
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

  const { to, subject, text, html } = JSON.parse(event.body || "{}");

  if (!to || (!text && !html)) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ok: false, error: "Missing email content" })
    };
  }

  let smtp;
  try {
    smtp = getSmtpConfig();
  } catch (envErr) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ok: false, error: envErr.message })
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

  const info = await transporter.sendMail({
    from: `"Neon Voting System" <${smtp.from}>`,
    to,
    subject,
    text,
    html
  });

  // 🔥 FIX 1 – FORCE CONFIRMATION
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
      provider: "smtp",
      messageId: info.messageId
    })
  };
};
