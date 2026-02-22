/**
 * Firebase Function Route: /api/send-sms
 * Sends SMS via Twilio
 */
const twilio = require("twilio");

function normalizeE164(phone) {
  let value = String(phone).trim();
  value = value.replace(/[\s\-\(\)]/g, '');
  
  if (value.startsWith('+')) return value;
  if (value.startsWith('233')) return '+' + value;
  if (value.startsWith('0')) return '+233' + value.substring(1);
  return '+' + value;
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

  const { to, message, phone, orgId, recipientType, recipientName } = body;
  const phoneNumber = to || phone;
  const messageText = message || body.body || "";

  if (!phoneNumber || !messageText) {
    return json(res, 400, { ok: false, error: "Missing phone number or message" });
  }

  // Get Twilio config from environment
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_SENDER_E164 || process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.error("Missing Twilio configuration");
    return json(res, 500, { ok: false, error: "SMS service not configured" });
  }

  try {
    const toE164 = normalizeE164(phoneNumber);
    const client = twilio(accountSid, authToken);

    const msg = await client.messages.create({
      from: fromNumber,
      to: toE164,
      body: messageText
    });

    if (!msg || !msg.sid) {
      throw new Error("Twilio did not confirm SMS delivery");
    }

    // Log to Firestore
    if (orgId) {
      await admin.firestore()
        .collection("organizations").doc(orgId)
        .collection("invites").add({
          type: (recipientType || "voter") + "_sms",
          phone: toE164,
          name: recipientName,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          status: msg.status,
          messageId: msg.sid,
          method: "sms"
        });
    }

    return json(res, 200, {
      ok: true,
      provider: "twilio-sms",
      sid: msg.sid,
      status: msg.status
    });
  } catch (error) {
    console.error("SMS send error:", error);
    return json(res, 500, { ok: false, error: error.message || "Failed to send SMS" });
  }
};
