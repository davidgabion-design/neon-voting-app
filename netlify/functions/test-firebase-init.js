// netlify/functions/test-firebase-init.js
const admin = require('firebase-admin');

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  };

  try {
    const envVar = process.env.FIREBASE_ADMIN_SDK;
    
    if (!envVar) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'error',
          message: 'FIREBASE_ADMIN_SDK environment variable not found',
          envVarExists: false
        })
      };
    }

    // Show first 200 chars and length
    const preview = envVar.substring(0, 200);
    const length = envVar.length;
    
    // Try to parse
    let parseError = null;
    let parsed = null;
    try {
      parsed = JSON.parse(envVar);
    } catch (e) {
      parseError = e.message;
      
      // Try to find the issue
      const pos = e.message.match(/position (\d+)/);
      if (pos) {
        const position = parseInt(pos[1]);
        const context = envVar.substring(Math.max(0, position - 50), position + 50);
        parseError += ` | Context: ...${context}...`;
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        status: parseError ? 'parse_error' : 'success',
        envVarExists: true,
        envVarLength: length,
        envVarPreview: preview,
        parseError,
        projectId: parsed ? parsed.project_id : null,
        hasPrivateKey: parsed ? !!parsed.private_key : null,
        adminAppsLength: admin.apps.length
      })
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        status: 'error',
        error: e.message,
        stack: e.stack
      })
    };
  }
};
