<template>
  <div class="kubeflow-pipelines">
    <section class="header">
      <h1>Kubeflow Pipelines</h1>
      <p>Manage and execute ML workflows</p>
    </section>

    <section class="content">
      <div class="empty-state">
        <div class="empty-icon">⚙️</div>
        <h2>No Pipelines Created</h2>
        <p>Upload or create your first ML pipeline</p>
        <button class="btn btn-primary">Upload Pipeline</button>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
// Mockup page - Will be enhanced with pipeline management
</script>

<style scoped>
.kubeflow-pipelines {
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

.content {
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  padding: 48px 24px;
}

.empty-state {
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-state h2 {
  margin: 0 0 8px 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.empty-state p {
  margin: 0 0 24px 0;
  color: #666;
  font-size: 14px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: #0066cc;
  color: white;
}

.btn-primary:hover {
  background: #0052a3;
}
</style>
