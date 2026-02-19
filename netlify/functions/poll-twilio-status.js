const twilio = require('twilio');
const admin = require('firebase-admin');
const { getTwilioAuth } = require('./_shared/env');

// Simple in-memory rate limiter (resets on cold starts)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;

function checkRateLimit(identifier) {
  const now = Date.now();
  const bucket = rateLimitMap.get(identifier) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW };
  
  if (now > bucket.resetAt) {
    bucket.count = 1;
    bucket.resetAt = now + RATE_LIMIT_WINDOW;
    rateLimitMap.set(identifier, bucket);
    return true;
  }
  
  if (bucket.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }
  
  bucket.count++;
  rateLimitMap.set(identifier, bucket);
  return true;
}

// Initialize Firebase Admin (for status updates)
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

module.exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'POST only' }) };
  }

  try {
    // Rate limiting by IP or source
    const clientIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ 
          ok: false, 
          error: 'Rate limit exceeded. Max 20 requests per minute.' 
        })
      };
    }

    const { sid } = JSON.parse(event.body || '{}');
    if (!sid) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'sid required' }) };
    }

    let accountSid;
    let authToken;
    try {
      ({ accountSid, authToken } = getTwilioAuth());
    } catch (envErr) {
      return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: envErr.message }) };
    }

    const client = twilio(accountSid, authToken);
    const message = await client.messages(sid).fetch();

    // Update Firestore log entries for this sid
    if (admin.apps.length) {
      const db = admin.firestore();
      const snap = await db.collection('message_logs').where('messageSid', '==', sid).get();
      if (!snap.empty) {
        const batch = db.batch();
        snap.forEach(doc => {
          batch.update(doc.ref, {
            status: message.status,
            errorCode: message.errorCode || null,
            errorMessage: message.errorMessage || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        });
        await batch.commit();
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        message: {
          sid: message.sid,
          status: message.status,
          to: message.to,
          from: message.from,
          errorCode: message.errorCode,
          errorMessage: message.errorMessage
        }
      })
    };
  } catch (err) {
    console.error('[Poll Status] Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
