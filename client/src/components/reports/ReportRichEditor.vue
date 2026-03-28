<template>
  <div class="report-rich-editor">
    <ckeditor
      v-if="editor"
      :editor="editor"
      :model-value="modelValue"
      :disabled="disabled"
      :config="editorConfig"
      @update:model-value="$emit('update:modelValue', $event)"
    />
    <div v-else class="editor-loading">
      <div class="spinner"></div>
      <span>Loading editor...</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue';
import ClassicEditor from '@ckeditor/ckeditor5-build-classic';

defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false }
});

defineEmits(['update:modelValue']);

const editor = ref(null);

// CKEditor Classic build includes: heading, bold, italic, link, bulletedList, numberedList,
// indent, outdent, blockQuote, insertTable, imageUpload, undo, redo
const editorConfig = {
  toolbar: {
    items: [
      'undo', 'redo',
      '|',
      'heading',
      '|',
      'bold', 'italic',
      '|',
      'link', 'bulletedList', 'numberedList',
      '|',
      'indent', 'outdent',
      '|',
      'blockQuote', 'insertTable'
    ],
    shouldNotGroupWhenFull: false
  },
  heading: {
    options: [
      { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
      { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
      { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
      { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' }
    ]
  },
  placeholder: 'Start typing your report content...',
  removePlugins: ['MediaEmbed', 'MediaEmbedToolbar'],
  table: {
    contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells']
  }
};

onMounted(() => {
  editor.value = ClassicEditor;
});

onBeforeUnmount(() => {
  editor.value = null;
});
</script>

<style scoped>
.report-rich-editor {
  min-height: 200px;
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.report-rich-editor :deep(.ck-editor__editable) {
  min-height: 180px;
  font-size: 15px;
  line-height: 1.6;
  padding: 16px 20px;
}

.report-rich-editor :deep(.ck-editor__editable:not(.ck-editor__nested-editable)) {
  border: none;
}

.report-rich-editor :deep(.ck-toolbar) {
  border: none;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-tertiary);
}

.editor-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  gap: 12px;
  color: var(--text-secondary);
  font-size: 14px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-light);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
