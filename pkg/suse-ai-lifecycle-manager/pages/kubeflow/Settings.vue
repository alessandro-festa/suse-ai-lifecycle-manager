<template>
  <div class="settings-page">
    <div class="header">
      <h1>Kubeflow Settings</h1>
      <p>Configure Kubeflow administration options</p>
    </div>
    
    <div class="tabs-container">
      <div class="tabs-header">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          :class="['tab-button', { active: activeTab === tab.id }]"
          @click="activeTab = tab.id"
        >
          {{ tab.label }}
        </button>
      </div>

      <!-- Users Tab -->
      <div v-if="activeTab === 'users'" class="tab-content">
        <div v-if="availableClusters.length === 0" class="empty-state">
          <p>No Kubeflow clusters detected. Please ensure Kubeflow and Dex are installed.</p>
        </div>

        <div v-else class="clusters-grid">
          <div v-for="cluster in availableClusters" :key="cluster.id" class="cluster-section">
            <div class="cluster-header">
              <h2>{{ cluster.name }}</h2>
              <span class="cluster-id">({{ cluster.id }})</span>
            </div>

            <UsersTab
              :cluster-id="cluster.id"
              :cluster-name="cluster.name"
              :dex-namespace="cluster.dexNamespace"
              :kubeflow-namespace="cluster.kubeflowNamespace"
            />
          </div>
        </div>
      </div>

      <!-- Profiles Tab -->
      <div v-if="activeTab === 'profiles'" class="tab-content">
        <div v-if="availableClusters.length === 0" class="empty-state">
          <p>No Kubeflow clusters detected. Please ensure Kubeflow is installed.</p>
        </div>

        <div v-else class="clusters-grid">
          <div v-for="cluster in availableClusters" :key="cluster.id" class="cluster-section">
            <div class="cluster-header">
              <h2>{{ cluster.name }}</h2>
              <span class="cluster-id">({{ cluster.id }})</span>
            </div>

            <ProfilesTab
              :cluster-id="cluster.id"
              :cluster-name="cluster.name"
            />
          </div>
        </div>
      </div>

      <!-- Configuration Tab -->
      <div v-if="activeTab === 'config'" class="tab-content">
        <ConfigTab />
      </div>

      <!-- Advanced Tab -->
      <div v-if="activeTab === 'advanced'" class="tab-content">
        <AdvancedTab />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import UsersTab from './components/UsersTab.vue'
import ProfilesTab from './components/ProfilesTab.vue'
import ConfigTab from './components/ConfigTab.vue'
import AdvancedTab from './components/AdvancedTab.vue'
import { ClusterDiscoveryService } from '../../services/cluster-discovery.service'
import type { RancherStore } from '../../types/rancher-types'
import { useStore } from 'vuex'

interface ClusterOption {
  id: string
  name: string
  dexNamespace: string
  kubeflowNamespace: string
}

const store = useStore() as RancherStore
const activeTab = ref('users')
const availableClusters = ref<ClusterOption[]>([])
const discoveryService = ref<ClusterDiscoveryService | null>(null)

const tabs = [
  { id: 'users', label: 'Users' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'config', label: 'Configuration' },
  { id: 'advanced', label: 'Advanced' }
]

onMounted(async () => {
  try {
    discoveryService.value = new ClusterDiscoveryService(store)
    const clusters = await discoveryService.value.discoverKubeflowClusters()
    
    availableClusters.value = clusters.map(cluster => ({
      id: cluster.id,
      name: cluster.name,
      dexNamespace: cluster.dexNamespace,
      kubeflowNamespace: cluster.kubeflowNamespace
    }))

    console.log('Available Kubeflow clusters:', availableClusters.value)
  } catch (error) {
    console.error('Error discovering clusters:', error)
  }
})
</script>

<style scoped>
.settings-page {
  padding: 24px;
}

.header {
  margin-bottom: 32px;
}

.header h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 600;
  color: #333;
}

.header p {
  margin: 8px 0 0 0;
  font-size: 14px;
  color: #666;
}

.tabs-container {
  background: white;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}

.tabs-header {
  display: flex;
  border-bottom: 1px solid #ddd;
  background-color: #f5f5f5;
}

.tab-button {
  flex: 0 0 auto;
  padding: 12px 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  border-bottom: 3px solid transparent;
  transition: all 0.2s ease;
}

.tab-button:hover {
  color: #333;
  background-color: #f0f0f0;
}

.tab-button.active {
  color: #0066cc;
  border-bottom-color: #0066cc;
  background-color: white;
}

.tab-content {
  padding: 20px;
  animation: fadeIn 0.2s ease;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: #666;
}

.clusters-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
  gap: 20px;
}

.cluster-section {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 20px;
  background: #fafafa;
  break-inside: avoid;
}

.cluster-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 2px solid #e0e0e0;
}

.cluster-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.cluster-id {
  font-size: 12px;
  color: #999;
  font-family: monospace;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
