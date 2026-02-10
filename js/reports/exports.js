// exports.js - Export Results to CSV/PDF
import { db, storage } from '../config/firebase.js';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  query 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { 
  ref as storageRef, 
  getBlob 
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js';
import { showToast } from '../utils/ui-helpers.js';
import { _ensureOrgId, _csvDownload } from './helpers.js';

/**
 * Load image and convert to base64 data URL for PDF embedding
 * Uses Firebase Storage SDK for Firebase URLs to avoid CORS issues
 */
export async function loadImageAsBase64(url) {
  if (!url) return null;
  
  try {
    let blob;
    
    // Handle Firebase Storage URLs with SDK (avoids CORS)
    if (url.includes('firebasestorage.googleapis.com')) {
      // Extract path from Firebase Storage URL
      const urlObj = new URL(url);
      const pathMatch = urlObj.pathname.match(/\/o\/(.+)\?/);
      if (pathMatch) {
        const storagePath = decodeURIComponent(pathMatch[1]);
        const fileRef = storageRef(storage, storagePath);
        blob = await getBlob(fileRef);
      } else {
        // Fallback to fetch with CORS mode
        const response = await fetch(url, { mode: 'cors' });
        if (!response.ok) return null;
        blob = await response.blob();
      }
    } else {
      // Handle relative paths
      if (url.startsWith('./') || url.startsWith('/')) {
        url = new URL(url, window.location.origin).href;
      }
      
      // Regular fetch for non-Firebase URLs
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) {
        console.warn('Failed to fetch image:', url, 'Status:', response.status);
        return null;
      }
      blob = await response.blob();
    }
    
    // Convert blob to base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = (err) => {
        console.error('FileReader error:', err);
        reject(err);
      };
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('Failed to load image:', url, e.message);
    return null;
  }
}

export async function exportResultsCSV(orgId) {
  // CSV export disabled — Results export is PDF only
  return exportResultsPDF(orgId);
}

export async function exportAuditCSV(orgId) {
  try {
    orgId = _ensureOrgId(orgId);
    if (!orgId) { 
      showToast("Select an organization first", "warning"); 
      return; 
    }

    const snap = await getDocs(query(
      collection(db, "organizations", orgId, "audit_logs")
    ));

    const rows = [
      ["Organization ID", orgId],
      ["Exported At", new Date().toISOString()],
      [],
      ["Time", "Action", "Actor", "Meta"]
    ];
    
    snap.forEach(d => {
      const a = d.data() || {};
      const t = a.at?.toDate ? a.at.toDate().toISOString() : "";
      rows.push([t, a.action || "", a.actor || "", JSON.stringify(a.meta || {})]);
    });

    _csvDownload(`audit_${orgId}.csv`, rows);
    showToast("Audit exported ✅", "success");
  } catch (e) {
    console.error(e);
    showToast("Audit export failed.", "error");
  }
}

export async function exportResultsPDF(orgId) {
  try {
    orgId = orgId || window.currentOrgId;
    if (!orgId) return showToast("Organization not resolved", "error");

    const jsp = window.jspdf;
    if (!jsp || !jsp.jsPDF) return showToast("PDF library missing", "error");

    const pdf = new jsp.jsPDF("p", "mm", "a4");
    let y = 15;
    const margin = 15;
    const maxW = 210 - margin * 2;
    const pageHeight = 297;
    
    // ===== FETCH ORGANIZATION DATA FIRST =====
    const orgSnap = await getDoc(doc(db, "organizations", orgId));
    const org = orgSnap.exists() ? orgSnap.data() : {};
    
    // Load images for PDF (after org data is available)
    const appLogoData = await loadImageAsBase64('./neon-logo.png');
    const orgLogoData = org.logoUrl ? await loadImageAsBase64(org.logoUrl) : null;
    
    // Professional color scheme
    const headerBg = [26, 189, 156]; // Teal #1ABD9C
    const headerText = [255, 255, 255]; // White
    const titleColor = [30, 130, 110]; // Dark teal
    const textDark = [40, 40, 50]; // Dark gray
    const textLight = [100, 100, 110]; // Light gray
    const borderColor = [200, 200, 210]; // Light border
    const rowBg1 = [255, 255, 255]; // White
    const rowBg2 = [248, 250, 251]; // Very light blue-gray

    // ===== HEADER SECTION =====
    pdf.setFillColor(26, 189, 156);
    pdf.rect(0, 0, 210, 28, "F");

    // App Logo (Neon)
    if (appLogoData) {
      try {
        // Add matching background behind logo for seamless blend
        pdf.setFillColor(26, 189, 156);
        pdf.rect(margin - 1, 3, 22, 22, "F");
        pdf.addImage(appLogoData, 'PNG', margin, 4, 20, 20);
      } catch (e) {
        console.warn('Failed to add app logo to PDF:', e);
      }
    }

    // Title
    pdf.setFontSize(24);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(255, 255, 255);
    pdf.text("ELECTION RESULTS", appLogoData ? margin + 24 : margin, 12);

    // Subtitle
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(220, 240, 235);
    pdf.text("Neon Voting Platform - Official Results Report", appLogoData ? margin + 24 : margin, 19);

    y = 35;

    // ===== ORGANIZATION & META INFO =====
    // (org data already fetched above)

    // Meta info box background
    pdf.setFillColor(248, 250, 251);
    const metaBoxHeight = orgLogoData ? 24 : 18;
    pdf.rect(margin, y - 2, maxW, metaBoxHeight, "F");
    pdf.setDrawColor(200, 200, 210);
    pdf.rect(margin, y - 2, maxW, metaBoxHeight);

    // Organization Logo
    if (orgLogoData) {
      try {
        pdf.addImage(orgLogoData, 'PNG', margin + 3, y, 18, 18);
      } catch (e) {
        console.warn('Failed to add org logo to PDF:', e);
      }
    }

    const textStartX = orgLogoData ? margin + 24 : margin + 3;

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(30, 130, 110);
    pdf.text("ELECTION DETAILS", textStartX, y + 2);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 70);

    pdf.text(`Organization: ${org.name || orgId}`, textStartX, y + 7);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, textStartX, y + 11);
    pdf.text(`Status: Final Results`, textStartX, y + 15);

    y += metaBoxHeight + 4;

    // ===== BUILD CANDIDATE LOOKUPS =====
    const candSnap = await getDocs(collection(db, "organizations", orgId, "candidates"));
    const candByAny = {};
    const candByName = {};
    const posCandidates = {};
    const candPhotoUrls = {}; // Store candidate photo URLs
    const norm = (s) => String(s || "").trim().toLowerCase();

    candSnap.forEach(c => {
      const d = c.data() || {};
      const name = d.name || d.fullName || d.candidateName || "Unnamed Candidate";
      let photoUrl = d.photoUrl || d.photo || d.imageUrl || d.image || null;
      
      // Skip default SVG avatars - they don't work in PDFs
      if (photoUrl && photoUrl.startsWith('data:image/svg')) {
        photoUrl = null;
      }
      
      // Store photo URL under all possible keys for better lookup
      const keys = new Set([
        c.id,
        d.id,
        d.candidateId,
        d.uid,
        d.docId,
        name
      ].filter(Boolean).map(norm));

      keys.forEach(k => { 
        if (k) {
          candByAny[k] = name;
          if (photoUrl) {
            candPhotoUrls[k] = photoUrl;
          }
        }
      });
      
      candByName[norm(name)] = name;
      if (photoUrl) candPhotoUrls[norm(name)] = photoUrl;

      const posId = d.positionId || d.position || d.position_id || d.posId;
      if (posId) {
        (posCandidates[posId] ||= []).push({ id: c.id, name, photoUrl });
      }
    });

    const resolveCandidateName = (choiceValue, posId) => {
      // Handle case where choiceValue might be an object (defensive)
      let raw;
      if (typeof choiceValue === 'object' && choiceValue !== null) {
        // Extract ID or name from object
        raw = choiceValue.id || choiceValue.candidateId || choiceValue.name || String(choiceValue);
      } else {
        raw = String(choiceValue ?? "");
      }
      
      raw = raw.trim();
      const key = norm(raw);

      if (!key) return "Unknown Candidate";

      if ((key === "yes" || key === "no") && posId && Array.isArray(posCandidates[posId]) && posCandidates[posId].length === 1) {
        const onlyName = posCandidates[posId][0].name || "Unnamed Candidate";
        return key === "yes" ? `${onlyName}` : `NO (against ${onlyName})`;
      }

      if (candByAny[key]) return candByAny[key];
      if (candByName[key]) return candByName[key];

      return raw || "Unknown Candidate";
    };

    // ===== AGGREGATE VOTES =====
    const votesSnap = await getDocs(collection(db, "organizations", orgId, "votes"));
    const voteMap = {};
    votesSnap.forEach(v => {
      const choices = v.data().choices || {};
      Object.entries(choices).forEach(([pos, cand]) => {
        // Handle both single candidates and arrays
        const candidates = Array.isArray(cand) ? cand : [cand];
        candidates.forEach(c => {
          // Extract ID if it's an object (defensive handling)
          let candId = c;
          if (typeof c === 'object' && c !== null) {
            candId = c.id || c.candidateId || c.name || String(c);
          }
          voteMap[pos] ??= {};
          voteMap[pos][candId] = (voteMap[pos][candId] || 0) + 1;
        });
      });
    });

    const totalBallots = votesSnap.size;

    // ===== SUMMARY STATS SECTION =====
    pdf.setFillColor(248, 250, 251);
    pdf.rect(margin, y - 2, maxW, 14, "F");
    pdf.setDrawColor(200, 200, 210);
    pdf.rect(margin, y - 2, maxW, 14);

    pdf.setFontSize(10);
    pdf.setFont("helvetica", "bold");
    pdf.setTextColor(30, 130, 110);
    pdf.text("VOTING SUMMARY", margin + 3, y + 2);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(60, 60, 70);
    pdf.text(`Total Ballots Cast: ${totalBallots}  |  Total Candidates: ${candSnap.size}`, margin + 3, y + 8);

    y += 18;

    // ===== DETAILED RESULTS BY POSITION =====
    const posSnap = await getDocs(collection(db, "organizations", orgId, "positions"));

    for (const p of posSnap.docs) {
      const pos = p.data();
      const counts = voteMap[p.id] || {};
      const total = Object.values(counts).reduce((a, b) => a + b, 0);

      // Check if we need a new page
      if (y > pageHeight - 70) {
        pdf.addPage();
        y = 15;
      }

      // ===== POSITION HEADER =====
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(30, 130, 110);
      pdf.text((pos.title || pos.name || "POSITION").toUpperCase(), margin, y);
      y += 5;

      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(120, 120, 130);
      pdf.text(`Position ID: ${p.id}`, margin, y);
      y += 6;

      // ===== TABLE STRUCTURE =====
      const colWidths = {
        photo: 20,
        candidate: 90,
        votes: 30,
        percentage: 30
      };
      const tableX = margin;
      const headerHeight = 7;
      const rowHeight = 12; // Increased for photos

      // TABLE HEADER
      pdf.setFillColor(26, 189, 156);
      pdf.rect(tableX, y, maxW, headerHeight, "F");

      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(255, 255, 255);

      pdf.text("Photo", tableX + 2, y + 4.5);
      pdf.text("Candidate / Choice", tableX + colWidths.photo + 2, y + 4.5);
      pdf.text("Votes", tableX + colWidths.photo + colWidths.candidate + 2, y + 4.5);
      pdf.text("%", tableX + colWidths.photo + colWidths.candidate + colWidths.votes + 2, y + 4.5);

      y += headerHeight + 0.5;

      // TABLE ROWS
      if (!Object.keys(counts).length) {
        pdf.setFillColor(245, 245, 250);
        pdf.rect(tableX, y, maxW, rowHeight, "F");
        pdf.setDrawColor(200, 200, 210);
        pdf.setLineWidth(0.2);
        pdf.rect(tableX, y, maxW, rowHeight);

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(150, 100, 100);
        pdf.text("No votes recorded for this position", tableX + 3, y + 4.5);
        y += rowHeight + 1;
      } else {
        // Sort candidates by votes (descending)
        const sorted = Object.entries(counts)
          .sort((a, b) => b[1] - a[1])
          .map(([cid, v]) => {
            const candKey = norm(cid);
            const candidateName = resolveCandidateName(cid, p.id);
            
            // Try multiple ways to find the photo URL
            let photoUrl = candPhotoUrls[candKey] || candPhotoUrls[norm(candidateName)] || null;
            
            // If still no photo, check the position's candidate list
            if (!photoUrl && posCandidates[p.id]) {
              const posCandidate = posCandidates[p.id].find(pc => 
                norm(pc.id) === candKey || 
                norm(pc.name) === candKey ||
                norm(pc.name) === norm(candidateName)
              );
              if (posCandidate) {
                photoUrl = posCandidate.photoUrl;
              }
            }
            
            return {
              name: candidateName,
              votes: v,
              percentage: total ? ((v / total) * 100).toFixed(1) : "0",
              photoUrl: photoUrl
            };
          });

        // Pre-load all candidate photos for this position
        const photoDataCache = {};
        
        await Promise.all(
          sorted.map(async (cand) => {
            if (cand.photoUrl) {
              const photoData = await loadImageAsBase64(cand.photoUrl);
              if (photoData) {
                photoDataCache[cand.name] = photoData;
              }
            }
          })
        );

        // Draw each row
        sorted.forEach((candidate, idx) => {
          // Alternating row background
          if (idx % 2 === 0) {
            pdf.setFillColor(255, 255, 255);
          } else {
            pdf.setFillColor(248, 250, 251);
          }
          pdf.rect(tableX, y, maxW, rowHeight, "F");

          // Row border
          pdf.setDrawColor(200, 200, 210);
          pdf.setLineWidth(0.2);
          pdf.rect(tableX, y, maxW, rowHeight);

          // Row content
          pdf.setFontSize(9);
          pdf.setFont("helvetica", "normal");
          pdf.setTextColor(40, 40, 50);

          // Candidate photo
          const photoData = photoDataCache[candidate.name];
          if (photoData) {
            try {
              // Add photo with rounded corners effect (small border)
              pdf.addImage(photoData, 'PNG', tableX + 2, y + 1, 10, 10);
              pdf.setDrawColor(220, 220, 230);
              pdf.setLineWidth(0.3);
              pdf.rect(tableX + 2, y + 1, 10, 10);
            } catch (e) {
              console.warn('Failed to add candidate photo:', e);
              // Fallback: draw placeholder icon
              pdf.setFillColor(230, 230, 240);
              pdf.circle(tableX + 7, y + 6, 4, 'F');
              pdf.setTextColor(180, 180, 190);
              pdf.setFontSize(7);
              pdf.text('👤', tableX + 5.5, y + 7.5);
            }
          } else {
            // Placeholder for missing photo
            pdf.setFillColor(230, 230, 240);
            pdf.circle(tableX + 7, y + 6, 4, 'F');
            pdf.setTextColor(180, 180, 190);
            pdf.setFontSize(7);
            pdf.text('👤', tableX + 5.5, y + 7.5);
          }

          // Candidate name
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(9);
          pdf.setTextColor(40, 40, 50);
          pdf.text(candidate.name, tableX + colWidths.photo + 2, y + 7);

          // Votes count
          pdf.setTextColor(60, 60, 70);
          pdf.text(String(candidate.votes), tableX + colWidths.photo + colWidths.candidate + 2, y + 7);

          // Percentage
          pdf.text(`${candidate.percentage}%`, tableX + colWidths.photo + colWidths.candidate + colWidths.votes + 2, y + 7);

          y += rowHeight;
        });
      }

      y += 4;
    }

    // ===== FOOTER =====
    const footerY = pageHeight - 10;
    pdf.setDrawColor(26, 189, 156);
    pdf.setLineWidth(0.8);
    pdf.line(margin, footerY - 2, 210 - margin, footerY - 2);

    pdf.setFontSize(8);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(120, 120, 130);
    pdf.text(`Neon Voting Platform | ${new Date().toLocaleString()}`, margin, footerY);
    pdf.text(`Org ID: ${orgId}`, 210 - margin - 30, footerY);
    pdf.text(`Page ${pdf.internal.pages.length} of ${pdf.internal.pages.length}`, 210 - margin - 15, footerY + 3);

    pdf.save(`Election_Results_${org.name || orgId}_${new Date().toISOString().split('T')[0]}.pdf`);
    showToast("Results exported successfully", "success");
  } catch (e) {
    console.error(e);
    showToast("Export failed", "error");
  }
}
