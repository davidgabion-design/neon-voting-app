// timers.js - Countdown Timers and Time Utilities

let voterCountdownInterval = null;

export function startVoterCountdown(endTime) {
  if (!endTime) return;
  
  const endDate = new Date(endTime);
  const now = new Date();
  
  if (endDate <= now) {
    showToast('Voting has ended', 'error');
    showScreen('voterLoginScreen');
    return;
  }
  
  // Create countdown container if it doesn't exist
  let countdownContainer = document.getElementById('countdown-container');
  if (!countdownContainer) {
    countdownContainer = document.createElement('div');
    countdownContainer.id = 'countdown-container';
    countdownContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      backdrop-filter: blur(10px);
      border: 1px solid rgba(0, 255, 255, 0.2);
      border-radius: 12px;
      padding: 12px 20px;
      color: white;
      z-index: 1000;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    `;
    document.body.appendChild(countdownContainer);
  }
  
  function updateCountdown() {
    const now = new Date();
    const diff = endDate - now;
    
    if (diff <= 0) {
      countdownContainer.innerHTML = `
        <i class="fas fa-hourglass-end" style="color: #ff4444;"></i>
        <span style="color: #ff4444;">Voting Ended</span>
      `;
      clearInterval(voterCountdownInterval);
      
      // Auto-submit if voting in progress
      if (document.getElementById('submitVoteBtn') && !document.getElementById('submitVoteBtn').disabled) {
        showToast('Voting time has ended. Submitting your vote...', 'warning');
        setTimeout(() => submitVote(), 1000);
      }
      
      return;
    }
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    countdownContainer.innerHTML = `
      <i class="fas fa-clock" style="color: #00eaff;"></i>
      <span style="color: ${hours < 1 ? '#ff9800' : '#00ffaa'}">
        ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}
      </span>
      <span class="subtext" style="font-size: 12px; color: #9beaff;">Remaining</span>
    `;
  }
  
  updateCountdown();
  voterCountdownInterval = setInterval(updateCountdown, 1000);
}

export function updateCountdownBanner(orgId, orgData) {
  const el = document.getElementById("electionCountdownBanner");
  if (!el) return;

  const { start, end } = getElectionWindow(orgData);
  if (!start || !end) {
    el.style.display = "none";
    return;
  }

  const now = Date.now();
  const s = start.getTime();
  const e = end.getTime();

  let label = "";
  let diff = 0;

  if (now < s) {
    label = "Election starts in";
    diff = s - now;
  } else if (now >= s && now < e) {
    label = "Election ends in";
    diff = e - now;
  } else {
    label = "Election ended";
    diff = 0;
  }

  if (label === "Election ended") {
    el.textContent = "⏱ Election ended";
  } else {
    const t = msToHMS(diff);
    el.textContent = `⏱ ${label}: ${t.h}h ${t.m}m ${t.s}s`;
  }
  el.style.display = "block";
}

export function msToHMS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { h, m, s };
}

// Import getElectionWindow from election-utils
function getElectionWindow(orgData) {
  const s = orgData?.electionSettings?.startTime ? new Date(orgData.electionSettings.startTime) : null;
  const e = orgData?.electionSettings?.endTime ? new Date(orgData.electionSettings.endTime) : null;
  if (!s || !e || isNaN(s.getTime()) || isNaN(e.getTime())) return { start: null, end: null };
  return { start: s, end: e };
}
