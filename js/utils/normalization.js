// js/utils/normalization.js - Data Normalization Functions

import { validateEmail } from './validation.js';

/**
 * Normalize email address (lowercase, trim)
 * @param {string} email - Email to normalize
 * @returns {string} Normalized email
 */
export function normalizeEmailAddr(email) {
  return email ? String(email).trim().toLowerCase() : "";
}

/**
 * Normalize phone number to E.164 format
 * @param {string} raw - Raw phone number
 * @returns {string} Normalized phone in E.164 format (+233XXXXXXXXX)
 */
export function normalizePhoneE164(raw) {
  if (!raw) return "";
  let p = String(raw).replace(/\s+/g, "").trim();
  
  // Handle different formats
  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (p.startsWith("0")) p = "+233" + p.slice(1); // Default Ghana
  if (!p.startsWith("+") && /^\d{7,}$/.test(p)) p = "+233" + p; // Fallback
  
  // Keep only + and digits
  p = "+" + p.replace(/[^0-9]/g, "");
  if (p === "+") return "";
  return p;
}

/**
 * Normalize phone number (remove all non-digits)
 * @param {string} phone - Phone number to normalize
 * @returns {string} Normalized phone (digits only)
 */
export function normalizePhoneNumber(phone) {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Normalize organization voter ID (lowercase, trim)
 * @param {string} voterId - Voter ID to normalize
 * @returns {string} Normalized voter ID
 */
export function normalizeOrgVoterId(voterId) {
  return voterId ? String(voterId).trim().toLowerCase() : "";
}

/**
 * Build voter document ID from credential
 * Creates consistent IDs for email, phone, or org voter ID
 * @param {string} credential - Email, phone, or voter ID
 * @returns {string} URL-encoded document ID
 */
export function buildVoterDocIdFromCredential(credential) {
  const c = String(credential || "").trim();
  
  // Try email first
  const email = normalizeEmailAddr(c);
  if (email && validateEmail(email)) {
    return encodeURIComponent(email);
  }
  
  // Try phone
  const phone = normalizePhoneE164(c);
  if (phone && phone.length >= 8) {
    return encodeURIComponent("tel:" + phone);
  }
  
  // Fall back to org voter ID
  const oid = normalizeOrgVoterId(c);
  if (oid) {
    return encodeURIComponent("id:" + oid);
  }
  
  return "";
}

/**
 * Decode voter document ID back to credential
 * @param {string} docId - URL-encoded document ID
 * @returns {object} Decoded credential with { type, value }
 */
export function decodeVoterDocId(docId) {
  try {
    const decoded = decodeURIComponent(docId);
    
    // Phone format: tel:+233XXXXXXXXX
    if (decoded.startsWith('tel:')) {
      return { type: 'phone', value: decoded.substring(4) };
    }
    
    // Org voter ID format: id:XXXXX
    if (decoded.startsWith('id:')) {
      return { type: 'voterId', value: decoded.substring(3) };
    }
    
    // Email format: email@example.com
    if (decoded.includes('@')) {
      return { type: 'email', value: decoded };
    }
    
    // Unknown format
    return { type: 'unknown', value: decoded };
  } catch (e) {
    return { type: 'unknown', value: docId };
  }
}

/**
 * Normalize string for comparison (lowercase, trim, remove extra spaces)
 * @param {string} str - String to normalize
 * @returns {string} Normalized string
 */
export function normalizeString(str) {
  if (!str) return "";
  return String(str).trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Detect credential type from string
 * @param {string} credential - Credential to analyze
 * @returns {string} Type: 'email', 'phone', or 'voterId'
 */
export function detectCredentialType(credential) {
  if (!credential) return 'unknown';
  
  const c = String(credential).trim();
  
  // Check email
  if (validateEmail(c)) return 'email';
  
  // Check phone (has digits and is >= 7 chars when cleaned)
  const phoneDigits = c.replace(/\D/g, '');
  if (phoneDigits.length >= 7) return 'phone';
  
  // Default to voter ID
  return 'voterId';
}

export default {
  normalizeEmailAddr,
  normalizePhoneE164,
  normalizePhoneNumber,
  normalizeOrgVoterId,
  buildVoterDocIdFromCredential,
  decodeVoterDocId,
  normalizeString,
  detectCredentialType
};
