/**
 * EC Module - Positions Management
 * Handles all position CRUD operations
 */

import { db } from '../config/firebase.js';
import { collection, doc, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast, createModal, showQuickLoading } from '../utils/ui-helpers.js';
import { escapeHtml } from '../utils/validation.js';
import { checkEditLock } from './utils.js';

/**
 * Load and display all positions
 */
export async function loadECPositions() {
  const el = document.getElementById("ecContent-positions");
  if (!el || !window.currentOrgId) return;
  
  // Get translation function
  const t = window.t || ((key) => key);
  
  showQuickLoading("ecContent-positions", "Loading Positions");
  
  try{
    const positionsRef = collection(db, "organizations", window.currentOrgId, "positions");
    const snap = await getDocs(positionsRef);
    
    const positions = [];
    snap.forEach(s => positions.push({ id: s.id, ...s.data() }));
    
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3><i class="fas fa-list-ol"></i> ${t('positions')} (${positions.length})</h3>
        <div style="display:flex;gap:8px">
          <button class="btn neon-btn" onclick="showAddPositionModal()">
            <i class="fas fa-plus-circle"></i> ${t('add_position')}
          </button>
          <button class="btn neon-btn-outline" onclick="refreshPositions()">
            <i class="fas fa-redo"></i>
          </button>
        </div>
      </div>
    `;
    
    if (positions.length === 0) {
      html += `
        <div class="card empty-state">
          <i class="fas fa-list-ol"></i>
          <h4>No Positions Yet</h4>
          <p class="subtext">Add positions to organize your election</p>
          <button class="btn neon-btn" onclick="showAddPositionModal()">
            <i class="fas fa-plus-circle"></i> Add Your First Position
          </button>
        </div>
      `;
    } else {
      positions.forEach(p => {
        html += `
          <div class="list-item" style="align-items:center">
            <div style="flex:1">
              <div style="display:flex;align-items:center;gap:12px">
                <div style="width:50px;height:50px;border-radius:8px;background:linear-gradient(135deg,#9D00FF,#00C3FF);display:flex;align-items:center;justify-content:center;color:white;">
                  <i class="fas fa-briefcase"></i>
                </div>
                <div>
                  <strong>${p.name}</strong>
                  ${p.description ? `<div class="subtext" style="margin-top:4px">${p.description}</div>` : ''}
                  <div class="subtext" style="margin-top:4px">Max Candidates: ${p.maxCandidates || 1}</div>
                </div>
              </div>
            </div>
            <div style="display:flex;gap:8px">
              <button class="btn neon-btn-outline" onclick="editPositionModal('${p.id}')" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-danger" onclick="deletePositionConfirm('${p.id}', '${escapeHtml(p.name)}')" title="Delete">
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      });
    }
    
    el.innerHTML = html;
  } catch(e) {
    console.error("Error loading positions:", e);
    el.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle" style="color:#ff4444;font-size:48px;margin-bottom:20px"></i>
        <h3>Error Loading Positions</h3>
        <p class="subtext" style="color:#ff9999">${e.message}</p>
        <button class="btn neon-btn" onclick="loadECPositions()">
          <i class="fas fa-redo"></i> Retry
        </button>
      </div>
    `;
  }
}

/**
 * Show add position modal
 */
export function showAddPositionModal() {
  // Check edit lock before opening modal
  if (checkEditLock(window.currentOrgData)) return;
  if (typeof window.checkVotingLock === 'function' && window.checkVotingLock("add positions")) return;

  createModal(
    '<i class="fas fa-plus-circle"></i> Add New Position',
    `
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label class="label">Position Name *</label>
          <input id="pos-name" class="input" placeholder="e.g., President, Secretary" required>
        </div>
        <div>
          <label class="label">Description</label>
          <textarea id="pos-desc" class="input" placeholder="Brief description" rows="3"></textarea>
        </div>
        <div>
          <label class="label">Maximum Candidates *</label>
          <input id="pos-max" class="input" type="number" min="1" max="10" value="1">
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="savePosition()">
        <i class="fas fa-plus-circle"></i> Add Position
      </button>
    `
  );
  
  setTimeout(() => document.getElementById('pos-name')?.focus(), 100);
}

/**
 * Save new position
 */
export async function savePosition() {
  // ✅ PATCH 2: Check edit lock before allowing position creation
  if (checkEditLock(window.currentOrgData)) return;
  
  const name = document.getElementById('pos-name')?.value.trim();
  const description = document.getElementById('pos-desc')?.value.trim();
  const maxCandidates = parseInt(document.getElementById('pos-max')?.value || '1');
  
  if (!name) {
    showToast('Position name is required', 'error');
    return;
  }
  
  try {
    const positionsRef = collection(db, "organizations", window.currentOrgId, "positions");
    await addDoc(positionsRef, {
      name,
      description: description || '',
      maxCandidates,
      votingType: 'single',
      createdAt: serverTimestamp()
    });
    
    showToast('Position added successfully', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECPositions();
  } catch(e) {
    console.error('Error adding position:', e);
    showToast('Error adding position: ' + e.message, 'error');
  }
}

/**
 * Edit position modal
 */
export async function editPositionModal(positionId) {
  // Check edit lock before opening modal
  if (checkEditLock(window.currentOrgData)) return;
  if (typeof window.checkVotingLock === 'function' && window.checkVotingLock("edit positions")) return;

  try {
    const positionRef = doc(db, "organizations", window.currentOrgId, "positions", positionId);
    const snap = await getDocs(collection(db, "organizations", window.currentOrgId, "positions"));
    
    let position = null;
    snap.forEach(s => {
      if (s.id === positionId) position = s.data();
    });
    
    if (!position) {
      showToast('Position not found', 'error');
      return;
    }
    
    createModal(
      '<i class="fas fa-edit"></i> Edit Position',
      `
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <div>
            <label class="label">Position Name *</label>
            <input id="editPositionName" class="input" value="${escapeHtml(position.name || '')}" required>
          </div>
          <div>
            <label class="label">Description</label>
            <textarea id="editPositionDesc" class="input" rows="3">${escapeHtml(position.description || '')}</textarea>
          </div>
          <div>
            <label class="label">Maximum Candidates *</label>
            <input id="editPositionMaxCandidates" class="input" type="number" min="1" max="10" value="${position.maxCandidates || 1}">
          </div>
        </div>
      `,
      `
        <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
          <i class="fas fa-times"></i> Cancel
        </button>
        <button class="btn neon-btn" onclick="updatePosition('${positionId}')">
          <i class="fas fa-save"></i> Save Changes
        </button>
      `
    );
    
    setTimeout(() => document.getElementById('editPositionName')?.focus(), 100);
  } catch(e) {
    console.error('Error loading position:', e);
    showToast('Error loading position details', 'error');
  }
}

/**
 * Update position
 */
export async function updatePosition(positionId) {
  // ✅ PATCH 2: Check edit lock before allowing position update
  if (checkEditLock(window.currentOrgData)) return;
  
  const name = document.getElementById('editPositionName')?.value.trim();
  const description = document.getElementById('editPositionDesc')?.value.trim();
  const maxCandidates = parseInt(document.getElementById('editPositionMaxCandidates')?.value || '1');
  
  if (!name) {
    showToast('Position name is required', 'error');
    return;
  }
  
  try {
    const positionRef = doc(db, "organizations", window.currentOrgId, "positions", positionId);
    await updateDoc(positionRef, {
      name,
      description,
      maxCandidates,
      updatedAt: serverTimestamp()
    });
    
    showToast('Position updated successfully', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECPositions();
  } catch(e) {
    console.error('Error updating position:', e);
    showToast('Error updating position: ' + e.message, 'error');
  }
}

/**
 * Delete position with confirmation
 */
export function deletePositionConfirm(positionId, positionName) {
  if (typeof window.checkVotingLock === 'function' && window.checkVotingLock("delete positions")) return;

  if (!confirm(`Delete position: ${positionName}?\n\nThis will also delete all candidates for this position.`)) {
    return;
  }
  
  deletePosition(positionId);
}

/**
 * Delete position
 */
async function deletePosition(positionId) {
  // ✅ PATCH 2: Check edit lock before allowing position deletion
  if (checkEditLock(window.currentOrgData)) return;
  
  try {
    await deleteDoc(doc(db, "organizations", window.currentOrgId, "positions", positionId));
    showToast('Position deleted successfully', 'success');
    loadECPositions();
    
    // Also reload candidates since they reference positions
    if (typeof window.loadECCandidates === 'function') {
      window.loadECCandidates();
    }
  } catch(e) {
    console.error('Error deleting position:', e);
    showToast('Error deleting position: ' + e.message, 'error');
  }
}

/**
 * Refresh positions list
 */
export function refreshPositions() {
  loadECPositions();
  showToast("Positions refreshed", "success");
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.loadECPositions = loadECPositions;
  window.showAddPositionModal = showAddPositionModal;
  window.savePosition = savePosition;
  window.editPositionModal = editPositionModal;
  window.updatePosition = updatePosition;
  window.deletePositionConfirm = deletePositionConfirm;
  window.refreshPositions = refreshPositions;
}
