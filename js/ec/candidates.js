/**
 * EC Module - Candidates Management
 * Handles all candidate CRUD operations
 */

import { db, storage } from '../config/firebase.js';
import { collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js';
import { showToast, createModal, showQuickLoading, getDefaultAvatar } from '../utils/ui-helpers.js';
import { escapeHtml } from '../utils/validation.js';
import { checkEditLock } from './utils.js';

/**
 * Load and display all candidates grouped by position
 */
export async function loadECCandidates() {
  const el = document.getElementById("ecContent-candidates");
  if (!el || !window.currentOrgId) return;
  
  // Get translation function
  const t = window.t || ((key) => key);
  
  showQuickLoading("ecContent-candidates", "Loading Candidates");
  
  try {
    const [candidatesSnap, positionsSnap] = await Promise.all([
      getDocs(collection(db, "organizations", window.currentOrgId, "candidates")),
      getDocs(collection(db, "organizations", window.currentOrgId, "positions"))
    ]);
    
    const candidates = [];
    candidatesSnap.forEach(s => {
      const data = s.data();
      candidates.push({ 
        id: s.id, 
        ...data,
        photo: data.photo || getDefaultAvatar(data.name || 'Candidate')
      });
    });
    
    const positions = [];
    positionsSnap.forEach(s => positions.push({ id: s.id, ...s.data() }));
    
    let html = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3><i class="fas fa-user-friends"></i> ${t('candidates')} (${candidates.length})</h3>
        <div style="display:flex;gap:8px">
          <button class="btn neon-btn" onclick="showAddCandidateModal()">
            <i class="fas fa-user-plus"></i> ${t('add_candidate')}
          </button>
          <button class="btn neon-btn-outline" onclick="exportCandidatesCSV()">
            <i class="fas fa-file-csv"></i> ${t('csv')}
          </button>
          <button class="btn neon-btn" onclick="exportCandidatesPDF()">
            <i class="fas fa-file-pdf"></i> ${t('pdf')}
          </button>
          <button class="btn neon-btn-outline" onclick="refreshCandidates()">
            <i class="fas fa-redo"></i>
          </button>
        </div>
      </div>
    `;
    
    if (candidates.length === 0) {
      html += `
        <div class="card empty-state">
          <i class="fas fa-user-friends"></i>
          <h4>No Candidates Yet</h4>
          <p class="subtext">Add candidates for each position</p>
          <button class="btn neon-btn" onclick="showAddCandidateModal()">
            <i class="fas fa-user-plus"></i> Add Your First Candidate
          </button>
        </div>
      `;
    } else {
      const grouped = {};
      candidates.forEach(c => {
        if (!grouped[c.positionId]) grouped[c.positionId] = [];
        grouped[c.positionId].push(c);
      });
      
      // Show candidates grouped by position
      positions.forEach(pos => {
        const posCandidates = grouped[pos.id] || [];
        if (posCandidates.length === 0) return;
        
        html += `
          <div class="card" style="margin-bottom:20px">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px">
              <h4 style="color:#00eaff;margin:0">
                <i class="fas fa-users"></i> ${pos.name}
                <span class="subtext">(${posCandidates.length} candidates)</span>
              </h4>
              <button class="btn neon-btn-outline" onclick="showAddCandidateForPositionModal('${pos.id}', '${escapeHtml(pos.name)}')">
                <i class="fas fa-user-plus"></i> Add to ${pos.name}
              </button>
            </div>
        `;
        
        posCandidates.forEach(c => {
          html += `
            <div class="list-item" style="margin-top:10px;align-items:center">
              <div style="display:flex;gap:12px;align-items:center">
                <img src="${c.photo}" 
                     style="width:60px;height:60px;border-radius:8px;object-fit:cover;border:2px solid rgba(0,255,255,0.2);">
                <div style="flex:1">
                  <strong>${c.name}</strong>
                  ${c.tagline ? `<div class="subtext" style="margin-top:2px">${c.tagline}</div>` : ''}
                  <div class="subtext" style="margin-top:2px">Votes: ${c.votes || 0}</div>
                </div>
              </div>
              <div style="display:flex;gap:8px">
                <button class="btn neon-btn-outline" onclick="editCandidateModal('${c.id}')" title="Edit">
                  <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-danger" onclick="deleteCandidateConfirm('${c.id}', '${escapeHtml(c.name)}')" title="Delete">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
          `;
        });
        
        html += `</div>`;
      });
    }
    
    el.innerHTML = html;
  } catch(e) {
    console.error("Error loading candidates:", e);
    el.innerHTML = `
      <div class="error-state">
        <i class="fas fa-exclamation-triangle" style="color:#ff4444;font-size:48px;margin-bottom:20px"></i>
        <h3>Error Loading Candidates</h3>
        <p class="subtext" style="color:#ff9999">${e.message}</p>
        <button class="btn neon-btn" onclick="loadECCandidates()">
          <i class="fas fa-redo"></i> Retry
        </button>
      </div>
    `;
  }
}

/**
 * Show add candidate modal
 */
export async function showAddCandidateModal() {
  // Check edit lock before opening modal
  if (checkEditLock(window.currentOrgData)) return;
  if (typeof window.checkVotingLock === 'function' && window.checkVotingLock("add candidates")) return;

  try {
    const positionsSnap = await getDocs(collection(db, "organizations", window.currentOrgId, "positions"));
    const positions = [];
    positionsSnap.forEach(s => positions.push({ id: s.id, ...s.data() }));
    
    if (positions.length === 0) {
      showToast('Please add positions first', 'error');
      return;
    }
    
    const positionOptions = positions.map(p => 
      `<option value="${p.id}">${p.name}</option>`
    ).join('');
    
    createModal(
      '<i class="fas fa-user-plus"></i> Add New Candidate',
      `
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <div>
            <label class="label">Position *</label>
            <select id="cand-position" class="input">${positionOptions}</select>
          </div>
          <div>
            <label class="label">Candidate Name *</label>
            <input id="cand-name" class="input" placeholder="Full name" required>
          </div>
          <div>
            <label class="label">Tagline</label>
            <input id="cand-tagline" class="input" placeholder="Brief tagline or slogan">
          </div>
          <div>
            <label class="label">Bio (optional)</label>
            <textarea id="cand-bio" class="input" rows="3" placeholder="Candidate biography"></textarea>
          </div>
          <div>
            <label class="label">Photo (optional)</label>
            <input id="cand-photo" class="input" type="file" accept="image/*">
          </div>
        </div>
      `,
      `
        <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
          <i class="fas fa-times"></i> Cancel
        </button>
        <button class="btn neon-btn" onclick="addCandidate()">
          <i class="fas fa-plus-circle"></i> Add Candidate
        </button>
      `
    );
    
    setTimeout(() => document.getElementById('cand-name')?.focus(), 100);
  } catch(e) {
    console.error('Error loading positions:', e);
    showToast('Error loading positions', 'error');
  }
}

/**
 * Add candidate
 */
export async function addCandidate() {
  // ✅ PATCH 2: Check edit lock before allowing candidate creation
  if (checkEditLock(window.currentOrgData)) return;
  
  const positionId = document.getElementById('cand-position')?.value;
  const name = document.getElementById('cand-name')?.value.trim();
  const tagline = document.getElementById('cand-tagline')?.value.trim();
  const bio = document.getElementById('cand-bio')?.value.trim();
  const photoFile = document.getElementById('cand-photo')?.files[0];
  
  if (!positionId || !name) {
    showToast('Position and name are required', 'error');
    return;
  }
  
  try {
    let photoUrl = getDefaultAvatar(name);
    
    // Upload photo if provided
    if (photoFile) {
      const photoRef = ref(storage, `organizations/${window.currentOrgId}/candidates/${Date.now()}_${photoFile.name}`);
      await uploadBytes(photoRef, photoFile);
      photoUrl = await getDownloadURL(photoRef);
    }
    
    const candidatesRef = collection(db, "organizations", window.currentOrgId, "candidates");
    await addDoc(candidatesRef, {
      positionId,
      name,
      tagline: tagline || '',
      bio: bio || '',
      photo: photoUrl,
      votes: 0,
      createdAt: serverTimestamp()
    });
    
    showToast('Candidate added successfully', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECCandidates();
  } catch(e) {
    console.error('Error adding candidate:', e);
    showToast('Error adding candidate: ' + e.message, 'error');
  }
}

/**
 * Edit candidate modal
 */
export async function editCandidateModal(candidateId) {
  // Check edit lock before opening modal
  if (checkEditLock(window.currentOrgData)) return;
  if (typeof window.checkVotingLock === 'function' && window.checkVotingLock("edit candidates")) return;

  try {
    const [candidatesSnap, positionsSnap] = await Promise.all([
      getDocs(collection(db, "organizations", window.currentOrgId, "candidates")),
      getDocs(collection(db, "organizations", window.currentOrgId, "positions"))
    ]);
    
    let candidate = null;
    candidatesSnap.forEach(s => {
      if (s.id === candidateId) candidate = s.data();
    });
    
    if (!candidate) {
      showToast('Candidate not found', 'error');
      return;
    }
    
    const positions = [];
    positionsSnap.forEach(s => positions.push({ id: s.id, ...s.data() }));
    
    const positionOptions = positions.map(p => 
      `<option value="${p.id}" ${p.id === candidate.positionId ? 'selected' : ''}>${p.name}</option>`
    ).join('');
    
    createModal(
      '<i class="fas fa-edit"></i> Edit Candidate',
      `
        <div style="display: flex; flex-direction: column; gap: 15px;">
          <div>
            <label class="label">Position *</label>
            <select id="editCandPosition" class="input">${positionOptions}</select>
          </div>
          <div>
            <label class="label">Candidate Name *</label>
            <input id="editCandName" class="input" value="${escapeHtml(candidate.name || '')}" required>
          </div>
          <div>
            <label class="label">Tagline</label>
            <input id="editCandTagline" class="input" value="${escapeHtml(candidate.tagline || '')}">
          </div>
          <div>
            <label class="label">Bio</label>
            <textarea id="editCandBio" class="input" rows="3">${escapeHtml(candidate.bio || '')}</textarea>
          </div>
          <div>
            <label class="label">New Photo (optional)</label>
            <input id="editCandPhoto" class="input" type="file" accept="image/*">
          </div>
          ${candidate.photo ? `
            <div>
              <img src="${candidate.photo}" style="max-width:100px;border-radius:8px">
            </div>
          ` : ''}
        </div>
      `,
      `
        <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
          <i class="fas fa-times"></i> Cancel
        </button>
        <button class="btn neon-btn" onclick="updateCandidate('${candidateId}', '${candidate.photo || ''}')">
          <i class="fas fa-save"></i> Save Changes
        </button>
      `
    );
    
    setTimeout(() => document.getElementById('editCandName')?.focus(), 100);
  } catch(e) {
    console.error('Error loading candidate:', e);
    showToast('Error loading candidate details', 'error');
  }
}

/**
 * Update candidate
 */
export async function updateCandidate(candidateId, currentPhoto) {
  // ✅ PATCH 2: Check edit lock before allowing candidate update
  if (checkEditLock(window.currentOrgData)) return;
  
  const positionId = document.getElementById('editCandPosition')?.value;
  const name = document.getElementById('editCandName')?.value.trim();
  const tagline = document.getElementById('editCandTagline')?.value.trim();
  const bio = document.getElementById('editCandBio')?.value.trim();
  const photoFile = document.getElementById('editCandPhoto')?.files[0];
  
  if (!positionId || !name) {
    showToast('Position and name are required', 'error');
    return;
  }
  
  try {
    let photoUrl = currentPhoto || getDefaultAvatar(name);
    
    // Upload new photo if provided
    if (photoFile) {
      const photoRef = ref(storage, `organizations/${window.currentOrgId}/candidates/${Date.now()}_${photoFile.name}`);
      await uploadBytes(photoRef, photoFile);
      photoUrl = await getDownloadURL(photoRef);
    }
    
    const candidateRef = doc(db, "organizations", window.currentOrgId, "candidates", candidateId);
    await updateDoc(candidateRef, {
      positionId,
      name,
      tagline,
      bio,
      photo: photoUrl,
      updatedAt: serverTimestamp()
    });
    
    showToast('Candidate updated successfully', 'success');
    document.querySelector('.modal-overlay')?.remove();
    loadECCandidates();
  } catch(e) {
    console.error('Error updating candidate:', e);
    showToast('Error updating candidate: ' + e.message, 'error');
  }
}

/**
 * Delete candidate with confirmation
 */
export function deleteCandidateConfirm(candidateId, candidateName) {
  if (typeof window.checkVotingLock === 'function' && window.checkVotingLock("delete candidates")) return;

  if (!confirm(`Delete candidate: ${candidateName}?\n\nThis cannot be undone.`)) {
    return;
  }
  
  deleteCandidate(candidateId);
}

/**
 * Delete candidate
 */
async function deleteCandidate(candidateId) {
  // ✅ PATCH 2: Check edit lock before allowing candidate deletion
  if (checkEditLock(window.currentOrgData)) return;
  
  try {
    await deleteDoc(doc(db, "organizations", window.currentOrgId, "candidates", candidateId));
    showToast('Candidate deleted successfully', 'success');
    loadECCandidates();
  } catch(e) {
    console.error('Error deleting candidate:', e);
    showToast('Error deleting candidate: ' + e.message, 'error');
  }
}

/**
 * Refresh candidates list
 */
export function refreshCandidates() {
  loadECCandidates();
  showToast("Candidates refreshed", "success");
}

/**
 * Show add candidate for specific position
 */
export function showAddCandidateForPositionModal(positionId, positionName) {
  // Check edit lock before opening modal
  if (checkEditLock(window.currentOrgData)) return;
  if (typeof window.checkVotingLock === 'function' && window.checkVotingLock("add candidates")) return;

  createModal(
    `<i class="fas fa-user-plus"></i> Add Candidate for ${positionName}`,
    `
      <input type="hidden" id="cand-position-fixed" value="${positionId}">
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label class="label">Candidate Name *</label>
          <input id="cand-name" class="input" placeholder="Full name" required>
        </div>
        <div>
          <label class="label">Tagline</label>
          <input id="cand-tagline" class="input" placeholder="Brief tagline or slogan">
        </div>
        <div>
          <label class="label">Bio (optional)</label>
          <textarea id="cand-bio" class="input" rows="3" placeholder="Candidate biography"></textarea>
        </div>
        <div>
          <label class="label">Photo (optional)</label>
          <input id="cand-photo" class="input" type="file" accept="image/*">
        </div>
      </div>
    `,
    `
      <button class="btn neon-btn-outline" onclick="document.querySelector('.modal-overlay').remove()">
        <i class="fas fa-times"></i> Cancel
      </button>
      <button class="btn neon-btn" onclick="addCandidateForPosition()">
        <i class="fas fa-plus-circle"></i> Add Candidate
      </button>
    `
  );
  
  setTimeout(() => document.getElementById('cand-name')?.focus(), 100);
}

/**
 * Add candidate for specific position
 */
export async function addCandidateForPosition() {
  const positionId = document.getElementById('cand-position-fixed')?.value;
  await addCandidate(); // Reuse addCandidate logic
}

/**
 * Export candidates list as CSV
 */
export async function exportCandidatesCSV() {
  try {
    const [candidatesSnap, positionsSnap] = await Promise.all([
      getDocs(collection(db, "organizations", window.currentOrgId, "candidates")),
      getDocs(collection(db, "organizations", window.currentOrgId, "positions"))
    ]);
    
    const candidates = [];
    candidatesSnap.forEach(s => candidates.push({ id: s.id, ...s.data() }));
    
    const positions = {};
    positionsSnap.forEach(s => positions[s.id] = s.data().name);
    
    let csv = "Name,Position,Tagline,Votes\n";
    candidates.forEach(c => {
      const positionName = positions[c.positionId] || 'N/A';
      csv += `"${c.name || ''}","${positionName}","${c.tagline || ''}","${c.votes || 0}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `candidates-${window.currentOrgId}-${Date.now()}.csv`;
    a.click();
    
    showToast('Candidates exported successfully', 'success');
  } catch(e) {
    console.error('Error exporting candidates:', e);
    showToast('Error exporting candidates', 'error');
  }
}

/**
 * Export candidates list as PDF with photos
 */
export async function exportCandidatesPDF() {
  try {
    const jsp = window.jspdf;
    if (!jsp || !jsp.jsPDF) return showToast("PDF library missing", "error");

    const pdf = new jsp.jsPDF("p", "mm", "a4");
    const margin = 15;
    const pageHeight = 297;
    let y = 15;

    // Load org data and images
    const orgSnap = await getDoc(doc(db, "organizations", window.currentOrgId));
    const org = orgSnap.exists() ? orgSnap.data() : {};
    
    const { loadImageAsBase64 } = await import('../reports/exports.js');
    const appLogoData = await loadImageAsBase64('./neon-logo.png');
    const orgLogoData = org.logoUrl ? await loadImageAsBase64(org.logoUrl) : null;

    // ===== HEADER =====
    pdf.setFillColor(26, 189, 156);
    pdf.rect(0, 0, 210, 28, "F");

    if (appLogoData) {
      try {
        // Add matching background behind logo for seamless blend
        pdf.setFillColor(26, 189, 156);
        pdf.rect(margin - 1, 3, 22, 22, "F");
        pdf.addImage(appLogoData, 'PNG', margin, 4, 20, 20);
      } catch (e) {
        console.warn('Failed to add app logo:', e);
      }
    }

    pdf.setFontSize(24);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255);
    pdf.text("CANDIDATES LIST", appLogoData ? margin + 24 : margin, 12);

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(220, 240, 235);
    pdf.text("Neon Voting Platform - Official Candidates Registry", appLogoData ? margin + 24 : margin, 19);

    y = 35;

    // ===== ORG INFO =====
    pdf.setFillColor(248, 250, 251);
    const metaBoxHeight = orgLogoData ? 24 : 18;
    pdf.rect(margin, y - 2, 180, metaBoxHeight, "F");
    pdf.setDrawColor(200, 200, 210);
    pdf.rect(margin, y - 2, 180, metaBoxHeight);

    if (orgLogoData) {
      try {
        pdf.addImage(orgLogoData, 'PNG', margin + 3, y, 18, 18);
      } catch (e) {
        console.warn('Failed to add org logo:', e);
      }
    }

    const textStartX = orgLogoData ? margin + 24 : margin + 3;
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(30, 130, 110);
    pdf.text("ORGANIZATION DETAILS", textStartX, y + 2);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 70);
    pdf.text(`Organization: ${org.name || window.currentOrgId}`, textStartX, y + 7);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, textStartX, y + 11);
    pdf.text(`Election Type: ${org.electionType || 'N/A'}`, textStartX, y + 15);

    y += metaBoxHeight + 6;

    // ===== FETCH CANDIDATES AND POSITIONS =====
    const [candidatesSnap, positionsSnap] = await Promise.all([
      getDocs(collection(db, "organizations", window.currentOrgId, "candidates")),
      getDocs(collection(db, "organizations", window.currentOrgId, "positions"))
    ]);
    
    const candidates = [];
    candidatesSnap.forEach(s => {
      const data = s.data();
      candidates.push({ 
        id: s.id, 
        ...data,
        photo: data.photo || getDefaultAvatar(data.name || 'Candidate')
      });
    });

    const positions = {};
    const positionsList = [];
    positionsSnap.forEach(s => {
      positions[s.id] = s.data().name;
      positionsList.push({ id: s.id, name: s.data().name });
    });

    const totalCandidates = candidates.length;
    const totalPositions = positionsList.length;

    // ===== SUMMARY STATS =====
    pdf.setFillColor(248, 250, 251);
    pdf.rect(margin, y - 2, 180, 14, "F");
    pdf.setDrawColor(200, 200, 210);
    pdf.rect(margin, y - 2, 180, 14);

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(30, 130, 110);
    pdf.text("SUMMARY", margin + 3, y + 2);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 70);
    pdf.text(`Total Candidates: ${totalCandidates}  |  Total Positions: ${totalPositions}`, margin + 3, y + 8);

    y += 18;

    // ===== LOAD CANDIDATE PHOTOS =====
    const candidatePhotos = {};
    for (const c of candidates) {
      const photoUrl = c.photo || c.photoUrl;
      
      // Skip default SVG avatars - they don't work in PDFs
      if (!photoUrl || photoUrl.startsWith('data:image/svg')) {
        candidatePhotos[c.id] = null;
        continue;
      }
      
      try {
        const photoData = await loadImageAsBase64(photoUrl);
        candidatePhotos[c.id] = photoData;
      } catch(e) {
        console.warn('Failed to load photo for candidate:', c.name, e.message);
        candidatePhotos[c.id] = null;
      }
    }

    // ===== TABLE HEADER =====
    pdf.setFillColor(26, 189, 156);
    pdf.rect(margin, y, 180, 7, "F");

    pdf.setFontSize(9);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255);
    pdf.text("Photo", margin + 2, y + 4.5);
    pdf.text("Name", margin + 25, y + 4.5);
    pdf.text("Position", margin + 80, y + 4.5);
    pdf.text("Tagline", margin + 130, y + 4.5);
    pdf.text("Votes", margin + 170, y + 4.5);

    y += 7.5;

    // ===== TABLE ROWS =====
    candidates.forEach((c, idx) => {
      // Check if need new page
      if (y > pageHeight - 40) {
        pdf.addPage();
        y = 15;
        
        // Repeat header on new page
        pdf.setFillColor(26, 189, 156);
        pdf.rect(margin, y, 180, 7, "F");
        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(255, 255, 255);
        pdf.text("Photo", margin + 2, y + 4.5);
        pdf.text("Name", margin + 25, y + 4.5);
        pdf.text("Position", margin + 80, y + 4.5);
        pdf.text("Tagline", margin + 130, y + 4.5);
        pdf.text("Votes", margin + 170, y + 4.5);
        y += 7.5;
      }

      const rowHeight = 16;

      // Alternating row background
      if (idx % 2 === 0) {
        pdf.setFillColor(255, 255, 255);
      } else {
        pdf.setFillColor(248, 250, 251);
      }
      pdf.rect(margin, y, 180, rowHeight, "F");

      // Row border
      pdf.setDrawColor(200, 200, 210);
      pdf.setLineWidth(0.2);
      pdf.rect(margin, y, 180, rowHeight);

      // Candidate photo
      if (candidatePhotos[c.id]) {
        try {
          pdf.addImage(candidatePhotos[c.id], 'JPEG', margin + 2, y + 2, 12, 12);
        } catch (e) {
          console.warn('Failed to add candidate photo:', c.name, e);
        }
      } else {
        // Draw placeholder circle
        pdf.setFillColor(200, 200, 210);
        pdf.circle(margin + 8, y + 8, 6, "F");
      }

      // Row content
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(40, 40, 50);

      const name = c.name || 'N/A';
      const positionName = positions[c.positionId] || 'N/A';
      const tagline = c.tagline || '-';
      const votes = c.votes || 0;

      // Truncate long text
      pdf.text(name.substring(0, 25), margin + 25, y + 8);
      pdf.text(positionName.substring(0, 22), margin + 80, y + 8);
      pdf.text(tagline.substring(0, 18), margin + 130, y + 8);
      pdf.text(String(votes), margin + 170, y + 8);

      y += rowHeight;
    });

    // ===== FOOTER =====
    const footerY = pageHeight - 10;
    pdf.setDrawColor(26, 189, 156);
    pdf.setLineWidth(0.8);
    pdf.line(margin, footerY - 2, 210 - margin, footerY - 2);

    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(120, 120, 130);
    pdf.text(`Neon Voting Platform | ${new Date().toLocaleString()}`, margin, footerY);
    pdf.text(`Org: ${org.name || window.currentOrgId}`, 210 - margin - 50, footerY);

    pdf.save(`Candidates_${org.name || window.currentOrgId}_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast('Candidates list exported as PDF successfully', 'success');
  } catch(e) {
    console.error('Error exporting candidates PDF:', e);
    showToast('Error exporting PDF: ' + e.message, 'error');
  }
}

// Export to window for backwards compatibility
if (typeof window !== 'undefined') {
  window.loadECCandidates = loadECCandidates;
  window.showAddCandidateModal = showAddCandidateModal;
  window.addCandidate = addCandidate;
  window.editCandidateModal = editCandidateModal;
  window.updateCandidate = updateCandidate;
  window.deleteCandidateConfirm = deleteCandidateConfirm;
  window.refreshCandidates = refreshCandidates;
  window.showAddCandidateForPositionModal = showAddCandidateForPositionModal;
  window.addCandidateForPosition = addCandidateForPosition;
  window.exportCandidatesCSV = exportCandidatesCSV;
  window.exportCandidatesPDF = exportCandidatesPDF;
}
