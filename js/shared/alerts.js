// alerts.js - Alert Scheduling and Notifications
import { db } from '../config/firebase.js';
import { 
  collection, 
  getDocs,
  addDoc,
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast } from '../utils/ui-helpers.js';
import { validateEmail } from '../utils/validation.js';
import { getCurrentOrgId, getCurrentOrgData } from '../state/app-state.js';

let alertSchedulerInterval = null;

export function startAlertScheduler() {
  if (alertSchedulerInterval) {
    clearInterval(alertSchedulerInterval);
  }
  
  alertSchedulerInterval = setInterval(async () => {
    const currentOrgId = getCurrentOrgId();
    const currentOrgData = getCurrentOrgData();
    
    if (!currentOrgId || !currentOrgData) return;
    
    try {
      const startTime = currentOrgData.electionSettings?.startTime;
      if (!startTime) return;
      
      const startDate = new Date(startTime);
      const now = new Date();
      const timeDiff = startDate - now;
      
      const thirtyMinutes = 30 * 60 * 1000;
      const oneMinute = 60 * 1000;
      
      if (timeDiff > (thirtyMinutes - oneMinute) && timeDiff < (thirtyMinutes + oneMinute)) {
        const lastAlertKey = `lastAlert_${currentOrgId}`;
        const lastAlertTime = localStorage.getItem(lastAlertKey);
        
        if (!lastAlertTime || (now - new Date(lastAlertTime)) > 10 * 60 * 1000) {
          console.log("Auto-triggering 30-minute alerts for", currentOrgId);
          await send30MinAlerts();
          localStorage.setItem(lastAlertKey, now.toISOString());
        }
      }
      
      if (timeDiff > -oneMinute && timeDiff < oneMinute) {
        const lastStartAlertKey = `lastStartAlert_${currentOrgId}`;
        const lastStartAlertTime = localStorage.getItem(lastStartAlertKey);
        
        if (!lastStartAlertTime || (now - new Date(lastStartAlertTime)) > 10 * 60 * 1000) {
          console.log("Auto-triggering voting start alerts for", currentOrgId);
          await sendVoteStartAlerts();
          localStorage.setItem(lastStartAlertKey, now.toISOString());
        }
      }
    } catch (e) {
      console.error("Error in alert scheduler:", e);
    }
  }, 60000);
}

export function stopAlertScheduler() {
  if (alertSchedulerInterval) {
    clearInterval(alertSchedulerInterval);
    alertSchedulerInterval = null;
  }
}

export async function send30MinAlerts() {
  try {
    const currentOrgId = getCurrentOrgId();
    const currentOrgData = getCurrentOrgData();
    
    if (!currentOrgId || !currentOrgData) {
      showToast("No organization selected", "error");
      return;
    }

    const votersSnap = await getDocs(collection(db, "organizations", currentOrgId, "voters"));
    let sentCount = 0;
    let errorCount = 0;
    const appUrl = window.location.origin + window.location.pathname;
    
    showToast("Sending 30-minute alerts to voters...", "info");

    for (const voterDoc of votersSnap.docs) {
      const voter = voterDoc.data();
      
      if (voter.isReplaced || voter.hasVoted) continue;

      const voterEmail = decodeURIComponent(voterDoc.id);
      const voterName = voter.name || "Voter";
      const voterPhone = voter.phone;

      if (validateEmail(voterEmail)) {
        try {
          const emailResponse = await fetch("/.netlify/functions/send-invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: voterEmail,
              recipientType: "voter",
              orgName: currentOrgData.name || currentOrgId,
              orgId: currentOrgId,
              recipientName: voterName,
              credentials: { 
                credential: voterEmail, 
                type: 'email',
                isReminder: true,
                message: `⏰ REMINDER: Voting starts in 30 minutes! Get ready to cast your vote in ${currentOrgData.name || 'the election'}.`
              }
            })
          });

          const emailResult = await emailResponse.json();
          if (emailResult.ok) {
            sentCount++;
            
            await addDoc(collection(db, "organizations", currentOrgId, "invites"), {
              type: "voter_alert_30min",
              email: voterEmail,
              name: voterName,
              sentAt: serverTimestamp(),
              status: "sent",
              sentBy: "ec"
            });
          } else {
            errorCount++;
          }
        } catch (e) {
          console.error("Error sending email to", voterEmail, e);
          errorCount++;
        }
      }

      if (voterPhone) {
        try {
          const message = `⏰ Hi ${voterName}! Voting for ${currentOrgData.name || 'your election'} starts in 30 minutes. Visit: ${appUrl} Org ID: ${currentOrgId} 🗳️`;
          
          const smsResponse = await fetch("/.netlify/functions/send-invite-sms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: voterPhone,
              message: message,
              recipientType: "voter_alert",
              orgId: currentOrgId,
              recipientName: voterName
            })
          });

          const smsResult = await smsResponse.json();
          if (smsResult.ok) {
            sentCount++;
            
            await addDoc(collection(db, "organizations", currentOrgId, "invites"), {
              type: "voter_alert_30min_sms",
              phone: voterPhone,
              name: voterName,
              sentAt: serverTimestamp(),
              status: "sent",
              sentBy: "ec"
            });
          }
        } catch (e) {
          console.error("Error sending SMS to", voterPhone, e);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (sentCount > 0) {
      showToast(`✅ 30-minute alerts sent to ${sentCount} voters!`, 'success');
    } else if (errorCount > 0) {
      showToast(`⚠️ Failed to send alerts (${errorCount} errors)`, 'warning');
    } else {
      showToast("No eligible voters to send alerts to", "info");
    }
  } catch(e) {
    console.error('Error sending 30-minute alerts:', e);
    showToast('Error sending alerts: ' + e.message, 'error');
  }
}

export async function sendVoteStartAlerts() {
  try {
    const currentOrgId = getCurrentOrgId();
    const currentOrgData = getCurrentOrgData();
    
    if (!currentOrgId || !currentOrgData) {
      showToast("No organization selected", "error");
      return;
    }

    const votersSnap = await getDocs(collection(db, "organizations", currentOrgId, "voters"));
    let sentCount = 0;
    let errorCount = 0;
    const appUrl = window.location.origin + window.location.pathname;
    
    showToast("Sending voting start alerts...", "info");

    for (const voterDoc of votersSnap.docs) {
      const voter = voterDoc.data();
      
      if (voter.isReplaced) continue;

      const voterEmail = decodeURIComponent(voterDoc.id);
      const voterName = voter.name || "Voter";
      const voterPhone = voter.phone;

      if (validateEmail(voterEmail)) {
        try {
          const emailResponse = await fetch("/.netlify/functions/send-invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: voterEmail,
              recipientType: "voter",
              orgName: currentOrgData.name || currentOrgId,
              orgId: currentOrgId,
              recipientName: voterName,
              credentials: { 
                credential: voterEmail, 
                type: 'email',
                isReminder: true,
                message: `🗳️ VOTING IS NOW OPEN! Cast your vote now for ${currentOrgData.name || 'the election'}. Click below to get started!`
              }
            })
          });

          const emailResult = await emailResponse.json();
          if (emailResult.ok) {
            sentCount++;
            
            await addDoc(collection(db, "organizations", currentOrgId, "invites"), {
              type: "voter_alert_start",
              email: voterEmail,
              name: voterName,
              sentAt: serverTimestamp(),
              status: "sent",
              sentBy: "ec"
            });
          } else {
            errorCount++;
          }
        } catch (e) {
          console.error("Error sending email to", voterEmail, e);
          errorCount++;
        }
      }

      if (voterPhone) {
        try {
          const message = `🗳️ Hi ${voterName}! Voting is NOW OPEN for ${currentOrgData.name || 'your election'}! Visit: ${appUrl} Org ID: ${currentOrgId} Cast your vote now! ✅`;
          
          const smsResponse = await fetch("/.netlify/functions/send-invite-sms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phone: voterPhone,
              message: message,
              recipientType: "voter_alert",
              orgId: currentOrgId,
              recipientName: voterName
            })
          });

          const smsResult = await smsResponse.json();
          if (smsResult.ok) {
            sentCount++;
            
            await addDoc(collection(db, "organizations", currentOrgId, "invites"), {
              type: "voter_alert_start_sms",
              phone: voterPhone,
              name: voterName,
              sentAt: serverTimestamp(),
              status: "sent",
              sentBy: "ec"
            });
          }
        } catch (e) {
          console.error("Error sending SMS to", voterPhone, e);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (sentCount > 0) {
      showToast(`✅ Voting start alerts sent to ${sentCount} voters!`, 'success');
    } else if (errorCount > 0) {
      showToast(`⚠️ Failed to send alerts (${errorCount} errors)`, 'warning');
    } else {
      showToast("No eligible voters to send alerts to", "info");
    }
  } catch(e) {
    console.error('Error sending voting start alerts:', e);
    showToast('Error sending alerts: ' + e.message, 'error');
  }
}
