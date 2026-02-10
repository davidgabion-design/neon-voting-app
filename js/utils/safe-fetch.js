// js/utils/safe-fetch.js
/**
 * safeFetch - fetch wrapper that always returns valid JSON or error info
 * @param {string} url - endpoint
 * @param {object} options - fetch options
 * @returns {Promise<object>} { ok, data, error, raw }
 */
export async function safeFetch(url, options = {}) {
  try {
    const response = await fetch(url, options);
    const text = await response.text();
    try {
      const data = JSON.parse(text);
      return { ok: true, data };
    } catch (parseErr) {
      // Not JSON, likely HTML or plain text error
      return {
        ok: false,
        error: 'Response not valid JSON',
        raw: text,
        status: response.status
      };
    }
  } catch (err) {
    return { ok: false, error: err.message, raw: null };
  }
}
