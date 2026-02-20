/**
 * Safe JSON Parser - Prevents "Unexpected token" crashes
 * Used across all session restore and localStorage operations
 */

/**
 * Safely parse JSON string with fallback
 * @param {string} str - JSON string to parse
 * @param {*} fallback - Value to return if parsing fails
 * @returns {*} Parsed object or fallback
 */
export function safeJsonParse(str, fallback = null) {
  // Handle empty/undefined/null strings
  if (!str || str === 'undefined' || str === 'null' || str.trim() === '') {
    return fallback;
  }

  try {
    return JSON.parse(str);
  } catch (err) {
    console.warn('[safeJsonParse] Failed to parse JSON:', {
      input: str.substring(0, 100) + (str.length > 100 ? '...' : ''),
      error: err.message
    });
    return fallback;
  }
}

/**
 * Safely stringify with error handling
 * @param {*} obj - Object to stringify
 * @param {string} fallback - Value to return if stringify fails
 * @returns {string} JSON string or fallback
 */
export function safeJsonStringify(obj, fallback = '{}') {
  try {
    return JSON.stringify(obj);
  } catch (err) {
    console.error('[safeJsonStringify] Failed to stringify object:', err);
    return fallback;
  }
}

/**
 * Safe localStorage getter with JSON parsing
 * @param {string} key - localStorage key
 * @param {*} fallback - Default value if missing/invalid
 * @returns {*} Parsed value or fallback
 */
export function getStorageJson(key, fallback = null) {
  try {
    const value = localStorage.getItem(key);
    return safeJsonParse(value, fallback);
  } catch (err) {
    console.warn(`[getStorageJson] Failed to read ${key}:`, err);
    return fallback;
  }
}

/**
 * Safe localStorage setter with JSON stringify
 * @param {string} key - localStorage key
 * @param {*} value - Value to store
 * @returns {boolean} Success status
 */
export function setStorageJson(key, value) {
  try {
    const jsonStr = safeJsonStringify(value);
    localStorage.setItem(key, jsonStr);
    return true;
  } catch (err) {
    console.error(`[setStorageJson] Failed to write ${key}:`, err);
    return false;
  }
}
