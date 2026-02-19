const twilio = require("twilio");
const admin = require('firebase-admin');
const {
  getTwilioAuth,
  getTwilioFromWhatsapp,
  getTwilioStatusCallbackUrl,
  normalizeE164,
  requireTwilioContentSid
} = require('./_shared/env');

// Template type -> env var mapping (Content SIDs are stored in env)
const TEMPLATE_ENV_BY_TYPE = {
  otp: 'TWILIO_TEMPLATE_VOTER_OTP',
  invite: 'TWILIO_TEMPLATE_VOTER_INVITE',
  results: 'TWILIO_TEMPLATE_RESULTS_PUBLISHED',
  ec: 'TWILIO_TEMPLATE_EC_ACCESS',
  approved: 'TWILIO_TEMPLATE_ELECTION_APPROVED'
};

// Initialize Firebase Admin (for message logging)
if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      console.error('Missing Firebase Admin environment variables');
    } else {
      privateKey = privateKey.replace(/\\n/g, '\n');

      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });

      console.log('Firebase Admin initialized successfully');
    }
  } catch (err) {
    console.error('Firebase Admin initialization failed:', err);
  }
}

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
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ success: false, error: "POST only" })
    };
  }

  try {
    const { type, phone, data, orgId } = JSON.parse(event.body || "{}");

    // Validate required fields
    if (!type || !phone) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          success: false, 
          error: "Missing required fields: type, phone" 
        })
      };
    }

    // Get template SID
    const templateEnvName = TEMPLATE_ENV_BY_TYPE[type];
    
    if (!templateEnvName) {
      return {
        statusCode: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ 
          success: false, 
          error: `Invalid type. Valid types: ${Object.keys(TEMPLATE_ENV_BY_TYPE).join(', ')}` 
        })
      };
    }
    let accountSid;
    let authToken;
    let formattedFrom;
    let formattedTo;
    let contentSid;
    let cleanPhone;
    try {
      ({ accountSid, authToken } = getTwilioAuth());
      formattedFrom = getTwilioFromWhatsapp();
      cleanPhone = normalizeE164(phone, { fieldName: 'phone', allowWhatsappPrefix: true });
      formattedTo = `whatsapp:${cleanPhone}`;
      contentSid = requireTwilioContentSid(templateEnvName);
    } catch (envErr) {
      return {
        statusCode: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ success: false, error: envErr.message })
      };
    }

    // ✅ Format contentVariables for Twilio templates (numbered keys)
    let contentVariables;

    if (data && typeof data === "object") {
      const keys = Object.keys(data);
      if (keys.length) {
        const isAlreadyNumbered = keys.every((key) => /^\d+$/.test(key));
        const numbered = {};

        if (isAlreadyNumbered) {
          keys.forEach((key) => {
            numbered[key] = String(data[key]);
          });
        } else {
          keys.forEach((key, index) => {
            numbered[(index + 1).toString()] = String(data[key]);
          });
        }

        contentVariables = JSON.stringify(numbered);
      }
    }

    // Defensive logging (no secrets)
    console.log("[WhatsApp] Sending Template:", {
      type,
      to: formattedTo,
      from: formattedFrom,
      templateEnvName,
      contentSidPrefix: contentSid.substring(0, 2),
      contentVarsKeys: data ? Object.keys(data) : [],
      contentVariablesPreview: contentVariables ? contentVariables.substring(0, 120) : null
    });

    // Initialize Twilio client
    const client = twilio(accountSid, authToken);

    // Send WhatsApp message using approved template
    const statusCallback = getTwilioStatusCallbackUrl();
    const message = await client.messages.create({
      from: formattedFrom,
      to: formattedTo,
      contentSid,
      contentVariables: contentVariables,
      statusCallback
    });

    console.log("[WhatsApp] Enqueued:", {
      sid: message.sid,
      status: message.status,
      type
    });

    // ✅ LOG TO FIRESTORE (audit trail + delivery tracking)
    if (admin.apps.length && orgId) {
      try {
        await admin.firestore().collection('message_logs').add({
          type: 'whatsapp',
          provider: 'twilio',
          templateType: type,
          contentSid: contentSid,
          orgId: orgId,
          recipient: cleanPhone,
          messageSid: message.sid,
          status: message.status,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
          variables: data || {}
        });
        console.log("[WhatsApp] Logged to Firestore");
      } catch (logErr) {
        console.error("[WhatsApp] Firestore logging failed:", logErr.message);
        // Don't fail the request if logging fails
      }
    }

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        success: true, 
        sid: message.sid,
        status: message.status,
        type,
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error("[WhatsApp] Error:", error);

    // Provide helpful error messages
    let statusCode = 500;
    let errorMessage = error.message;

    if (error.code === 21211) {
      statusCode = 400;
      errorMessage = "Invalid phone number format. Use E.164: +233XXXXXXXXX";
    } else if (error.code === 21608) {
      statusCode = 403;
      errorMessage = "Not authorized to send to this number";
    } else if (error.code === 63016) {
      statusCode = 400;
      errorMessage = "Template content error. Check variable mapping.";
    } else if (error.code === 21614) {
      statusCode = 500;
      errorMessage = "WhatsApp not enabled for Twilio account";
    }

    return {
      statusCode,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ 
        success: false, 
        error: errorMessage,
        code: error.code,
        details: error.moreInfo
      })
    };
  }
};