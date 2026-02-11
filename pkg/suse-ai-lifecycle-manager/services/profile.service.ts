/**
 * Service for managing Kubeflow Profiles
 * CRUD operations for kubeflow.org.profiles
 */

import type { RancherStore } from '../types/rancher-types';

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

export interface ProfileInput {
  name: string;
  ownerEmail: string;
}

export interface Contributor {
  email: string;
  role: string;
  namespace: string;
}

export class ProfileService {
  private clusterId: string;
  private resourcePath = 'kubeflow.org.profiles';

  constructor(private store: RancherStore, clusterId: string) {
    this.clusterId = clusterId;
  }

  /**
   * Get all Kubeflow Profiles
   */
  async getProfiles(): Promise<KubeflowProfile[]> {
    try {
      const url = `/k8s/clusters/${encodeURIComponent(this.clusterId)}/v1/${this.resourcePath}`;
      console.log('[ProfileService] Fetching profiles from:', url);
      
      const response = await this.apiRequest(url, 'GET');
      const items = response?.data || response?.items || [];
      
      console.log(`[ProfileService] Found ${items.length} profiles`);
      return items as KubeflowProfile[];
    } catch (error) {
      console.error('[ProfileService] Error getting profiles:', error);
      return [];
    }
  }

  /**
   * Create a new Kubeflow Profile
   */
  async createProfile(input: ProfileInput): Promise<KubeflowProfile> {
    try {
      const url = `/k8s/clusters/${encodeURIComponent(this.clusterId)}/v1/${this.resourcePath}`;
      
      const profile = {
        apiVersion: 'kubeflow.org/v1',
        kind: 'Profile',
        metadata: {
          name: input.name
        },
        spec: {
          owner: {
            kind: 'User',
            name: input.ownerEmail
          }
        }
      };

      console.log('[ProfileService] Creating profile:', profile);
      const response = await this.apiRequest(url, 'POST', profile);
      return response as KubeflowProfile;
    } catch (error) {
      console.error('[ProfileService] Error creating profile:', error);
      throw error;
    }
  }

  /**
   * Update a Kubeflow Profile
   * Note: Usually only the owner can be updated for a profile
   */
  async updateProfile(name: string, ownerEmail: string): Promise<KubeflowProfile> {
    try {
      const url = `/k8s/clusters/${encodeURIComponent(this.clusterId)}/v1/${this.resourcePath}/${name}`;
      
      // First get existing profile to have resourceVersion
      const existing = await this.apiRequest(url, 'GET');
      
      const update = {
        ...existing,
        spec: {
          ...existing.spec,
          owner: {
            kind: 'User',
            name: ownerEmail
          }
        }
      };

      console.log('[ProfileService] Updating profile:', update);
      const response = await this.apiRequest(url, 'PUT', update);
      return response as KubeflowProfile;
    } catch (error) {
      console.error('[ProfileService] Error updating profile:', error);
      throw error;
    }
  }

  /**
   * Delete a Kubeflow Profile
   */
  async deleteProfile(name: string): Promise<void> {
    try {
      const url = `/k8s/clusters/${encodeURIComponent(this.clusterId)}/v1/${this.resourcePath}/${name}`;
      console.log('[ProfileService] Deleting profile:', name);
      await this.apiRequest(url, 'DELETE');
    } catch (error) {
      console.error('[ProfileService] Error deleting profile:', error);
      throw error;
    }
  }

  /**
   * Get contributors for a profile (namespace)
   * Fetches RoleBindings in the profile namespace
   */
  async getContributors(namespace: string): Promise<Contributor[]> {
    try {
      // List RoleBindings in the namespace
      const url = `/k8s/clusters/${encodeURIComponent(this.clusterId)}/apis/rbac.authorization.k8s.io/v1/namespaces/${namespace}/rolebindings`;
      console.log(`[ProfileService] Fetching contributors (RoleBindings) for ${namespace}:`, url);
      
      const response = await this.apiRequest(url, 'GET');
      const items = response?.data || response?.items || [];
      
      const contributors: Contributor[] = [];
      
      items.forEach((rb: any) => {
        // Look for RoleBindings that grant access to users
        // Usually these bind 'kubeflow-edit' or similar roles
        if (rb.subjects) {
          rb.subjects.forEach((subject: any) => {
            if (subject.kind === 'User' || subject.kind === 'Group') { // Typically User for email
               // Filter out the owner if needed, but showing everyone with access is usually better
               contributors.push({
                 email: subject.name,
                 role: rb.roleRef.name, // e.g. 'kubeflow-edit'
                 namespace: namespace
               });
            }
          });
        }
      });
      
      console.log(`[ProfileService] Found ${contributors.length} contributors in ${namespace}`);
      return contributors;
    } catch (error) {
      console.error(`[ProfileService] Error getting contributors for ${namespace}:`, error);
      return [];
    }
  }

  /**
   * Add a contributor to a profile
   * Creates a RoleBinding in the profile namespace
   */
  async addContributor(namespace: string, email: string, role = 'kubeflow-edit'): Promise<void> {
    try {
      const url = `/k8s/clusters/${encodeURIComponent(this.clusterId)}/apis/rbac.authorization.k8s.io/v1/namespaces/${namespace}/rolebindings`;
      
      // Sanitize email for resource name
      const sanitizedEmail = email.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      // Ensure the name matches the pattern used by Kubeflow: user-{sanitizedEmail}-clusterrole-edit
      const bindingName = `user-${sanitizedEmail}-clusterrole-edit`;
      
      const roleBinding = {
        apiVersion: 'rbac.authorization.k8s.io/v1',
        kind: 'RoleBinding',
        metadata: {
          name: bindingName,
          namespace: namespace,
          annotations: {
            role: 'edit',
            user: email
          }
        },
        roleRef: {
          apiGroup: 'rbac.authorization.k8s.io',
          kind: 'ClusterRole',
          // Kubeflow seems to standardize on 'kubeflow-edit' for the clusterrole-edit binding
          name: 'kubeflow-edit'
        },
        subjects: [
          {
            apiGroup: 'rbac.authorization.k8s.io',
            kind: 'User',
            name: email
          }
        ]
      };

      console.log(`[ProfileService] Adding contributor ${email} to ${namespace} with role ${role}`);
      await this.apiRequest(url, 'POST', roleBinding);

      // Also create AuthorizationPolicy if role is kubeflow-edit
      if (role === 'kubeflow-edit') {
        await this.createAuthorizationPolicy(namespace, email);
      }
    } catch (error) {
      console.error('[ProfileService] Error adding contributor:', error);
      throw error;
    }
  }

  /**
   * Create AuthorizationPolicy for contributor
   * Allows access through Istio Ingress Gateway
   */
  async createAuthorizationPolicy(namespace: string, email: string): Promise<void> {
    try {
      const url = `/k8s/clusters/${encodeURIComponent(this.clusterId)}/apis/security.istio.io/v1/namespaces/${namespace}/authorizationpolicies`;
      
      const sanitizedEmail = email.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const policyName = `user-${sanitizedEmail}-clusterrole-edit`;
      
      const policy = {
        apiVersion: 'security.istio.io/v1',
        kind: 'AuthorizationPolicy',
        metadata: {
          name: policyName,
          namespace: namespace,
          annotations: {
            role: 'edit',
            user: email
          }
        },
        spec: {
          rules: [
            {
              from: [
                {
                  source: {
                    principals: [
                      'cluster.local/ns/istio-system/sa/istio-ingressgateway-service-account',
                      'cluster.local/ns/kubeflow/sa/ml-pipeline-ui'
                    ]
                  }
                }
              ],
              when: [
                {
                  key: 'request.headers[kubeflow-userid]',
                  values: [email]
                }
              ]
            }
          ]
        }
      };

      console.log(`[ProfileService] Creating AuthorizationPolicy ${policyName} for ${email} in ${namespace}`);
      await this.apiRequest(url, 'POST', policy);
    } catch (error) {
      console.error('[ProfileService] Error creating AuthorizationPolicy:', error);
      // Don't throw here, as RoleBinding might have succeeded
    }
  }

  /**
   * Delete AuthorizationPolicy for contributor
   */
  async deleteAuthorizationPolicy(namespace: string, email: string): Promise<void> {
    try {
      const sanitizedEmail = email.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      const policyName = `user-${sanitizedEmail}-clusterrole-edit`;
      
      const url = `/k8s/clusters/${encodeURIComponent(this.clusterId)}/apis/security.istio.io/v1/namespaces/${namespace}/authorizationpolicies/${policyName}`;
      
      console.log(`[ProfileService] Deleting AuthorizationPolicy ${policyName}`);
      await this.apiRequest(url, 'DELETE');
    } catch (error) {
      console.error('[ProfileService] Error deleting AuthorizationPolicy:', error);
      // Warning only, resource might not exist
    }
  }

  /**
   * Remove a contributor from a profile
   * Deletes the RoleBinding and AuthorizationPolicy
   */
  async removeContributor(namespace: string, email: string, role: string): Promise<void> {
    try {
      // 1. Remove AuthorizationPolicy
      if (role === 'kubeflow-edit') {
        await this.deleteAuthorizationPolicy(namespace, email);
      }

      // 2. Remove RoleBinding
      const sanitizedEmail = email.replace(/[^a-z0-9]/gi, '-').toLowerCase();
      
      // Construct the expected binding name based on our standardized pattern
      const standardBindingName = `user-${sanitizedEmail}-clusterrole-edit`;
      
      try {
        const urlDelete = `/k8s/clusters/${encodeURIComponent(this.clusterId)}/apis/rbac.authorization.k8s.io/v1/namespaces/${namespace}/rolebindings/${standardBindingName}`;
        console.log(`[ProfileService] Removing contributor (deleting RoleBinding ${standardBindingName})`);
        await this.apiRequest(urlDelete, 'DELETE');
        return; // Success
      } catch (deleteError) {
        console.warn(`[ProfileService] Failed to delete RoleBinding by standard name ${standardBindingName}, trying to search...`);
      }

      // Fallback: Find binding by listing if standard name failed (e.g. legacy bindings)
      const urlList = `/k8s/clusters/${encodeURIComponent(this.clusterId)}/apis/rbac.authorization.k8s.io/v1/namespaces/${namespace}/rolebindings`;
      const response = await this.apiRequest(urlList, 'GET');
      const items = response?.data || response?.items || [];
      
      let bindingName = '';
      
      for (const rb of items) {
        if (rb.roleRef.name === role && rb.subjects) {
          const subject = rb.subjects.find((s: any) => s.kind === 'User' && s.name === email);
          if (subject) {
             bindingName = rb.metadata.name;
             break;
          }
        }
      }
      
      if (!bindingName) {
        console.warn(`[ProfileService] Could not find RoleBinding for user ${email} with role ${role} in ${namespace}`);
        return; // Already gone?
      }

      const urlDelete = `/k8s/clusters/${encodeURIComponent(this.clusterId)}/apis/rbac.authorization.k8s.io/v1/namespaces/${namespace}/rolebindings/${bindingName}`;
      console.log(`[ProfileService] Removing contributor (deleting RoleBinding ${bindingName})`);
      await this.apiRequest(urlDelete, 'DELETE');
      
    } catch (error) {
      console.error('[ProfileService] Error removing contributor:', error);
      throw error;
    }
  }

  /**
   * Make an API request using the store's request method
   */
  private async apiRequest(path: string, method = 'GET', data?: any): Promise<any> {
    try {
      if (this.store.dispatch) {
        try {
          const result = await this.store.dispatch('rancher/request', {
            method,
            url: path,
            data
          });
          return result;
        } catch (e1) {
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
}
