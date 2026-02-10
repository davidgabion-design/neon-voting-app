/**
 * Credential Types Configuration
 * Defines available credential types for different organization types
 */

/**
 * Available credential type configurations
 */
export const CREDENTIAL_TYPES = {
  EMAIL_PHONE: {
    id: 'email_phone',
    label: 'Email & Phone',
    description: 'Standard email and phone number credentials',
    primaryField: 'email',
    secondaryField: 'phone',
    primaryLabel: 'Email or Phone Number',
    secondaryLabel: 'Phone Number',
    primaryPlaceholder: 'voter@example.com or +233501234567',
    secondaryPlaceholder: '+1234567890',
    primaryIcon: 'fa-envelope',
    secondaryIcon: 'fa-phone',
    useCase: 'General elections, corporate voting'
  },
  STUDENT_ID: {
    id: 'student_id',
    label: 'Student ID',
    description: 'Student identification numbers',
    primaryField: 'studentId',
    secondaryField: 'email',
    primaryLabel: 'Student ID',
    secondaryLabel: 'Email (Optional)',
    primaryPlaceholder: 'STU-12345 or 2024001',
    secondaryPlaceholder: 'student@school.edu',
    primaryIcon: 'fa-id-card',
    secondaryIcon: 'fa-envelope',
    useCase: 'Schools, universities, educational institutions'
  },
  STAFF_ID: {
    id: 'staff_id',
    label: 'Staff ID',
    description: 'Employee/Staff identification numbers',
    primaryField: 'staffId',
    secondaryField: 'email',
    primaryLabel: 'Staff ID',
    secondaryLabel: 'Email (Optional)',
    primaryPlaceholder: 'EMP-789 or STAFF-456',
    secondaryPlaceholder: 'staff@organization.com',
    primaryIcon: 'fa-id-badge',
    secondaryIcon: 'fa-envelope',
    useCase: 'Companies, government agencies, organizations'
  },
  MEMBER_ID: {
    id: 'member_id',
    label: 'Member ID',
    description: 'Association or club membership numbers',
    primaryField: 'memberId',
    secondaryField: 'phone',
    primaryLabel: 'Member ID',
    secondaryLabel: 'Phone (Optional)',
    primaryPlaceholder: 'MEM-2024-123 or GMA-456',
    secondaryPlaceholder: '+233501234567',
    primaryIcon: 'fa-users',
    secondaryIcon: 'fa-phone',
    useCase: 'Professional associations, clubs (e.g., Ghana Medical Association)'
  },
  CUSTOM_PIN: {
    id: 'custom_pin',
    label: 'Custom PIN/Code',
    description: 'Organization-specific PIN or unique code',
    primaryField: 'customPin',
    secondaryField: 'name',
    primaryLabel: 'Voter PIN / Code',
    secondaryLabel: 'Full Name',
    primaryPlaceholder: 'PIN-789 or unique code',
    secondaryPlaceholder: 'Full Name',
    primaryIcon: 'fa-key',
    secondaryIcon: 'fa-user',
    useCase: 'Custom voting systems with pre-assigned codes'
  },
  NATIONAL_ID: {
    id: 'national_id',
    label: 'National ID',
    description: 'Government-issued ID numbers',
    primaryField: 'nationalId',
    secondaryField: 'phone',
    primaryLabel: 'National ID / Ghana Card',
    secondaryLabel: 'Phone Number',
    primaryPlaceholder: 'GHA-123456789-0',
    secondaryPlaceholder: '+233501234567',
    primaryIcon: 'fa-id-card',
    secondaryIcon: 'fa-phone',
    useCase: 'National or regional elections'
  }
};

/**
 * Organization type to credential type mapping
 */
export const ORG_TYPE_DEFAULTS = {
  'school': CREDENTIAL_TYPES.STUDENT_ID.id,
  'university': CREDENTIAL_TYPES.STUDENT_ID.id,
  'college': CREDENTIAL_TYPES.STUDENT_ID.id,
  'company': CREDENTIAL_TYPES.STAFF_ID.id,
  'corporate': CREDENTIAL_TYPES.STAFF_ID.id,
  'association': CREDENTIAL_TYPES.MEMBER_ID.id,
  'club': CREDENTIAL_TYPES.MEMBER_ID.id,
  'professional': CREDENTIAL_TYPES.MEMBER_ID.id,
  'government': CREDENTIAL_TYPES.STAFF_ID.id,
  'ngo': CREDENTIAL_TYPES.MEMBER_ID.id,
  'default': CREDENTIAL_TYPES.EMAIL_PHONE.id
};

/**
 * Get credential type configuration by ID
 * @param {string} credentialTypeId - Credential type ID
 * @returns {Object} Credential type configuration
 */
export function getCredentialType(credentialTypeId) {
  return Object.values(CREDENTIAL_TYPES).find(type => type.id === credentialTypeId) || CREDENTIAL_TYPES.EMAIL_PHONE;
}

/**
 * Get recommended credential type for organization type
 * @param {string} orgType - Organization type
 * @returns {string} Recommended credential type ID
 */
export function getRecommendedCredentialType(orgType) {
  const normalizedType = orgType.toLowerCase();
  return ORG_TYPE_DEFAULTS[normalizedType] || ORG_TYPE_DEFAULTS.default;
}

/**
 * Validate credential value based on type
 * @param {string} credentialTypeId - Credential type ID
 * @param {string} value - Value to validate
 * @param {string} field - Field name (primary or secondary)
 * @returns {Object} Validation result {isValid, error}
 */
export function validateCredential(credentialTypeId, value, field = 'primary') {
  const type = getCredentialType(credentialTypeId);
  
  if (!value || value.trim().length === 0) {
    return { isValid: false, error: `${field === 'primary' ? type.primaryLabel : type.secondaryLabel} is required` };
  }
  
  const trimmedValue = value.trim();
  
  // Special case: email_phone type accepts BOTH email and phone
  if (type.id === 'email_phone' && field === 'primary') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const cleanPhone = trimmedValue.replace(/[\s\-\(\)]/g, '');
    
    const isEmail = emailRegex.test(trimmedValue);
    const isPhone = phoneRegex.test(cleanPhone);
    
    if (!isEmail && !isPhone) {
      return { isValid: false, error: 'Please enter a valid email address or phone number (e.g., +233501234567)' };
    }
    return { isValid: true };
  }
  
  // Email validation
  if ((field === 'primary' && type.primaryField === 'email') || 
      (field === 'secondary' && type.secondaryField === 'email')) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedValue)) {
      return { isValid: false, error: 'Invalid email format' };
    }
  }
  
  // Phone validation
  if ((field === 'primary' && type.primaryField === 'phone') || 
      (field === 'secondary' && type.secondaryField === 'phone')) {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(trimmedValue.replace(/[\s\-\(\)]/g, ''))) {
      return { isValid: false, error: 'Invalid phone format (use E.164 format, e.g., +233501234567)' };
    }
  }
  
  // ID/PIN validation (alphanumeric with dashes/underscores)
  if (['studentId', 'staffId', 'memberId', 'customPin', 'nationalId'].includes(type.primaryField)) {
    if (field === 'primary') {
      if (trimmedValue.length < 3) {
        return { isValid: false, error: `${type.primaryLabel} must be at least 3 characters` };
      }
      // Allow alphanumeric, dashes, and underscores
      const idRegex = /^[A-Za-z0-9\-_]+$/;
      if (!idRegex.test(trimmedValue)) {
        return { isValid: false, error: `${type.primaryLabel} can only contain letters, numbers, dashes, and underscores` };
      }
    }
  }
  
  return { isValid: true };
}

/**
 * Format credential for display
 * @param {string} credentialTypeId - Credential type ID
 * @param {Object} voterData - Voter data object
 * @returns {string} Formatted credential display
 */
export function formatCredentialDisplay(credentialTypeId, voterData) {
  const type = getCredentialType(credentialTypeId);
  const primary = voterData[type.primaryField] || '';
  const secondary = voterData[type.secondaryField] || '';
  
  if (secondary) {
    return `${primary} (${secondary})`;
  }
  return primary;
}

/**
 * Get credential field name for storage
 * @param {string} credentialTypeId - Credential type ID
 * @param {string} field - 'primary' or 'secondary'
 * @returns {string} Field name
 */
export function getCredentialFieldName(credentialTypeId, field = 'primary') {
  const type = getCredentialType(credentialTypeId);
  return field === 'primary' ? type.primaryField : type.secondaryField;
}

/**
 * Build voter document ID from credential
 * @param {string} credentialTypeId - Credential type ID
 * @param {string} primaryValue - Primary credential value
 * @returns {string} Document ID (URL-encoded)
 */
export function buildVoterDocId(credentialTypeId, primaryValue) {
  const type = getCredentialType(credentialTypeId);
  
  // Special case: email_phone accepts both email and phone
  if (type.id === 'email_phone') {
    const trimmed = primaryValue.trim();
    // Check if it's an email (contains @)
    if (trimmed.includes('@')) {
      return encodeURIComponent(trimmed.toLowerCase());
    }
    // Otherwise treat as phone - normalize to E.164 format
    let cleanPhone = trimmed.replace(/[\s\-\(\)]/g, '');
    
    // Ensure proper E.164 format with + prefix
    if (!cleanPhone.startsWith('+')) {
      if (cleanPhone.startsWith('0')) {
        // Local format - add Ghana country code
        cleanPhone = '+233' + cleanPhone.slice(1);
      } else if (cleanPhone.startsWith('233')) {
        // Country code without +
        cleanPhone = '+' + cleanPhone;
      } else if (/^\d{7,}$/.test(cleanPhone)) {
        // Just digits - assume Ghana
        cleanPhone = '+233' + cleanPhone;
      }
    }
    
    // Keep only + and digits for E.164
    const digits = cleanPhone.substring(1).replace(/\D/g, '');
    cleanPhone = '+' + digits;
    
    return encodeURIComponent(cleanPhone);
  }
  
  // For email-based systems, maintain backward compatibility
  if (type.primaryField === 'email') {
    return encodeURIComponent(primaryValue.toLowerCase().trim());
  }
  
  // For other ID types, use the ID directly (normalized)
  return primaryValue.toUpperCase().trim().replace(/\s+/g, '-');
}

// Global exports
if (typeof window !== 'undefined') {
  window.CREDENTIAL_TYPES = CREDENTIAL_TYPES;
  window.getCredentialType = getCredentialType;
  window.getRecommendedCredentialType = getRecommendedCredentialType;
  window.validateCredential = validateCredential;
  window.formatCredentialDisplay = formatCredentialDisplay;
  window.getCredentialFieldName = getCredentialFieldName;
  window.buildVoterDocId = buildVoterDocId;
}

export default {
  CREDENTIAL_TYPES,
  getCredentialType,
  getRecommendedCredentialType,
  validateCredential,
  formatCredentialDisplay,
  getCredentialFieldName,
  buildVoterDocId
};
