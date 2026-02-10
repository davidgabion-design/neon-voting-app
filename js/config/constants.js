// js/config/constants.js - Application Constants & Configuration

// Session Storage Key
export const SESSION_KEY = "neon_voting_session_v8";

// API Endpoints (Netlify Functions)
export const API_ENDPOINTS = {
  SEND_INVITE: '/.netlify/functions/send-invite',
  SEND_EMAIL: '/.netlify/functions/send-email',
  SEND_INVITE_SMS: '/.netlify/functions/send-invite-sms',
  SEND_SMS: '/.netlify/functions/send-sms',
  SEND_WHATSAPP: '/.netlify/functions/send-whatsapp',
  TEST_RUNTIME: '/.netlify/functions/test-runtime'
};

// Default App Settings
export const DEFAULT_SETTINGS = {
  APP_NAME: 'Neon Voting',
  APP_VERSION: 'v8',
  DEFAULT_LOGO_ICON: 'fa-vote-yea',
  BULK_SEND_DELAY: 100, // milliseconds between bulk invites
  MAX_BULK_INVITES: 1000
};

// Voter Credential Types
export const CREDENTIAL_TYPES = {
  EMAIL: 'email',
  PHONE: 'phone',
  PIN: 'pin'
};

// Invite Status
export const INVITE_STATUS = {
  PENDING: 'pending',
  SENT: 'sent',
  FAILED: 'failed',
  DELIVERED: 'delivered'
};

// Invite Types
export const INVITE_TYPES = {
  EMAIL: 'email',
  SMS: 'sms',
  WHATSAPP: 'whatsapp'
};

// Recipient Types
export const RECIPIENT_TYPES = {
  VOTER: 'voter',
  EC: 'ec'
};

// Organization Status
export const ORG_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  ARCHIVED: 'archived'
};

// Approval Status
export const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected'
};

// Tabs
export const TABS = {
  VOTERS: 'voters',
  POSITIONS: 'positions',
  CANDIDATES: 'candidates',
  INVITES: 'invites',
  OUTCOMES: 'outcomes',
  SETTINGS: 'settings',
  APPROVAL: 'approval'
};

// Settings Sub-tabs
export const SETTINGS_TABS = {
  GENERAL: 'general',
  EC_ACCOUNTS: 'ec-accounts',
  TEMPLATES: 'templates'
};

// Phone Number Validation
export const PHONE_REGEX = /^\+?[1-9]\d{1,14}$/; // E.164 format

// Email Validation
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Date Format
export const DATE_FORMAT = {
  SHORT: 'MM/DD/YYYY',
  LONG: 'MMMM DD, YYYY',
  TIME: 'HH:mm:ss',
  DATETIME: 'MM/DD/YYYY HH:mm:ss'
};

// Default Templates
export const DEFAULT_TEMPLATES = {
  VOTER_EMAIL_SUBJECT: 'Your Voting Credentials for {orgName}',
  VOTER_EMAIL_BODY: `Dear {voterName},

You have been invited to participate in the voting process for {orgName}.

Your voting credentials:
- Credential: {credential}
- Type: {credentialType}

Please use these credentials to access the voting portal and cast your vote.

Thank you for your participation!`,
  
  EC_EMAIL_SUBJECT: 'Your Electoral Commission Account for {orgName}',
  EC_EMAIL_BODY: `Dear {ecName},

You have been granted Electoral Commission access for {orgName}.

Your login credentials:
- Email: {email}
- Password: {password}

Please log in to manage the voting process.

Best regards,
Super Admin`,
  
  VOTER_SMS_MESSAGE: 'Hi {voterName}, your voting credential for {orgName}: {credential}. Use this to vote.',
  
  EC_SMS_MESSAGE: 'Hi {ecName}, your EC login for {orgName} - Email: {email}, Password: {password}'
};

// Storage Paths
export const STORAGE_PATHS = {
  ORG_LOGOS: 'organizations/{orgId}/logo',
  VOTER_AVATARS: 'organizations/{orgId}/voters/{voterId}/avatar',
  CANDIDATE_PHOTOS: 'organizations/{orgId}/candidates/{candidateId}/photo'
};

// Firestore Collections
export const COLLECTIONS = {
  ORGANIZATIONS: 'organizations',
  VOTERS: 'voters',
  POSITIONS: 'positions',
  CANDIDATES: 'candidates',
  VOTES: 'votes',
  INVITES: 'invites',
  INVITE_TEMPLATES: 'inviteTemplates',
  META: 'meta'
};

// Super Admin Path
export const SUPER_ADMIN_DOC = 'meta/superAdmin';

// Default Assets
export const DEFAULT_LOGO_DATA_URL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDQiIGhlaWdodD0iNDQiIHZpZXdCb3g9IjAgMCA0NCA0NCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDQiIGhlaWdodD0iNDQiIHJ4PSIxNCIgZmlsbD0idXJsKCNncmFkaWVudDApIi8+PGRlZnM+PGxpbmVhckdyYWRpZW50IGlkPSJncmFkaWVudDAiIHgxPSIwIiB5MT0iMCIgeDI9IjQ0IiB5Mj0iNDQiIGdyYWRpZW50VW5pdHM9InVzZXJTcGFjZU9uVXNlIj48c3RvcCBzdG9wLWNvbG9yPSIjOUQwMEZGIi8+PHN0b3Agb2Zmc2V0PSIxIiBzdG9wLWNvbG9yPSIjMDBDM0ZGIi8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PC9zdmc+';

export const DEFAULT_AVATAR_DATA_URL = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSIzMCIgY3k9IjMwIiByPSIzMCIgZmlsbD0iIzExMWEzMyIvPjxjaXJjbGUgY3g9IjMwIiBjeT0iMjUiIHI9IjEwIiBmaWxsPSIjOWJiMmQwIi8+PHBhdGggZD0iTTEwIDUwYzAtMTEgOS0yMCAyMC0yMHMyMCA5IDIwIDIwIiBmaWxsPSIjOWJiMmQwIi8+PC9zdmc+';

// Export all constants as a single object for convenience
export default {
  SESSION_KEY,
  API_ENDPOINTS,
  DEFAULT_SETTINGS,
  CREDENTIAL_TYPES,
  INVITE_STATUS,
  INVITE_TYPES,
  RECIPIENT_TYPES,
  ORG_STATUS,
  APPROVAL_STATUS,
  TABS,
  SETTINGS_TABS,
  PHONE_REGEX,
  EMAIL_REGEX,
  DATE_FORMAT,
  DEFAULT_TEMPLATES,
  STORAGE_PATHS,
  COLLECTIONS,
  SUPER_ADMIN_DOC,
  DEFAULT_LOGO_DATA_URL,
  DEFAULT_AVATAR_DATA_URL
};
