<template>
  <div class="advanced-tab">
    <div class="section">
      <h3>Namespace Configuration</h3>
      <p class="section-description">Configure Kubeflow namespace settings</p>

      <div class="settings-list">
        <div class="setting-item">
          <div class="item-content">
            <strong>Allow User Creation</strong>
            <p>Permit users to create personal namespaces</p>
          </div>
          <label class="toggle">
            <input type="checkbox" v-model="settings.allowUserNamespaceCreation" />
            <span :class="{ active: settings.allowUserNamespaceCreation }"></span>
          </label>
        </div>

        <div class="setting-item">
          <div class="item-content">
            <strong>Namespace Quotas</strong>
            <p>Enforce resource quotas per namespace</p>
          </div>
          <label class="toggle">
            <input type="checkbox" v-model="settings.enforceNamespaceQuotas" />
            <span :class="{ active: settings.enforceNamespaceQuotas }"></span>
          </label>
        </div>

        <div class="setting-item">
          <div class="item-content">
            <strong>Network Policies</strong>
            <p>Enable network policy enforcement</p>
          </div>
          <label class="toggle">
            <input type="checkbox" v-model="settings.enableNetworkPolicies" />
            <span :class="{ active: settings.enableNetworkPolicies }"></span>
          </label>
        </div>
      </div>

      <div v-if="settings.enforceNamespaceQuotas" class="quota-settings">
        <div class="form-group">
          <label>Default CPU Quota:</label>
          <input v-model="settings.defaultCpuQuota" type="text" placeholder="4" />
        </div>
        <div class="form-group">
          <label>Default Memory Quota:</label>
          <input v-model="settings.defaultMemoryQuota" type="text" placeholder="16Gi" />
        </div>
      </div>
    </div>

    <div class="section">
      <h3>Security Settings</h3>
      <p class="section-description">Configure security policies</p>

      <div class="settings-list">
        <div class="setting-item">
          <div class="item-content">
            <strong>Pod Security Policy</strong>
            <p>Enforce pod security policies</p>
          </div>
          <label class="toggle">
            <input type="checkbox" v-model="settings.enablePodSecurityPolicy" />
            <span :class="{ active: settings.enablePodSecurityPolicy }"></span>
          </label>
        </div>

        <div class="setting-item">
          <div class="item-content">
            <strong>RBAC Enforcement</strong>
            <p>Strict role-based access control</p>
          </div>
          <label class="toggle">
            <input type="checkbox" v-model="settings.enforceRBAC" />
            <span :class="{ active: settings.enforceRBAC }"></span>
          </label>
        </div>

        <div class="setting-item">
          <div class="item-content">
            <strong>Log Audit Trail</strong>
            <p>Log all Kubeflow administration actions</p>
          </div>
          <label class="toggle">
            <input type="checkbox" v-model="settings.enableAuditLogging" />
            <span :class="{ active: settings.enableAuditLogging }"></span>
          </label>
        </div>
      </div>
    </div>

    <div class="section">
      <h3>Monitoring & Observability</h3>
      <p class="section-description">Configure monitoring settings</p>

      <div class="settings-list">
        <div class="setting-item">
          <div class="item-content">
            <strong>Prometheus Metrics</strong>
            <p>Export metrics to Prometheus</p>
          </div>
          <label class="toggle">
            <input type="checkbox" v-model="settings.enablePrometheus" />
            <span :class="{ active: settings.enablePrometheus }"></span>
          </label>
        </div>

        <div class="setting-item">
          <div class="item-content">
            <strong>Distributed Tracing</strong>
            <p>Enable distributed tracing with Jaeger</p>
          </div>
          <label class="toggle">
            <input type="checkbox" v-model="settings.enableJaeger" />
            <span :class="{ active: settings.enableJaeger }"></span>
          </label>
        </div>

        <div class="setting-item">
          <div class="item-content">
            <strong>log Aggregation</strong>
            <p>Aggregate logs from all components</p>
          </div>
          <label class="toggle">
            <input type="checkbox" v-model="settings.enableLogAggregation" />
            <span :class="{ active: settings.enableLogAggregation }"></span>
          </label>
        </div>
      </div>

      <div v-if="settings.enableLogAggregation" class="log-settings">
        <div class="form-group">
          <label>Log Aggregation Backend:</label>
          <select v-model="settings.logBackend">
            <option value="">Select backend</option>
            <option value="elasticsearch">Elasticsearch</option>
            <option value="splunk">Splunk</option>
            <option value="stackdriver">Google Cloud Logging</option>
            <option value="cloudwatch">AWS CloudWatch</option>
          </select>
        </div>
        <div class="form-group">
          <label>Backend Endpoint:</label>
          <input
            v-model="settings.logBackendEndpoint"
            type="text"
            placeholder="https://logging.example.com"
          />
        </div>
      </div>
    </div>

    <div class="actions">
      <button class="btn btn-secondary" @click="resetSettings">Reset to Defaults</button>
      <button class="btn btn-primary" @click="saveSettings" :disabled="isSaving">
        {{ isSaving ? 'Saving...' : 'Apply Settings' }}
      </button>
    </div>

    <div v-if="saveMessage" :class="['message', saveMessage.type]">
      {{ saveMessage.text }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'

interface AdvancedSettings {
  // Namespace
  allowUserNamespaceCreation: boolean
  enforceNamespaceQuotas: boolean
  defaultCpuQuota: string
  defaultMemoryQuota: string
  enableNetworkPolicies: boolean

  // Security
  enablePodSecurityPolicy: boolean
  enforceRBAC: boolean
  enableAuditLogging: boolean

  // Monitoring
  enablePrometheus: boolean
  enableJaeger: boolean
  enableLogAggregation: boolean
  logBackend: string
  logBackendEndpoint: string
}

const settings = reactive<AdvancedSettings>({
  allowUserNamespaceCreation: true,
  enforceNamespaceQuotas: false,
  defaultCpuQuota: '4',
  defaultMemoryQuota: '16Gi',
  enableNetworkPolicies: true,
  enablePodSecurityPolicy: true,
  enforceRBAC: true,
  enableAuditLogging: true,
  enablePrometheus: true,
  enableJaeger: false,
  enableLogAggregation: false,
  logBackend: '',
  logBackendEndpoint: ''
})

const isSaving = ref(false)
const saveMessage = ref<{ type: 'success' | 'error', text: string } | null>(null)

const saveSettings = async () => {
  isSaving.value = true
  saveMessage.value = null

  try {
    // Simulate saving settings
    await new Promise(resolve => setTimeout(resolve, 1000))

    saveMessage.value = {
      type: 'success',
      text: 'Advanced settings applied successfully'
    }

    setTimeout(() => {
      saveMessage.value = null
    }, 3000)
  } catch (error) {
    saveMessage.value = {
      type: 'error',
      text: 'Failed to apply settings'
    }
  } finally {
    isSaving.value = false
  }
}

const resetSettings = () => {
  Object.assign(settings, {
    allowUserNamespaceCreation: true,
    enforceNamespaceQuotas: false,
    defaultCpuQuota: '4',
    defaultMemoryQuota: '16Gi',
    enableNetworkPolicies: true,
    enablePodSecurityPolicy: true,
    enforceRBAC: true,
    enableAuditLogging: true,
    enablePrometheus: true,
    enableJaeger: false,
    enableLogAggregation: false,
    logBackend: '',
    logBackendEndpoint: ''
  })
  saveMessage.value = null
}
</script>

<style scoped>
.advanced-tab {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding-bottom: 20px;
  border-bottom: 1px solid #eee;
}

.section:last-of-type {
  border-bottom: none;
}

.section h3 {
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

.settings-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border-radius: 4px;
  background: #f9f9f9;
  border: 1px solid #eee;
  transition: all 0.2s;
}

.setting-item:hover {
  background: #f5f5f5;
  border-color: #ddd;
}

.item-content strong {
  display: block;
  font-size: 13px;
  color: #333;
  margin-bottom: 4px;
}

.item-content p {
  margin: 0;
  font-size: 12px;
  color: #999;
}

.toggle {
  display: flex;
  align-items: center;
  cursor: pointer;
  position: relative;
  width: 44px;
  height: 24px;
}

.toggle input {
  display: none;
}

.toggle span {
  position: absolute;
  width: 100%;
  height: 100%;
  background: #ddd;
  border-radius: 12px;
  transition: background 0.3s;
  left: 0;
  top: 0;
}

.toggle span::after {
  content: '';
  position: absolute;
  width: 20px;
  height: 20px;
  background: white;
  border-radius: 50%;
  top: 2px;
  left: 2px;
  transition: left 0.3s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle input:checked + span {
  background: #0066cc;
}

.toggle input:checked + span::after {
  left: 22px;
}

.quota-settings,
.log-settings {
  margin-top: 12px;
  padding: 12px;
  background: #f0f8ff;
  border: 1px solid #cce5ff;
  border-radius: 4px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 12px;
  font-weight: 500;
  color: #333;
}

.form-group input,
.form-group select {
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 12px;
  font-family: inherit;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #0066cc;
  box-shadow: 0 0 0 3px rgba(0, 102, 204, 0.1);
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
