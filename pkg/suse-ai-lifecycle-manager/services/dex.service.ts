/**
 * Service for managing Dex users
 * Reads and updates users from Dex ConfigMap in the auth namespace
 */

import type { RancherStore } from '../types/rancher-types';
import YAML from 'js-yaml';
import bcryptjs from 'bcryptjs';

export interface DexUser {
  email: string;
  password: string; // hashed in ConfigMap
  username: string;
  userID: string;
  groups?: string[];
  profileName?: string; // Kubeflow Profile name
}

export interface KubeflowProfile {
  metadata: {
    name: string;
    [key: string]: any;
  };
  spec: {
    owner: {
      kind: string;
      name: string;
    };
    [key: string]: any;
  };
}

export interface DexUserInput {
  email: string;
  password: string;
  username: string;
}

interface DexConfig {
  issuer?: string;
  enablePasswordDB?: boolean;
  staticPasswords?: Array<{
    email: string;
    hash?: string;
    hashFromEnv?: string;
    username: string;
    userID: string;
    groups?: string[];
  }>;
  staticClients?: any[];
  [key: string]: any;
}

export class DexService {
  private clusterId: string;
  private configMapName = 'dex';
  private configMapNamespace = 'auth';
  private configMapKey = 'config.yaml';

  constructor(private store: RancherStore, clusterId: string) {
    this.clusterId = clusterId;
  }

  /**
   * Get all local users from Dex ConfigMap
   */
  async getLocalUsers(): Promise<DexUser[]> {
    try {
      console.log('[DexService] getLocalUsers() called for cluster:', this.clusterId);
      
      const configMap = await this.getDexConfigMap();
      console.log('[DexService] getDexConfigMap returned:', { 
        configMapExists: !!configMap,
        configMapKeys: configMap ? Object.keys(configMap) : [],
        configMapData: configMap?.data ? 'exists' : 'missing'
      });
      
      if (!configMap) {
        console.warn('[DexService] ConfigMap is null/undefined, returning empty users array');
        return [];
      }

      // Try multiple ways to extract the config.yaml
      let configData = configMap.data?.[this.configMapKey];
      
      // Fallback 1: Check if data IS the config section directly
      if (!configData && configMap['config.yaml']) {
        console.log('[DexService] Config.yaml found directly in configMap (no data wrapper)');
        configData = configMap['config.yaml'];
      }
      
      // Fallback 2: Check if there's a nested data.data structure
      if (!configData && configMap.data?.data?.[this.configMapKey]) {
        console.log('[DexService] Config.yaml found in nested data.data structure');
        configData = configMap.data.data[this.configMapKey];
      }
      
      // Fallback 3: If configMap looks like it might be just the data section, try direct access
      if (!configData && typeof configMap === 'object' && !('apiVersion' in configMap) && !('kind' in configMap)) {
        console.log('[DexService] ConfigMap might be the data section directly, trying direct access');
        configData = configMap[this.configMapKey];
      }
      
      console.log('[DexService] Config data retrieved:', {
        keyExists: !!configData,
        dataLength: configData?.length || 0,
        dataPreview: configData?.substring(0, 200) || 'NO DATA',
        configMapHasData: !!configMap.data,
        configMapDataKeys: configMap?.data ? Object.keys(configMap.data) : [],
        configMapDataType: typeof configMap?.data
      });
      
      if (!configData) {
        console.warn('[DexService] No config data found at key:', this.configMapKey);
        console.warn('[DexService] Available keys in configMap.data:', configMap?.data ? Object.keys(configMap.data) : 'no data object');
        console.warn('[DexService] Available keys in configMap:', configMap ? Object.keys(configMap).slice(0, 20) : 'no configMap');
        console.warn('[DexService] Full configMap structure:', JSON.stringify(configMap, null, 2).substring(0, 500));
        return [];
      }

      // Parse YAML to find staticPasswords section
      const users = this.parseUsersFromConfig(configData);
      console.log('[DexService] Users parsed successfully:', users.length, 'users found');
      return users;
    } catch (error) {
      console.error('[DexService] Error getting local users:', error);
      return [];
    }
  }

  /**
   * Create a new local user in Dex
   */
  async createUser(user: DexUserInput): Promise<DexUser> {
    try {
      const configMap = await this.getDexConfigMap();
      if (!configMap) {
        throw new Error('Dex ConfigMap not found');
      }

      console.log('ConfigMap retrieved:', { configMap, hasData: !!configMap.data });
      
      // Ensure data object exists
      if (!configMap.data) {
        configMap.data = {};
      }

      const configData = configMap.data[this.configMapKey] || '';
      
      // Add user to config
      const updatedConfig = this.addUserToConfig(configData, user);
      
      // Update ConfigMap
      configMap.data[this.configMapKey] = updatedConfig;
      console.log('Updated ConfigMap data, about to save');
      await this.updateDexConfigMap(configMap);

      // Trigger rollout of Dex deployment
      await this.rolloutDexDeployment();

      return {
        email: user.email,
        password: user.password,
        username: user.username,
        userID: this.generateUserID(user.email)
      };
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  /**
   * Update an existing local user
   */
  async updateUser(email: string, updates: Partial<DexUserInput>): Promise<DexUser> {
    try {
      const configMap = await this.getDexConfigMap();
      if (!configMap) {
        throw new Error('Dex ConfigMap not found');
      }

      // Ensure data object exists
      if (!configMap.data) {
        configMap.data = {};
      }

      const configData = configMap.data[this.configMapKey] || '';
      
      // Update user in config
      const updatedConfig = this.updateUserInConfig(configData, email, updates);
      
      // Update ConfigMap
      configMap.data[this.configMapKey] = updatedConfig;
      await this.updateDexConfigMap(configMap);

      // Trigger rollout of Dex deployment
      await this.rolloutDexDeployment();

      return {
        email: updates.email || email,
        password: updates.password || '***',
        username: updates.username || '',
        userID: this.generateUserID(updates.email || email)
      };
    } catch (error) {
      console.error('Error updating user:', error);
      throw error;
    }
  }

  /**
   * Delete a local user from Dex
   */
  async deleteUser(email: string): Promise<void> {
    try {
      const configMap = await this.getDexConfigMap();
      if (!configMap) {
        throw new Error('Dex ConfigMap not found');
      }

      // Ensure data object exists
      if (!configMap.data) {
        configMap.data = {};
      }

      const configData = configMap.data[this.configMapKey] || '';
      
      // Remove user from config
      const updatedConfig = this.removeUserFromConfig(configData, email);
      
      // Update ConfigMap
      configMap.data[this.configMapKey] = updatedConfig;
      await this.updateDexConfigMap(configMap);

      // Trigger rollout of Dex deployment
      await this.rolloutDexDeployment();
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Get all Kubeflow Profiles
   */
  async getKubeflowProfiles(): Promise<KubeflowProfile[]> {
    try {
      // Use the path provided by the user: k8s/clusters/{cluster id}/v1/kubeflow.org.profiles
      const resourcePath = 'kubeflow.org.profiles';
      const url = `/k8s/clusters/${encodeURIComponent(this.clusterId)}/v1/${resourcePath}`;
      console.log('[DexService] Fetching Kubeflow Profiles from:', url);
      
      const response = await this.apiRequest(url, 'GET');
      
      // Handle Rancher list response structure
      const items = response?.data || response?.items || [];
      
      console.log(`[DexService] Found ${items.length} profiles`);
      return items as KubeflowProfile[];
    } catch (error) {
      console.error('[DexService] Error getting Kubeflow Profiles:', error);
      return [];
    }
  }

  /**
   * Get Dex ConfigMap
   */
  private async getDexConfigMap(): Promise<any> {
    try {
      // Use the direct v1 API path format: /v1/configmaps/{namespace}/{name}
      const resourcePath = `configmaps/${this.configMapNamespace}/${this.configMapName}`;
      const url = `/k8s/clusters/${encodeURIComponent(this.clusterId)}/v1/${resourcePath}`;
      console.log('[DexService] Fetching ConfigMap from:', url);
      
      const response = await this.apiRequest(url, 'GET');
      
      console.log('[DexService] ConfigMap API response structure:', { 
        isNull: response === null,
        isUndefined: response === undefined,
        type: response ? typeof response : 'null',
        hasData: !!response?.data,
        responseKeys: response ? Object.keys(response).slice(0, 10) : [],
        dataType: response?.data ? typeof response.data : 'N/A',
        dataKeys: response?.data ? Object.keys(response.data).slice(0, 10) : [],
        configYamlKey: response?.data?.['config.yaml'] ? 'EXISTS' : 'MISSING',
        configYamlLength: response?.data?.['config.yaml']?.length || 0
      });
      
      // Log the actual data structure more clearly
      console.log('[DexService] Response data section:', response?.data);
      
      let configMap = response;
      
      // Check if response is an Axios/Wrapper object (has data property but is NOT a K8s resource)
      // A K8s ConfigMap will have 'kind', 'apiVersion', 'metadata', and 'data'.
      // An Axios response will have 'data', 'status', 'headers'.
      if (response && 'data' in response && 'status' in response && !('kind' in response)) {
        console.log('[DexService] Unwrapping Axios/Network response');
        configMap = response.data;
      } else {
        console.log('[DexService] Response appears to be the resource directly');
      }
      
      console.log('[DexService] Returning configMap:', { 
        isPresent: !!configMap,
        hasMetadata: !!configMap?.metadata,
        hasData: !!configMap?.data,
        dataKeys: configMap?.data ? Object.keys(configMap.data) : [],
        configYamlPresent: !!configMap?.data?.['config.yaml']
      });
      
      return configMap;
    } catch (error) {
      console.error('[DexService] Error getting Dex ConfigMap:', {
        error,
        errorType: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : 'No message'
      });
      return null;
    }
  }

  /**
   * Update Dex ConfigMap
   */
  private async updateDexConfigMap(configMap: any): Promise<void> {
    try {
      // Use the direct v1 API path format: /v1/configmaps/{namespace}/{name}
      const resourcePath = `configmaps/${this.configMapNamespace}/${this.configMapName}`;
      const url = `/k8s/clusters/${encodeURIComponent(this.clusterId)}/v1/${resourcePath}`;
      await this.apiRequest(url, 'PUT', configMap);
    } catch (error) {
      console.error('Error updating Dex ConfigMap:', error);
      throw error;
    }
  }

  /**
   * Trigger rollout of Dex deployment
   */
  private async rolloutDexDeployment(): Promise<void> {
    try {
      // Use the correct API path for deployments: /apis/apps/v1/namespaces/{namespace}/deployments/{name}
      const resourcePath = `apis/apps/v1/namespaces/${this.configMapNamespace}/deployments/dex`;
      const deploymentUrl = `/k8s/clusters/${encodeURIComponent(this.clusterId)}/${resourcePath}`;
      
      console.log('[DexService] Rolling out deployment:', deploymentUrl);

      // Get current deployment
      const deployment = await this.apiRequest(deploymentUrl, 'GET');
      const deploymentData = deployment?.data || deployment;

      // Update deployment to trigger rollout (update annotation)
      const now = new Date().toISOString();
      
      if (!deploymentData.spec) {
        throw new Error('Deployment spec is missing');
      }

      if (!deploymentData.spec.template.metadata.annotations) {
        deploymentData.spec.template.metadata.annotations = {};
      }
      deploymentData.spec.template.metadata.annotations['kubectl.kubernetes.io/restartedAt'] = now;

      // Update deployment
      await this.apiRequest(deploymentUrl, 'PUT', deploymentData);
    } catch (error) {
      console.error('Error rolling out Dex deployment:', error);
      // Don't throw - rollout failure shouldn't prevent user creation
    }
  }

  /**
   * Make an API request using the store's request method
   */
  private async apiRequest(path: string, method = 'GET', data?: any): Promise<any> {
    try {
      // Try using rancher/request if available
      if (this.store.dispatch) {
        try {
          const result = await this.store.dispatch('rancher/request', {
            method,
            url: path,
            data
          });
          return result;
        } catch (e1) {
          // Fallback to request action
          try {
            const result = await this.store.dispatch('request', {
              method,
              url: path,
              data
            });
            return result;
          } catch (e2) {
            console.debug('Both request methods failed:', e1, e2);
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
   * Parse users from Dex config YAML
   * Handles both 'hash' and 'hashFromEnv' formats
   */
  private parseUsersFromConfig(configData: string): DexUser[] {
    const users: DexUser[] = [];
    
    try {
      console.log('[DexService] Parsing YAML config, data length:', configData?.length);
      
      // Handle empty config data
      if (!configData || configData.trim().length === 0) {
        console.warn('[DexService] Empty Dex config data');
        return users;
      }

      // Parse YAML configuration
      const config = YAML.load(configData) as DexConfig;
      
      console.log('[DexService] YAML parsed successfully:', {
        configExists: !!config,
        configKeys: config ? Object.keys(config) : [],
        hasStaticPasswords: !!config?.staticPasswords,
        passwordsLength: config?.staticPasswords?.length || 0
      });
      
      if (!config || !config.staticPasswords || !Array.isArray(config.staticPasswords)) {
        console.warn('[DexService] No staticPasswords section found in Dex config');
        return users;
      }

      // Extract users from staticPasswords
      config.staticPasswords.forEach((userEntry, idx) => {
        console.log(`[DexService] Processing user ${idx}:`, {
          email: userEntry.email,
          hasUsername: !!userEntry.username,
          hasHash: !!userEntry.hash,
          hasHashFromEnv: !!userEntry.hashFromEnv
        });
        
        if (userEntry.email) {
          users.push({
            email: userEntry.email,
            password: '***', // Password is hashed/env ref, don't expose
            username: userEntry.username || this.generateUsernameFromEmail(userEntry.email),
            userID: userEntry.userID || this.generateUserID(userEntry.email),
            groups: userEntry.groups
          });
        }
      });

      console.log(`[DexService] Parsed ${users.length} users from Dex config`);
    } catch (error) {
      console.error('[DexService] Error parsing YAML config:', error, {
        errorType: error instanceof Error ? error.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : 'No message'
      });
      // Return empty array on parse error
    }

    return users;
  }

  /**
   * Add user to Dex config
   */
  private addUserToConfig(configData: string, user: DexUserInput): string {
    try {
      console.log('Adding user to config, configData length:', configData?.length);
      
      // Handle empty config data - initialize with default structure
      let config: DexConfig;
      if (!configData || configData.trim().length === 0) {
        console.warn('Empty config data, initializing with default structure');
        config = {
          issuer: 'http://dex.auth.svc.cluster.local:5556/dex',
          enablePasswordDB: true,
          staticPasswords: [],
          staticClients: []
        };
      } else {
        // Parse current config
        const parsed = YAML.load(configData) as DexConfig;
        if (!parsed) {
          console.error('Failed to parse YAML config, initializing with defaults', { configData: configData.substring(0, 300) });
          config = {
            issuer: 'http://dex.auth.svc.cluster.local:5556/dex',
            enablePasswordDB: true,
            staticPasswords: [],
            staticClients: []
          };
        } else {
          config = parsed;
        }
      }
      
      // Ensure staticPasswords array exists
      if (!config.staticPasswords) {
        config.staticPasswords = [];
      }

      // Check if user already exists
      const existingUserIndex = config.staticPasswords.findIndex(u => u.email === user.email);
      if (existingUserIndex !== -1) {
        throw new Error(`User with email ${user.email} already exists`);
      }

      // Hash the password
      const hashedPassword = bcryptjs.hashSync(user.password, 10);

      // Add new user
      config.staticPasswords.push({
        email: user.email,
        hash: hashedPassword,
        username: user.username,
        userID: this.generateUserID(user.email)
      });

      // Convert back to YAML preserving structure
      return this.configToYaml(config);
    } catch (error) {
      console.error('Error adding user to config:', error);
      throw error;
    }
  }

  /**
   * Update user in Dex config
   */
  private updateUserInConfig(
    configData: string, 
    email: string, 
    updates: Partial<DexUserInput>
  ): string {
    try {
      console.log('Updating user in config, configData length:', configData?.length);
      
      // Parse current config
      const parsed = YAML.load(configData) as DexConfig;
      
      if (!parsed || !parsed.staticPasswords) {
        throw new Error('No staticPasswords section found in config');
      }
      
      const config = parsed;

      // Find user
      const userIndex = config.staticPasswords!.findIndex(u => u.email === email);
      if (userIndex === -1) {
        throw new Error(`User with email ${email} not found`);
      }

      const user = config.staticPasswords![userIndex];

      // Update fields
      if (updates.email) {
        user.email = updates.email;
      }
      if (updates.username) {
        user.username = updates.username;
      }
      if (updates.password) {
        // Hash the new password
        user.hash = bcryptjs.hashSync(updates.password, 10);
        // Remove hashFromEnv if it exists
        if (user.hashFromEnv) {
          delete user.hashFromEnv;
        }
      }

      // Convert back to YAML preserving structure
      return this.configToYaml(config);
    } catch (error) {
      console.error('Error updating user in config:', error);
      throw error;
    }
  }

  /**
   * Remove user from Dex config
   */
  private removeUserFromConfig(configData: string, email: string): string {
    try {
      console.log('Removing user from config, configData length:', configData?.length);
      
      // Parse current config
      const parsed = YAML.load(configData) as DexConfig;
      
      if (!parsed || !parsed.staticPasswords) {
        throw new Error('No staticPasswords section found in config');
      }
      
      const config = parsed;

      // Find and remove user
      const userIndex = config.staticPasswords!.findIndex(u => u.email === email);
      if (userIndex === -1) {
        throw new Error(`User with email ${email} not found`);
      }

      config.staticPasswords!.splice(userIndex, 1);

      // Convert back to YAML preserving structure
      return this.configToYaml(config);
    } catch (error) {
      console.error('Error removing user from config:', error);
      throw error;
    }
  }

  /**
   * Convert config object back to YAML string with proper formatting
   */
  private configToYaml(config: DexConfig): string {
    const yamlStr = YAML.dump(config, {
      indent: 2,
      lineWidth: -1, // Prevent line wrapping
      quotingType: '"',
      noRefs: true
    });
    
    return yamlStr;
  }

  /**
   * Generate a user ID from email
   */
  private generateUserID(email: string): string {
    // Generate a timestamp-based user ID similar to Kubernetes conventions
    return Date.now().toString();
  }

  /**
   * Generate a username from email
   */
  private generateUsernameFromEmail(email: string): string {
    // Extract the part before @ and use it as username
    return email.split('@')[0];
  }
}

export default DexService;

