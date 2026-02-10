// netlify/functions/send-otp.js
const admin = require('firebase-admin');
const fetch = require('node-fetch');

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') : null,
      }),
    });
  } catch (err) {
    console.error('Firebase Admin init failed:', err);
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

    await admin.firestore().doc(`organizations/${orgId}/otp/${userId}`).set({
      otp,
      expiresAt,
      attempts: 0,
      sentVia: method,
    });

    // Send OTP via the appropriate method
    let sendResult = { ok: false };
    const appUrl = process.env.APP_URL || 'https://neonvotingsystemz.netlify.app';
    try {
      let response;
      if (method === 'sms') {
        response = await fetch(`${appUrl}/.netlify/functions/send-sms`, {
          method: 'POST',
          body: JSON.stringify({ to: credential, message: `Your OTP is: ${otp}` }),
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (method === 'email') {
        response = await fetch(`${appUrl}/.netlify/functions/send-email`, {
          method: 'POST',
          body: JSON.stringify({ to: credential, subject: 'Your OTP', message: `Your OTP is: ${otp}` }),
          headers: { 'Content-Type': 'application/json' }
        });
      } else if (method === 'whatsapp') {
        response = await fetch(`${appUrl}/.netlify/functions/send-whatsapp`, {
          method: 'POST',
          body: JSON.stringify({ to: credential, message: `Your OTP is: ${otp}` }),
          headers: { 'Content-Type': 'application/json' }
        });
      }
      if (response) {
        const text = await response.text();
        try {
          sendResult = JSON.parse(text);
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
