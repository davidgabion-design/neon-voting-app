// results-notifications.js - Send results to voters and candidates when declared
import { db } from '../config/firebase.js';
import { 
  collection, 
  getDocs,
  addDoc,
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast } from '../utils/ui-helpers.js';
import { validateEmail } from '../utils/validation.js';

/**
 * Build HTML email template for election results
 */
function buildResultsEmailTemplate({ recipientName, orgName, orgId, positions, appUrl, isCandidate = false }) {
  const subject = `🏆 Election Results - ${orgName}`;
  
  // Build positions summary
  let positionsHtml = '';
  positions.forEach(position => {
    const winner = position.candidates[0]; // First is winner (already sorted)
    const totalVotes = position.candidates.reduce((sum, c) => sum + c.votes, 0);
    
    positionsHtml += `
      <div style="background:rgba(0,20,40,0.6);border:1px solid rgba(0,255,170,0.3);border-radius:8px;padding:20px;margin:0 0 20px;">
        <h3 style="margin:0 0 15px;color:#00ffaa;font-size:18px;border-bottom:1px solid rgba(0,255,170,0.2);padding-bottom:10px;">
          📌 ${position.name}
        </h3>
        
        ${position.candidates.map((candidate, index) => {
          const percentage = totalVotes > 0 ? Math.round((candidate.votes / totalVotes) * 100) : 0;
          const isWinner = index === 0;
          const barColor = isWinner ? '#00ffaa' : '#00d4ff';
          const borderColor = isWinner ? 'rgba(0,255,170,0.5)' : 'rgba(0,212,255,0.3)';
          
          return `
            <div style="margin:0 0 12px;padding:12px;background:rgba(0,0,0,0.3);border-radius:6px;border-left:3px solid ${borderColor};">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <div style="color:${isWinner ? '#00ffaa' : '#ffffff'};font-weight:${isWinner ? '700' : '600'};font-size:15px;">
                  ${isWinner ? '🏆 ' : ''}${candidate.name}
                </div>
                <div style="color:${barColor};font-weight:700;font-size:16px;">
                  ${candidate.votes} votes (${percentage}%)
                </div>
              </div>
              <div style="background:rgba(255,255,255,0.1);height:8px;border-radius:4px;overflow:hidden;">
                <div style="background:${barColor};height:100%;width:${percentage}%;border-radius:4px;transition:width 0.3s ease;${isWinner ? 'box-shadow:0 0 10px rgba(0,255,170,0.5);' : ''}"></div>
              </div>
              ${candidate.tagline ? `<div style="color:#888;font-size:12px;margin-top:6px;font-style:italic;">"${candidate.tagline}"</div>` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;
  });
  
  const body = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Election Results</title>
</head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#0a0a1a;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #1a0033 0%, #0d1b2a 100%);min-height:100vh;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#0d1b2a;border-radius:12px;border:2px solid #00ffaa;box-shadow:0 8px 32px rgba(0,255,170,0.2);">
          <!-- Header -->
          <tr>
            <td style="padding:30px;text-align:center;border-bottom:1px solid rgba(0,255,170,0.2);">
              <h1 style="margin:0;color:#00ffaa;font-size:28px;font-weight:700;text-shadow:0 0 20px rgba(0,255,170,0.5);">
                🏆 Election Results Declared
              </h1>
              <p style="margin:10px 0 0;color:#00d4ff;font-size:16px;font-weight:600;">
                ${orgName}
              </p>
            </td>
          </tr>
          
          <!-- Main Content -->
          <tr>
            <td style="padding:40px 30px;">
              <p style="margin:0 0 25px;color:#b0b0b0;font-size:16px;line-height:1.6;">
                Hi <strong style="color:#00ffaa;">${recipientName || 'Voter'}</strong>!
              </p>
              
              <p style="margin:0 0 30px;color:#b0b0b0;font-size:15px;line-height:1.6;">
                ${isCandidate 
                  ? 'The election results have been officially declared. Thank you for participating as a candidate!' 
                  : 'Thank you for participating in the election! The results have been officially declared below.'}
              </p>
              
              <!-- Results by Position -->
              <h2 style="margin:0 0 20px;color:#00d4ff;font-size:20px;font-weight:600;">
                📊 Final Results:
              </h2>
              
              ${positionsHtml}
              
              <!-- View Full Results Button -->
              <div style="text-align:center;margin:30px 0;">
                <a href="${appUrl}?role=voter&org=${orgId}" 
                   style="display:inline-block;background:linear-gradient(135deg,#00C3FF 0%,#00ffaa 100%);color:#0a0a1a;text-decoration:none;padding:15px 40px;border-radius:8px;font-size:16px;font-weight:700;box-shadow:0 4px 15px rgba(0,255,170,0.4);">
                  View Full Results
                </a>
              </div>
              
              <!-- Thank You Message -->
              <div style="background:rgba(0,195,255,0.1);border-left:4px solid #00C3FF;border-radius:4px;padding:15px;margin:30px 0 0;">
                <p style="margin:0;color:#00C3FF;font-size:14px;">
                  ${isCandidate 
                    ? '🙏 Thank you for your leadership and participation in this democratic process!' 
                    : '🗳️ Thank you for exercising your right to vote and making democracy work!'}
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding:25px 30px;background:rgba(0,0,0,0.3);border-top:1px solid rgba(0,255,170,0.2);border-radius:0 0 10px 10px;">
              <p style="margin:0;color:#666;font-size:13px;text-align:center;">
                Need help? Visit <a href="${appUrl}" style="color:#00ffaa;text-decoration:none;">${appUrl}</a>
              </p>
              <p style="margin:10px 0 0;color:#555;font-size:12px;text-align:center;">
                © ${new Date().getFullYear()} Neon Voting System. Secure. Simple. Transparent.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, body };
}

/**
 * Build SMS message for election results
 */
function buildResultsSmsMessage({ recipientName, orgName, positions, appUrl, orgId }) {
  const firstPosition = positions[0];
  const winner = firstPosition?.candidates[0];
  
  let message = `🏆 ${orgName} - Results Declared!\n\n`;
  
  if (winner) {
    message += `${firstPosition.name}: ${winner.name} (${winner.votes} votes)\n`;
  }
  
  if (positions.length > 1) {
    message += `+ ${positions.length - 1} more position(s)\n`;
  }
  
  message += `\nView full results: ${appUrl}?role=voter&org=${orgId}`;
  
  return message;
}

/**
 * Send results to all voters and candidates
 */
export async function sendResultsNotifications(orgId, options = {}) {
  try {
    const { 
      sendEmail = true, 
      sendSms = false,
      sendWhatsApp = false 
    } = options;
    
    showToast('Preparing to send results notifications...', 'info');
    
    // Fetch organization data
    const [positionsSnap, candidatesSnap, votersSnap, orgSnap] = await Promise.all([
      getDocs(collection(db, "organizations", orgId, "positions")),
      getDocs(collection(db, "organizations", orgId, "candidates")),
      getDocs(collection(db, "organizations", orgId, "voters")),
      getDocs(collection(db, "organizations"))
    ]);
    
    const orgData = orgSnap.docs.find(d => d.id === orgId)?.data();
    const orgName = orgData?.name || orgId;
    const appUrl = (typeof window !== 'undefined' && window.APP_URL) ? window.APP_URL : window.location.origin;
    
    // Build positions with sorted candidates
    const positions = [];
    positionsSnap.forEach(posDoc => {
      const posData = posDoc.data();
      const posCandidates = [];
      
      candidatesSnap.forEach(candDoc => {
        const candData = candDoc.data();
        if (candData.positionId === posDoc.id) {
          posCandidates.push({
            id: candDoc.id,
            name: candData.name,
            votes: candData.votes || 0,
            tagline: candData.tagline || '',
            email: candData.email || ''
          });
        }
      });
      
      // Sort candidates by votes (descending)
      posCandidates.sort((a, b) => b.votes - a.votes);
      
      positions.push({
        id: posDoc.id,
        name: posData.name,
        candidates: posCandidates
      });
    });
    
    // Get all voters
    const voters = [];
    votersSnap.forEach(voterDoc => {
      const voterData = voterDoc.data();
      if (!voterData.isReplaced && (voterData.email || voterData.phone)) {
        voters.push({
          id: voterDoc.id,
          name: voterData.name,
          email: voterData.email,
          phone: voterData.phone
        });
      }
    });
    
    // Get all candidates with contact info
    const candidates = [];
    candidatesSnap.forEach(candDoc => {
      const candData = candDoc.data();
      if (candData.email || candData.phone) {
        candidates.push({
          id: candDoc.id,
          name: candData.name,
          email: candData.email,
          phone: candData.phone
        });
      }
    });
    
    let sentCount = 0;
    let failedCount = 0;
    
    // Send to voters
    if (sendEmail) {
      showToast(`Sending results to ${voters.length} voters...`, 'info');
      
      for (const voter of voters) {
        if (!voter.email || !validateEmail(voter.email)) continue;
        
        try {
          const emailTemplate = buildResultsEmailTemplate({
            recipientName: voter.name,
            orgName,
            orgId,
            positions,
            appUrl,
            isCandidate: false
          });
          
          const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: voter.email,
              subject: emailTemplate.subject,
              html: emailTemplate.body
            })
          });
          
          if (response.ok) {
            // Log the notification
            await addDoc(collection(db, "organizations", orgId, "invites"), {
              type: "results",
              recipientEmail: voter.email,
              name: voter.name,
              sentAt: serverTimestamp(),
              status: "sent",
              sentBy: "system"
            });
            sentCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          console.error(`Failed to send to voter ${voter.email}:`, error);
          failedCount++;
        }
      }
    }
    
    // Send to candidates
    if (sendEmail) {
      showToast(`Sending results to ${candidates.length} candidates...`, 'info');
      
      for (const candidate of candidates) {
        if (!candidate.email || !validateEmail(candidate.email)) continue;
        
        try {
          const emailTemplate = buildResultsEmailTemplate({
            recipientName: candidate.name,
            orgName,
            orgId,
            positions,
            appUrl,
            isCandidate: true
          });
          
          const response = await fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: candidate.email,
              subject: emailTemplate.subject,
              html: emailTemplate.body
            })
          });
          
          if (response.ok) {
            // Log the notification
            await addDoc(collection(db, "organizations", orgId, "invites"), {
              type: "results",
              recipientEmail: candidate.email,
              name: candidate.name,
              sentAt: serverTimestamp(),
              status: "sent",
              sentBy: "system"
            });
            sentCount++;
          } else {
            failedCount++;
          }
        } catch (error) {
          console.error(`Failed to send to candidate ${candidate.email}:`, error);
          failedCount++;
        }
      }
    }
    
    // Show summary
    if (sentCount > 0) {
      showToast(`✅ Results sent to ${sentCount} recipients${failedCount > 0 ? ` (${failedCount} failed)` : ''}`, 'success', 5000);
    } else {
      showToast('No results notifications were sent. Check email addresses.', 'warning');
    }
    
    return { sent: sentCount, failed: failedCount };
    
  } catch (error) {
    console.error('Error sending results notifications:', error);
    showToast('Error sending results notifications: ' + error.message, 'error');
    throw error;
  }
}

// Export for global access
if (typeof window !== 'undefined') {
  window.sendResultsNotifications = sendResultsNotifications;
}

export default {
  sendResultsNotifications,
  buildResultsEmailTemplate,
  buildResultsSmsMessage
};
