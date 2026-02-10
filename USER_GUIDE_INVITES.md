# Invite System User Guide

## Quick Start Guide for Election Commissioners (EC)

### Feature 1: Send Email Invites to Individual Voters

**Location:** EC Dashboard → Voters Tab

1. Find a voter in the list
2. Click the **paper plane icon** (✈️) button next to their name
3. An email invitation will be sent automatically
4. The invite is logged in the **Invites** tab

### Feature 2: Send Bulk Invites to Multiple Voters

**Location:** EC Dashboard → Bulk Invite Tab

1. See list of all voters with checkboxes
2. Click **"Select All"** or manually check voters
3. Click **"Send Bulk Invites"** button
4. All selected voters will receive invites
5. Progress bar shows real-time status
6. All invites appear in the **Invites** tracking dashboard

### Feature 3: Send SMS Invites (Phone)

**Location:** EC Dashboard → Voters Tab

1. Find a voter with a phone number
2. Click the **SMS icon** (📱) button next to their name
3. An SMS message will be sent to their phone
4. The SMS invite is logged in the **Invites** tab with SMS badge
5. **Note:** SMS button is disabled for voters without phone numbers

### Feature 4: Customize Email Templates

**Location:** EC Dashboard → Settings → Email Templates

1. Click the **"Email Templates"** tab in settings
2. Edit the **Voter Invitation** email:
   - Subject line (what voters see in their inbox)
   - Body text (the message content)
3. Edit the **EC Invitation** email (if you have EC management)
4. Use placeholders for dynamic content:
   - `{voterName}` - Voter's name
   - `{orgName}` - Organization name
   - `{orgId}` - Organization ID
   - `{appUrl}` - Application URL
5. Click **"Save Templates"** to store changes
6. Click **"Reset to Default"** to restore original templates

### Feature 5: Auto-Send Invites When Adding Voters

**Location:** EC Dashboard → Voters Tab → "Add Voter" Button

1. Click **"Add Voter"** button
2. Fill in voter details (name, email, phone)
3. Check the **"Auto-send invitation"** checkbox
4. Click **"Add Voter"**
5. Voter is created AND receives invite automatically
6. Email or SMS based on which contact info was provided

### Feature 6: Track & Analyze Invites

**Location:** EC Dashboard → Invites Tab

**Dashboard Statistics:**

- **Total Sent:** Count of all invitations (with email/SMS breakdown)
- **Open Rate:** % of voters who opened the email
- **Click Rate:** % of voters who clicked the link
- **Status Breakdown:**
  - Sent: Delivered but not opened
  - Opened: Email was read
  - Clicked: Voter clicked the link

**Advanced Features:**

1. **Filter Invites:**
   - Search by voter email
   - Filter by invite type (email/SMS/EC)
   - Filter by status (sent/opened/clicked)

2. **Resend Invite:**
   - Click the **"Resend"** button to send again
   - Useful if voter didn't receive or lost the email

3. **Delete Invite:**
   - Click **"Delete"** to remove from tracking
   - Doesn't affect actual sent invitations

4. **Time Display:**
   - See when each invite was sent
   - Format: "2h ago", "1d ago", "now"

---

## For Super Admin: Invite Analytics

**Location:** Super Admin Dashboard → Invites Analytics Tab (Future)

View system-wide invite metrics across all organizations:

- Total invitations by channel (email vs SMS)
- Network-wide open and click rates
- Fastest/slowest responding organizations
- Export reports for analysis

---

## Tips & Best Practices

### Email Invites ✉️

- Use clear, professional language
- Include organization name in subject
- Test custom templates before bulk send
- Monitor open rates to assess engagement

### SMS Invites 📱

- Keep messages concise (160 chars)
- Include voting deadline
- Use short links when possible
- Verify phone numbers for accuracy

### Bulk Sending

- Start with small groups to test
- Monitor for delivery issues
- Space out bulk sends if possible
- Allow time between invites (100ms per invite)

### Analytics

- Check open rates daily
- Monitor for spam complaints
- Track which templates perform best
- Use data to improve future campaigns

---

## Troubleshooting

### SMS button is disabled

- **Issue:** No phone number for voter
- **Solution:** Add phone number to voter record

### Email not received

- **Solution:**
  1. Check spam/junk folder
  2. Verify email address is correct
  3. Resend invite using "Resend" button
  4. Check organization email settings

### Custom template not saving

- **Solution:**
  1. Ensure all required fields are filled
  2. Check browser console for errors
  3. Try resetting to defaults first
  4. Refresh page and try again

### Bulk send is slow

- **Note:** Intentional 100ms delay between sends
- **Expected:** ~50 voters per 5 seconds
- **Tip:** Monitor progress bar during send

---

## Technical Details for IT Support

### Supported Placeholders in Templates

| Placeholder | Used In     | Example                      |
| ----------- | ----------- | ---------------------------- |
| {voterName} | Voter Email | "Hi John Doe!"               |
| {ecName}    | EC Email    | "Hi Jane Smith!"             |
| {orgName}   | Both        | "Your Organization Election" |
| {orgId}     | Both        | "org-12345"                  |
| {email}     | Voter Email | "john@example.com"           |
| {appUrl}    | Both        | "https://votingapp.com"      |
| {password}  | EC Email    | "SecurePass123!"             |

### Rate Limits

- SMS: Limited by Twilio account (typically 1/sec)
- Email: Limited by SMTP server (typically 100/minute)
- Bulk ops: 100ms delay between sends to prevent issues

### Data Retention

- Invites tracked for 90 days by default
- Analytics calculated in real-time
- Firestore backups recommended

---

## Support & Feedback

For issues or feature requests:

1. Check this guide's Troubleshooting section
2. Review system logs for errors
3. Contact IT support with organization ID
4. Provide screenshot of the issue

---

**Version:** 1.0  
**Last Updated:** [Current Date]  
**Status:** Production Ready
