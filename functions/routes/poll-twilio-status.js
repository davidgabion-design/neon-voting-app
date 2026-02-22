/**
 * Firebase Function Route: /api/poll-twilio-status
 * Polls Twilio message status until delivered/failed
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

  const { sid, maxAttempts = 10, intervalMs = 2000 } = body;

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
    
    let attempts = 0;
    let message;

    // Poll until delivered, failed, or max attempts
    while (attempts < maxAttempts) {
      message = await client.messages(sid).fetch();
      
      // Terminal statuses
      if (["delivered", "sent", "failed", "undelivered"].includes(message.status)) {
        break;
      }

      attempts++;
      
      // Wait before next poll (unless last attempt)
      if (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }

    return json(res, 200, {
      ok: true,
      message: {
        sid: message.sid,
        status: message.status,
        to: message.to,
        from: message.from,
        errorCode: message.errorCode,
        errorMessage: message.errorMessage
      },
      attempts,
      timedOut: attempts >= maxAttempts && !["delivered", "sent", "failed", "undelivered"].includes(message.status)
    });
  } catch (error) {
    console.error("Twilio poll error:", error);
    return json(res, 500, { ok: false, error: error.message });
  }
};
