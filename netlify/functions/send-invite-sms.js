const twilio = require('twilio');
const {
  getTwilioAuth,
  getTwilioFromSms,
  normalizeE164
} = require('./_shared/env');

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST,OPTIONS"
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "POST only" })
    };
  }

  const { phone, message, recipientType, orgId, recipientName } = JSON.parse(event.body || "{}");

  if (!phone || !message) {
    return {
      statusCode: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ ok: false, error: "Missing phone or message" })
    };
  }

  try {
    let accountSid;
    let authToken;
    let fromNumber;
    let toE164;
    try {
      ({ accountSid, authToken } = getTwilioAuth());
      fromNumber = getTwilioFromSms();
      toE164 = normalizeE164(phone, { fieldName: 'phone', allowWhatsappPrefix: false });
    } catch (envErr) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: envErr.message })
      };
    }

    const client = twilio(accountSid, authToken);
    
    const smsMessage = await client.messages.create({
      body: message,
      from: fromNumber,
      to: toE164
    });

    console.log("SMS sent - Twilio response:", {
      sid: smsMessage.sid,
      status: smsMessage.status,
      to: smsMessage.to,
      from: smsMessage.from,
      errorCode: smsMessage.errorCode,
      errorMessage: smsMessage.errorMessage
    });

    return {
      statusCode: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: true,
        provider: "twilio",
        messageId: smsMessage.sid,
        status: smsMessage.status,
        recipientType,
        details: {
          to: toE164,
          from: fromNumber,
          twilioStatus: smsMessage.status
        }
      })
    };
  } catch (error) {
    console.error("SMS send error:", error);
    return {
      statusCode: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({
        ok: false,
        error: error.message || "Failed to send SMS"
      })
    };
  }
};
