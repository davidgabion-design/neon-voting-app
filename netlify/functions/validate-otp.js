// netlify/functions/validate-otp.js
const admin = require('firebase-admin');

// Initialize Firebase Admin with service account or use default credentials
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
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Allow-Methods": "POST, OPTIONS"
      },
      body: ''
    };
  }

  // Enforce POST method
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ok: false, error: 'Method not allowed. Use POST.' })
    };
  }

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  try {
    const { orgId, userId, otp } = JSON.parse(event.body);
    if (!orgId || !userId || !otp) {
      return { 
        statusCode: 400, 
        headers,
        body: JSON.stringify({ ok: false, error: 'Missing fields' }) 
      };
    }

    const docRef = admin.firestore().doc(`organizations/${orgId}/otp/${userId}`);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      return { 
        statusCode: 404, 
        headers,
        body: JSON.stringify({ ok: false, error: 'OTP not found' }) 
      };
    }

    const data = doc.data();
    
    if (Date.now() > data.expiresAt) {
      return { 
        statusCode: 400, 
        headers,
        body: JSON.stringify({ ok: false, error: 'OTP expired' }) 
      };
    }
    
    if (data.attempts >= 5) {
      return { 
        statusCode: 400, 
        headers,
        body: JSON.stringify({ ok: false, error: 'Too many attempts' }) 
      };
    }

    if (data.otp !== otp) {
      await docRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
      return { 
        statusCode: 400, 
        headers,
        body: JSON.stringify({ ok: false, error: 'Invalid OTP' }) 
      };
    }

    // 🔒 SECURITY: Verify EC ownership of organization
    if (userId === 'ec') {
      try {
        const orgRef = admin.firestore().doc(`organizations/${orgId}`);
        const orgSnap = await orgRef.get();
        
        if (!orgSnap.exists) {
          return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ ok: false, error: 'Organization not found' })
          };
        }
        
        const orgData = orgSnap.data();
        if (!orgData.ecEmail && !orgData.ecPhone) {
          return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ ok: false, error: 'EC not configured for this organization' })
          };
        }
      } catch (verifyErr) {
        console.error('Org verification error:', verifyErr);
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ ok: false, error: 'Verification failed' })
        };
      }
    }

    // Success: delete OTP
    await docRef.delete();
    return { 
      statusCode: 200, 
      headers,
      body: JSON.stringify({ ok: true, message: 'OTP validated', orgId })
      body: JSON.stringify({ ok: true }) 
    };
  } catch (e) {
    console.error('Validate OTP error:', e);
    return { 
      statusCode: 500, 
      headers,
      body: JSON.stringify({ ok: false, error: e.message }) 
    };
  }
};
