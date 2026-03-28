<template>
  <div class="admin-users-view">
    <div class="page-header">
      <div class="header-content">
        <div>
          <h1>User Management</h1>
          <p class="subtitle">Manage team members and permissions</p>
        </div>
        <div class="header-actions">
          <button v-if="isSuperAdmin" @click="openGroupModal()" class="btn-secondary">
            Manage Groups
          </button>
          <button @click="openCreateModal" class="btn-primary">
            + Add User
          </button>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading users...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="error-state">
      <p>{{ error }}</p>
      <button @click="loadUsers" class="btn-retry">Retry</button>
    </div>

    <!-- Users Table -->
    <div v-else class="users-table-container">
      <table class="users-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Email</th>
            <th>Group</th>
            <th>Degree</th>
            <th>Role</th>
            <th>Status</th>
            <th>Editor</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.name }}</td>
            <td>{{ user.email }}</td>
            <td>{{ getGroupLabel(user.group) }}</td>
            <td>
              {{
                user.degree
                  ? user.degree
                    .replace(/_/g, ' ')
                    .toLowerCase()
                    .replace(/\b\w/g, c => c.toUpperCase())
              : 'N/A'
              }}
            </td>
            <td>
            <span class="role-badge" :class="`role-${user.role.toLowerCase()}`">
              {{ formatRole(user.role) }}
            </span>
            </td>
            <td>
              <span class="status-badge" :class="`status-${user.status}`">
                {{ user.status }}
              </span>
            </td>
            <td>
              <span v-if="user.editor" class="badge-yes">Yes</span>
              <span v-else class="badge-no">No</span>
            </td>
            <td>{{ formatDate(user.createdAt) }}</td>
            <td>
              <div class="action-buttons">
                <button type="button" @click="openEditModal(user)" class="btn-edit">Edit</button>
                <button type="button" @click="handleResetPassword(user)" class="btn-reset">Reset Password</button>
                <button
                  v-if="canDeleteUser(user)"
                  type="button"
                  @click="openDeleteConfirm(user)"
                  class="btn-delete"
                >
                  Delete
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="users.length === 0">
            <td colspan="9" class="empty-state">
              No users found. Click "Add User" to create one.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Modal -->
    <div v-if="showModal" class="modal-overlay">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h2>{{ editingUser ? 'Edit User' : 'Create User' }}</h2>
          <button @click="closeModal" class="close-btn">✕</button>
        </div>
        <div class="modal-content">
          <form @submit.prevent="handleSubmit">
            <div class="form-group">
              <label>Email *</label>
              <input v-model="form.email" type="email" required :disabled="editingUser !== null"
                placeholder="user@example.com" />
            </div>
            <div class="form-group">
              <label>Name *</label>
              <input v-model="form.name" type="text" required placeholder="Full Name" />
            </div>
            <!-- add group and member degree -->
            <div class="form-row">
              <div class="form-group">
                <label>Group *</label>
                <select v-model="form.group" required>
                  <option v-for="opt in userGroupOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
              <div class="form-group">
                <label>Degree *</label>
                <select v-model="form.degree" required>
                  <option value="SUPER_ADMIN">Super Admin</option>
                  <option value="ADMIN">Admin</option>
                  <option value="TEAM_BOSS">Team Boss</option>
                  <option value="MEMBER">Member</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label>Role *</label>
                <select v-model="form.role" required>
                  <option value="MEMBER">Member</option>
                  <option value="ADMIN">Admin</option>
                  <option value="GUEST">Guest</option>
                  <option value="BOSS">Boss</option>
                  <option v-if="isSuperAdmin" value="SUPER_ADMIN">Super Admin</option>
                  <!-- Legacy BOSS option removed - will be auto-converted to ADMIN if used -->
                </select>
              </div>
              <div class="form-group">
                <label>Status *</label>
                <select v-model="form.status" required>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="disabled">Disabled</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label>
                <input v-model="form.editor" type="checkbox" />
                Editor (Can edit profiles and tickets)
              </label>
            </div>
            <div v-if="tempPassword" class="temp-password-alert">
              <div class="temp-password-row">
                <div class="temp-password-main">
                  <strong>Temporary Password:</strong>
                  <span class="temp-password-value">{{ tempPassword }}</span>
                  <small>Save this password! The user needs it to log in the first time.</small>
                </div>
                <button
                  type="button"
                  class="btn-copy-temp-password"
                  @click="copyCreateTempPassword"
                >
                  {{ createTempPasswordCopied ? 'Copied!' : 'Copy' }}
                </button>
              </div>
            </div>
            <div class="form-actions">
              <button type="button" @click="closeModal" class="btn-cancel">Cancel</button>
              <button
                type="submit"
                :disabled="saving || (!!tempPassword && !editingUser)"
                class="btn-save"
              >
                {{ saving ? 'Saving...' : (editingUser ? 'Update' : 'Create') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- Reset password: confirm -->
    <div v-if="showResetConfirmModal" class="modal-overlay">
      <div class="modal modal-reset" @click.stop>
        <div class="modal-header">
          <h2>Reset password?</h2>
          <button type="button" @click="closeResetConfirm" class="close-btn">✕</button>
        </div>
        <div class="modal-content">
          <p class="reset-modal-text">
            Reset password for <strong>{{ resetConfirmUser?.name }}</strong>? A new temporary password will be generated.
          </p>
          <div class="form-actions reset-modal-actions">
            <button type="button" @click="closeResetConfirm" class="btn-cancel" :disabled="resettingPassword">
              Cancel
            </button>
            <button type="button" @click="executeResetPassword" class="btn-reset-modal" :disabled="resettingPassword">
              {{ resettingPassword ? 'Resetting…' : 'Reset password' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reset password: success (password copied + shown) -->
    <div v-if="showResetSuccessModal" class="modal-overlay">
      <div class="modal modal-reset" @click.stop>
        <div class="modal-header">
          <h2>Password reset</h2>
          <button type="button" @click="closeResetSuccess" class="close-btn">✕</button>
        </div>
        <div class="modal-content">
          <p class="reset-modal-text">
            A new temporary password for <strong>{{ resetSuccessUserName }}</strong> is below.
            {{ resetPasswordInitialCopyOk ? 'It has been copied to your clipboard.' : 'Copy it to share with the user.' }}
          </p>
          <div class="reset-password-box">
            <code>{{ resetSuccessPassword }}</code>
          </div>
          <div class="form-actions reset-modal-actions">
            <button type="button" @click="copyResetPasswordAgain" class="btn-secondary">
              {{ resetPasswordInitialCopyOk ? 'Copy again' : 'Copy password' }}
            </button>
            <button type="button" @click="closeResetSuccess" class="btn-save">Done</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Reset password: error -->
    <div v-if="showResetErrorModal" class="modal-overlay">
      <div class="modal modal-reset" @click.stop>
        <div class="modal-header">
          <h2>Reset failed</h2>
          <button type="button" @click="closeResetError" class="close-btn">✕</button>
        </div>
        <div class="modal-content">
          <p class="reset-modal-text reset-modal-error">{{ resetErrorMessage }}</p>
          <div class="form-actions reset-modal-actions">
            <button type="button" @click="closeResetError" class="btn-save">OK</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete user: confirm -->
    <div v-if="showDeleteConfirmModal" class="modal-overlay">
      <div class="modal modal-reset" @click.stop>
        <div class="modal-header">
          <h2>Delete user?</h2>
          <button type="button" @click="closeDeleteConfirm" class="close-btn">✕</button>
        </div>
        <div class="modal-content">
          <p class="reset-modal-text">
            Permanently delete <strong>{{ deleteTargetUser?.name }}</strong> ({{ deleteTargetUser?.email }})? This cannot be undone.
          </p>
          <div class="form-actions reset-modal-actions">
            <button type="button" @click="closeDeleteConfirm" class="btn-cancel" :disabled="deletingUser">
              Cancel
            </button>
            <button type="button" @click="executeDeleteUser" class="btn-delete-modal" :disabled="deletingUser">
              {{ deletingUser ? 'Deleting…' : 'Delete user' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete user: error -->
    <div v-if="showDeleteErrorModal" class="modal-overlay">
      <div class="modal modal-reset" @click.stop>
        <div class="modal-header">
          <h2>Delete failed</h2>
          <button type="button" @click="closeDeleteError" class="close-btn">✕</button>
        </div>
        <div class="modal-content">
          <p class="reset-modal-text reset-modal-error">{{ deleteErrorMessage }}</p>
          <div class="form-actions reset-modal-actions">
            <button type="button" @click="closeDeleteError" class="btn-save">OK</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Group Management Modal (Super Admin only) -->
    <div v-if="showGroupModal" class="modal-overlay">
      <div class="modal modal-wide" @click.stop>
        <div class="modal-header">
          <h2>Manage Groups</h2>
          <button @click="closeGroupModal" class="close-btn">✕</button>
        </div>
        <div class="modal-content">
          <form @submit.prevent="saveGroup" class="group-form">
            <div class="form-row">
              <div class="form-group">
                <label>Name *</label>
                <input v-model="groupForm.name" type="text" required placeholder="e.g. Group 1" />
              </div>
              <div class="form-group">
                <label>Code *</label>
                <input v-model="groupForm.code" type="text" required placeholder="e.g. GROUP_1" :disabled="!!editingGroup" />
                <small v-if="editingGroup" class="form-hint">Code cannot be changed</small>
              </div>
              <div class="form-group form-group-sm">
                <label>Sort</label>
                <input v-model.number="groupForm.sortOrder" type="number" min="0" />
              </div>
              <div class="form-group form-group-actions">
                <button type="submit" class="btn-save">{{ editingGroup ? 'Update' : 'Add' }}</button>
                <button v-if="editingGroup" type="button" @click="openGroupModal()" class="btn-cancel">Cancel Edit</button>
              </div>
            </div>
          </form>
          <div class="groups-list">
            <h4>Existing Groups</h4>
            <table class="groups-table">
              <thead>
                <tr><th>Name</th><th>Code</th><th>Sort</th><th>Actions</th></tr>
              </thead>
              <tbody>
                <tr v-for="g in groups" :key="g._id">
                  <td>{{ g.name }}</td>
                  <td><code>{{ g.code }}</code></td>
                  <td>{{ g.sortOrder }}</td>
                  <td>
                    <button @click="openGroupModal(g)" class="btn-edit btn-sm">Edit</button>
                    <button @click="deleteGroup(g)" class="btn-reset btn-sm">Delete</button>
                  </td>
                </tr>
                <tr v-if="groups.length === 0">
                  <td colspan="4" class="empty-state">No groups yet. Add one above.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import * as adminService from '../services/admin';
import { formatGroupLabel } from '../constants/groups.js';
import { ROLES } from '../constants/roles.js';

const authStore = useAuthStore();
const groups = ref([]);
const userGroupOptions = computed(() => {
  const special = [
    { value: 'SUPER_ADMIN', label: 'Super Admin' },
    { value: 'ADMIN', label: 'Admin' }
  ];
  const fromDb = groups.value.map(g => ({ value: g.code, label: g.name }));
  return [...special, ...fromDb];
});
const defaultUserGroup = computed(() => {
  const first = groups.value[0];
  return first ? first.code : 'GROUP_1';
});

const loading = ref(false);
const error = ref(null);
const users = ref([]);
const showModal = ref(false);
const editingUser = ref(null);
const saving = ref(false);
const tempPassword = ref('');
const createTempPasswordCopied = ref(false);

// Reset password flow (modal + clipboard)
const showResetConfirmModal = ref(false);
const resetConfirmUser = ref(null);
const resettingPassword = ref(false);
const showResetSuccessModal = ref(false);
const resetSuccessPassword = ref('');
const resetSuccessUserName = ref('');
const resetPasswordInitialCopyOk = ref(false);
const showResetErrorModal = ref(false);
const resetErrorMessage = ref('');

const showDeleteConfirmModal = ref(false);
const deleteTargetUser = ref(null);
const deletingUser = ref(false);
const showDeleteErrorModal = ref(false);
const deleteErrorMessage = ref('');

const isSuperAdmin = computed(() => authStore.user?.role === ROLES.SUPER_ADMIN);

const canDeleteUser = (user) => {
  const selfId = authStore.user?.id;
  if (!selfId || !user?.id) return false;
  if (String(user.id) === String(selfId)) return false;
  if (user.role === 'SUPER_ADMIN' && !isSuperAdmin.value) return false;
  return true;
};

// Group management (super admin only)
const showGroupModal = ref(false);
const editingGroup = ref(null);
const groupForm = ref({ name: '', code: '', sortOrder: 0 });

const form = ref({
  email: '',
  name: '',
  group: '',
  member: 'MEMBER',
  role: 'MEMBER',
  status: 'active',
  editor: false
});

const loadGroups = async () => {
  try {
    const res = await adminService.fetchGroups();
    if (res?.data?.groups) {
      groups.value = res.data.groups;
    }
  } catch (err) {
    console.error('Failed to load groups:', err);
  }
};

const loadUsers = async () => {
  loading.value = true;
  error.value = null;
  try {
    const response = await adminService.fetchUsers({ limit: 1000 });
    if (response.ok && response.data) {
      users.value = response.data.users || [];
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to load users';
    console.error('Error loading users:', err);
  } finally {
    loading.value = false;
  }
};

const openCreateModal = () => {
  editingUser.value = null;
  form.value = {
    email: '',
    name: '',
    group: defaultUserGroup.value || 'GROUP_1',
    degree: 'MEMBER',
    role: 'MEMBER',
    status: 'active',
    editor: false
  };
  tempPassword.value = '';
  createTempPasswordCopied.value = false;
  showModal.value = true;
};

const openEditModal = (user) => {
  editingUser.value = user;
  form.value = {
    email: user.email,
    name: user.name,
    group: user.group,
    degree: user.degree,
    role: user.role,
    status: user.status,
    editor: user.editor || false
  };
  tempPassword.value = '';
  createTempPasswordCopied.value = false;
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
  editingUser.value = null;
  tempPassword.value = '';
  createTempPasswordCopied.value = false;
};

const handleSubmit = async () => {
  saving.value = true;
  error.value = null;
  try {
    if (editingUser.value) {
      // Update user
      const response = await adminService.updateUser(editingUser.value.id, {
        group: form.value?.group,
        degree: form.value?.degree,
        role: form.value.role,
        status: form.value.status,
        editor: form.value.editor
      });
      if (response.ok) {
        await loadUsers();
        closeModal();
      }
    } else {
      // Create user
      const response = await adminService.createUser(form.value);
      if (response.ok && response.data) {
        tempPassword.value = response.data.tempPassword || '';
        createTempPasswordCopied.value = false;
        await loadUsers();
      }
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to save user';
    console.error('Error saving user:', err);
  } finally {
    saving.value = false;
  }
};

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

const copyCreateTempPassword = async () => {
  if (!tempPassword.value) return;
  createTempPasswordCopied.value = await copyTextToClipboard(tempPassword.value);
};

const closeResetConfirm = () => {
  if (resettingPassword.value) return;
  showResetConfirmModal.value = false;
  resetConfirmUser.value = null;
};

const closeResetSuccess = () => {
  showResetSuccessModal.value = false;
  resetSuccessPassword.value = '';
  resetSuccessUserName.value = '';
  resetPasswordInitialCopyOk.value = false;
};

const closeResetError = () => {
  showResetErrorModal.value = false;
  resetErrorMessage.value = '';
};

const closeDeleteConfirm = () => {
  if (deletingUser.value) return;
  showDeleteConfirmModal.value = false;
  deleteTargetUser.value = null;
};

const closeDeleteError = () => {
  showDeleteErrorModal.value = false;
  deleteErrorMessage.value = '';
};

const openDeleteConfirm = (user) => {
  deleteTargetUser.value = user;
  showDeleteConfirmModal.value = true;
};

const executeDeleteUser = async () => {
  const user = deleteTargetUser.value;
  if (!user) return;
  deletingUser.value = true;
  error.value = null;
  try {
    const response = await adminService.deleteUser(user.id);
    if (response.ok) {
      showDeleteConfirmModal.value = false;
      deleteTargetUser.value = null;
      await loadUsers();
    }
  } catch (err) {
    const msg = err.response?.data?.message || 'Failed to delete user';
    error.value = msg;
    showDeleteConfirmModal.value = false;
    deleteTargetUser.value = null;
    deleteErrorMessage.value = msg;
    showDeleteErrorModal.value = true;
  } finally {
    deletingUser.value = false;
  }
};

const handleResetPassword = (user) => {
  resetConfirmUser.value = user;
  showResetConfirmModal.value = true;
};

const copyResetPasswordAgain = async () => {
  await copyTextToClipboard(resetSuccessPassword.value);
};

const executeResetPassword = async () => {
  const user = resetConfirmUser.value;
  if (!user) return;
  resettingPassword.value = true;
  error.value = null;
  try {
    const response = await adminService.resetUserPassword(user.id);
    if (response.ok && response.data) {
      const newPassword = response.data.tempPassword || '';
      const copied = await copyTextToClipboard(newPassword);
      showResetConfirmModal.value = false;
      resetConfirmUser.value = null;
      resetSuccessPassword.value = newPassword;
      resetSuccessUserName.value = user.name;
      resetPasswordInitialCopyOk.value = copied;
      showResetSuccessModal.value = true;
    }
  } catch (err) {
    const msg = err.response?.data?.message || 'Failed to reset password';
    error.value = msg;
    showResetConfirmModal.value = false;
    resetConfirmUser.value = null;
    resetErrorMessage.value = msg;
    showResetErrorModal.value = true;
  } finally {
    resettingPassword.value = false;
  }
};

const formatRole = (role) => {
  return role.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString();
};

onMounted(() => {
  loadGroups();
  loadUsers();
});

// Group CRUD
const openGroupModal = (group = null) => {
  editingGroup.value = group;
  groupForm.value = group
    ? { name: group.name, code: group.code, sortOrder: group.sortOrder ?? 0 }
    : { name: '', code: '', sortOrder: groups.value.length };
  showGroupModal.value = true;
};

const closeGroupModal = () => {
  showGroupModal.value = false;
  editingGroup.value = null;
};

const saveGroup = async () => {
  try {
    if (editingGroup.value) {
      await adminService.updateGroup(editingGroup.value._id, groupForm.value);
    } else {
      await adminService.createGroup(groupForm.value);
    }
    await loadGroups();
    closeGroupModal();
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to save group';
  }
};

const getGroupLabel = (code) => {
  if (!code) return '—';
  const g = groups.value.find(x => x.code === code);
  if (g) return g.name;
  if (code === 'SUPER_ADMIN') return 'Super Admin';
  if (code === 'ADMIN') return 'Admin';
  return formatGroupLabel(code);
};

const deleteGroup = async (group) => {
  if (!confirm(`Delete group "${group.name}"? Users must be reassigned first.`)) return;
  try {
    await adminService.deleteGroup(group._id);
    await loadGroups();
  } catch (err) {
    error.value = err.response?.data?.message || 'Failed to delete group';
  }
};
</script>

<style scoped>
.admin-users-view {
  background: transparent;
  padding: 0;
  max-width: 1400px;
  margin: 0 auto;
  width: 100%;
}

.page-header {
  background: var(--bg-primary);
  padding: var(--spacing-xl);
  border-radius: var(--radius-lg);
  margin-bottom: var(--spacing-lg);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.header-actions {
  display: flex;
  gap: var(--spacing-md);
  align-items: center;
}

.btn-secondary {
  padding: var(--spacing-md) var(--spacing-xl);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1.5px solid var(--border-medium);
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  transition: all var(--transition-base);
}

.btn-secondary:hover {
  background: var(--border-medium);
  border-color: var(--color-primary);
}

.modal-wide {
  max-width: 640px;
}

.group-form {
  margin-bottom: var(--spacing-xl);
}

.groups-list h4 {
  margin: 0 0 var(--spacing-md) 0;
  font-size: var(--font-size-base);
  color: var(--text-secondary);
}

.groups-table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--font-size-sm);
}

.groups-table th,
.groups-table td {
  padding: var(--spacing-sm) var(--spacing-md);
  text-align: left;
  border-bottom: 1px solid var(--border-light);
}

.groups-table code {
  font-size: 0.85em;
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
}

.btn-sm {
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-xs);
  margin-right: var(--spacing-xs);
}

.form-hint {
  display: block;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.form-group-sm {
  max-width: 80px;
}

.form-group-actions {
  display: flex;
  align-items: flex-end;
  gap: var(--spacing-sm);
}

.page-header h1 {
  color: var(--text-primary);
  margin: 0 0 var(--spacing-xs) 0;
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.02em;
}

.subtitle {
  color: var(--text-secondary);
  margin: 0;
  font-size: var(--font-size-sm);
}

.btn-primary {
  padding: var(--spacing-md) var(--spacing-xl);
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  color: var(--text-inverse);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  transition: all var(--transition-base);
  box-shadow: var(--shadow-md);
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

.loading-state,
.error-state {
  text-align: center;
  padding: var(--spacing-3xl) var(--spacing-xl);
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
}

.spinner {
  border: 3px solid var(--border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  width: 48px;
  height: 48px;
  animation: spin 0.8s linear infinite;
  margin: 0 auto var(--spacing-lg);
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}

.users-table-container {
  background: var(--bg-primary);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  overflow: hidden;
  border: 1px solid var(--border-light);
}

.users-table {
  width: 100%;
  border-collapse: collapse;
}

.users-table thead {
  background: linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%);
}

.users-table th {
  padding: var(--spacing-lg);
  text-align: left;
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border-bottom: 2px solid var(--border-light);
  font-size: var(--font-size-xs);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.users-table td {
  padding: var(--spacing-lg);
  border-bottom: 1px solid var(--border-light);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.users-table tbody tr {
  transition: all var(--transition-fast);
}

.users-table tbody tr:hover {
  background: var(--bg-tertiary);
  transform: scale(1.01);
}

.role-badge,
.status-badge {
  display: inline-flex;
  align-items: center;
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-full);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  text-transform: capitalize;
}

.role-super_admin {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(124, 58, 237, 0.2) 100%);
  color: var(--color-secondary);
  border: 1px solid rgba(139, 92, 246, 0.3);
}

.role-boss,
.role-admin {
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%);
  color: var(--color-info);
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.role-member {
  background: linear-gradient(135deg, rgba(107, 114, 128, 0.2) 0%, rgba(75, 85, 99, 0.2) 100%);
  color: var(--color-gray-600);
  border: 1px solid rgba(107, 114, 128, 0.3);
}

.status-active {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%);
  color: var(--color-success);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.status-pending {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(217, 119, 6, 0.2) 100%);
  color: var(--color-warning);
  border: 1px solid rgba(245, 158, 11, 0.3);
}

.status-disabled {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.2) 100%);
  color: var(--color-error);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.badge-yes {
  color: var(--color-success);
  font-weight: var(--font-weight-semibold);
}

.badge-no {
  color: var(--text-tertiary);
}

.action-buttons {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.btn-edit,
.btn-reset {
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  transition: all var(--transition-base);
}

.btn-edit {
  background: linear-gradient(135deg, var(--color-info) 0%, #2563eb 100%);
  color: var(--text-inverse);
  box-shadow: var(--shadow-sm);
}

.btn-edit:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-reset {
  background: linear-gradient(135deg, var(--color-warning) 0%, #d97706 100%);
  color: var(--text-inverse);
  box-shadow: var(--shadow-sm);
}

.btn-reset:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-delete {
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  transition: all var(--transition-base);
  background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
  color: var(--text-inverse);
  box-shadow: var(--shadow-sm);
}

.btn-delete:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.empty-state {
  text-align: center;
  padding: var(--spacing-3xl);
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: var(--z-modal-backdrop);
  padding: var(--spacing-md);
  animation: fadeIn var(--transition-base);
}

.modal {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  width: 520px;
  max-width: 520px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: var(--shadow-2xl);
  animation: slideUp var(--transition-slow);
  border: 1px solid var(--border-light);
}

@media (max-width: 560px) {
  .modal {
    width: calc(100vw - 40px);
    max-width: calc(100vw - 40px);
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-xl);
  border-bottom: 1px solid var(--border-light);
}

.modal-header h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
}

.close-btn {
  background: none;
  border: none;
  font-size: var(--font-size-xl);
  color: var(--text-tertiary);
  cursor: pointer;
  padding: var(--spacing-xs);
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  transition: all var(--transition-base);
}

.close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.modal-content {
  padding: var(--spacing-xl);
}

.form-group {
  margin-bottom: var(--spacing-lg);
}

.form-group label {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  font-size: var(--font-size-sm);
}

.form-group input[type="text"],
.form-group input[type="email"],
.form-group select {
  width: 100%;
  padding: var(--spacing-md);
  border: 1.5px solid var(--border-medium);
  border-radius: var(--radius-md);
  font-size: var(--font-size-base);
  transition: all var(--transition-base);
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
}

.form-group input:disabled {
  background: var(--bg-tertiary);
  cursor: not-allowed;
  opacity: 0.6;
}

.form-group input[type="checkbox"] {
  margin-right: var(--spacing-sm);
  width: auto;
  cursor: pointer;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.temp-password-alert {
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.1) 100%);
  border: 1.5px solid rgba(245, 158, 11, 0.3);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  color: #92400e;
}

.temp-password-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--spacing-md);
}

.temp-password-main {
  flex: 1;
  min-width: 0;
}

.temp-password-alert strong {
  display: block;
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-sm);
}

.temp-password-value {
  display: block;
  margin-bottom: var(--spacing-sm);
  font-family: ui-monospace, monospace;
  font-size: var(--font-size-sm);
  word-break: break-all;
  line-height: 1.4;
}

.temp-password-main small {
  display: block;
  line-height: 1.4;
}

.btn-copy-temp-password {
  flex-shrink: 0;
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1.5px solid rgba(217, 119, 6, 0.45);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: #92400e;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-base);
  align-self: center;
}

.btn-copy-temp-password:hover {
  background: rgba(245, 158, 11, 0.15);
  border-color: rgba(217, 119, 6, 0.65);
}

@media (max-width: 400px) {
  .temp-password-row {
    flex-direction: column;
    align-items: stretch;
  }

  .btn-copy-temp-password {
    align-self: stretch;
  }
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: var(--spacing-md);
  margin-top: var(--spacing-xl);
}

.btn-cancel,
.btn-save {
  padding: var(--spacing-md) var(--spacing-xl);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  transition: all var(--transition-base);
}

.btn-cancel {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1.5px solid var(--border-medium);
}

.btn-cancel:hover {
  background: var(--border-medium);
}

.btn-save {
  background: linear-gradient(135deg, var(--color-success) 0%, #059669 100%);
  color: var(--text-inverse);
  box-shadow: var(--shadow-md);
}

.btn-save:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-retry {
  padding: var(--spacing-md) var(--spacing-xl);
  background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-dark) 100%);
  color: var(--text-inverse);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  margin-top: var(--spacing-lg);
  font-weight: var(--font-weight-semibold);
  box-shadow: var(--shadow-md);
  transition: all var(--transition-base);
}

.btn-retry:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

.modal-reset {
  max-width: 440px;
}

.reset-modal-text {
  margin: 0 0 var(--spacing-lg) 0;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  line-height: 1.5;
}

.reset-modal-error {
  color: var(--color-error);
}

.reset-password-box {
  background: var(--bg-tertiary);
  border: 1.5px solid var(--border-medium);
  border-radius: var(--radius-md);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
  word-break: break-all;
}

.reset-password-box code {
  font-size: var(--font-size-sm);
  font-family: ui-monospace, monospace;
  color: var(--text-primary);
}

.reset-modal-actions {
  margin-top: 0;
  flex-wrap: wrap;
}

.btn-reset-modal {
  padding: var(--spacing-md) var(--spacing-xl);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  background: linear-gradient(135deg, var(--color-warning) 0%, #d97706 100%);
  color: var(--text-inverse);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
}

.btn-reset-modal:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-reset-modal:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-delete-modal {
  padding: var(--spacing-md) var(--spacing-xl);
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
  color: var(--text-inverse);
  box-shadow: var(--shadow-sm);
  transition: all var(--transition-base);
}

.btn-delete-modal:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
}

.btn-delete-modal:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .page-header {
    padding: var(--spacing-lg);
  }

  .page-header h1 {
    font-size: var(--font-size-2xl);
  }

  .form-row {
    grid-template-columns: 1fr;
  }

  .users-table {
    font-size: var(--font-size-xs);
  }

  .users-table th,
  .users-table td {
    padding: var(--spacing-md);
  }

  .action-buttons {
    flex-direction: column;
  }

  .btn-edit,
  .btn-reset,
  .btn-delete {
    width: 100%;
  }
}
</style>
