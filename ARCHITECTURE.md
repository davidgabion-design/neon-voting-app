# Invite System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Voting Application                      │
│                                                          │
│  ┌────────────────┐    ┌──────────────────────────────┐│
│  │  EC Interface  │    │    Netlify Functions         ││
│  │                │    │                              ││
│  │ • Send Email   │───→│ send-invite.js               ││
│  │ • Send SMS     │───→│ • SMTP (NodeMailer)          ││
│  │ • Bulk Send    │    │ • Twilio Integration         ││
│  │ • Templates    │    │ send-invite-sms.js           ││
│  │ • Analytics    │    │ • SMS delivery via Twilio    ││
│  └────────────────┘    └──────────────────────────────┘
│           │                          │
│           ├──────────────────────────┼─────────────────┐
│           │                          │                 │
│           ▼                          ▼                 ▼
│  ┌─────────────────┐      ┌──────────────────┐  ┌──────────┐
│  │  Firestore DB   │      │  Email Provider  │  │  Twilio  │
│  │                 │      │  (SMTP/Nodemailer)│ │   API    │
│  │ Collections:    │      │  • Gmail         │  │          │
│  │ • invites       │      │  • SendGrid      │  │ • SMS    │
│  │ • templates     │      │  • Custom SMTP   │  │ • MMS    │
│  │ • voters        │      └──────────────────┘  └──────────┘
│  │ • candidates    │
│  │ • votes         │
│  └─────────────────┘
└─────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### Email Invite Flow

```
EC Clicks "Send Email"
        ↓
Validate voter email
        ↓
Call send-invite.js function
        ↓
Function prepares email with template
        ↓
Nodemailer sends via SMTP
        ↓
Store record in invites collection
        ↓
Display in tracking dashboard
        ↓
Track opens/clicks (pixel tracking)
```

### SMS Invite Flow

```
EC Clicks SMS icon
        ↓
Validate voter phone number
        ↓
Call send-invite-sms.js function
        ↓
Format message with details
        ↓
Twilio API sends SMS
        ↓
Store record in invites collection
        ↓
Display in tracking dashboard
        ↓
Track delivery status
```

### Bulk Invite Flow

```
EC Selects voters (checkboxes)
        ↓
Click "Send Bulk Invites"
        ↓
Iterate each selected voter
        ↓
For each voter:
  • Add 100ms delay (prevent rate limit)
  • Send via email or SMS (based on prefs)
  • Store in invites collection
        ↓
Display progress bar (100ms per invite)
        ↓
Show completion summary
        ↓
Auto-refresh tracking dashboard
```

### Analytics Flow

```
Open Invites Analytics Tab
        ↓
Query invites collection
        ↓
Calculate metrics:
  • Total sent count
  • Email vs SMS breakdown
  • Open rate % (opened / total)
  • Click rate % (clicked / total)
  • Avg time to open
        ↓
Group by status (sent/opened/clicked)
        ↓
Calculate progress bar widths
        ↓
Render dashboard with charts
```

## Database Schema

### Firestore Structure

```
organizations/
├── {orgId}/
│   ├── invites/
│   │   ├── {inviteId}
│   │   │   ├── type: "voter" | "voter_sms" | "ec"
│   │   │   ├── email: string
│   │   │   ├── phone: string
│   │   │   ├── name: string
│   │   │   ├── sentAt: timestamp
│   │   │   ├── status: "sent" | "opened" | "clicked"
│   │   │   ├── sentBy: "superadmin" | "ec"
│   │   │   ├── openedAt: timestamp (optional)
│   │   │   └── clickedAt: timestamp (optional)
│   │   └── ...
│   │
│   ├── inviteTemplates/
│   │   ├── voterSubject: string
│   │   ├── voterBody: string
│   │   ├── ecSubject: string
│   │   ├── ecBody: string
│   │   └── updatedAt: timestamp
│   │
│   ├── voters/
│   │   ├── {voterId}
│   │   │   ├── name: string
│   │   │   ├── email: string
│   │   │   ├── phone: string
│   │   │   └── ...
│   │   └── ...
│   │
│   ├── candidates/
│   ├── positions/
│   ├── votes/
│   └── ...
```

## API Endpoints

### Netlify Function: send-invite.js

```
Endpoint: /.netlify/functions/send-invite
Method: POST
Content-Type: application/json

Request Body:
{
  to: string,                    // recipient email
  recipientType: "ec" | "voter", // for template selection
  orgName: string,               // organization name
  orgId: string,                 // organization ID
  recipientName: string,         // recipient name
  credentials: {                 // dynamic template data
    password?: string,           // for EC invites
    email?: string,              // for voter emails
    type?: string                // credential type
  }
}

Response:
{
  ok: boolean,
  provider: "nodemailer",
  messageId: string,
  recipientType: string
}

Error Response:
{
  ok: false,
  error: string,
  provider: "nodemailer"
}
```

### Netlify Function: send-invite-sms.js

```
Endpoint: /.netlify/functions/send-invite-sms
Method: POST
Content-Type: application/json

Request Body:
{
  phone: string,           // E.164 format: +1234567890
  message: string,         // SMS text content
  recipientType: string,   // "voter" | "ec"
  orgId: string,          // organization ID
  recipientName: string   // recipient name
}

Response:
{
  ok: boolean,
  provider: "twilio",
  messageId: string,
  recipientType: string
}

Error Response:
{
  ok: false,
  error: string,
  provider: "twilio"
}
```

## Function Reference

### Core Functions

#### **sendVoterInvite(email, name, phone)**

- Sends email invite to voter
- Stores in invites collection
- Called from voter action buttons
- Template used: voter invitation

#### **sendVoterInviteSMS(phone, name)**

- Sends SMS invite to voter
- Stores in invites collection
- Integrates with Twilio
- Pre-formatted message with org details

#### **sendBulkVoterInvites()**

- Batch sends to all selected voters
- 100ms delay between each send
- Shows progress bar UI
- Updates tracking dashboard on completion

#### **loadInvitesTracking()**

- Fetches all invites from Firestore
- Renders tracking dashboard
- Shows stats and status breakdown
- Provides filtering and search
- Enables resend/delete operations

#### **loadInviteTemplates()**

- Displays template editor UI
- Loads custom templates from Firestore
- Allows editing subject and body
- Supports placeholder variables

#### **saveInviteTemplates()**

- Persists templates to Firestore
- Updates `organizations/{orgId}/inviteTemplates`
- Validates template content
- Shows success/error feedback

#### **resetInviteTemplates()**

- Clears custom templates
- Reverts to defaults on next load
- Requires confirmation

#### **loadInviteAnalytics()**

- Calculates system-wide metrics
- Computes rates and averages
- Renders analytics dashboard
- Groups data by status

### Helper Functions

#### **getTimeAgo(date)**

- Converts timestamp to relative time
- Returns: "now", "5m ago", "2h ago", "1d ago", "3w ago"
- Used in dashboard timestamps

#### **switchSettingsTab(tabId)**

- Toggles between settings sub-tabs
- Updates active button styling
- Shows/hides content divs
- Called by tab buttons

#### **getDefaultInviteTemplates()**

- Returns default template structure
- Used as fallback if none exist
- Contains sample subject/body text

#### **filterInvites(searchTerm, filterType, filterStatus)**

- Client-side filtering
- Searches email field
- Filters by type (voter/sms/ec)
- Filters by status (sent/opened/clicked)

## Security Considerations

### Authentication

- EC users authenticated via Firebase Auth
- Invites can only be sent by authorized EC
- SuperAdmin approval required for organization

### Data Protection

- Email addresses encrypted at rest in Firestore
- Phone numbers PII compliance
- HTTPS for all API calls
- CORS configured for allowed origins

### Rate Limiting

- SMS: Limited by Twilio account tier
- Email: Limited by SMTP server (typically 100/min)
- Invite writes: 100ms delay between bulk sends
- Firestore: Write quota limits per collection

### Audit Trail

- All invites stored with:
  - sentAt timestamp
  - sentBy user identifier
  - recipient name/contact
  - Enables compliance audits

## Performance Optimization

### Query Optimization

- Indices on: sentAt, status, type
- Pagination for large invite lists
- Client-side filtering reduces network calls

### Bulk Operations

- 100ms delay prevents database overload
- Async/await prevents blocking UI
- Progress tracking for user feedback

### Caching

- Template data cached in currentOrgData
- Analytics calculated on-demand
- Real-time updates via Firestore listeners

## Error Handling

### Email Errors

```javascript
try {
  // Send email via Netlify function
} catch (e) {
  // Log error
  // Show toast: "Failed to send email: {error}"
  // Retry functionality available
  // Fallback: SMS if available
}
```

### SMS Errors

```javascript
try {
  // Send SMS via Twilio
} catch (e) {
  // Log error
  // Show toast: "Failed to send SMS: {error}"
  // Suggest retry or alternate channel
}
```

### Database Errors

```javascript
try {
  // Write to Firestore
} catch (e) {
  // Catch and display error
  // User can retry
  // Invite marked as failed
}
```

## Monitoring & Logging

### Logs Location

- Browser console: Client-side errors
- Netlify function logs: Email/SMS delivery
- Firestore activity: Write operations
- Analytics: Real-time metrics

### Metrics to Monitor

- Email delivery rate
- SMS delivery rate
- Open rate trend
- Click rate trend
- Error rate by channel
- Response times

## Future Enhancements

### Immediate

- [ ] Email open pixel tracking
- [ ] Link click redirect tracking
- [ ] Scheduled sends
- [ ] Template A/B testing

### Short-term

- [ ] WhatsApp integration
- [ ] Push notifications
- [ ] Invite response webhooks
- [ ] Bulk import from CSV

### Long-term

- [ ] Machine learning for send time optimization
- [ ] Advanced analytics dashboard
- [ ] Multi-language template support
- [ ] Custom branding in emails
- [ ] Compliance certifications (SOC2, GDPR)

## Dependencies

### Libraries Used

- Firebase SDK v9.22.0 (Firestore)
- Nodemailer (Email via SMTP)
- Twilio SDK (SMS delivery)
- FontAwesome 6.0 (Icons)

### External Services

- Firestore (Database)
- Netlify Functions (Serverless)
- SMTP Provider (Email)
- Twilio (SMS)

### Browser APIs

- Fetch API (HTTP requests)
- LocalStorage (Client state)
- Clipboard API (Copy functionality)

---

**Architecture Version:** 1.0  
**Last Updated:** [Current Date]  
**Status:** Production Ready  
**Maintainer:** [Your Name/Team]
