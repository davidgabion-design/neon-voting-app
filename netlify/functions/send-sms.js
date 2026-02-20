const twilio = require("twilio");
const {
  getTwilioAuth,
  getTwilioFromSms,
  normalizeE164
} = require("./_shared/env");

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

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ok: false, error: "Invalid JSON" })
    };
  }

  const to = String(body.to || "").trim(); // +233XXXXXXXXX
  const messageText = String(body.message || "").trim();

  if (!to || !messageText) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ok: false, error: "Missing to or message" })
    };
  }

  let accountSid;
  let authToken;
  let fromE164;
  let toE164;
  try {
    ({ accountSid, authToken } = getTwilioAuth());
    fromE164 = getTwilioFromSms();
    toE164 = normalizeE164(to, { fieldName: "to", allowWhatsappPrefix: false });
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

  const client = twilio(accountSid, authToken);

  try {
    const msg = await client.messages.create({
      from: fromE164,
      to: toE164,
      body: messageText
    });

    // 🔥 FIX 1 – FORCE PROVIDER CONFIRMATION
    if (!msg || !msg.sid) {
      throw new Error("Twilio did not confirm SMS delivery");
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ok: true,
        provider: "twilio-sms",
        sid: msg.sid,
        status: msg.status
      })
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ok: false,
        error: err.message
      })
    };
  }
};
