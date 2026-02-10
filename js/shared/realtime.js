// realtime.js - Real-time Election Monitoring and Auto-updates
import { db } from '../config/firebase.js';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc,
  writeBatch,
  serverTimestamp 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

export function electionRealtimeTick(orgId, orgData) {
  updateCountdownBanner(orgId, orgData);
  maybeAutoUpdateElectionStatus(orgId, orgData);
  maybeQueue30MinReminders(orgId, orgData);
  // EC freeze is applied elsewhere too, but safe to call here if present
  applyECFreezeUI?.();
}

export async function maybeAutoUpdateElectionStatus(orgId, orgData) {
  try {
    if (session?.role !== "superadmin") return;
    const desired = computeElectionPhase(orgData);
    if (!desired) return;

    const current = orgData?.electionStatus || "active";
    if (current === "declared") return; // do not override manual "declared"
    if (current === desired) return;

    await updateDoc(doc(db, "organizations", orgId), {
      electionStatus: desired,
      statusAutoUpdatedAt: serverTimestamp()
    });
    console.log("Auto electionStatus ->", desired);
  } catch (e) {
    console.warn("maybeAutoUpdateElectionStatus skipped:", e);
  }
}

export async function maybeQueue30MinReminders(orgId, orgData) {
  try {
    if (session?.role !== "superadmin") return;
    if (orgData?.remindersQueuedAt) return;

    const { start } = getElectionWindow(orgData);
    if (!start) return;

    const now = Date.now();
    const diffMs = start.getTime() - now;

    // Trigger within a 90-second window around 30 minutes before start
    const thirtyMin = 30 * 60 * 1000;
    if (diffMs > thirtyMin + 45_000) return;
    if (diffMs < thirtyMin - 45_000) return;

    const votersSnap = await getDocs(collection(db, "organizations", orgId, "voters"));
    const batch = writeBatch(db);
    const queueCol = collection(db, "organizations", orgId, "remindersQueue");

    votersSnap.forEach(vDoc => {
      const v = vDoc.data() || {};
      const qRef = doc(queueCol);
      batch.set(qRef, {
        voterId: vDoc.id,
        email: v.email || null,
        phone: v.phone || v.telephone || null,
        createdAt: serverTimestamp(),
        status: "queued",
        type: "30_min_before_start"
      });
    });

    batch.update(doc(db, "organizations", orgId), {
      remindersQueuedAt: serverTimestamp()
    });

    await batch.commit();
    showToast?.("30-minute reminders queued (requires sending service)", "success");
    console.log("30-minute reminders queued:", votersSnap.size);
  } catch (e) {
    console.warn("maybeQueue30MinReminders skipped:", e);
  }
}

export async function startVoterLiveRefresh(orgId) {
  try {
    clearInterval(window.VOTER_LIVE_REFRESH_TIMER);
    window.VOTER_LIVE_REFRESH_TIMER = setInterval(async () => {
      try {
        await window.firebaseReady;
        if (typeof window.loadResultsByPosition === "function") {
          await window.loadResultsByPosition(orgId, { readOnly: true });
        }
      } catch (e) {}
    }, 30000);
  } catch (err) {
    console.error("startVoterLiveRefresh failed:", err);
  }
}

// UI freeze for EC based on computed window/status
export function applyECFreezeUI() {
  try {
    if (session?.role !== "ec") return;
    if (!currentOrgData) return;

    const locked = isVotingLive(currentOrgData) || (currentOrgData.electionStatus === "active");
    if (!locked) return;

    // Disable known EC edit actions
    const selectors = [
      "#addVoterBtn", "#bulkAddVoterBtn", "#addPositionBtn", "#addCandidateBtn",
      ".ec-edit-btn", ".ec-delete-btn",
      "button[onclick*='showAddVoterModal']",
      "button[onclick*='showBulkVoterModal']",
      "button[onclick*='showAddPositionModal']",
      "button[onclick*='showAddCandidateModal']"
    ];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(btn => {
        btn.disabled = true;
        btn.classList.add("disabled");
        btn.title = "Editing is locked — voting has started.";
      });
    });
  } catch (e) {
    console.error("applyECFreezeUI error:", e);
  }
}

// Import helpers from election-utils
function getElectionWindow(orgData) {
  const s = orgData?.electionSettings?.startTime ? new Date(orgData.electionSettings.startTime) : null;
  const e = orgData?.electionSettings?.endTime ? new Date(orgData.electionSettings.endTime) : null;
  if (!s || !e || isNaN(s.getTime()) || isNaN(e.getTime())) return { start: null, end: null };
  return { start: s, end: e };
}

function computeElectionPhase(orgData) {
  const { start, end } = getElectionWindow(orgData);
  if (!start || !end) return null;
  const now = Date.now();
  const s = start.getTime();
  const e = end.getTime();
  if (now < s) return "scheduled";
  if (now >= s && now < e) return "active";
  return "ended";
}

function isVotingLive(orgData) {
  const { start, end } = getElectionWindow(orgData);
  if (!start || !end) return false;
  const now = Date.now();
  return now >= start.getTime() && now < end.getTime();
}

function updateCountdownBanner(orgId, orgData) {
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

function msToHMS(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { h, m, s };
}

// Make applyECFreezeUI available globally
window.applyECFreezeUI = applyECFreezeUI;
