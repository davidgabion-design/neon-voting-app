'use strict';

const E164_RE = /^\+[1-9]\d{1,14}$/;
const TWILIO_CONTENT_SID_RE = /^HX[a-zA-Z0-9]{32}$/;

function getRawEnv(name) {
  const value = process.env[name];
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed.length ? trimmed : undefined;
}

function requireEnv(name) {
  const value = getRawEnv(name);
  if (!value) {
    const err = new Error(`Missing required environment variable: ${name}`);
    err.code = 'ENV_MISSING';
    err.envVar = name;
    throw err;
  }
  return value;
}

function optionalEnv(name) {
  return getRawEnv(name);
}

function normalizeE164(input, { fieldName = 'phone', allowWhatsappPrefix = true } = {}) {
  if (input === undefined || input === null) {
    const err = new Error(`Missing ${fieldName}`);
    err.code = 'E164_MISSING';
    throw err;
  }

  let value = String(input).trim();
  if (allowWhatsappPrefix) value = value.replace(/^whatsapp:/i, '');
  value = value.replace(/^tel:/i, '');
  value = value.replace(/[\s\-\(\)]/g, '');

  if (!E164_RE.test(value)) {
    const err = new Error(`${fieldName} must be E.164 format (example: +233501234567). Received: ${String(input)}`);
    err.code = 'E164_INVALID';
    err.fieldName = fieldName;
    throw err;
  }

  return value;
}

function getTwilioAuth() {
  const accountSid = requireEnv('TWILIO_ACCOUNT_SID');
  const authToken = requireEnv('TWILIO_AUTH_TOKEN');

  if (!accountSid.startsWith('AC')) {
    const err = new Error('Invalid TWILIO_ACCOUNT_SID (must start with AC)');
    err.code = 'TWILIO_SID_INVALID';
    throw err;
  }

  return { accountSid, authToken };
}

function getTwilioSenderE164() {
  // New canonical sender variable (single source of truth)
  const sender = optionalEnv('TWILIO_SENDER_E164');

  // Legacy vars (kept ONLY for migration detection)
  const legacySmsFrom = optionalEnv('TWILIO_SMS_FROM');
  const legacyPhoneNumber = optionalEnv('TWILIO_PHONE_NUMBER');
  const legacyWhatsappFrom = optionalEnv('TWILIO_WHATSAPP_FROM');

  const legacySet = [
    legacySmsFrom ? 'TWILIO_SMS_FROM' : null,
    legacyPhoneNumber ? 'TWILIO_PHONE_NUMBER' : null,
    legacyWhatsappFrom ? 'TWILIO_WHATSAPP_FROM' : null
  ].filter(Boolean);

  if (sender) {
    if (legacySet.length) {
      const err = new Error(`Duplicate Twilio sender configuration. Use only TWILIO_SENDER_E164. Remove: ${legacySet.join(', ')}`);
      err.code = 'TWILIO_SENDER_DUPLICATE';
      throw err;
    }
    return normalizeE164(sender, { fieldName: 'TWILIO_SENDER_E164' });
  }

  if (legacySet.length) {
    const err = new Error(`Legacy Twilio sender variables detected (${legacySet.join(', ')}). Migrate to TWILIO_SENDER_E164 (single E.164 number, e.g. +233501234567) and remove legacy vars.`);
    err.code = 'TWILIO_SENDER_LEGACY';
    throw err;
  }

  const err = new Error('Missing required environment variable: TWILIO_SENDER_E164');
  err.code = 'ENV_MISSING';
  err.envVar = 'TWILIO_SENDER_E164';
  throw err;
}

function getTwilioFromSms() {
  return getTwilioSenderE164();
}

function getTwilioFromWhatsapp() {
  return `whatsapp:${getTwilioSenderE164()}`;
}

function getTwilioStatusCallbackUrl() {
  const url = optionalEnv('TWILIO_STATUS_CALLBACK_URL');
  if (!url) return undefined;
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    const err = new Error('TWILIO_STATUS_CALLBACK_URL must be a valid absolute URL');
    err.code = 'ENV_INVALID_URL';
    throw err;
  }
  return url;
}

function requireTwilioContentSid(name) {
  const value = requireEnv(name);
  if (!TWILIO_CONTENT_SID_RE.test(value)) {
    const err = new Error(`${name} must look like a Twilio Content SID (HX + 32 chars).`);
    err.code = 'TWILIO_CONTENT_SID_INVALID';
    err.envVar = name;
    throw err;
  }
  return value;
}

function getTwilioTemplateSids() {
  return {
    TWILIO_TEMPLATE_VOTER_INVITE: requireTwilioContentSid('TWILIO_TEMPLATE_VOTER_INVITE'),
    TWILIO_TEMPLATE_VOTER_OTP: requireTwilioContentSid('TWILIO_TEMPLATE_VOTER_OTP'),
    TWILIO_TEMPLATE_EC_ACCESS: requireTwilioContentSid('TWILIO_TEMPLATE_EC_ACCESS'),
    TWILIO_TEMPLATE_ELECTION_APPROVED: requireTwilioContentSid('TWILIO_TEMPLATE_ELECTION_APPROVED'),
    TWILIO_TEMPLATE_RESULTS_PUBLISHED: requireTwilioContentSid('TWILIO_TEMPLATE_RESULTS_PUBLISHED')
  };
}

function getAppUrl() {
  const url = requireEnv('APP_URL');
  try {
    // eslint-disable-next-line no-new
    new URL(url);
  } catch {
    const err = new Error('APP_URL must be a valid absolute URL');
    err.code = 'ENV_INVALID_URL';
    throw err;
  }
  return url.replace(/\/$/, '');
}

function getSmtpConfig() {
  const host = requireEnv('SMTP_HOST');
  const portRaw = requireEnv('SMTP_PORT');
  const port = Number(portRaw);
  if (!Number.isFinite(port) || port <= 0) {
    const err = new Error('SMTP_PORT must be a valid number');
    err.code = 'ENV_INVALID_NUMBER';
    err.envVar = 'SMTP_PORT';
    throw err;
  }

  const smtpUser = optionalEnv('SMTP_USER') || optionalEnv('EMAIL_USER');
  const smtpPass = optionalEnv('SMTP_PASS') || optionalEnv('EMAIL_PASS');
  if (!smtpUser || !smtpPass) {
    const err = new Error('Missing SMTP credentials (SMTP_USER/SMTP_PASS).');
    err.code = 'ENV_MISSING';
    throw err;
  }

  const from = optionalEnv('SMTP_FROM') || smtpUser;
  return { host, port, user: smtpUser, pass: smtpPass, from };
}

function getFirebaseAdminCertEnv() {
  const projectId = optionalEnv('FIREBASE_PROJECT_ID');
  const clientEmail = optionalEnv('FIREBASE_CLIENT_EMAIL');
  const privateKey = optionalEnv('FIREBASE_PRIVATE_KEY');

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, '\n')
  };
}

module.exports = {
  optionalEnv,
  requireEnv,
  normalizeE164,
  getTwilioAuth,
  getTwilioSenderE164,
  getTwilioFromSms,
  getTwilioFromWhatsapp,
  getTwilioStatusCallbackUrl,
  requireTwilioContentSid,
  getTwilioTemplateSids,
  getAppUrl,
  getSmtpConfig,
  getFirebaseAdminCertEnv
};
