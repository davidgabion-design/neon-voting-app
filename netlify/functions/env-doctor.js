'use strict';

const {
  optionalEnv,
  getAppUrl,
  getSmtpConfig,
  getTwilioAuth,
  getTwilioSenderE164,
  getTwilioTemplateSids,
  getTwilioStatusCallbackUrl,
  getFirebaseAdminCertEnv
} = require('./_shared/env');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, x-env-doctor-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json'
};

function hasAnyLegacyTwilioSenderVars() {
  const legacy = ['TWILIO_SMS_FROM', 'TWILIO_PHONE_NUMBER', 'TWILIO_WHATSAPP_FROM'];
  return legacy.filter((k) => !!optionalEnv(k));
}

function requireTokenIfConfigured(event) {
  const expected = optionalEnv('ENV_DOCTOR_TOKEN');
  if (!expected) return;

  const provided =
    (event.headers && (event.headers['x-env-doctor-token'] || event.headers['X-Env-Doctor-Token'])) ||
    (event.queryStringParameters && event.queryStringParameters.token) ||
    '';

  if (!provided || String(provided).trim() !== expected) {
    const err = new Error('Unauthorized');
    err.statusCode = 401;
    throw err;
  }
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    requireTokenIfConfigured(event);

    const errors = [];
    const warnings = [];

    // APP_URL
    try {
      getAppUrl();
    } catch (e) {
      errors.push(e.message);
    }

    // Firebase Admin vars (required for logging + OTP persistence)
    const firebaseCert = getFirebaseAdminCertEnv();
    if (!firebaseCert) {
      errors.push('Missing Firebase Admin SDK env vars (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)');
    }

    // SMTP (required for email channel)
    try {
      getSmtpConfig();
    } catch (e) {
      errors.push(e.message);
    }

    // Twilio auth
    try {
      getTwilioAuth();
    } catch (e) {
      errors.push(e.message);
    }

    // Twilio sender (single source of truth)
    const legacySenderVars = hasAnyLegacyTwilioSenderVars();
    if (legacySenderVars.length) {
      errors.push(`Legacy Twilio sender vars are set (${legacySenderVars.join(', ')}). Remove them and use only TWILIO_SENDER_E164.`);
    }

    try {
      getTwilioSenderE164();
    } catch (e) {
      errors.push(e.message);
    }

    // Twilio templates (contentSid)
    try {
      getTwilioTemplateSids();
    } catch (e) {
      errors.push(e.message);
    }

    // Optional callback URL
    try {
      getTwilioStatusCallbackUrl();
    } catch (e) {
      errors.push(e.message);
    }

    if (!optionalEnv('ENV_DOCTOR_TOKEN')) {
      warnings.push('ENV_DOCTOR_TOKEN is not set. Consider setting it to restrict access to this endpoint in production.');
    }

    const ok = errors.length === 0;

    return {
      statusCode: ok ? 200 : 500,
      headers: corsHeaders,
      body: JSON.stringify(
        {
          ok,
          errors,
          warnings,
          meta: {
            node: process.version,
            context: optionalEnv('CONTEXT') || null
          }
        },
        null,
        2
      )
    };
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
