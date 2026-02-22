/**
 * Firebase Function Route: /api/validate-otp
 * Validates OTP codes
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

  // TODO: Implement OTP validation logic
  return json(res, 200, { ok: true, valid: false, message: "OTP feature coming soon" });
};
