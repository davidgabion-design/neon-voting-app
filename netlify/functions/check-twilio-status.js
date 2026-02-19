/**
 * Check Twilio message status
 * Rate limited to prevent abuse
 */

const { getTwilioAuth } = require('./_shared/env');

// Simple in-memory rate limiter (resets on cold starts)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

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
    // Rate limiting by IP or source
    const clientIp = event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return {
        statusCode: 429,
        headers,
        body: JSON.stringify({ 
          ok: false, 
          error: 'Rate limit exceeded. Max 10 requests per minute.' 
        })
      };
    }

    let parsedBody;
    try {
      parsedBody = JSON.parse(event.body || '{}');
    } catch (parseErr) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: 'Invalid JSON payload' })
      };
    }

    const { messageSid } = parsedBody;

    if (!messageSid) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: 'messageSid required' })
      };
    }

    const sidPattern = /^SM[0-9a-fA-F]{32}$/;
    if (!sidPattern.test(messageSid)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ ok: false, error: 'Invalid messageSid format' })
      };
    }

    let accountSid;
    let authToken;
    try {
      ({ accountSid, authToken } = getTwilioAuth());
    } catch (envErr) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ ok: false, error: envErr.message })
      };
    }

    // Fetch message status from Twilio API
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${messageSid}.json`;

    // Time-bound the request to avoid hanging lambdas
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch(twilioUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`
        },
        signal: controller.signal
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      
      // Handle timeout specifically
      if (fetchError.name === 'AbortError') {
        return {
          statusCode: 408,
          headers,
          body: JSON.stringify({ 
            ok: false, 
            error: 'Request timeout: Twilio API did not respond within 15 seconds' 
          })
        };
      }
      
      // Network errors
      return {
        statusCode: 502,
        headers,
        body: JSON.stringify({ 
          ok: false, 
          error: `Network error: ${fetchError.message}` 
        })
      };
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const errorText = await response.text();
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ 
          ok: false, 
          error: `Twilio API error: ${errorText.slice(0, 500)}` 
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
