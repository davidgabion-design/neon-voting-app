// js/utils/validation.js - Input Validation Functions

/**
 * Validate email address format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if valid email format
 */
export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

/**
 * Validate phone number format (E.164)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone format
 */
export function validatePhoneNumber(phone) {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone);
}

/**
 * Validate date of birth
 * @param {string} dateStr - Date string to validate
 * @returns {object} Validation result with { valid, error, date }
 */
export function validateDateOfBirth(dateStr) {
  if (!dateStr || dateStr.trim() === '') {
    return { valid: true };
  }
  
  dateStr = dateStr.trim();
  
  let date;
  
  // Try different date formats
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
    const parts = dateStr.split('-');
    date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
    const parts = dateStr.split('/');
    date = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr) && dateStr.includes('/')) {
    const parts = dateStr.split('/');
    date = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
  } else {
    date = new Date(dateStr);
  }
  
  if (isNaN(date.getTime())) {
    return { 
      valid: false, 
      error: 'Invalid date format. Please use YYYY-MM-DD or DD/MM/YYYY format.' 
    };
  }
  
  const today = new Date();
  if (date > today) {
    return { 
      valid: false, 
      error: 'Date of birth cannot be in the future.' 
    };
  }
  
  const ageInYears = (today - date) / (1000 * 60 * 60 * 24 * 365.25);
  if (ageInYears > 150) {
    return { 
      valid: false, 
      error: 'Age seems unrealistic. Please check the date.' 
    };
  }
  
  return { 
    valid: true, 
    date: date.toISOString().split('T')[0]
  };
}

/**
 * Validate credential (email, phone, or voter ID)
 * @param {string} credential - Credential to validate
 * @returns {object} Validation result with { valid, type, error }
 */
export function validateCredential(credential) {
  if (!credential || !credential.trim()) {
    return { valid: false, error: 'Credential is required' };
  }
  
  const cred = credential.trim();
  
  // Check if email
  if (validateEmail(cred)) {
    return { valid: true, type: 'email' };
  }
  
  // Check if phone
  const normalizedPhone = cred.replace(/\D/g, '');
  if (normalizedPhone.length >= 7) {
    return { valid: true, type: 'phone' };
  }
  
  // Otherwise, treat as org voter ID
  if (cred.length >= 3) {
    return { valid: true, type: 'voterId' };
  }
  
  return { valid: false, error: 'Invalid credential format' };
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
export function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Normalize email address
 * @param {string} v - Email to normalize
 * @returns {string} Lowercase trimmed email
 */
export function normalizeEmailAddr(v) {
  return v ? String(v).trim().toLowerCase() : "";
}

/**
 * Normalize phone to E.164 format
 * @param {string} raw - Phone number
 * @returns {string} E.164 formatted phone
 */
export function normalizePhoneE164(raw) {
  if (!raw) return "";
  let p = String(raw).replace(/\s+/g, "").trim();
  // Accept +233..., 233..., 0...
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (p.startsWith("0")) p = "+233" + p.slice(1); // Default Ghana
  if (!p.startsWith("+") && /^\d{7,}$/.test(p)) p = "+233" + p;
  // Keep only + and digits
  p = "+" + p.replace(/[^0-9]/g, "");
  if (p === "+") return "";
  return p;
}

/**
 * Normalize org voter ID
 * @param {string} v - Voter ID
 * @returns {string} Lowercase trimmed ID
 */
export function normalizeOrgVoterId(v) {
  return v ? String(v).trim().toLowerCase() : "";
}

/**
 * Build voter document ID from credential
 * @param {string} credential - Email or phone
 * @returns {string} Encoded document ID
 */
export function buildVoterDocIdFromCredential(credential) {
  const c = String(credential || "").trim();
  const email = normalizeEmailAddr(c);
  if (email && validateEmail(email)) return encodeURIComponent(email);

  const phone = normalizePhoneE164(c);
  if (phone && phone.length >= 8) return encodeURIComponent("tel:" + phone);

  const oid = normalizeOrgVoterId(c);
  if (oid) return encodeURIComponent("id:" + oid);

  return "";
}

export default {
  validateEmail,
  validatePhoneNumber,
  validateDateOfBirth,
  validateCredential,
  escapeHtml,
  normalizeEmailAddr,
  normalizePhoneE164,
  normalizeOrgVoterId,
  buildVoterDocIdFromCredential
};
