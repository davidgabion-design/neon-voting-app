/**
 * Election Hash Utilities
 * Generates snapshot hashes to detect changes before resubmission
 */

import { db } from '../config/firebase.js';
import { collection, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';

/**
 * Stable JSON stringification (sorted keys)
 * @param {Object} obj - Object to stringify
 * @returns {string} - Sorted JSON string
 */
function stableStringify(obj) {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => stableStringify(item)).join(',') + ']';
  }
  
  const keys = Object.keys(obj).sort();
  const pairs = keys.map(key => `"${key}":${stableStringify(obj[key])}`);
  return '{' + pairs.join(',') + '}';
}

/**
 * Simple DJB2 hash function
 * @param {string} str - String to hash
 * @returns {string} - Hash as hex string
 */
function djb2Hash(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}

/**
 * Compute election snapshot hash
 * Includes positions, candidates, voters, and election settings
 * @param {string} orgId - Organization ID
 * @returns {Promise<string>} - Hash string
 */
export async function computeElectionSnapshotHash(orgId) {
  try {
    const snapshot = {
      positions: [],
      candidates: [],
      voters: [],
      settings: {}
    };
    
    // Get positions
    const posSnap = await getDocs(collection(db, 'organizations', orgId, 'positions'));
    posSnap.forEach(doc => {
      snapshot.positions.push({
        id: doc.id,
        name: doc.data().name
      });
    });
    
    // Get candidates
    const candSnap = await getDocs(collection(db, 'organizations', orgId, 'candidates'));
    candSnap.forEach(doc => {
      snapshot.candidates.push({
        id: doc.id,
        name: doc.data().name,
        positionId: doc.data().positionId
      });
    });
    
    // Get voters (only count, not PII)
    const voterSnap = await getDocs(collection(db, 'organizations', orgId, 'voters'));
    snapshot.voters = voterSnap.size;
    
    // Get org settings (election type, etc)
    const orgRef = doc(db, 'organizations', orgId);
    const orgSnap = await getDoc(orgRef);
    if (orgSnap.exists()) {
      const data = orgSnap.data();
      snapshot.settings = {
        electionType: data.electionType,
        name: data.name
      };
    }
    
    // Compute hash
    const jsonStr = stableStringify(snapshot);
    return djb2Hash(jsonStr);
  } catch (e) {
    console.error('Error computing election hash:', e);
    return 'error-' + Date.now(); // Fallback hash
  }
}

/**
 * Check if election has changed since last submission
 * @param {string} orgId - Organization ID
 * @param {string} lastHash - Previous submission hash
 * @returns {Promise<boolean>} - True if changed
 */
export async function hasElectionChanged(orgId, lastHash) {
  if (!lastHash) return true; // No previous hash, allow submission
  
  const currentHash = await computeElectionSnapshotHash(orgId);
  return currentHash !== lastHash;
}
