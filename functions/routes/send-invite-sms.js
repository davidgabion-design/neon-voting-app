/**
 * Firebase Function Route: /api/send-invite-sms
 * Sends SMS invitations via Twilio
 */
const twilio = require("twilio");

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

  const { to, message } = body;

  if (!to || !message) {
    return json(res, 400, { ok: false, error: "Missing 'to' or 'message'" });
  }

  // Get Twilio config from environment
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromPhone = process.env.TWILIO_FROM_SMS;

  if (!accountSid || !authToken || !fromPhone) {
    console.error("Missing Twilio configuration");
    return json(res, 500, {
      ok: false,
      error: "Server SMS configuration incomplete"
    });
  }

  try {
    const client = twilio(accountSid, authToken);
    
    const result = await client.messages.create({
      body: message,
      from: fromPhone,
      to: to
    });

    return json(res, 200, {
      ok: true,
      provider: "twilio-sms",
      messageId: result.sid
    });
  } catch (error) {
    console.error("SMS send error:", error);
    return json(res, 500, {
      ok: false,
      error: error.message || "Failed to send SMS"
    });
  }
};
