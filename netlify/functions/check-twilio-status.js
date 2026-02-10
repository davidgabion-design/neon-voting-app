/**
 * Check Twilio message status
 */

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ ok: false, error: 'Method not allowed' })
    };
  }

  try {
    const { messageSid } = JSON.parse(event.body);

    if (!messageSid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: 'messageSid required' })
      };
    }

    // Validate environment variables
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ 
          ok: false, 
          error: 'Twilio credentials not configured' 
        })
      };
    }

    // Fetch message status from Twilio API
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${messageSid}.json`;

    const response = await fetch(twilioUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          ok: false, 
          error: `Twilio API error: ${errorText}` 
        })
      };
    }

    const messageData = await response.json();

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        ok: true,
        message: {
          sid: messageData.sid,
          status: messageData.status,
          to: messageData.to,
          from: messageData.from,
          direction: messageData.direction,
          dateSent: messageData.date_sent,
          dateCreated: messageData.date_created,
          price: messageData.price,
          priceUnit: messageData.price_unit,
          errorCode: messageData.error_code,
          errorMessage: messageData.error_message
        }
      })
    };
  } catch (error) {
    console.error('Error checking Twilio status:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        ok: false, 
        error: error.message 
      })
    };
  }
};
