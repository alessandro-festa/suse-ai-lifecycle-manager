<template>
  <div class="config-tab">
    <div class="config-section">
      <h3>Kubeflow Components</h3>
      <p class="section-description">Configure which Kubeflow components are available</p>

      <div class="config-list">
        <div class="config-item">
          <label>
            <input type="checkbox" v-model="config.enableNotebooks" />
            <div class="label-content">
              <strong>Notebooks</strong>
              <p>Jupyter notebook servers for model development</p>
            </div>
          </label>
        </div>

        <div class="config-item">
          <label>
            <input type="checkbox" v-model="config.enablePipelines" />
            <div class="label-content">
              <strong>Pipelines</strong>
              <p>ML workflow orchestration and management</p>
            </div>
          </label>
        </div>

        <div class="config-item">
          <label>
            <input type="checkbox" v-model="config.enableModelRegistry" />
            <div class="label-content">
              <strong>Model Registry</strong>
              <p>Track and manage ML models across versions</p>
            </div>
          </label>
        </div>

        <div class="config-item">
          <label>
            <input type="checkbox" v-model="config.enableKatib" />
            <div class="label-content">
              <strong>Katib</strong>
              <p>Hyperparameter tuning and neural architecture search</p>
            </div>
          </label>
        </div>

        <div class="config-item">
          <label>
            <input type="checkbox" v-model="config.enableTrainer" />
            <div class="label-content">
              <strong>Trainer</strong>
              <p>Distributed model training</p>
            </div>
          </label>
        </div>
      </div>
    </div>

    <div class="config-section">
      <h3>Authentication</h3>
      <p class="section-description">Configure authentication settings</p>

      <div class="config-list">
        <div class="config-item">
          <label>
            <input type="checkbox" v-model="config.enableOAuth2Proxy" />
            <div class="label-content">
              <strong>OAuth2 Proxy</strong>
              <p>Enable external authentication provider integration</p>
            </div>
          </label>
        </div>
      </div>

      <div class="config-form" v-if="config.enableOAuth2Proxy">
        <div class="form-group">
          <label>Provider:</label>
          <input
            v-model="config.oauth2Provider"
            type="text"
            placeholder="e.g., Google, GitHub, OIDC"
          />
        </div>

        <div class="form-group">
          <label>Client ID:</label>
          <input
            v-model="config.oauth2ClientId"
            type="text"
            placeholder="OAuth2 Client ID"
          />
        </div>
      </div>
    </div>

    <div class="config-section">
      <h3>Resource Limits</h3>
      <p class="section-description">Configure default resource limits</p>

      <div class="config-form">
        <div class="form-group">
          <label>Default CPU Request:</label>
          <input v-model="config.defaultCpuRequest" type="text" placeholder="0.5" />
          <p class="help-text">Default: 0.5 CPU cores</p>
        </div>

        <div class="form-group">
          <label>Default Memory Request:</label>
          <input v-model="config.defaultMemoryRequest" type="text" placeholder="512Mi" />
          <p class="help-text">Default: 512Mi</p>
        </div>

        <div class="form-group">
          <label>Default Storage Limit:</label>
          <input v-model="config.defaultStorageLimit" type="text" placeholder="10Gi" />
          <p class="help-text">Default: 10Gi</p>
        </div>
      </div>
    </div>

    <div class="actions">
      <button class="btn btn-secondary" @click="resetConfig">Reset</button>
      <button class="btn btn-primary" @click="saveConfig" :disabled="isSaving">
        {{ isSaving ? 'Saving...' : 'Save Configuration' }}
      </button>
    </div>

    <div v-if="saveMessage" :class="['message', saveMessage.type]">
      {{ saveMessage.text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

interface ConfigState {
  enableNotebooks: boolean
  enablePipelines: boolean
  enableModelRegistry: boolean
  enableKatib: boolean
  enableTrainer: boolean
  enableOAuth2Proxy: boolean
  oauth2Provider: string
  oauth2ClientId: string
  defaultCpuRequest: string
  defaultMemoryRequest: string
  defaultStorageLimit: string
}

const config = reactive<ConfigState>({
  enableNotebooks: true,
  enablePipelines: true,
  enableModelRegistry: true,
  enableKatib: true,
  enableTrainer: true,
  enableOAuth2Proxy: false,
  oauth2Provider: '',
  oauth2ClientId: '',
  defaultCpuRequest: '0.5',
  defaultMemoryRequest: '512Mi',
  defaultStorageLimit: '10Gi'
})

const isSaving = ref(false)
const saveMessage = ref<{ type: 'success' | 'error', text: string } | null>(null)

const saveConfig = async () => {
  isSaving.value = true
  saveMessage.value = null

  try {
    // Simulate saving configuration
    await new Promise(resolve => setTimeout(resolve, 1000))
    
    saveMessage.value = {
      type: 'success',
      text: 'Configuration saved successfully'
    }

    setTimeout(() => {
      saveMessage.value = null
    }, 3000)
  } catch (error) {
    saveMessage.value = {
      type: 'error',
      text: 'Failed to save configuration'
    }
  } finally {
    isSaving.value = false
  }
}

const resetConfig = () => {
  Object.assign(config, {
    enableNotebooks: true,
    enablePipelines: true,
    enableModelRegistry: true,
    enableKatib: true,
    enableTrainer: true,
    enableOAuth2Proxy: false,
    oauth2Provider: '',
    oauth2ClientId: '',
    defaultCpuRequest: '0.5',
    defaultMemoryRequest: '512Mi',
    defaultStorageLimit: '10Gi'
  })
  saveMessage.value = null
}
</script>

<style scoped>
.config-tab {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.config-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}

.config-section:last-of-type {
  border-bottom: none;
}

.config-section h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.section-description {
  margin: 0;
  font-size: 13px;
  color: #999;
}

.config-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.config-item label {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  cursor: pointer;
  padding: 12px;
  border-radius: 4px;
  transition: background 0.2s;
}

.config-item label:hover {
  background: #f5f5f5;
}

.config-item input[type="checkbox"] {
  margin-top: 2px;
  cursor: pointer;
}

.label-content {
  flex: 1;
}

.label-content strong {
  display: block;
  font-size: 13px;
  color: #333;
  margin-bottom: 2px;
}

.label-content p {
  margin: 0;
  font-size: 12px;
  color: #999;
}

.config-form {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 4px;
  border: 1px solid #eee;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 500;
  color: #333;
}

.form-group input {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  font-family: inherit;
}

.form-group input:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
}

.help-text {
  margin: 0;
  font-size: 12px;
  color: #999;
  font-style: italic;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 20px;
  border-top: 1px solid #eee;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #0066cc;
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: #0052a3;
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;
}

.btn-secondary:hover {
  background: #e0e0e0;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.message {
  padding: 12px 16px;
  border-radius: 4px;
  font-size: 13px;
  margin-top: 12px;
}

.message.success {
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}
</style>
