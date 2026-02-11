# Kubeflow Admin Architecture Diagram

## Menu Structure
```
SUSE AI Lifecycle Manager (Product)
├── Applications (existing)
├── Install (existing)
├── Manage (existing)
├── Repositories (existing)
├── Settings (existing)
└── Kubeflow Admin (NEW - top-level menu item) ←────────────────┐
    ├── Deployments (sub-page)                                  │ Parent routes to
    │   └── Components: DeploymentsList, Detail, Form           │ first sub-page
    ├── Notebooks (sub-page)
    │   └── Components: NotebooksList, Detail, Form
    ├── Pipelines (sub-page)
    │   └── Components: PipelinesList, Detail, Form
    └── Settings (sub-page)
        └── Components: SettingsForm, Validation
```

## Vue Router Structure
```
/c/:cluster/suseai
├── /apps (Apps.vue) - existing
├── /install (Install.vue) - existing
├── /manage (Manage.vue) - existing
├── /repositories (Apps.vue placeholder) - existing
├── /settings (Apps.vue placeholder) - existing
└── /kubeflow-admin (NEW - top-level, redirects to /kubeflow-admin/deployments)
    ├── /kubeflow-admin/deployments → KubeflowDeployments.vue
    ├── /kubeflow-admin/notebooks → KubeflowNotebooks.vue
    ├── /kubeflow-admin/pipelines → KubeflowPipelines.vue
    └── /kubeflow-admin/settings → KubeflowSettings.vue
```

## File Organization
```
suse-ai-lifecycle-manager/
├── pkg/suse-ai-lifecycle-manager/
│   ├── index.ts (entry point - no changes)
│   ├── product.ts (UPDATE - register virtual types & menus)
│   ├── routing.ts (UPDATE - add kubeflow-admin routes)
│   │
│   ├── config/
│   │   ├── suseai.ts (UPDATE - add PAGE_TYPES, VIRTUAL_TYPES, etc)
│   │   └── kubeflow-admin.ts (CREATE - optional, kubeflow-specific config)
│   │
│   ├── pages/
│   │   └── kubeflow-admin/ (NEW - all kubeflow pages)
│   │       ├── KubeflowDeployments.vue
│   │       ├── KubeflowNotebooks.vue
│   │       ├── KubeflowPipelines.vue
│   │       ├── KubeflowSettings.vue
│   │       └── components/
│   │           ├── DeploymentsList.vue
│   │           ├── DeploymentDetail.vue
│   │           ├── DeploymentForm.vue
│   │           ├── NotebooksList.vue
│   │           ├── NotebookDetail.vue
│   │           ├── NotebookForm.vue
│   │           ├── PipelinesList.vue
│   │           ├── PipelineDetail.vue
│   │           ├── PipelineForm.vue
│   │           └── SettingsForm.vue
│   │
│   ├── l10n/
│   │   └── en-us.json (UPDATE - add translations)
│   │
│   ├── style/
│   │   └── kubeflow-admin.scss (optional - styling)
│   │
│   └── types/ (existing - may need updates for new types)
└── Chart.yaml (may need version bump)
```

## Data Flow

```
User Interaction
    ↓
Router: c-cluster-suseai-kubeflow-admin-{submenu}
    ↓
Page Component (e.g., KubeflowDeployments.vue)
    ↓
Sub-components (DeploymentsList, DeploymentForm)
    ↓
Rancher Store / API
    ↓
Kubernetes API (via Rancher)
    ↓
Kubeflow Resources
```

## Component Hierarchy

```
KubeflowDeployments.vue (Page)
├── SectionHeader
├── DeploymentsList.vue (Main List)
│   └── ClusterResourceTable (from existing)
└── DeploymentForm.vue (Conditional)
```

## Configuration Flow

```
suseai.ts (Central Configuration)
├── PAGE_TYPES (defines kubeflow-admin pages)
├── NAVIGATION_ITEMS (menu structure)
└── VIRTUAL_TYPES (page definitions)
    ↓
product.ts (Registration)
├── virtualType() - Register pages
├── basicType() - Add to menu
├── weightType() - Order items
└── weightGroup() - Order groups
    ↓
Menu Output in Rancher Dashboard
```

## Implementation Dependency Graph

```
Phase 1: Config & Types
    ↓
Phase 2: Routing ← (depends on Phase 1)
    ↓
Phase 3: Product Registration ← (depends on Phase 1, 2)
    ↓
Phase 4: Components (Pages) ← (depends on Phase 1, 2, 3)
    ↓
Phase 5: Localization ← (depends on Phase 4)
    ↓
Phase 6: Styling ← (depends on Phase 4, 5)
    ↓
Testing & Documentation
```

## Translation Key Hierarchy

```
suseai
├── nav
│   └── kubeflowAdmin: "Kubeflow Admin"
└── kubeflowAdmin
    ├── title
    ├── description
    ├── deployments
    │   ├── title
    │   ├── columns
    │   └── actions
    ├── notebooks
    │   ├── title
    │   ├── columns
    │   └── actions
    ├── pipelines
    │   ├── title
    │   ├── columns
    │   └── actions
    └── settings
        ├── title
        └── sections
```

## Type Definitions

```
PAGE_TYPES.KUBEFLOW_ADMIN = 'kubeflow-admin'

KUBEFLOW_SUBMENU_TYPES:
├── DEPLOYMENTS = 'kubeflow-deployments'
├── NOTEBOOKS = 'kubeflow-notebooks'
├── PIPELINES = 'kubeflow-pipelines'
└── SETTINGS = 'kubeflow-settings'

Route Names:
├── c-cluster-suseai-kubeflow-admin-deployments
├── c-cluster-suseai-kubeflow-admin-notebooks
├── c-cluster-suseai-kubeflow-admin-pipelines
└── c-cluster-suseai-kubeflow-admin-settings
```

## Rancher DSL Integration Points

```
$extension.DSL(store, 'suseai')
├── virtualType() - Defines page types
│   ├── KubeflowDeployments
│   ├── KubeflowNotebooks
│   ├── KubeflowPipelines
│   └── KubeflowSettings
├── basicType() - Registers in side menu (with group)
│   └── group: 'kubeflow-admin-group'
├── weightType() - Orders menu items (100, 90, 80, 70)
└── weightGroup() - Orders groups (weight: 200)
```

## Menu Rendering Order (with weights)

```
Rancher Dashboard
├── SUSE AI (product - top level)
│   ├── Applications (weight: default)
│   ├── Install (weight: default)
│   ├── Manage (weight: default)
│   ├── Repositories (weight: default)
│   ├── Settings (weight: default)
│   └── Kubeflow Admin (weight: 75) ← positioned here
│       ├── Deployments (weight: 100)
│       ├── Notebooks (weight: 90)
│       ├── Pipelines (weight: 80)
│       └── Settings (weight: 70)
```
