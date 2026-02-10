const twilio = require('twilio');

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
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_SMS_FROM || process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          ok: false,
          error: "Missing Twilio configuration (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM/TWILIO_PHONE_NUMBER)"
        })
      };
    }

    if (!accountSid.startsWith('AC')) {
      return {
        statusCode: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ok: false, error: "Invalid TWILIO_ACCOUNT_SID (must start with AC)" })
      };
    }

    const client = twilio(accountSid, authToken);
    
    const smsMessage = await client.messages.create({
      body: message,
      from: fromNumber,
      to: phone
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
          to: phone,
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
