// netlify/functions/send-otp.js
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const { getAppUrl, normalizeE164 } = require('./_shared/env');

function normalizePhoneForOtp(raw) {
  if (!raw) return '';
  let value = String(raw).trim();
  value = value.replace(/^whatsapp:/i, '');
  value = value.replace(/^tel:/i, '');
  value = value.replace(/[\s\-\(\)]/g, '');
  if (value.startsWith('00')) value = '+' + value.slice(2);
  if (value.startsWith('0')) value = '+233' + value.slice(1);
  if (!value.startsWith('+') && /^\d{7,}$/.test(value)) value = '+233' + value;
  value = '+' + value.replace(/[^0-9]/g, '');
  return value === '+' ? '' : value;
}

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
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      body: '',
    };
  }

  // Enforce POST method
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: 'Method not allowed. Use POST.' })
    };
  }

  if (!admin.apps.length) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: false,
        error: 'Firebase Admin not initialized (check FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars)',
      }),
    };
  }

  try {
    const { orgId, userId, credential, method } = JSON.parse(event.body || '{}');

    if (!orgId || !userId || !credential || !method) {
      return {
        statusCode: 400,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: 'Missing fields' }),
      };
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    let phoneE164 = '';
    if (method === 'sms' || method === 'whatsapp') {
      try {
        phoneE164 = normalizeE164(normalizePhoneForOtp(credential), {
          fieldName: 'credential',
          allowWhatsappPrefix: false
        });
      } catch (phoneErr) {
        return {
          statusCode: 400,
          headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
          body: JSON.stringify({ ok: false, error: phoneErr.message })
        };
      }
    }

    await admin.firestore().doc(`organizations/${orgId}/otp/${userId}`).set({
      otp,
      expiresAt,
      attempts: 0,
      sentVia: method,
    });

    // Send OTP via the appropriate method
    let sendResult = { ok: false };
    let appUrl;
    try {
      appUrl = getAppUrl();
    } catch (envErr) {
      return {
        statusCode: 500,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: false, error: envErr.message })
      };
    }
    try {
      let response;
      if (method === 'sms') {
        response = await fetch(`${appUrl}/.netlify/functions/send-sms`, {
          method: 'POST',
          body: JSON.stringify({ to: phoneE164, message: `Your OTP is: ${otp}` }),
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (method === 'email') {
        response = await fetch(`${appUrl}/.netlify/functions/send-email`, {
          method: 'POST',
          body: JSON.stringify({ to: credential, subject: 'Your Neon Voting OTP', text: `Your OTP code is: ${otp}. Valid for 5 minutes.`, html: `<div style="font-family: Arial, sans-serif; padding: 20px; background: #0a0e27; color: #00eaff;"><h2 style="color: #9D00FF;">Your OTP Code</h2><p style="font-size: 24px; font-weight: bold; color: #00ffaa;">${otp}</p><p style="color: #888;">This code expires in 5 minutes.</p></div>` }),
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (method === 'whatsapp') {
        response = await fetch(`${appUrl}/.netlify/functions/send-whatsapp`, {
          method: 'POST',
          body: JSON.stringify({ 
            type: 'otp',                // Use approved template
            phone: phoneE164,           // WhatsApp expects 'phone' not 'to'
            data: { otpCode: otp },     // Template variable for OTP
            orgId: orgId                // For Firestore logging
          }),
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (response) {
        const text = await response.text();
        try {
          sendResult = JSON.parse(text);
          // Normalize response format (send-whatsapp uses 'success', others use 'ok')
          if (sendResult.success !== undefined) {
            sendResult.ok = sendResult.success;
          }
        } catch (parseErr) {
          sendResult = { ok: false, error: 'Provider response not valid JSON', raw: text };
        }
      }
    } catch (providerErr) {
      sendResult = { ok: false, error: providerErr.message };
    }

    return {
      statusCode: 200,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ok: !!sendResult.ok,
        error: sendResult.error || null,
        provider: sendResult.provider || null
      }),
    };

  } catch (err) {
    console.error('send-otp error:', err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ok: false, error: err.message }),
    };
  }
};
  
