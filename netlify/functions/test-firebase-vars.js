// netlify/functions/test-firebase-vars.js
// Tests the individual Firebase environment variables

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({
      status: 'check',
      hasProjectId: !!projectId,
      projectId: projectId || 'NOT SET',
      hasClientEmail: !!clientEmail,
      clientEmail: clientEmail || 'NOT SET',
      hasPrivateKey: !!privateKey,
      privateKeyLength: privateKey ? privateKey.length : 0,
      privateKeyPreview: privateKey ? privateKey.substring(0, 50) + '...' : 'NOT SET',
      allSet: !!(projectId && clientEmail && privateKey)
    })
  };
};
