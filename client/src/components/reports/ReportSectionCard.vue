<template>
  <div class="report-section-card">
    <div class="section-header">
      <input
        v-if="editable"
        :value="title"
        type="text"
        class="section-title-input"
        placeholder="Section title"
        @input="$emit('update:title', $event.target.value)"
      />
      <h3 v-else class="section-title">{{ title }}</h3>
      <button
        v-if="editable && showRemove"
        type="button"
        class="btn-remove-section"
        title="Remove section"
        @click="$emit('remove')"
      >
        Remove
      </button>
    </div>
    <div class="section-content">
      <ReportRichEditor
        :model-value="modelValue"
        :disabled="!editable"
        @update:model-value="$emit('update:modelValue', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import ReportRichEditor from './ReportRichEditor.vue';

defineProps({
  title: { type: String, default: '' },
  modelValue: { type: String, default: '' },
  editable: { type: Boolean, default: true },
  showRemove: { type: Boolean, default: true }
});

defineEmits(['update:title', 'update:modelValue', 'remove']);
</script>

<style scoped>
.report-section-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: var(--spacing-lg);
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
}

.section-title {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--text-primary);
}

.section-title-input {
  flex: 1;
  padding: 8px 12px;
  font-size: 1rem;
  font-weight: 600;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  background: var(--bg-primary);
  color: var(--text-primary);
}

.section-title-input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
}

.btn-remove-section {
  padding: 6px 12px;
  font-size: 0.875rem;
  color: var(--color-error);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-remove-section:hover {
  background: rgba(239, 68, 68, 0.2);
}

.section-content {
  padding: 0;
}
</style>
