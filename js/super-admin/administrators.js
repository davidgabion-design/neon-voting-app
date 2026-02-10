/**
 * Super Admin Module - Administrators Management
 * Handles CRUD operations for administrator accounts with role-based permissions
 */

import { db } from '../config/firebase.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js';
import { showToast, createModal, showQuickLoading, renderError } from '../utils/ui-helpers.js';
import { escapeHtml, validateEmail } from '../utils/validation.js';
import { formatFirestoreTimestamp } from '../utils/formatting.js';
import {
  ADMIN_ROLES,
  PERMISSION_CATEGORIES,
  PERMISSION_LABELS,
  PERMISSIONS,
  hasPermission,
  getRoleById,
  validateAdminData
} from '../config/admin-roles.js';

/**
 * Load and display all administrators
 */
export async function loadAdministrators() {
  console.log('[LOAD ADMINISTRATORS] Starting...');
  const container = document.getElementById('superContent-admins');
  if (!container) {
    console.error('[LOAD ADMINISTRATORS] Container not found: superContent-admins');
    return;
  }

  const t = window.t || ((key) => key);
  showQuickLoading('superContent-admins', t('loading_administrators') || 'Loading Administrators');

  try {
    console.log('[LOAD ADMINISTRATORS] Fetching from Firestore...');
    const adminsRef = collection(db, 'administrators');
    const snap = await getDocs(adminsRef);

    const admins = [];
    snap.forEach(docSnap => {
      admins.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    // Sort by createdAt in JavaScript instead of Firestore query
    admins.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeB - timeA; // Descending order (newest first)
    });

    console.log('[LOAD ADMINISTRATORS] Found', admins.length, 'administrators');
    renderAdministratorsList(admins);
    console.log('[LOAD ADMINISTRATORS] Rendering complete');
  } catch (error) {
    console.error('[LOAD ADMINISTRATORS] ERROR:', error);
    console.error('[LOAD ADMINISTRATORS] Stack:', error.stack);
    renderError('superContent-admins', 'Failed to load administrators: ' + error.message, 'loadAdministrators()');
  }
}

/**
 * Render administrators list with search and filters
 * @param {Array} admins - Array of administrator objects
 */
function renderAdministratorsList(admins) {
  const container = document.getElementById('superContent-admins');
  const t = window.t || ((key) => key);

  const activeAdmins = admins.filter(a => a.status === 'active');
  const inactiveAdmins = admins.filter(a => a.status === 'inactive');

  let html = `
    <div class="card" style="margin-bottom: 20px">
      <div class="section-header">
        <h3><i class="fas fa-user-shield"></i> ${t('administrators') || 'Administrators'} (${admins.length})</h3>
        <button class="btn neon-btn" onclick="showAddAdminModal()">
          <i class="fas fa-user-plus"></i> ${t('add_administrator') || 'Add Administrator'}
        </button>
      </div>

      <div style="margin-top: 15px; margin-bottom: 20px">
        <div class="stats-cards" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px">
          <div class="stat-card">
            <div class="label">${t('total_admins') || 'Total Admins'}</div>
            <div class="value">${admins.length}</div>
          </div>
          <div class="stat-card">
            <div class="label">${t('active') || 'Active'}</div>
            <div class="value" style="color: #00ffaa">${activeAdmins.length}</div>
          </div>
          <div class="stat-card">
            <div class="label">${t('inactive') || 'Inactive'}</div>
            <div class="value" style="color: #888">${inactiveAdmins.length}</div>
          </div>
        </div>
      </div>

      <div style="margin-bottom: 15px">
        <input type="text" class="input" id="adminSearchInput" 
               placeholder="${t('search_admins') || 'Search administrators by name, email, or role...'}"
               oninput="filterAdministrators(this.value)"
               style="width: 100%; max-width: 500px">
      </div>
    </div>

    <div id="adminsListContainer">
  `;

  if (admins.length === 0) {
    html += `
      <div class="card" style="text-align: center; padding: 40px">
        <i class="fas fa-user-shield" style="font-size: 48px; color: rgba(255,255,255,0.2); margin-bottom: 15px"></i>
        <h3>${t('no_administrators') || 'No Administrators Yet'}</h3>
        <p class="subtext">${t('add_first_admin') || 'Add your first administrator to manage system operations'}</p>
        <button class="btn neon-btn" onclick="showAddAdminModal()" style="margin-top: 15px">
          <i class="fas fa-user-plus"></i> ${t('add_administrator') || 'Add Administrator'}
        </button>
      </div>
    `;
  } else {
    admins.forEach(admin => {
      const role = getRoleById(admin.role);
      const roleLabel = role ? role.label : admin.role;
      const roleColor = role ? role.color : '#888';
      const statusBadge = admin.status === 'active' 
        ? `<span class="badge success">${t('active') || 'Active'}</span>`
        : `<span class="badge" style="background: rgba(136,136,136,0.2); color: #888">${t('inactive') || 'Inactive'}</span>`;
      
      const isSuperAdmin = admin.role === 'super_admin' || admin.isSuperAdmin;
      const lastLogin = admin.lastLogin 
        ? formatFirestoreTimestamp(admin.lastLogin)
        : t('never') || 'Never';

      html += `
        <div class="card admin-card" data-admin-id="${escapeHtml(admin.id)}" 
             data-admin-name="${escapeHtml(admin.name.toLowerCase())}"
             data-admin-email="${escapeHtml(admin.email.toLowerCase())}"
             data-admin-role="${escapeHtml(admin.role)}"
             style="margin-bottom: 15px">
          <div style="display: flex; align-items: start; gap: 20px">
            <div style="flex: 1">
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px">
                <i class="fas fa-user-circle" style="font-size: 24px; color: ${roleColor}"></i>
                <div>
                  <h4 style="margin: 0">${escapeHtml(admin.name)}</h4>
                  <div class="subtext" style="font-size: 13px">${escapeHtml(admin.email)}</div>
                </div>
              </div>

              <div style="display: flex; gap: 15px; flex-wrap: wrap; margin-top: 10px">
                <div>
                  <div class="label" style="font-size: 11px; margin-bottom: 3px">${t('role') || 'Role'}</div>
                  <span class="badge" style="background: ${roleColor}; color: white">
                    <i class="fas fa-shield"></i> ${escapeHtml(roleLabel)}
                  </span>
                </div>
                <div>
                  <div class="label" style="font-size: 11px; margin-bottom: 3px">${t('status') || 'Status'}</div>
                  ${statusBadge}
                </div>
                <div>
                  <div class="label" style="font-size: 11px; margin-bottom: 3px">${t('permissions') || 'Permissions'}</div>
                  <span class="badge neon" style="background: rgba(0,234,255,0.1); color: #00eaff">
                    ${admin.permissions ? admin.permissions.length : 0} ${t('permissions') || 'permissions'}
                  </span>
                </div>
                <div>
                  <div class="label" style="font-size: 11px; margin-bottom: 3px">${t('last_login') || 'Last Login'}</div>
                  <div class="subtext" style="font-size: 12px">${lastLogin}</div>
                </div>
              </div>
            </div>

            <div style="display: flex; gap: 8px; flex-shrink: 0">
              <button class="btn neon-btn-outline" onclick="viewAdminDetails('${escapeHtml(admin.id)}')" 
                      title="${t('view_details') || 'View Details'}">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn neon-btn-outline" onclick="editAdminModal('${escapeHtml(admin.id)}')" 
                      title="${t('edit') || 'Edit'}"
                      ${isSuperAdmin ? 'disabled' : ''}>
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn btn-danger" onclick="deleteAdminConfirm('${escapeHtml(admin.id)}', '${escapeHtml(admin.name)}')" 
                      title="${t('delete') || 'Delete'}"
                      ${isSuperAdmin ? 'disabled' : ''}>
                <i class="fas fa-trash"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    });
  }

  html += '</div>'; // Close adminsListContainer

  container.innerHTML = html;
}

/**
 * Filter administrators by search query
 * @param {string} searchQuery - Search string
 */
window.filterAdministrators = function(searchQuery) {
  const query = searchQuery.toLowerCase().trim();
  const adminCards = document.querySelectorAll('.admin-card');

  adminCards.forEach(card => {
    const name = card.dataset.adminName || '';
    const email = card.dataset.adminEmail || '';
    const role = card.dataset.adminRole || '';

    const matches = name.includes(query) || email.includes(query) || role.includes(query);
    card.style.display = matches ? 'block' : 'none';
  });
};

/**
 * Show modal to add new administrator
 */
window.showAddAdminModal = function() {
  const t = window.t || ((key) => key);
  
  const modalHtml = `
    <div style="max-width: 800px; margin: 0 auto">
      <h3 style="margin-bottom: 20px">
        <i class="fas fa-user-plus"></i> ${t('add_administrator') || 'Add Administrator'}
      </h3>

      <div class="form-group">
        <label>${t('full_name') || 'Full Name'} *</label>
        <input type="text" id="adminName" class="input" placeholder="${t('enter_full_name') || 'Enter administrator full name'}" required>
      </div>

      <div class="form-group">
        <label>${t('email') || 'Email'} *</label>
        <input type="email" id="adminEmail" class="input" placeholder="${t('enter_email') || 'admin@example.com'}" required>
      </div>

      <div class="form-group">
        <label>${t('password') || 'Password'} *</label>
        <input type="password" id="adminPassword" class="input" placeholder="${t('enter_password') || 'Enter password'}" required>
        <div class="subtext" style="margin-top: 5px">
          ${t('password_requirement') || 'Minimum 8 characters, include letters and numbers'}
        </div>
      </div>

      <div class="form-group">
        <label>${t('role') || 'Role'} *</label>
        <select id="adminRole" class="input" onchange="handleRoleChange(this.value)">
          ${Object.values(ADMIN_ROLES).map(role => 
            `<option value="${role.id}">${role.label} - ${role.description}</option>`
          ).join('')}
        </select>
      </div>

      <div class="form-group">
        <label style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px">
          <i class="fas fa-shield-alt"></i>
          <span>${t('permissions') || 'Permissions'}</span>
          <button type="button" class="btn neon-btn-outline" onclick="toggleAllPermissions()" 
                  style="margin-left: auto; padding: 4px 12px; font-size: 12px">
            ${t('toggle_all') || 'Toggle All'}
          </button>
        </label>
        <div id="permissionsContainer" style="max-height: 400px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 15px">
          ${renderPermissionsCheckboxes()}
        </div>
      </div>

      <div class="form-actions" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px">
        <button type="button" class="btn neon-btn-outline" onclick="closeModal()">
          ${t('cancel') || 'Cancel'}
        </button>
        <button type="button" class="btn neon-btn" onclick="saveNewAdministrator()">
          <i class="fas fa-save"></i> ${t('save_administrator') || 'Save Administrator'}
        </button>
      </div>
    </div>
  `;

  createModal(modalHtml);
  
  // Set default role permissions
  setTimeout(() => {
    handleRoleChange(ADMIN_ROLES.ADMIN.id);
  }, 100);
};

/**
 * Render permission checkboxes grouped by category
 * @returns {string} HTML for permissions checkboxes
 */
function renderPermissionsCheckboxes() {
  const t = window.t || ((key) => key);
  let html = '';

  Object.entries(PERMISSION_CATEGORIES).forEach(([categoryKey, category]) => {
    html += `
      <div class="permission-category" style="margin-bottom: 20px">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1)">
          <i class="fas ${category.icon}" style="color: #00eaff"></i>
          <strong>${category.label}</strong>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; padding-left: 10px">
          ${category.permissions.map(permission => `
            <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 6px; border-radius: 4px; transition: background 0.2s"
                   onmouseover="this.style.background='rgba(0,234,255,0.05)'"
                   onmouseout="this.style.background='transparent'">
              <input type="checkbox" 
                     class="permission-checkbox" 
                     value="${permission}" 
                     style="cursor: pointer">
              <span style="font-size: 13px">${PERMISSION_LABELS[permission]}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  });

  return html;
}

/**
 * Handle role change - auto-select permissions based on role
 * @param {string} roleId - Selected role ID
 */
window.handleRoleChange = function(roleId) {
  const role = getRoleById(roleId);
  if (!role) return;

  const checkboxes = document.querySelectorAll('.permission-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.checked = role.permissions.includes(checkbox.value);
  });
};

/**
 * Toggle all permissions on/off
 */
window.toggleAllPermissions = function() {
  const checkboxes = document.querySelectorAll('.permission-checkbox');
  const allChecked = Array.from(checkboxes).every(cb => cb.checked);
  
  checkboxes.forEach(checkbox => {
    checkbox.checked = !allChecked;
  });
};

/**
 * Save new administrator
 */
window.saveNewAdministrator = async function() {
  const name = document.getElementById('adminName')?.value.trim();
  const email = document.getElementById('adminEmail')?.value.trim();
  const password = document.getElementById('adminPassword')?.value;
  const role = document.getElementById('adminRole')?.value;

  const t = window.t || ((key) => key);

  // Validation
  if (!name || name.length < 2) {
    showToast(t('name_required') || 'Name is required (min 2 characters)', 'error');
    return;
  }

  if (!validateEmail(email)) {
    showToast(t('invalid_email') || 'Please enter a valid email address', 'error');
    return;
  }

  if (!password || password.length < 8) {
    showToast(t('password_min_8') || 'Password must be at least 8 characters', 'error');
    return;
  }

  // Get selected permissions
  const permissionCheckboxes = document.querySelectorAll('.permission-checkbox:checked');
  const permissions = Array.from(permissionCheckboxes).map(cb => cb.value);

  if (permissions.length === 0) {
    showToast(t('select_permissions') || 'Please select at least one permission', 'error');
    return;
  }

  try {
    const adminData = {
      name,
      email: email.toLowerCase(),
      password, // In production, hash this password
      role,
      permissions,
      status: 'active',
      createdAt: serverTimestamp(),
      createdBy: 'super_admin', // Get from session
      lastLogin: null
    };

    // Validate data
    const validation = validateAdminData(adminData);
    if (!validation.isValid) {
      showToast(validation.errors.join(', '), 'error');
      return;
    }

    // Check if email already exists
    const existingAdminRef = doc(db, 'administrators', email);
    const existingSnap = await getDoc(existingAdminRef);
    
    if (existingSnap.exists()) {
      showToast(t('email_exists') || 'An administrator with this email already exists', 'error');
      return;
    }

    // Save to Firestore
    await setDoc(existingAdminRef, adminData);

    showToast(t('admin_created') || 'Administrator created successfully', 'success');
    closeModal();
    loadAdministrators();
  } catch (error) {
    console.error('Error creating administrator:', error);
    showToast(t('error_creating_admin') || 'Failed to create administrator: ' + error.message, 'error');
  }
};

/**
 * View administrator details in modal
 * @param {string} adminId - Administrator ID (email)
 */
window.viewAdminDetails = async function(adminId) {
  const t = window.t || ((key) => key);
  
  try {
    const adminRef = doc(db, 'administrators', adminId);
    const adminSnap = await getDoc(adminRef);

    if (!adminSnap.exists()) {
      showToast(t('admin_not_found') || 'Administrator not found', 'error');
      return;
    }

    const admin = adminSnap.data();
    const role = getRoleById(admin.role);
    
    let permissionsHtml = '';
    Object.entries(PERMISSION_CATEGORIES).forEach(([key, category]) => {
      const categoryPerms = category.permissions.filter(p => admin.permissions.includes(p));
      if (categoryPerms.length > 0) {
        permissionsHtml += `
          <div style="margin-bottom: 15px">
            <h5 style="color: #00eaff; margin-bottom: 8px">
              <i class="fas ${category.icon}"></i> ${category.label}
            </h5>
            <ul style="margin: 0; padding-left: 20px">
              ${categoryPerms.map(p => `<li>${PERMISSION_LABELS[p]}</li>`).join('')}
            </ul>
          </div>
        `;
      }
    });

    const modalHtml = `
      <div style="max-width: 600px">
        <h3 style="margin-bottom: 20px">
          <i class="fas fa-user-shield"></i> ${t('administrator_details') || 'Administrator Details'}
        </h3>

        <div style="display: grid; gap: 15px">
          <div>
            <div class="label">${t('name') || 'Name'}</div>
            <div>${escapeHtml(admin.name)}</div>
          </div>
          <div>
            <div class="label">${t('email') || 'Email'}</div>
            <div>${escapeHtml(admin.email)}</div>
          </div>
          <div>
            <div class="label">${t('role') || 'Role'}</div>
            <span class="badge" style="background: ${role?.color || '#888'}; color: white">
              ${role?.label || admin.role}
            </span>
          </div>
          <div>
            <div class="label">${t('status') || 'Status'}</div>
            <span class="badge ${admin.status === 'active' ? 'success' : ''}">
              ${admin.status === 'active' ? t('active') || 'Active' : t('inactive') || 'Inactive'}
            </span>
          </div>
          <div>
            <div class="label">${t('created_at') || 'Created'}</div>
            <div>${formatFirestoreTimestamp(admin.createdAt)}</div>
          </div>
          <div>
            <div class="label">${t('last_login') || 'Last Login'}</div>
            <div>${admin.lastLogin ? formatFirestoreTimestamp(admin.lastLogin) : t('never') || 'Never'}</div>
          </div>
          <div>
            <div class="label" style="margin-bottom: 10px">${t('permissions') || 'Permissions'} (${admin.permissions.length})</div>
            ${permissionsHtml}
          </div>
        </div>

        <div style="margin-top: 20px; text-align: right">
          <button class="btn neon-btn-outline" onclick="closeModal()">
            ${t('close') || 'Close'}
          </button>
        </div>
      </div>
    `;

    createModal(modalHtml);
  } catch (error) {
    console.error('Error loading admin details:', error);
    showToast(t('error_loading_admin') || 'Failed to load administrator details', 'error');
  }
};

/**
 * Show edit administrator modal
 * @param {string} adminId - Administrator ID (email)
 */
window.editAdminModal = async function(adminId) {
  const t = window.t || ((key) => key);
  
  try {
    const adminRef = doc(db, 'administrators', adminId);
    const adminSnap = await getDoc(adminRef);

    if (!adminSnap.exists()) {
      showToast(t('admin_not_found') || 'Administrator not found', 'error');
      return;
    }

    const admin = adminSnap.data();
    
    const modalHtml = `
      <div style="max-width: 800px; margin: 0 auto">
        <h3 style="margin-bottom: 20px">
          <i class="fas fa-edit"></i> ${t('edit_administrator') || 'Edit Administrator'}
        </h3>

        <input type="hidden" id="editAdminId" value="${escapeHtml(adminId)}">

        <div class="form-group">
          <label>${t('full_name') || 'Full Name'} *</label>
          <input type="text" id="editAdminName" class="input" value="${escapeHtml(admin.name)}" required>
        </div>

        <div class="form-group">
          <label>${t('email') || 'Email'} *</label>
          <input type="email" id="editAdminEmail" class="input" value="${escapeHtml(admin.email)}" disabled>
          <div class="subtext">${t('email_cannot_change') || 'Email cannot be changed'}</div>
        </div>

        <div class="form-group">
          <label>${t('status') || 'Status'} *</label>
          <select id="editAdminStatus" class="input">
            <option value="active" ${admin.status === 'active' ? 'selected' : ''}>${t('active') || 'Active'}</option>
            <option value="inactive" ${admin.status === 'inactive' ? 'selected' : ''}>${t('inactive') || 'Inactive'}</option>
          </select>
        </div>

        <div class="form-group">
          <label>${t('role') || 'Role'} *</label>
          <select id="editAdminRole" class="input" onchange="handleEditRoleChange(this.value)">
            ${Object.values(ADMIN_ROLES).map(role => 
              `<option value="${role.id}" ${admin.role === role.id ? 'selected' : ''}>${role.label} - ${role.description}</option>`
            ).join('')}
          </select>
        </div>

        <div class="form-group">
          <label style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px">
            <i class="fas fa-shield-alt"></i>
            <span>${t('permissions') || 'Permissions'}</span>
            <button type="button" class="btn neon-btn-outline" onclick="toggleAllPermissions()" 
                    style="margin-left: auto; padding: 4px 12px; font-size: 12px">
              ${t('toggle_all') || 'Toggle All'}
            </button>
          </label>
          <div id="editPermissionsContainer" style="max-height: 400px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 15px">
            ${renderEditPermissionsCheckboxes(admin.permissions)}
          </div>
        </div>

        <div class="form-actions" style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px">
          <button type="button" class="btn neon-btn-outline" onclick="closeModal()">
            ${t('cancel') || 'Cancel'}
          </button>
          <button type="button" class="btn neon-btn" onclick="saveAdministratorEdits()">
            <i class="fas fa-save"></i> ${t('save_changes') || 'Save Changes'}
          </button>
        </div>
      </div>
    `;

    createModal(modalHtml);
  } catch (error) {
    console.error('Error loading admin for edit:', error);
    showToast(t('error_loading_admin') || 'Failed to load administrator', 'error');
  }
};

/**
 * Render permission checkboxes with pre-selected values for edit
 * @param {string[]} selectedPermissions - Array of selected permission IDs
 * @returns {string} HTML for permissions checkboxes
 */
function renderEditPermissionsCheckboxes(selectedPermissions = []) {
  const t = window.t || ((key) => key);
  let html = '';

  Object.entries(PERMISSION_CATEGORIES).forEach(([categoryKey, category]) => {
    html += `
      <div class="permission-category" style="margin-bottom: 20px">
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.1)">
          <i class="fas ${category.icon}" style="color: #00eaff"></i>
          <strong>${category.label}</strong>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 10px; padding-left: 10px">
          ${category.permissions.map(permission => `
            <label class="checkbox-label" style="display: flex; align-items: center; gap: 8px; cursor: pointer; padding: 6px; border-radius: 4px; transition: background 0.2s"
                   onmouseover="this.style.background='rgba(0,234,255,0.05)'"
                   onmouseout="this.style.background='transparent'">
              <input type="checkbox" 
                     class="permission-checkbox" 
                     value="${permission}"
                     ${selectedPermissions.includes(permission) ? 'checked' : ''}
                     style="cursor: pointer">
              <span style="font-size: 13px">${PERMISSION_LABELS[permission]}</span>
            </label>
          `).join('')}
        </div>
      </div>
    `;
  });

  return html;
}

/**
 * Handle role change in edit modal
 * @param {string} roleId - Selected role ID
 */
window.handleEditRoleChange = function(roleId) {
  handleRoleChange(roleId); // Reuse the same function
};

/**
 * Save administrator edits
 */
window.saveAdministratorEdits = async function() {
  const adminId = document.getElementById('editAdminId')?.value;
  const name = document.getElementById('editAdminName')?.value.trim();
  const status = document.getElementById('editAdminStatus')?.value;
  const role = document.getElementById('editAdminRole')?.value;

  const t = window.t || ((key) => key);

  if (!name || name.length < 2) {
    showToast(t('name_required') || 'Name is required (min 2 characters)', 'error');
    return;
  }

  // Get selected permissions
  const permissionCheckboxes = document.querySelectorAll('.permission-checkbox:checked');
  const permissions = Array.from(permissionCheckboxes).map(cb => cb.value);

  if (permissions.length === 0) {
    showToast(t('select_permissions') || 'Please select at least one permission', 'error');
    return;
  }

  try {
    const adminRef = doc(db, 'administrators', adminId);
    
    await updateDoc(adminRef, {
      name,
      role,
      permissions,
      status,
      updatedAt: serverTimestamp(),
      updatedBy: 'super_admin' // Get from session
    });

    showToast(t('admin_updated') || 'Administrator updated successfully', 'success');
    closeModal();
    loadAdministrators();
  } catch (error) {
    console.error('Error updating administrator:', error);
    showToast(t('error_updating_admin') || 'Failed to update administrator: ' + error.message, 'error');
  }
};

/**
 * Confirm and delete administrator
 * @param {string} adminId - Administrator ID
 * @param {string} adminName - Administrator name
 */
window.deleteAdminConfirm = function(adminId, adminName) {
  const t = window.t || ((key) => key);
  
  if (confirm(`${t('confirm_delete_admin') || 'Are you sure you want to delete administrator'} "${adminName}"? ${t('action_cannot_undone') || 'This action cannot be undone.'}`)) {
    deleteAdministrator(adminId);
  }
};

/**
 * Delete administrator
 * @param {string} adminId - Administrator ID
 */
async function deleteAdministrator(adminId) {
  const t = window.t || ((key) => key);
  
  try {
    const adminRef = doc(db, 'administrators', adminId);
    await deleteDoc(adminRef);

    showToast(t('admin_deleted') || 'Administrator deleted successfully', 'success');
    loadAdministrators();
  } catch (error) {
    console.error('Error deleting administrator:', error);
    showToast(t('error_deleting_admin') || 'Failed to delete administrator: ' + error.message, 'error');
  }
}

/**
 * Close modal
 */
window.closeModal = function() {
  const modal = document.querySelector('.modal-overlay');
  if (modal) {
    modal.remove();
  }
};
