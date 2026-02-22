/**
 * Firebase Function Route: /api/send-whatsapp
 * Sends WhatsApp messages via Twilio
 */
const twilio = require("twilio");

function normalizeE164(phone) {
  let value = String(phone).trim();
  value = value.replace(/^whatsapp:/i, '');
  value = value.replace(/[\s\-\(\)]/g, '');
  
  if (value.startsWith('+')) return value;
  if (value.startsWith('233')) return '+' + value;
  if (value.startsWith('0')) return '+233' + value.substring(1);
  return '+' + value;
}

module.exports = async (req, res, { admin, json }) => {
  if (req.method !== "POST") {
    return json(res, 405, { success: false, error: "POST only" });
  }

  let body = {};
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
  } catch {
    return json(res, 400, { success: false, error: "Invalid JSON body" });
  }

  const { type, phone, data, message, orgId } = body;
  const phoneNumber = phone || body.to;

  if (!phoneNumber) {
    return json(res, 400, { success: false, error: "Missing phone number" });
  }

  // Get Twilio config from environment
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_SENDER_E164 || process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.error("Missing Twilio configuration");
    return json(res, 500, { success: false, error: "WhatsApp service not configured" });
  }

  try {
    const toE164 = normalizeE164(phoneNumber);
    const client = twilio(accountSid, authToken);

    // Check if using Content SID template (for WhatsApp templates)
    const contentSid = process.env[`TWILIO_TEMPLATE_${type?.toUpperCase()}`];

    let msg;
    if (contentSid) {
      // Use Content API template
      const contentVariables = data ? JSON.stringify(data) : undefined;
      
      msg = await client.messages.create({
        from: `whatsapp:${fromNumber}`,
        to: `whatsapp:${toE164}`,
        contentSid: contentSid,
        contentVariables: contentVariables
      });
    } else if (message || data?.message) {
      // Send plain text message
      msg = await client.messages.create({
        from: `whatsapp:${fromNumber}`,
        to: `whatsapp:${toE164}`,
        body: message || data.message
      });
    } else {
      return json(res, 400, { success: false, error: "Missing message content or template" });
    }

    if (!msg || !msg.sid) {
      throw new Error("Twilio did not confirm WhatsApp delivery");
    }

    // Log to Firestore
    if (orgId) {
      await admin.firestore()
        .collection("organizations").doc(orgId)
        .collection("invites").add({
          type: (type || "voter") + "_whatsapp",
          phone: toE164,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          status: msg.status,
          messageId: msg.sid,
          method: "whatsapp"
        });
    }

    return json(res, 200, {
      success: true,
      sid: msg.sid,
      status: msg.status
    });
  } catch (error) {
    console.error("WhatsApp send error:", error);
    return json(res, 500, { success: false, error: error.message || "Failed to send WhatsApp message" });
  }
};
