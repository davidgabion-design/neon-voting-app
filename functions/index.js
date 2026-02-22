const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

/**
 * Helper: Send JSON response
 */
function json(res, code, data) {
  res.set("Content-Type", "application/json");
  res.status(code).send(JSON.stringify(data));
}

/**
 * Helper: Set CORS headers
 */
function cors(res) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

/**
 * Main API Router Function
 * Routes all /api/* requests to appropriate handlers
 */
exports.api = functions
  .runWith({ timeoutSeconds: 60, memory: "512MB" })
  .https.onRequest(async (req, res) => {
    cors(res);

    // Handle preflight OPTIONS request
    if (req.method === "OPTIONS") {
      return res.status(204).send("");
    }

    // Normalize path (remove trailing slashes)
    const path = (req.path || "").replace(/^\/api/, "").replace(/\/+$/, "") || "/";

    console.log("API Request:", { method: req.method, path, originalPath: req.path });

    try {
      // Route to appropriate handler
      if (path === "/send-invite") {
        return await require("./routes/send-invite")(req, res, { admin, json });
      }
      if (path === "/send-invite-sms") {
        return await require("./routes/send-invite-sms")(req, res, { admin, json });
      }
      if (path === "/send-otp") {
        return await require("./routes/send-otp")(req, res, { admin, json });
      }
      if (path === "/validate-otp") {
        return await require("./routes/validate-otp")(req, res, { admin, json });
      }
      if (path === "/send-whatsapp") {
        return await require("./routes/send-whatsapp")(req, res, { admin, json });
      }
      if (path === "/send-sms") {
        return await require("./routes/send-sms")(req, res, { admin, json });
      }
      if (path === "/send-email") {
        return await require("./routes/send-email")(req, res, { admin, json });
      }
      if (path === "/send-notification") {
        return await require("./routes/send-notification")(req, res, { admin, json });
      }
      if (path === "/check-twilio-status") {
        return await require("./routes/check-twilio-status")(req, res, { admin, json });
      }
      if (path === "/poll-twilio-status") {
        return await require("./routes/poll-twilio-status")(req, res, { admin, json });
      }

      // 404 - Route not found
      return json(res, 404, { ok: false, error: "Not found", path });
    } catch (error) {
      console.error("API Error:", error);
      return json(res, 500, { ok: false, error: "Internal server error" });
    }
  });
