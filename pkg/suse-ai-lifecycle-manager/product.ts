import type { IPlugin } from '@shell/core/types';
import suseaiStore from './store/suseai-common';
import {
  PRODUCT,
  BLANK_CLUSTER,
  SUSEAI_PRODUCT,
  VIRTUAL_TYPES,
  BASIC_TYPES,
  PAGE_TYPES
} from './config/suseai';
import type { RancherStore } from './types/rancher-types';

export { PRODUCT } from './config/suseai';

export function init($plugin: IPlugin, store: RancherStore) {
  const { product, virtualType, basicType, weightType, weightGroup } = $plugin.DSL(store, PRODUCT);

  // Register store modules following standard patterns
  store.registerModule?.(PRODUCT, suseaiStore);

  // Configure product following standard patterns
  product({
    category: SUSEAI_PRODUCT.category,
    name: PRODUCT,
    icon: 'suseai',
    inStore: SUSEAI_PRODUCT.inStore,
    weight: SUSEAI_PRODUCT.weight,
    to: { 
      name: `c-cluster-${PRODUCT}-${PAGE_TYPES.APPS}`, 
      params: { product: PRODUCT, cluster: BLANK_CLUSTER }, 
      meta: { product: PRODUCT } 
    }
  });

  // Register virtual types following standard patterns
  VIRTUAL_TYPES.forEach(vType => {
    virtualType({
      name: vType.name,
      label: vType.label,
      route: vType.route
    });
  });

  // Register basic types (Apps at root level)
  basicType(BASIC_TYPES);

  // Register Kubeflow Admin sub-pages as a collapsible group
  basicType([
    PAGE_TYPES.KUBEFLOW_DEPLOYMENTS,
    PAGE_TYPES.KUBEFLOW_NOTEBOOKS,
    PAGE_TYPES.KUBEFLOW_PIPELINES,
    PAGE_TYPES.KUBEFLOW_SETTINGS
  ], 'kubeflow-admin-group');

  // Set weights for Kubeflow Admin sub-pages (ordering within group)
  weightType(PAGE_TYPES.KUBEFLOW_DEPLOYMENTS, 100, true);
  weightType(PAGE_TYPES.KUBEFLOW_NOTEBOOKS, 90, true);
  weightType(PAGE_TYPES.KUBEFLOW_PIPELINES, 80, true);
  weightType(PAGE_TYPES.KUBEFLOW_SETTINGS, 70, true);

  // Set weight for the Kubeflow Admin group (positioning in menu)
  weightGroup('kubeflow-admin-group', 75, true);
}
