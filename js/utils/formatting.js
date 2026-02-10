// js/utils/formatting.js - Data Formatting Functions

/**
 * Format phone number for display
 * @param {string} phone - Phone number to format
 * @returns {string} Formatted phone number
 */
export function formatPhoneForDisplay(phone) {
  if (!phone) return "No phone";
  const clean = phone.replace(/\D/g, '');
  
  // Ghana format: +233 XXX XXX XXX
  if (clean.startsWith('233') && clean.length === 12) {
    const local = clean.substring(3);
    return `+233 ${local.substring(0, 3)} ${local.substring(3, 6)} ${local.substring(6)}`;
  }
  
  // Convert local 0XXXXXXXXX to +233 format
  if (clean.length === 10 && clean.startsWith('0')) {
    return `+233 ${clean.substring(1, 4)} ${clean.substring(4, 7)} ${clean.substring(7)}`;
  }
  
  // Default: just add +
  return `+${clean}`;
}

/**
 * Format date for display
 * @param {Date} date - Date object to format
 * @returns {string} Formatted date string
 */
export function formatDateForDisplay(date) {
  if (!date || isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

/**
 * Format Firestore timestamp for display
 * @param {object} timestamp - Firestore timestamp object
 * @returns {string} Formatted timestamp string
 */
export function formatFirestoreTimestamp(timestamp) {
  if (!timestamp) return 'N/A';
  
  try {
    let date;
    
    // Handle Firestore timestamp
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      date = timestamp.toDate();
    } else if (timestamp instanceof Date) {
      date = timestamp;
    } else {
      date = new Date(timestamp);
    }
    
    if (isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch(e) {
    console.error('Error formatting timestamp:', e);
    return 'N/A';
  }
}

/**
 * Format number with commas
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
export function formatNumber(num) {
  if (typeof num !== 'number') return '0';
  return num.toLocaleString('en-US');
}

/**
 * Format percentage
 * @param {number} value - Decimal value (0-1)
 * @param {number} decimals - Number of decimal places
 * @returns {string} Formatted percentage string
 */
export function formatPercentage(value, decimals = 1) {
  if (typeof value !== 'number') return '0%';
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format duration in human-readable format
 * @param {number} milliseconds - Duration in milliseconds
 * @returns {string} Formatted duration string
 */
export function formatDuration(milliseconds) {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
  if (minutes > 0) return `${minutes} min${minutes > 1 ? 's' : ''}`;
  return `${seconds} sec${seconds > 1 ? 's' : ''}`;
}

/**
 * Truncate text with ellipsis
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum length before truncation
 * @returns {string} Truncated text
 */
export function truncateText(text, maxLength = 50) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

/**
 * Get initials from name
 * @param {string} name - Full name
 * @returns {string} Initials (max 2 characters)
 */
export function getInitials(name) {
  if (!name) return 'UN';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default {
  formatPhoneForDisplay,
  formatDateForDisplay,
  formatFirestoreTimestamp,
  formatNumber,
  formatPercentage,
  formatDuration,
  truncateText,
  getInitials
};
