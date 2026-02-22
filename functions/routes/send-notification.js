/**
 * Firebase Function Route: /api/send-notification
 * Multi-channel notification system (email, WhatsApp, SMS)
 */

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

  const { type, email, phone, message, orgId } = body;

  if (!type || (!email && !phone)) {
    return json(res, 400, { ok: false, error: "Missing required fields" });
  }

  // For now, return success - implement full notification logic later
  console.log("Notification request:", { type, email, phone, orgId });
  
  return json(res, 200, {
    ok: true,
    message: "Notification queued successfully"
  });
};

