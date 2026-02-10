# AI Agent Instructions: Neon Voting App

## Big Picture

- Frontend: Single-page static app in index.html + script.js (monolithic UI controllers, Firebase modular SDK via CDN).
- Backend: Netlify Functions in netlify/functions/_.js for email, SMS, WhatsApp; called from the frontend via fetch to /.netlify/functions/_.
- Data: Firestore under organizations/{orgId}/ with subcollections voters, positions, candidates, votes, invites, inviteTemplates.
- Why this shape: Static hosting keeps UX fast; serverless handles outbound messaging and credentials; Firestore provides real-time sync across Super Admin and EC dashboards.

## Core Files & Responsibilities

- index.html: Role-based UI screens, tab containers, component markup, and Neon styles.
- script.js: All app logic (tab switching, EC/Super Admin flows, Firestore access, invite send + tracking, outcomes, bulk ops). Key entrypoints: showECTab(), loginEC(), loginSuperAdmin(), loadECVoters(), loadInvitesTracking(), sendVoterInvite(), sendVoterInviteSMS().
- firebase-config.js: Environment-aware Firebase config exported as window.firebaseConfig (script.js currently hardcodes config).
- netlify/functions:
  - send-invite.js (SMTP via Nodemailer) and send-email.js (generic email send)
  - send-invite-sms.js and send-sms.js (Twilio SMS)
  - send-whatsapp.js (Twilio WhatsApp with CORS + error codes)
  - test-runtime.js (quick runtime check)
- netlify.toml: Publishes root and maps /.netlify/functions; includes /api/\* redirect to functions.
- firebase-setup.js: One-off helper to seed meta/superAdmin and a test org.

## Data Model & Patterns

- Firestore paths: organizations/{orgId}/{subcollection}. Voter docs often use URL-encoded email as id; decode via decodeURIComponent in UI.
- Invites: organizations/{orgId}/invites with fields {type, email|phone, name, sentAt, status, sentBy}. UI aggregates stats and filtering client-side.
- Templates: organizations/{orgId}/inviteTemplates with voterSubject/body and ecSubject/body; defaults via getDefaultInviteTemplates().
- Real-time: onSnapshot on organizations/{orgId} drives EC dashboard updates and global dashboard metrics.

## Serverless API Contracts

- send-invite.js (POST): {to, recipientType: "ec"|"voter", orgName, orgId, recipientName, credentials:{password|credential,type}} → {ok, provider:"nodemailer", messageId}.
- send-invite-sms.js (POST): {phone, message, recipientType, orgId, recipientName} → {ok, provider:"twilio", messageId}.
- send-sms.js (POST): {to, message} with env TWILIO_SMS_FROM; returns {ok, sid}.
- send-whatsapp.js (POST/OPTIONS): {to, message, voterName?, voterPin?, orgId?}; validates E.164, wraps numbers with whatsapp:. Returns {ok, sid, status} or granular errors (e.g., 21211, 21608).
- Conventions: POST-only, JSON body parse with defensive errors, CORS headers on responses, consistent {ok:boolean, error?:string} shape.

## Workflows

- Local dev (functions):
  - Ensure Node deps: npm install (uses nodemailer, twilio, node-fetch).
  - Netlify CLI: netlify login; netlify init; netlify dev to run functions and serve static site.
  - Quick check: call /.netlify/functions/test-runtime.
- Deploy:
  - Windows: run deploy-netlify.ps1 for guided steps or use Netlify UI drag-and-drop.
  - Linux/macOS: deploy.sh or `netlify deploy --prod` after init.
- Firebase rules: firestore.rules currently allow read/write true (development-heavy). storage.rules allow public reads under organizations/\* and gated writes. Adjust for production if needed.

## Conventions To Follow

- Frontend fetch endpoints use /.netlify/functions/_ (not /api/_); keep response shape aligned with {ok, ...} used in UI to drive toasts.
- Bulk operations: respect ~100ms delay between sends; update invites collection for tracking immediately after successful provider response.
- UI loaders: call showQuickLoading(containerId, msg) before async content; renderError(containerId, msg, retryFn) on failures.
- Tab rendering: use showECTab() and lazy-load content per tab; avoid re-render loops by checking dataset.loaded.
- Metrics: When possible, update organizations/{orgId} voterCount/voteCount but tolerate permission failures (UI continues).

## Env Vars (Netlify)

- SMTP: SMTP_HOST, SMTP_PORT, EMAIL_USER, EMAIL_PASS, SMTP_FROM (send-invite.js uses EMAIL_USER/EMAIL_PASS).
- Twilio SMS: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SMS_FROM or TWILIO_PHONE_NUMBER.
- WhatsApp: TWILIO_WHATSAPP_FROM (e.g., whatsapp:+1XXXXXXXXXX).
- App URL: APP_URL for links in emails/SMS.

## Adding Features Safely

- New function: place in netlify/functions, export handler with POST-only, JSON parse, CORS, and {ok} result; document payload in ARCHITECTURE.md.
- Frontend: add button/actions in index.html; wire to script.js using existing patterns (toast, loaders, Firestore writes, 100ms bulk delay).
- Data: keep collection paths under organizations/{orgId}/... and update invites tracking if user-facing.

References: See ARCHITECTURE.md and IMPLEMENTATION_SUMMARY.md for detailed flows; study script.js for function names and UI integration, and netlify/functions for API patterns.
