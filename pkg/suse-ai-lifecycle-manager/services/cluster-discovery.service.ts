/**
 * Service for discovering Kubeflow clusters
 * Finds clusters that have both Dex (in auth namespace) and Kubeflow installed
 */

import type { RancherStore } from '../types/rancher-types';

export interface KubeflowCluster {
  id: string;
  name: string;
  dexNamespace: string;
  kubeflowNamespace: string;
  dexUrl?: string;
}

export class ClusterDiscoveryService {
  constructor(private store: RancherStore) {}

  /**
   * Find all clusters where both Dex and Kubeflow are installed and active
   */
  async discoverKubeflowClusters(): Promise<KubeflowCluster[]> {
    try {
      const clusters: KubeflowCluster[] = [];
      
      // Get all clusters - use the rancher/request dispatcher with proper endpoint
      let allClusters: any[] = [];
      try {
        const response = await this.apiRequest(`/v1/provisioning.cattle.io.clusters`);
        console.log('Raw response:', response);
        
        // Response format: { data: Array, links: {...}, type: "collection" }
        allClusters = response?.data || response?.items || [];
        console.log('Clusters from provisioning API:', allClusters.length, allClusters);
      } catch (error) {
        console.warn('Failed to get clusters from provisioning API, trying management API:', error);
        try {
          const response = await this.apiRequest(`/v1/management.cattle.io.clusters`);
          allClusters = response?.data?.items || response?.items || [];
          console.log('Clusters from management API:', allClusters.length, allClusters);
        } catch (e) {
          console.error('Failed to get clusters from both APIs:', e);
          return [];
        }
      }

      if (!allClusters || allClusters.length === 0) {
        console.warn('No clusters found in API response');
        return [];
      }
      
      for (const cluster of allClusters) {
        const clusterId = cluster.metadata?.name || cluster.id;
        if (!clusterId) {
          console.warn('Cluster has no ID:', cluster);
          continue;
        }

        console.log(`Checking cluster ${clusterId}...`);

        // Check if cluster has both Dex and Kubeflow
        const hasDex = await this.checkNamespaceWithActivePods(clusterId, 'auth', 'dex');
        const hasKubeflow = await this.checkNamespaceWithActivePods(clusterId, 'kubeflow');
        
        console.log(`Cluster ${clusterId}: Dex=${hasDex}, Kubeflow=${hasKubeflow}`);
        
        if (hasDex && hasKubeflow) {
          // Get display name from annotations
          const displayName = this.getClusterDisplayName(cluster);
          
          clusters.push({
            id: clusterId,
            name: displayName || cluster.metadata?.displayName || cluster.spec?.displayName || cluster.metadata?.name || clusterId,
            dexNamespace: 'auth',
            kubeflowNamespace: 'kubeflow'
          });
        }
      }
      
      console.log('Discovered Kubeflow clusters:', clusters);
      return clusters;
    } catch (error) {
      console.error('Error discovering Kubeflow clusters:', error);
      return [];
    }
  }

  /**
   * Extract cluster display name from annotations
   */
  private getClusterDisplayName(cluster: any): string | null {
    try {
      // Try to get from provisioning.cattle.io/management-cluster-display-name annotation
      const displayName = cluster.metadata?.annotations?.['provisioning.cattle.io/management-cluster-display-name'];
      return displayName || null;
    } catch (error) {
      console.debug('Error getting cluster display name:', error);
      return null;
    }
  }

  /**
   * Check if a namespace exists and has active pods
   */
  private async checkNamespaceWithActivePods(
    clusterId: string, 
    namespace: string, 
    labelSelector?: string
  ): Promise<boolean> {
    try {
      // First check if namespace exists using the correct API endpoint
      const namespacePath = `/k8s/clusters/${clusterId}/v1/namespaces/${namespace}`;
      const namespaceResponse = await this.apiRequest(namespacePath);

      // If namespace doesn't exist, return false
      if (!namespaceResponse || namespaceResponse.status === 404) {
        return false;
      }

      // Get pods from the namespace
      const podsPath = `/k8s/clusters/${clusterId}/api/v1/namespaces/${namespace}/pods`;
      const podsResponse = await this.apiRequest(podsPath);

      if (!podsResponse || !podsResponse.data?.items && !podsResponse.items) {
        return false;
      }

      // Filter by label if provided
      const items = podsResponse.data?.items || podsResponse.items || [];
      let pods = items;
      if (labelSelector) {
        pods = pods.filter((pod: any) => {
          const labels = pod.metadata?.labels || {};
          return labels['app'] === labelSelector || labels['k8s-app'] === labelSelector;
        });
      }

      // Check if any pod is running/active
      return pods.some((pod: any) => {
        const status = pod.status?.phase;
        return status === 'Running' || status === 'Pending';
      });
    } catch (error) {
      console.error(`Error checking namespace ${namespace}:`, error);
      return false;
    }
  }

  /**
   * Get Dex service URL for a cluster
   */
  async getDexUrl(clusterId: string): Promise<string | undefined> {
    try {
      // Try to get Dex service using correct API endpoint
      const servicesPath = `/k8s/clusters/${clusterId}/api/v1/namespaces/auth/services`;
      const servicesResponse = await this.apiRequest(servicesPath);

      const items = servicesResponse?.data?.items || servicesResponse?.items || [];
      const dexService = items.find(
        (svc: any) => svc.metadata?.name === 'dex'
      );

      if (!dexService) {
        return undefined;
      }

      // Construct URL from service
      const clusterUrl = await this.getClusterUrl(clusterId);
      return `${clusterUrl}/auth/dex`;
    } catch (error) {
      console.error('Error getting Dex URL:', error);
      return undefined;
    }
  }

  /**
   * Make an API request using the store's request method
   */
  private async apiRequest(path: string, method = 'GET', data?: any): Promise<any> {
    console.log(`API Request: ${method} ${path}`);
    try {
      // Try using rancher/request if available
      if (this.store.dispatch) {
        try {
          console.log(`Trying rancher/request for ${path}...`);
          const result = await this.store.dispatch('rancher/request', {
            method,
            url: path,
            data
          });
          console.log(`rancher/request succeeded for ${path}:`, result);
          return result;
        } catch (e1) {
          console.debug(`rancher/request failed for ${path}:`, e1);
          // Fallback to request action
          try {
            console.log(`Trying request for ${path}...`);
            const result = await this.store.dispatch('request', {
              method,
              url: path,
              data
            });
            console.log(`request succeeded for ${path}:`, result);
            return result;
          } catch (e2) {
            console.debug(`Both request methods failed for ${path}:`, e1, e2);
            throw e2;
          }
        }
      }
      throw new Error('Store dispatch method not available');
    } catch (error) {
      console.error(`API request failed for ${path}:`, error);
      throw error;
    }
  }

  /**
   * Get the cluster's base URL
   */
  private async getClusterUrl(clusterId: string): Promise<string> {
    try {
      // Get cluster details to find its URL
      const clusterPath = `/k8s/clusters/${clusterId}/v1/clusters/${clusterId}`;
      const clusterResponse = await this.apiRequest(clusterPath);
      
      // Try to extract URL from cluster object
      const clusterData = clusterResponse?.data || clusterResponse;
      if (clusterData?.spec?.kubeConfig?.clusters?.[0]?.cluster?.server) {
        return clusterData.spec.kubeConfig.clusters[0].cluster.server;
      }
    } catch (error) {
      console.debug('Could not get cluster URL from API:', error);
    }
    
    // Fallback to default pattern
    return `https://cluster.${clusterId}`;
  }
}

export default ClusterDiscoveryService;
