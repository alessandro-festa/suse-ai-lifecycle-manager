<template>
  <div class="profiles-section">
    <div class="section-header">
      <h3>Kubeflow Profiles</h3>
      <button class="btn btn-primary" @click="showCreateForm = true">
        Create Profile
      </button>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading profiles...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <p class="error-message">{{ error }}</p>
      <button class="btn btn-secondary" @click="loadProfiles">Retry</button>
    </div>

    <div v-else-if="profiles.length === 0" class="empty-state">
      <p>No profiles found</p>
      <p class="hint">Click "Create Profile" to add a new profile</p>
    </div>

    <div v-else class="profiles-table">
      <table>
        <thead>
          <tr>
            <th>Profile Name</th>
            <th>Owner Email</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="profile in profiles" :key="profile.metadata.name">
            <td>{{ profile.metadata.name }}</td>
            <td>{{ profile.spec?.owner?.name || '-' }}</td>
            <td>
              <span class="badge-active">Active</span>
            </td>
            <td class="actions-cell">
              <button class="btn-icon" title="Contributors" @click="manageContributors(profile)">
                👥
              </button>
              <button class="btn-icon" title="Edit" @click="editProfile(profile)">
                ✎
              </button>
              <button class="btn-icon delete" title="Delete" @click="deleteProfile(profile)">
                ✕
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Create/Edit Profile Modal -->
    <div v-if="showCreateForm || editingProfile" class="modal-overlay" @click.self="closeForm">
      <div class="modal">
        <div class="modal-header">
          <h4>{{ editingProfile ? 'Edit Profile' : 'Create New Profile' }}</h4>
          <button class="close-btn" @click="closeForm">✕</button>
        </div>

        <div class="modal-body">
          <form @submit.prevent="saveProfile" id="profileForm">
            <div class="form-group">
              <label>Profile Name <span class="required">*</span></label>
              <input
                v-model="formData.name"
                type="text"
                placeholder="profile-name"
                :disabled="!!editingProfile"
                autocomplete="off"
              />
              <p class="help-text" v-if="!editingProfile">Kubernetes namespace name rules apply</p>
            </div>

            <div class="form-group">
              <label>Owner Email <span class="required">*</span></label>
              <input
                v-model="formData.ownerEmail"
                type="email"
                placeholder="user@example.com"
                autocomplete="off"
              />
            </div>
          </form>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeForm">Cancel</button>
          <button 
            class="btn btn-primary" 
            @click="saveProfile"
            :disabled="isSaving"
          >
            {{ isSaving ? 'Saving...' : 'Save' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div v-if="profileToDelete" class="modal-overlay" @click.self="profileToDelete = null">
      <div class="modal confirm-modal">
        <div class="modal-body">
          <p><strong>Delete Profile?</strong></p>
          <p>Are you sure you want to delete profile <strong>{{ profileToDelete.metadata.name }}</strong>?</p>
          <p class="warning">This action cannot be undone and will delete all resources in this profile namespace.</p>
        </div>

        <div class="modal-footer">
          <button class="btn btn-secondary" @click="profileToDelete = null">Cancel</button>
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
    <!-- Manage Contributors Modal -->
    <div v-if="showContributorsModal && selectedProfile" class="modal-overlay" @click.self="closeContributorsModal">
      <div class="modal large-modal">
        <div class="modal-header">
          <h4>Manage Contributors: {{ selectedProfile.metadata.name }}</h4>
          <button class="close-btn" @click="closeContributorsModal">✕</button>
        </div>

        <div class="modal-body">
          <!-- Add Contributor Form -->
          <div class="add-contributor-section">
            <h5>Add Contributor</h5>
            <div class="form-row">
              <input 
                v-model="contributorForm.email" 
                type="email" 
                placeholder="User Email" 
                list="dex-users"
                @blur="checkUserExists"
              />
              <datalist id="dex-users">
                <option v-for="user in dexUsers" :key="user.email" :value="user.email" />
              </datalist>
              
              <button class="btn btn-primary" @click="addContributor" :disabled="isAddingContributor || !contributorForm.email">
                {{ isAddingContributor ? 'Adding...' : 'Add' }}
              </button>
            </div>

            <div v-if="contributorForm.createDexUser" class="new-user-alert">
              <div class="checkbox-group">
                <input type="checkbox" id="createUser" v-model="contributorForm.createDexUser" disabled checked>
                <label for="createUser">User not found. Create new local user?</label>
              </div>
              <div class="form-group password-group">
                <input 
                  v-model="contributorForm.password" 
                  type="password" 
                  placeholder="Set Password for new user"
                />
              </div>
            </div>
          </div>

          <!-- Contributors List -->
          <div class="contributors-list">
            <h5>Current Contributors</h5>
            <div v-if="contributors.length === 0" class="empty-list">
              No contributors found.
            </div>
            <table v-else>
              <thead>
                <tr>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="c in contributors" :key="c.email + c.role">
                  <td>{{ c.email }}</td>
                  <td>{{ c.role }}</td>
                  <td class="actions-cell">
                    <button class="btn-icon delete" title="Remove" @click="removeContributor(c)">✕</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import type { KubeflowProfile, Contributor } from '../../../services/profile.service'
import { ProfileService } from '../../../services/profile.service'
import type { DexUser } from '../../../services/dex.service'
import { DexService } from '../../../services/dex.service'
import type { RancherStore } from '../../../types/rancher-types'
import { useStore } from 'vuex'

interface Props {
  clusterId: string
  clusterName: string
}

const props = defineProps<Props>()

const store = useStore() as RancherStore
const profiles = ref<KubeflowProfile[]>([])
const loading = ref(false)
const error = ref('')
const showCreateForm = ref(false)
const showContributorsModal = ref(false)
const editingProfile = ref<KubeflowProfile | null>(null)
const profileToDelete = ref<KubeflowProfile | null>(null)
const selectedProfile = ref<KubeflowProfile | null>(null)
const contributors = ref<Contributor[]>([])
const dexUsers = ref<DexUser[]>([])
const isSaving = ref(false)
const isDeleting = ref(false)
const isAddingContributor = ref(false)
const profileService = ref<ProfileService | null>(null)
const dexService = ref<DexService | null>(null)

const formData = ref({
  name: '',
  ownerEmail: ''
})

const contributorForm = ref({
  email: '',
  password: '',
  createDexUser: false
})

onMounted(() => {
  console.log('[ProfilesTab] Component mounted for cluster:', props.clusterId);
  profileService.value = new ProfileService(store, props.clusterId)
  dexService.value = new DexService(store, props.clusterId)
  loadProfiles()
  loadDexUsers()
})

const loadDexUsers = async () => {
  if (dexService.value) {
    dexUsers.value = await dexService.value.getLocalUsers()
  }
}

const loadProfiles = async () => {
  loading.value = true
  error.value = ''

  try {
    profiles.value = await profileService.value!.getProfiles()
    console.log('[ProfilesTab] Loaded profiles:', profiles.value.length);
  } catch (err) {
    error.value = `Failed to load profiles: ${err instanceof Error ? err.message : 'Unknown error'}`
    console.error('[ProfilesTab] Error loading profiles:', err);
  } finally {
    loading.value = false
  }
}

const manageContributors = async (profile: KubeflowProfile) => {
  selectedProfile.value = profile
  showContributorsModal.value = true
  contributors.value = []
  contributorForm.value = { email: '', password: '', createDexUser: false }
  
  try {
    if (profileService.value) {
      contributors.value = await profileService.value.getContributors(profile.metadata.name)
    }
  } catch (err) {
    console.error('Error loading contributors:', err)
  }
}

const checkUserExists = () => {
  const email = contributorForm.value.email
  if (!email) return
  
  const exists = dexUsers.value.some(u => u.email === email)
  // If user does NOT exist, default to checking "createDexUser"
  if (!exists) {
     contributorForm.value.createDexUser = true
  } else {
     contributorForm.value.createDexUser = false
  }
}

const addContributor = async () => {
  if (!selectedProfile.value || !contributorForm.value.email) return
  
  isAddingContributor.value = true
  error.value = ''

  try {
    // 1. Create Dex user if requested
    if (contributorForm.value.createDexUser) {
      if (!contributorForm.value.password) {
        error.value = 'Password is required to create a new user'
        isAddingContributor.value = false
        return
      }
      
      await dexService.value?.createUser({
        email: contributorForm.value.email,
        username: contributorForm.value.email.split('@')[0],
        password: contributorForm.value.password
      })
      // Refresh local user list
      await loadDexUsers()
    }

    // 2. Add Contributor (RoleBinding)
    await profileService.value?.addContributor(
      selectedProfile.value.metadata.name,
      contributorForm.value.email
    )

    // 3. Refresh list
    contributors.value = await profileService.value!.getContributors(selectedProfile.value.metadata.name)
    
    // Reset form
    contributorForm.value = { email: '', password: '', createDexUser: false }

  } catch (err) {
    error.value = `Failed to add contributor: ${err instanceof Error ? err.message : 'Unknown error'}`
  } finally {
    isAddingContributor.value = false
  }
}

const removeContributor = async (contributor: Contributor) => {
  if (!selectedProfile.value) return
  
  try {
    await profileService.value?.removeContributor(
      selectedProfile.value.metadata.name,
      contributor.email,
      contributor.role
    )
    contributors.value = await profileService.value!.getContributors(selectedProfile.value.metadata.name)
  } catch (err) {
    console.error('Error removing contributor:', err)
    error.value = `Failed to remove contributor: ${err instanceof Error ? err.message : 'Unknown error'}`
  }
}

const closeContributorsModal = () => {
  showContributorsModal.value = false
  selectedProfile.value = null
}


const resetForm = () => {
  formData.value = {
    name: '',
    ownerEmail: ''
  }
}

const closeForm = () => {
  showCreateForm.value = false
  editingProfile.value = null
  resetForm()
}

const editProfile = (profile: KubeflowProfile) => {
  editingProfile.value = profile
  formData.value = {
    name: profile.metadata.name,
    ownerEmail: profile.spec.owner.name
  }
}

const deleteProfile = (profile: KubeflowProfile) => {
  profileToDelete.value = profile
}

const saveProfile = async () => {
  if (!formData.value.name || !formData.value.ownerEmail) {
    error.value = 'Name and Owner Email are required'
    return
  }

  isSaving.value = true
  error.value = ''

  try {
    if (editingProfile.value) {
      await profileService.value?.updateProfile(
        editingProfile.value.metadata.name,
        formData.value.ownerEmail
      )
    } else {
      await profileService.value?.createProfile({
        name: formData.value.name,
        ownerEmail: formData.value.ownerEmail
      })
    }

    await loadProfiles()
    closeForm()
  } catch (err) {
    error.value = `Failed to save profile: ${err instanceof Error ? err.message : 'Unknown error'}`
  } finally {
    isSaving.value = false
  }
}

const confirmDelete = async () => {
  if (!profileToDelete.value) return

  isDeleting.value = true
  error.value = ''

  try {
    await profileService.value?.deleteProfile(profileToDelete.value.metadata.name)
    await loadProfiles()
    profileToDelete.value = null
  } catch (err) {
    error.value = `Failed to delete profile: ${err instanceof Error ? err.message : 'Unknown error'}`
  } finally {
    isDeleting.value = false
  }
}
</script>

<style scoped>
.profiles-section {
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

.profiles-table {
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

.badge-active {
  display: inline-block;
  padding: 2px 8px;
  background-color: #e8f5e9;
  color: #2e7d32;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
  border: 1px solid #c8e6c9;
}

.large-modal {
  max-width: 700px;
}

.add-contributor-section {
  background: #f9f9f9;
  padding: 16px;
  border-radius: 4px;
  margin-bottom: 20px;
  border: 1px solid #eee;
}

.add-contributor-section h5 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-row input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.new-user-alert {
  margin-top: 12px;
  padding: 12px;
  background: #fff3e0;
  border: 1px solid #ffe0b2;
  border-radius: 4px;
}

.checkbox-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 500;
}

.password-group input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.contributors-list h5 {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
}

.empty-list {
  color: #999;
  font-style: italic;
  text-align: center;
  padding: 20px;
  background: #f9f9f9;
  border-radius: 4px;
}
</style>
