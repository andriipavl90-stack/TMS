<template>
  <div class="report-view">
    <div class="report-card">
      <header class="report-header">
        <div class="header-actions">
          <button
            v-if="state < 5"
            type="button"
            class="btn btn-primary"
            title="Approve report"
            @click="approveReport"
          >
            Approve
          </button>
          <button
            v-if="state < 5"
            type="button"
            class="btn btn-danger"
            title="Reject report"
            @click="rejectReport"
          >
            Reject
          </button>
          <label class="edit-toggle">
            <input v-model="editableEnabled" type="checkbox" />
            <span>Edit mode</span>
          </label>
        </div>
        <h1 class="report-title">{{ date }} Daily Report</h1>
      </header>

      <div v-if="state === 5" class="status-badge status-approved">Approved</div>
      <div v-if="state === 2" class="status-badge status-pending">Awaiting Review</div>
      <div v-if="[3, 4].includes(state)" class="status-badge status-rejected">Rejected</div>

      <div v-if="report" class="report-body">
        <button
          v-if="showActions"
          type="button"
          class="btn-add-section"
          title="Add section"
          @click="addSection"
        >
          + Add Section
        </button>

        <div class="sections-list">
          <ReportSectionCard
            v-for="(section, index) in report.sections"
            :key="index"
            :title="section.title"
            :model-value="section.notes"
            :editable="isEditable"
            :show-remove="showActions && report.sections.length > 1"
            @update:title="(v) => updateSectionTitle(index, v)"
            @update:model-value="(v) => updateSectionNotes(index, v)"
            @remove="removeSection(section.title)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, computed, watch } from 'vue';
import { useAuthStore } from '../composables/useAuth';
import { updateDaily, getTeam } from '../services/daily';
import { useToast } from 'vue-toastification';
import ReportSectionCard from '../components/reports/ReportSectionCard.vue';

const props = defineProps({
  p_id: { type: String, default: '' }
});

const toast = useToast();
const authStore = useAuthStore();

const report = ref(null);
const selectedReport = ref(null);
const state = ref(0);
const date = ref(new Date().toLocaleDateString('en-CA'));
const editableEnabled = ref(false);

const showActions = computed(() => editableEnabled.value);
const isEditable = computed(() => editableEnabled.value);

function updateSectionTitle(index, value) {
  if (report.value?.sections?.[index]) {
    report.value.sections[index].title = value;
  }
}

function updateSectionNotes(index, value) {
  if (report.value?.sections?.[index]) {
    report.value.sections[index].notes = value;
  }
}

function addSection() {
  if (!report.value?.sections) return;
  report.value.sections.push({ title: 'New Section', notes: '' });
}

function removeSection(title) {
  if (!report.value?.sections) return;
  report.value.sections = report.value.sections.filter((s) => s.title !== title);
}

async function loadReport() {
  try {
    const response = await getTeam(authStore.user.group);
    if (!response.data) return;

    let item = null;
    if (props.p_id && props.p_id !== '') {
      item = response.data.find((r) => r._id === props.p_id);
      selectedReport.value = item;
    } else {
      item = response.data.find((r) => r.date.split('T')[0] === date.value && r.state > 1);
    }
    if (!item) return;

    report.value = item;
    selectedReport.value = item;
    state.value = item.state;
    date.value = item.date?.split?.('T')[0] || date.value;
  } catch (err) {
    toast.error('Failed to load report');
  }
}

async function approveReport() {
  try {
    const r = selectedReport.value || report.value;
    await updateDaily(r.userId, r.username, r.group, r.date?.split?.('T')[0], {
      sections: report.value.sections,
      state: 5
    });
    toast.success('Report approved');
    loadReport();
  } catch {
    toast.error('Approve failed');
  }
}

async function rejectReport() {
  try {
    const r = selectedReport.value || report.value;
    await updateDaily(r.userId, r.username, r.group, r.date?.split?.('T')[0], {
      sections: report.value.sections,
      state: 3
    });
    toast.success('Report rejected');
    loadReport();
  } catch {
    toast.error('Reject failed');
  }
}

watch(() => props.p_id, () => {
  editableEnabled.value = false;
  loadReport();
});
onMounted(loadReport);
</script>

<style scoped>
.report-view {
  width: 100%;
  max-width: 900px;
  margin: 0 auto;
  padding: var(--spacing-lg);
}

.report-card {
  background: var(--bg-primary);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-md);
  border: 1px solid var(--border-light);
  padding: var(--spacing-xl);
  position: relative;
  min-height: 400px;
}

.report-header {
  text-align: center;
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: 2px solid var(--border-light);
}

.header-actions {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 16px;
  margin-bottom: var(--spacing-md);
}

.report-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.edit-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.875rem;
  color: var(--text-secondary);
  cursor: pointer;
}

.edit-toggle input {
  cursor: pointer;
}

.status-badge {
  position: absolute;
  top: 20px;
  right: 20px;
  padding: 6px 16px;
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.status-approved {
  background: rgba(34, 197, 94, 0.15);
  color: #16a34a;
}

.status-pending {
  background: rgba(59, 130, 246, 0.15);
  color: #2563eb;
}

.status-rejected {
  background: rgba(239, 68, 68, 0.15);
  color: #dc2626;
}

.report-body {
  position: relative;
}

.btn-add-section {
  display: block;
  width: 100%;
  padding: 12px 20px;
  margin-bottom: var(--spacing-lg);
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-primary);
  background: rgba(99, 102, 241, 0.08);
  border: 1px dashed var(--color-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
}

.btn-add-section:hover {
  background: rgba(99, 102, 241, 0.15);
}

.sections-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.btn {
  padding: 10px 20px;
  font-size: 0.9375rem;
  font-weight: 500;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s;
  border: none;
}

.btn-primary {
  background: var(--color-primary);
  color: white;
}

.btn-primary:hover {
  filter: brightness(1.1);
}

.btn-danger {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.btn-danger:hover {
  background: rgba(239, 68, 68, 0.2);
}

@media (max-width: 768px) {
  .report-view {
    padding: var(--spacing-md);
  }

  .header-actions {
    flex-wrap: wrap;
  }
}
</style>
