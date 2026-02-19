const admin = require('firebase-admin');

// Initialize Firebase Admin (for status logging)
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

  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ ok: false, error: 'POST only' }) };
  }

  try {
    const contentType = (event.headers['content-type'] || event.headers['Content-Type'] || '').toLowerCase();
    let params = {};

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const sp = new URLSearchParams(event.body || '');
      sp.forEach((v, k) => { params[k] = v; });
    } else {
      // Fallback for JSON
      params = JSON.parse(event.body || '{}');
    }

    const messageSid = params.MessageSid || params.SmsSid || params.sid || params.messageSid;
    const messageStatus = params.MessageStatus || params.SmsStatus || params.status || 'unknown';
    const to = params.To || params.to || null;
    const from = params.From || params.from || null;
    const errorCode = params.ErrorCode || params.error_code || null;
    const errorMessage = params.ErrorMessage || params.error_message || null;

    if (!messageSid) {
      return { statusCode: 400, headers, body: JSON.stringify({ ok: false, error: 'MessageSid required' }) };
    }

    console.log('[WhatsApp Callback] Update:', { messageSid, messageStatus, to, from, errorCode, errorMessage });

    // Update message_logs entry by messageSid
    if (admin.apps.length) {
      const db = admin.firestore();
      const snap = await db.collection('message_logs').where('messageSid', '==', messageSid).get();

      if (snap.empty) {
        // Create a minimal log if none exists
        await db.collection('message_logs').add({
          type: 'whatsapp',
          provider: 'twilio',
          messageSid,
          status: messageStatus,
          recipient: to || null,
          from: from || null,
          errorCode: errorCode || null,
          errorMessage: errorMessage || null,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdFrom: 'statusCallback'
        });
      } else {
        const batch = db.batch();
        snap.forEach(doc => {
          batch.update(doc.ref, {
            status: messageStatus,
            errorCode: errorCode || null,
            errorMessage: errorMessage || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        });
        await batch.commit();
      }
    }

    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  } catch (err) {
    console.error('[WhatsApp Callback] Error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ ok: false, error: err.message }) };
  }
};
