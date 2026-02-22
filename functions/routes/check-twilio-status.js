/**
 * Firebase Function Route: /api/check-twilio-status
 * Checks Twilio message status
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

  const { sid } = body;

  if (!sid) {
    return json(res, 400, { ok: false, error: "Missing message SID" });
  }

  // Get Twilio config from environment
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    return json(res, 500, { ok: false, error: "Twilio not configured" });
  }

  try {
    const client = twilio(accountSid, authToken);
    const message = await client.messages(sid).fetch();

    return json(res, 200, {
      ok: true,
      message: {
        sid: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage
      }
    });
  } catch (error) {
    console.error("Twilio status check error:", error);
    return json(res, 500, { ok: false, error: error.message });
  }
};
