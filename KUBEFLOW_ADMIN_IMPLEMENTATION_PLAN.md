# Kubeflow Admin Menu Implementation Plan
**SUSE AI Lifecycle Manager Rancher Extension**

**Document Status:** Planning Phase  
**Date:** February 6, 2026  
**Workspace Root:** `/Users/alessandrofesta/Documents/innovation`

---

## Executive Summary

This document outlines the implementation strategy for adding a new "Kubeflow Admin" menu to the SUSE AI Lifecycle Manager Rancher Extension. The menu will be positioned under the "Apps" section and include four submenu items: Deployments, Notebooks, Pipelines, and Settings.

The implementation leverages Rancher Extension DSL patterns for navigation and follows the existing architecture of the suse-ai-lifecycle-manager extension.

---

## 1. Architecture Overview

### 1.1 Rancher Extension Pattern
The implementation follows Rancher Extension best practices:
- **Product-level Extension**: Extends existing product (suse-ai-lifecycle-manager)
- **Route Structure**: `c-cluster-{product}-{page}` pattern for cluster-level navigation
- **Menu Management**: Using Rancher DSL (`virtualType`, `basicType`, `weightType`, `weightGroup`)
- **Navigation**: Hierarchical menu structure with parent-child relationships

### 1.2 Current Architecture Structure
```
suse-ai-lifecycle-manager/
├── pkg/suse-ai-lifecycle-manager/
│   ├── index.ts                    # Entry point
│   ├── product.ts                  # Product & menu registration
│   ├── routing.ts                  # Vue routes
│   ├── config/
│   │   ├── suseai.ts              # Central config (PAGE_TYPES, NAVIGATION_ITEMS, etc)
│   │   └── ...                     # Other configs
│   ├── pages/                      # Vue components for pages
│   │   ├── Apps.vue
│   │   ├── Install.vue
│   │   ├── Manage.vue
│   │   └── components/
│   ├── l10n/
│   │   └── en-us.json             # Translations
│   └── ...
```

### 1.3 Kubeflow Admin Menu Structure
```
SUSE AI Lifecycle Manager
├── Apps (existing)
├── Install (existing)
├── Manage (existing)
├── Repositories (existing)
├── Settings (existing)
└── Kubeflow Admin (NEW - top-level menu item)
    ├── Deployments          (sub-page)
    ├── Notebooks            (sub-page)
    ├── Pipelines            (sub-page)
    └── Settings             (sub-page)
```

---

## 2. Implementation Phases

### Phase 1: Configuration & Types
**Objective:** Define new configuration constants and types for Kubeflow Admin functionality.

#### 2.1.1 Update `config/suseai.ts`
**File:** `pkg/suse-ai-lifecycle-manager/config/suseai.ts`

**Changes:**
1. Add new page type constants:
   - `KUBEFLOW_ADMIN: 'kubeflow-admin'` (parent/redirect page)
   - `KUBEFLOW_DEPLOYMENTS: 'kubeflow-deployments'`
   - `KUBEFLOW_NOTEBOOKS: 'kubeflow-notebooks'`
   - `KUBEFLOW_PIPELINES: 'kubeflow-pipelines'`
   - `KUBEFLOW_SETTINGS: 'kubeflow-settings'`

2. Add Kubeflow Admin configuration:
```typescript
export const KUBEFLOW_ADMIN_WEIGHT = 75;  // Weight for top-level menu positioning

export const KUBEFLOW_ADMIN_SUBPAGE_WEIGHTS = {
  DEPLOYMENTS: 100,
  NOTEBOOKS: 90,
  PIPELINES: 80,
  SETTINGS: 70
};
```

3. Extend `NAVIGATION_ITEMS` array with:
   - Main Kubeflow Admin menu item (for top-level navigation)
   - Child items for each sub-page (deployments, notebooks, pipelines, settings)

4. Extend `VIRTUAL_TYPES` array to include virtual type definitions for:
   - Kubeflow Admin parent page (redirects to deployments)
   - All 4 sub-pages

5. Update `BASIC_TYPES` array to include sub-page names for menu registration

#### 2.1.2 Create `config/kubeflow-admin.ts` (Optional)
**File:** `pkg/suse-ai-lifecycle-manager/config/kubeflow-admin.ts`

**Purpose:** Centralize Kubeflow Admin-specific configuration

**Content:**
- Menu structure constants
- Submenu definitions
- Feature flags for Kubeflow Admin
- Kubeflow-specific labels and translations

**Example Structure:**
```typescript
export const KUBEFLOW_ADMIN_CONFIG = {
  displayName: 'Kubeflow Admin',
  icon: 'chart',
  weight: 200,
  submenus: [
    { name: 'deployments', label: 'Deployments', icon: 'deployment', weight: 100 },
    { name: 'notebooks', label: 'Notebooks', icon: 'file', weight: 90 },
    { name: 'pipelines', label: 'Pipelines', icon: 'pipeline', weight: 80 },
    { name: 'settings', label: 'Settings', icon: 'gear', weight: 70 }
  ]
};
```

### Phase 2: Routing Configuration
**Objective:** Define Vue routes for all Kubeflow Admin pages.

#### 2.2.1 Update `routing.ts`
**File:** `pkg/suse-ai-lifecycle-manager/routing.ts`

**Changes:**
1. Import new page components (to be created)
2. Add route definitions following the pattern:
   ```typescript
   {
     name: `c-cluster-${PRODUCT}-kubeflow-admin-{submenu}`,
     path: `/c/:cluster/${PRODUCT}/kubeflow-admin/{submenu}`,
     component: () => import('./pages/kubeflow-admin/{SubmenuPage}.vue'),
     props: true,
     meta: { product: PRODUCT, category: 'kubeflow-admin' }
   }
   ```

3. Define routes for:
   - Parent route: `c-cluster-{product}-kubeflow-admin` → redirect to deployments
   - Deployments: `c-cluster-{product}-kubeflow-admin-deployments`
   - Notebooks: `c-cluster-{product}-kubeflow-admin-notebooks`
   - Pipelines: `c-cluster-{product}-kubeflow-admin-pipelines`
   - Settings: `c-cluster-{product}-kubeflow-admin-settings`

---

### Phase 3: Product & Menu Registration
**Objective:** Register menu items with Rancher DSL.

#### 2.3.1 Update `product.ts`
**File:** `pkg/suse-ai-lifecycle-manager/product.ts`

**Changes:**
1. Create virtual types using `virtualType()` for:
   - Kubeflow Admin parent page (name: 'kubeflow-admin')
   - Deployments sub-page
   - Notebooks sub-page
   - Pipelines sub-page
   - Settings sub-page

2. Register top-level menu item using `basicType()`:
   ```typescript
   basicType([PAGE_TYPES.KUBEFLOW_ADMIN]);
   ```
   This registers Kubeflow Admin as a top-level menu item (same level as Apps, etc.)

3. Register sub-pages using `basicType()` (as child items of Kubeflow Admin):
   ```typescript
   basicType(
     [
       PAGE_TYPES.KUBEFLOW_DEPLOYMENTS,
       PAGE_TYPES.KUBEFLOW_NOTEBOOKS,
       PAGE_TYPES.KUBEFLOW_PIPELINES,
       PAGE_TYPES.KUBEFLOW_SETTINGS
     ]
   );
   ```

4. Apply weights to sub-pages using `weightType()`:
   ```typescript
   weightType(PAGE_TYPES.KUBEFLOW_DEPLOYMENTS, 100, true);
   weightType(PAGE_TYPES.KUBEFLOW_NOTEBOOKS, 90, true);
   weightType(PAGE_TYPES.KUBEFLOW_PIPELINES, 80, true);
   weightType(PAGE_TYPES.KUBEFLOW_SETTINGS, 70, true);
   ```

5. Apply weight to top-level Kubeflow Admin menu using `weightType()`:
   ```typescript
   weightType(PAGE_TYPES.KUBEFLOW_ADMIN, 75, true);  // Position between existing menu items
   ```

---

### Phase 4: Pages & Components
**Objective:** Create Vue components for all Kubeflow Admin pages.

#### 2.4.1 Create Page Components
**Directory:** `pkg/suse-ai-lifecycle-manager/pages/kubeflow-admin/`

**Files to Create:**
1. `KubeflowAdmin.vue` (Parent container, optional)
2. `KubeflowDeployments.vue` - List and manage Kubeflow deployments
3. `KubeflowNotebooks.vue` - List and manage Jupyter notebooks
4. `KubeflowPipelines.vue` - List and manage Kubeflow pipelines
5. `KubeflowSettings.vue` - Configuration and settings for Kubeflow Admin

**Base Component Structure (for each page):**
```vue
<template>
  <div class="kubeflow-{page}">
    <SectionHeader :title="title" :description="description" />
    <!-- Page-specific content -->
  </div>
</template>

<script setup lang="ts">
// Standard composition setup
defineProps({
  // Page-specific props
});

const title = 'Page Title';
const description = 'Page description';

// Page-specific logic and methods
</script>

<style scoped>
/* Component-specific styles */
</style>
```

#### 2.4.2 Create Page Sub-components
**Directory:** `pkg/suse-ai-lifecycle-manager/pages/kubeflow-admin/components/`

**Components per page:**

**Deployments Page:**
- `DeploymentsList.vue` - Table listing deployments
- `DeploymentDetail.vue` - Details view for a single deployment
- `DeploymentForm.vue` - Form for creating/editing deployments

**Notebooks Page:**
- `NotebooksList.vue` - Table listing notebooks
- `NotebookDetail.vue` - Details view for a single notebook
- `NotebookForm.vue` - Form for creating/editing notebooks

**Pipelines Page:**
- `PipelinesList.vue` - Table listing pipelines
- `PipelineDetail.vue` - Details view for a single pipeline
- `PipelineForm.vue` - Form for creating/editing pipelines

**Settings Page:**
- `SettingsForm.vue` - Settings configuration form
- `SettingsValidation.vue` - Settings validation component

### Phase 5: Localization (i18n)
**Objective:** Add translations for all Kubeflow Admin menu items and pages.

#### 2.5.1 Update `l10n/en-us.json`
**File:** `pkg/suse-ai-lifecycle-manager/l10n/en-us.json`

**Changes:**
Add translations under `suseai` object:
```json
{
  "suseai": {
    "nav": {
      "kubeflowAdmin": "Kubeflow Admin"
    },
    "kubeflowAdmin": {
      "title": "Kubeflow Admin",
      "description": "Manage Kubeflow deployments, notebooks, pipelines, and settings",
      
      "deployments": {
        "title": "Deployments",
        "subtitle": "Manage Kubeflow model deployments",
        "columns": {
          "name": "Name",
          "status": "Status",
          "replicas": "Replicas",
          "created": "Created"
        },
        "actions": {
          "deploy": "Deploy Model",
          "update": "Update",
          "delete": "Delete",
          "logs": "View Logs"
        }
      },
      
      "notebooks": {
        "title": "Notebooks",
        "subtitle": "Manage Jupyter notebooks",
        "columns": {
          "name": "Name",
          "status": "Status",
          "namespace": "Namespace",
          "created": "Created"
        },
        "actions": {
          "create": "Create Notebook",
          "connect": "Connect",
          "delete": "Delete",
          "logs": "View Logs"
        }
      },
      
      "pipelines": {
        "title": "Pipelines",
        "subtitle": "Manage Kubeflow pipelines",
        "columns": {
          "name": "Name",
          "status": "Status",
          "runs": "Runs",
          "created": "Created"
        },
        "actions": {
          "create": "Create Pipeline",
          "run": "Run Pipeline",
          "delete": "Delete",
          "logs": "View Logs"
        }
      },
      
      "settings": {
        "title": "Kubeflow Admin Settings",
        "subtitle": "Configure Kubeflow components and features",
        "sections": {
          "general": "General Settings",
          "components": "Enabled Components",
          "resources": "Resource Configuration",
          "advanced": "Advanced Settings"
        }
      },
      
      "common": {
        "status": {
          "running": "Running",
          "pending": "Pending",
          "failed": "Failed",
          "stopped": "Stopped",
          "unknown": "Unknown"
        },
        "messages": {
          "deploymentSuccess": "Successfully deployed",
          "deploymentFailed": "Deployment failed",
          "deletionConfirm": "Are you sure you want to delete this item?"
        }
      }
    }
  }
}
```

### Phase 6: Styling & UX
**Objective:** Ensure consistent UI/UX with existing components.

#### 2.6.1 Component Styling
- Create shared styles in `style/kubeflow-admin.scss`
- Use existing SUSE AI design tokens
- Implement responsive design for all pages
- Follow Rancher UI guidelines

#### 2.6.2 Common Components Integration
- Use existing `SectionHeader` component
- Integrate with `ClusterResourceTable` for listings
- Use established form components for data input

---

## 3. File Structure Summary

### Files to Create
```
pkg/suse-ai-lifecycle-manager/
├── config/
│   └── kubeflow-admin.ts                    (Optional, can inline in suseai.ts)
├── pages/
│   └── kubeflow-admin/
│       ├── KubeflowDeployments.vue
│       ├── KubeflowNotebooks.vue
│       ├── KubeflowPipelines.vue
│       ├── KubeflowSettings.vue
│       └── components/
│           ├── DeploymentsList.vue
│           ├── NotebooksList.vue
│           ├── PipelinesList.vue
│           └── SettingsForm.vue
├── style/
│   └── kubeflow-admin.scss                  (Optional, can add to existing styles)
└── l10n/
    └── en-us.json                           (Update existing)
```

### Files to Update
```
pkg/suse-ai-lifecycle-manager/
├── index.ts                                 (No changes needed)
├── product.ts                               (Register virtual types and menus)
├── routing.ts                               (Add route definitions)
├── config/
│   └── suseai.ts                           (Add constants and configurations)
└── l10n/
    └── en-us.json                          (Add translations)
```

---

## 4. Implementation Timeline

| Phase | Task | Estimated Effort | Dependencies |
|-------|------|-----------------|--------------|
| Phase 1 | Configuration & Types | 2-3 hours | None |
| Phase 2 | Routing Configuration | 1-2 hours | Phase 1 |
| Phase 3 | Product & Menu Registration | 1-2 hours | Phase 1, 2 |
| Phase 4 | Pages & Components (MVP) | 6-8 hours | Phase 1, 2, 3 |
| Phase 5 | Localization | 2-3 hours | Phase 4 |
| Phase 6 | Styling & Polish | 3-4 hours | Phase 4, 5 |
| Testing | Integration & E2E Tests | 2-3 hours | All phases |
| Documentation | README & inline docs | 1-2 hours | All phases |

**Total Estimated Effort:** 18-28 hours

---

## 5. Technical Considerations

### 5.1 Rancher DSL API Usage
The implementation uses the following Rancher DSL functions:
- `virtualType()` - Define virtual page types
- `basicType()` - Register items in side menu
- `weightType()` - Set menu item ordering
- `weightGroup()` - Set group ordering

### 5.2 Route Naming Convention
Following Rancher patterns:
- **Pattern:** `c-cluster-{product}-{page}`
- **Product:** `suseai`
- **Pages:** `kubeflow-admin-deployments`, `kubeflow-admin-notebooks`, etc.

### 5.3 Menu Structure (Rancher Terminology)
- **Group:** Collection of related menu items (Kubeflow Admin group)
- **Menu Item:** Individual navigation entry (Deployments, Notebooks, etc.)
- **Weight:** Numeric value for ordering (higher = appears above lower)

### 5.4 Type Safety
- Use TypeScript interfaces for configuration objects
- Define types for component props
- Leverage `@rancher/auto-import` for model auto-discovery

### 5.5 Store Integration (Optional)
If state management is needed:
- Create `store/kubeflow-admin.ts` module
- Register in `product.ts` alongside existing store registration
- Use for caching Kubeflow resources

---

## 6. Development Workflow

### 6.1 Prerequisites
- Node.js & npm/yarn installed
- Development environment set up per project README
- Rancher dashboard running locally or accessible
- Understanding of Vue 3 & TypeScript

### 6.2 Local Development Steps
1. Update configuration files (Phase 1)
2. Update routing (Phase 2)
3. Update product registration (Phase 3)
4. Create page components incrementally (Phase 4)
5. Add translations (Phase 5)
6. Style components (Phase 6)
7. Test in local Rancher instance
8. Build and verify extension

### 6.3 Testing Strategy
- Component unit tests (Jest/Vitest)
- Menu rendering tests
- Route navigation tests
- Translation key validation
- Integration tests with Rancher dashboard

---

## 7. Future Enhancements

### 7.1 Phase 2 Features
1. **Deployment Management:**
   - Create/update/delete deployments
   - Manage replica sets
   - View logs and metrics

2. **Notebook Management:**
   - Create notebook instances
   - Connect to notebook servers
   - Manage persistent storage

3. **Pipeline Management:**
   - Upload and execute pipelines
   - Monitor pipeline runs
   - View pipeline logs and artifacts

4. **Advanced Settings:**
   - Custom resource definitions
   - Namespace configuration
   - Resource quotas and limits

### 7.2 Extended Features
- Kubeflow pipeline visualization
- Notebook terminal access
- Real-time deployment metrics
- Audit logging integration
- Multi-language support (additional locales)
- Dark/Light theme support

---

## 8. Key Files Reference

### Configuration Files
- **suseai.ts:** Product configuration, page types, navigation items
- **kubeflow-admin.ts (optional):** Kubeflow-specific configuration

### Component Files
- **product.ts:** Menu and virtual type registration
- **routing.ts:** Vue route definitions
- **Pages/*.vue:** Vue page components

### Localization
- **en-us.json:** English translations for all UI text

### Styling
- **style/*.scss:** Component and global styles

---

## 9. Approval Checklist

Before proceeding to implementation, verify:

- [ ] Rancher Extension documentation reviewed
- [ ] Current project architecture understood
- [ ] Kubeflow Admin functionality requirements clarified
- [ ] Menu structure confirmed with stakeholders
- [ ] Translation keys reviewed and approved
- [ ] Development environment ready
- [ ] This implementation plan reviewed and approved

---

## 10. Next Steps

After approval of this plan:

1. **Phase 1:** Begin with configuration updates
2. **Phase 2:** Implement routing
3. **Phase 3:** Register product & menus
4. **Phase 4:** Create page components
5. **Phase 5:** Add translations
6. **Phase 6:** Style components
7. **Testing:** Comprehensive testing
8. **Documentation:** Complete inline documentation
9. **Build & Deployment:** Package and deploy extension

---

**Document Version:** 1.0  
**Last Updated:** February 6, 2026  
**Author:** AI Assistant  
**Status:** Ready for Implementation
