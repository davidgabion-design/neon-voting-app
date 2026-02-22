/**
 * Firebase Function Route: /api/send-otp
 * Sends OTP codes via SMS or WhatsApp
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

  // TODO: Implement OTP sending logic
  // For now, return success for compatibility
  return json(res, 200, { ok: true, message: "OTP feature coming soon" });
};
