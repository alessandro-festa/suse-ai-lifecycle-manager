<template>
  <div class="users-section">
    <div class="section-header">
      <h3>Local Users</h3>
      <button class="btn btn-primary" @click="showCreateForm = true">
        Add User
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading users...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <p class="error-message">{{ error }}</p>
      <button class="btn btn-secondary" @click="loadUsers">Retry</button>
    </div>

    <div v-else-if="users.length === 0" class="empty-state">
      <p>No local users configured</p>
      <p class="hint">Click "Add User" to create a new local user</p>
    </div>

    <div v-else class="users-table">
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Username</th>
            <th>Profile</th>
            <th>User ID</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.userID">
            <td>{{ user.email }}</td>
            <td>{{ user.username }}</td>
            <td>
              <span v-if="user.profileName" class="badge-profile">{{ user.profileName }}</span>
              <span v-else class="text-muted">-</span>
            </td>
            <td class="monospace">{{ user.userID }}</td>
            <td class="actions-cell">
              <button class="btn-icon" title="Edit" @click="editUser(user)">
                ✎
              </button>
              <button class="btn-icon delete" title="Delete" @click="deleteUser(user)">
                ✕
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit User Modal -->
    <div v-if="showCreateForm || editingUser" class="modal-overlay" @click.self="closeForm">
      <div class="modal">
        <div class="modal-header">
          <h4>{{ editingUser ? 'Edit User' : 'Create New User' }}</h4>
          <button class="close-btn" @click="closeForm">✕</button>
        </div>

        <div class="modal-body">
          <form @submit.prevent="saveUser" id="userForm">
            <div class="form-group">
              <label>Email <span class="required">*</span></label>
              <input
                v-model="formData.email"
                type="email"
                placeholder="user@example.com"
                :disabled="!!editingUser"
                autocomplete="email"
              />
            </div>

            <div class="form-group">
              <label>Username <span class="required">*</span></label>
              <input
                v-model="formData.username"
                type="text"
                placeholder="username"
                autocomplete="username"
              />
            </div>

            <div class="form-group">
              <label>Password <span class="required">*</span></label>
              <input
                v-model="formData.password"
                type="password"
                placeholder="Enter password"
                autocomplete="new-password"
              />
              <p class="help-text">{{ editingUser ? 'Leave empty to keep current password' : 'Minimum 8 characters recommended' }}</p>
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeForm">Cancel</button>
          <button 
            class="btn btn-primary" 
            @click="saveUser"
            :disabled="isSaving"
          >
            {{ isSaving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="userToDelete" class="modal-overlay" @click.self="userToDelete = null">
      <div class="modal confirm-modal">
        <div class="modal-body">
          <p><strong>Delete User?</strong></p>
          <p>Are you sure you want to delete {{ userToDelete.email }}?</p>
          <p class="warning">This action cannot be undone.</p>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="userToDelete = null">Cancel</button>
          <button 
            class="btn btn-danger" 
            @click="confirmDelete"
            :disabled="isDeleting"
          >
            {{ isDeleting ? 'Deleting...' : 'Delete' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { DexUser } from '../../../services/dex.service'
import { DexService } from '../../../services/dex.service'
import type { RancherStore } from '../../../types/rancher-types'
import { useStore } from 'vuex'

interface Props {
  clusterId: string
  clusterName: string
  dexNamespace: string
  kubeflowNamespace: string
}

const props = defineProps<Props>()

const store = useStore() as RancherStore
const users = ref<DexUser[]>([])
const loading = ref(false)
const error = ref('')
const showCreateForm = ref(false)
const editingUser = ref<DexUser | null>(null)
const userToDelete = ref<DexUser | null>(null)
const isSaving = ref(false)
const isDeleting = ref(false)
const dexService = ref<DexService | null>(null)

const formData = ref({
  email: '',
  username: '',
  password: ''
})

onMounted(() => {
  console.log('[UsersTab] Component mounted for cluster:', props.clusterId);
  loadUsers()
})

const loadUsers = async () => {
  console.log('[UsersTab] loadUsers() called for cluster:', props.clusterId);
  loading.value = true
  error.value = ''

  try {
    dexService.value = new DexService(store, props.clusterId)
    console.log('[UsersTab] DexService instantiated, calling getLocalUsers()');
    
    // Fetch users and profiles in parallel
    const [fetchedUsers, fetchedProfiles] = await Promise.all([
      dexService.value.getLocalUsers(),
      dexService.value.getKubeflowProfiles()
    ]);
    
    console.log('[UsersTab] Data fetched:', { 
      users: fetchedUsers.length, 
      profiles: fetchedProfiles.length 
    });

    // Map profiles to users
    users.value = fetchedUsers.map(user => {
      // Find profile where user is owner
      const userProfile = fetchedProfiles.find(profile => 
        profile.spec?.owner?.kind === 'User' && 
        profile.spec?.owner?.name === user.email
      );
      
      return {
        ...user,
        profileName: userProfile?.metadata?.name || ''
      };
    });
    
    console.log('[UsersTab] Users mapped with profiles');
  } catch (err) {
    error.value = `Failed to load users: ${err instanceof Error ? err.message : 'Unknown error'}`
    console.error('[UsersTab] Error loading users:', err);
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  formData.value = {
    email: '',
    username: '',
    password: ''
  }
}

const closeForm = () => {
  showCreateForm.value = false
  editingUser.value = null
  resetForm()
}

const editUser = (user: DexUser) => {
  editingUser.value = user
  formData.value = {
    email: user.email,
    username: user.username,
    password: ''
  }
}

const deleteUser = (user: DexUser) => {
  userToDelete.value = user
}

const saveUser = async () => {
  if (!formData.value.email || !formData.value.username) {
    error.value = 'Email and username are required'
    return
  }

  if (!editingUser.value && !formData.value.password) {
    error.value = 'Password is required for new users'
    return
  }

  isSaving.value = true
  error.value = ''

  try {
    if (editingUser.value) {
      await dexService.value?.updateUser(editingUser.value.email, {
        email: formData.value.email,
        username: formData.value.username,
        password: formData.value.password
      })
    } else {
      await dexService.value?.createUser({
        email: formData.value.email,
        username: formData.value.username,
        password: formData.value.password
      })
    }

    await loadUsers()
    closeForm()
  } catch (err) {
    error.value = `Failed to save user: ${err instanceof Error ? err.message : 'Unknown error'}`
  } finally {
    isSaving.value = false
  }
}

const confirmDelete = async () => {
  if (!userToDelete.value) return

  isDeleting.value = true
  error.value = ''

  try {
    await dexService.value?.deleteUser(userToDelete.value.email)
    await loadUsers()
    userToDelete.value = null
  } catch (err) {
    error.value = `Failed to delete user: ${err instanceof Error ? err.message : 'Unknown error'}`
  } finally {
    isDeleting.value = false
  }
}
</script>

<style scoped>
.users-section {
  margin-bottom: 20px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background-color: #0066cc;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background-color: #0052a3;
}

.btn-primary:disabled,
.btn-secondary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-secondary {
  background-color: #f0f0f0;
  color: #333;
  border: 1px solid #ddd;
}

.btn-secondary:hover:not(:disabled) {
  background-color: #e0e0e0;
}

.btn-danger {
  background-color: #cc0000;
  color: white;
}

.btn-danger:hover:not(:disabled) {
  background-color: #990000;
}

.loading-state,
.error-state,
.empty-state {
  padding: 20px;
  text-align: center;
  color: #666;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #f0f0f0;
  border-top-color: #0066cc;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.error-state {
  background-color: #fff3f3;
  border: 1px solid #ffcccc;
  border-radius: 4px;
}

.error-message {
  color: #cc0000;
  margin: 0 0 12px 0;
}

.empty-state {
  background-color: #f9f9f9;
  border: 1px solid #eee;
  border-radius: 4px;
}

.hint {
  margin: 0;
  font-size: 12px;
  color: #999;
}

.users-table {
  width: 100%;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  overflow: hidden;
}

table {
  width: 100%;
  border-collapse: collapse;
}

thead {
  background-color: #f5f5f5;
}

th {
  padding: 12px 16px;
  text-align: left;
  font-size: 13px;
  font-weight: 600;
  color: #333;
  border-bottom: 1px solid #ddd;
}

td {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
  color: #333;
}

tbody tr:hover {
  background-color: #f9f9f9;
}

.monospace {
  font-family: monospace;
  color: #666;
}

.actions-cell {
  text-align: right;
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn-icon {
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid #ddd;
  background: white;
  border-radius: 2px;
  cursor: pointer;
  font-size: 14px;
  color: #0066cc;
  transition: all 0.2s ease;
}

.btn-icon:hover {
  background-color: #f0f0f0;
  border-color: #0066cc;
}

.btn-icon.delete {
  color: #cc0000;
}

.btn-icon.delete:hover {
  border-color: #cc0000;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: white;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  max-width: 500px;
  width: 90%;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #ddd;
}

.modal-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #999;
}

.close-btn:hover {
  color: #333;
}

.modal-body {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.required {
  color: #cc0000;
}

.form-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
}

.form-group input:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
}

.form-group input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.help-text {
  margin: 6px 0 0 0;
  font-size: 12px;
  color: #999;
}

.warning {
  color: #cc0000;
  margin: 12px 0 0 0;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #ddd;
  background-color: #f5f5f5;
}

.confirm-modal .modal-body {
  text-align: center;
}

.confirm-modal .modal-body p {
  margin: 0 0 12px 0;
}

.badge-profile {
  display: inline-block;
  padding: 2px 8px;
  background-color: #e0f2f1;
  color: #00695c;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid #b2dfdb;
}

.text-muted {
  color: #999;
  font-style: italic;
}
</style>
