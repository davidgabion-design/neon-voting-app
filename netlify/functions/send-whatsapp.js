const twilio = require("twilio");

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: JSON.stringify({ ok: true })
    };
  }

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
  } catch (err) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ok: false, error: "Invalid JSON", details: err.message })
    };
  }

  const to = String(body.to || "").trim();
  const messageText = String(body.message || "").trim();
  const voterName = String(body.voterName || "Voter").trim();
  const voterPin = String(body.voterPin || "0000").trim();
  const orgId = String(body.orgId || "").trim();

  if (!to) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ok: false, error: "Missing phone number (to)" })
    };
  }

  if (!messageText) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ok: false, error: "Missing message" })
    };
  }

  // ✅ PATCH START – Accept whatsapp: prefix safely
  let cleanTo = to.replace(/^whatsapp:/i, '');

  // Validate phone number format
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(cleanTo)) {
    return {
      statusCode: 400,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ok: false, error: "Invalid phone number format" })
    };
  }

  // Ensure phone number has + prefix
  const formattedTo = cleanTo.startsWith("+") ? cleanTo : `+${cleanTo}`;

  // Check for Twilio environment variables
  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_WHATSAPP_FROM
  } = process.env;

  console.log("Twilio Config Check:", {
    hasSID: !!TWILIO_ACCOUNT_SID,
    hasToken: !!TWILIO_AUTH_TOKEN,
    hasFrom: !!TWILIO_WHATSAPP_FROM,
    fromNumber: TWILIO_WHATSAPP_FROM
  });

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
    return {
      statusCode: 500,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ok: false,
        error: "Missing Twilio configuration",
        missing: [
          !TWILIO_ACCOUNT_SID ? "TWILIO_ACCOUNT_SID" : null,
          !TWILIO_AUTH_TOKEN ? "TWILIO_AUTH_TOKEN" : null,
          !TWILIO_WHATSAPP_FROM ? "TWILIO_WHATSAPP_FROM" : null
        ].filter(Boolean)
      })
    };
  }

  // Format Twilio numbers
  const twilioFrom = TWILIO_WHATSAPP_FROM.startsWith("whatsapp:") 
    ? TWILIO_WHATSAPP_FROM 
    : `whatsapp:${TWILIO_WHATSAPP_FROM}`;
  
  const twilioTo = formattedTo.startsWith("whatsapp:") 
    ? formattedTo 
    : `whatsapp:${formattedTo}`;

  console.log("Sending WhatsApp message:", {
    to: twilioTo,
    from: twilioFrom,
    messageLength: messageText.length,
    orgId,
    voterName
  });

  // 🔥 DEBUG – Final payload sent to Twilio
  console.log("FINAL TWILIO PAYLOAD:", {
    from: twilioFrom,
    to: twilioTo
  });

  try {
    // Initialize Twilio client
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    // Send WhatsApp message
    const msg = await client.messages.create({
      from: twilioFrom,
      to: twilioTo,
      body: messageText,
      // Optional: Add WhatsApp template for better deliverability
      // contentSid: "HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", // Template SID if using templates
      // contentVariables: JSON.stringify({
      //   "1": voterName,
      //   "2": voterPin,
      //   "3": orgId
      // })
    });

    console.log("WhatsApp sent successfully:", {
      sid: msg.sid,
      status: msg.status,
      to: msg.to,
      from: msg.from,
      errorCode: msg.errorCode,
      errorMessage: msg.errorMessage
    });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ok: true,
        provider: "twilio-whatsapp",
        sid: msg.sid,
        status: msg.status,
        to: formattedTo,
        from: TWILIO_WHATSAPP_FROM,
        timestamp: new Date().toISOString(),
        details: {
          voterName,
          orgId,
          messageLength: messageText.length
        }
      })
    };
  } catch (err) {
    console.error("Twilio WhatsApp error:", {
      error: err.message,
      code: err.code,
      moreInfo: err.moreInfo,
      status: err.status,
      to: twilioTo,
      from: twilioFrom
    });

    // Provide more specific error messages
    let errorMessage = err.message;
    let errorCode = 500;

    if (err.code === 21211) {
      errorMessage = "Invalid phone number";
      errorCode = 400;
    } else if (err.code === 21608) {
      errorMessage = "Not authorized to send to this number";
      errorCode = 403;
    } else if (err.code === 21612) {
      errorMessage = "WhatsApp not enabled for this number";
      errorCode = 400;
    } else if (err.code === 21614) {
      errorMessage = "WhatsApp capability not enabled for Twilio account";
      errorCode = 500;
    }

    return {
      statusCode: errorCode,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ok: false,
        error: errorMessage,
        details: {
          code: err.code,
          moreInfo: err.moreInfo,
          to: formattedTo,
          suggestion: "Make sure the recipient has WhatsApp and has opted in"
        }
      })
    };
  }
};