// election-utils.js - Election Window and Phase Utilities
import { db } from '../config/firebase.js';
import { 
  collection, 
  getDocs 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

export function getElectionWindow(orgData) {
  const s = orgData?.electionSettings?.startTime ? new Date(orgData.electionSettings.startTime) : null;
  const e = orgData?.electionSettings?.endTime ? new Date(orgData.electionSettings.endTime) : null;
  if (!s || !e || isNaN(s.getTime()) || isNaN(e.getTime())) return { start: null, end: null };
  return { start: s, end: e };
}

export function computeElectionPhase(orgData) {
  const { start, end } = getElectionWindow(orgData);
  if (!start || !end) return null;
  const now = Date.now();
  const s = start.getTime();
  const e = end.getTime();
  if (now < s) return "scheduled";
  if (now >= s && now < e) return "active";
  return "ended";
}

export function isVotingLive(orgData) {
  const { start, end } = getElectionWindow(orgData);
  if (!start || !end) return false;
  const now = Date.now();
  return now >= start.getTime() && now < end.getTime();
}

export async function _getCandidatesMap(orgId) {
  const map = {};
  try {
    const cSnap = await getDocs(collection(db, "organizations", orgId, "candidates"));
    cSnap.forEach(d => {
      const x = d.data() || {};
      map[d.id] = {
        id: d.id,
        name: x.name || x.fullName || x.title || ("Candidate " + d.id),
        positionId: x.positionId || x.position || x.postId || null
      };
    });
  } catch(e) {}
  
  try {
    const pSnap = await getDocs(collection(db, "organizations", orgId, "positions"));
    for (const p of pSnap.docs) {
      const cc = await getDocs(collection(db, "organizations", orgId, "positions", p.id, "candidates"));
      cc.forEach(d => {
        const x = d.data() || {};
        if (!map[d.id]) {
          map[d.id] = {
            id: d.id,
            name: x.name || x.fullName || ("Candidate " + d.id),
            positionId: p.id
          };
        }
      });
    }
  } catch(e) {}
  
  return map;
}
