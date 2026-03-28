<template>
  <div class="report-view">
    <div class="report-card">
      <header class="report-header">
        <div class="header-actions">
          <button
            v-if="showActions"
            type="button"
            class="btn btn-secondary"
            title="Save draft"
            @click="saveReport"
          >
            Save Draft
          </button>
          <button
            v-if="showActions"
            type="button"
            class="btn btn-primary"
            title="Submit for review"
            @click="submitReport"
          >
            Submit
          </button>
        </div>
        <h1 class="report-title">{{ date }} Daily Report</h1>
      </header>

      <div v-if="state === 5" class="status-badge status-approved">Approved</div>
      <div v-if="state === 2" class="status-badge status-pending">Pending</div>
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
import { ref, onMounted, nextTick, computed } from 'vue';
import { useAuthStore } from '../stores/auth';
import { getDailys, updateDaily } from '../services/daily';
import { useToast } from 'vue-toastification';
import ReportSectionCard from '../components/reports/ReportSectionCard.vue';

const toast = useToast();
const authStore = useAuthStore();

const report = ref(null);
const state = ref(0);
const date = ref(new Date().toLocaleDateString('en-CA'));

const STORAGE_KEY = `daily_titles_${authStore.user?.id || 'anon'}`;

const showActions = computed(() => [0, 1, 3, 4].includes(state.value));
const isEditable = computed(() => [0, 1, 3, 4].includes(state.value));

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

function saveTitlesToStorage() {
  if (!report.value) return;
  const titles = report.value.sections.map((s) => s.title);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(titles));
}

async function loadReport() {
  try {
    const res = await getDailys(authStore.user.id);
    let todayReport = res.data.find((r) => r.date.split('T')[0] === date.value);

    if (!todayReport) {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        todayReport = {
          state: 1,
          sections: [
            { title: 'Earning Money', notes: '' },
            { title: 'Catching Real Person', notes: '' },
            { title: 'Task Progress', notes: '' }
          ]
        };
      } else {
        const titles = JSON.parse(saved);
        todayReport = {
          state: 1,
          sections: titles.map((t) => ({ title: t, notes: '' }))
        };
      }
    }

    report.value = todayReport;
    state.value = todayReport.state;
  } catch (err) {
    toast.error('Failed to load report');
  }
}

async function saveReport() {
  try {
    await updateDaily(
      authStore.user.id,
      authStore.user.name,
      authStore.user.group,
      date.value,
      { sections: report.value.sections, state: 1 }
    );
    toast.success('Saved successfully');
    loadReport();
  } catch {
    toast.error('Save failed');
  }
}

async function submitReport() {
  try {
    await updateDaily(
      authStore.user.id,
      authStore.user.name,
      authStore.user.group,
      date.value,
      { sections: report.value.sections, state: 2 }
    );
    toast.success('Submitted successfully');
    saveTitlesToStorage();
    loadReport();
  } catch {
    toast.error('Submit failed');
  }
}

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
  gap: 12px;
  margin-bottom: var(--spacing-md);
}

.report-title {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
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

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-medium);
}

.btn-secondary:hover {
  background: var(--bg-secondary);
}

@media (max-width: 768px) {
  .report-view {
    padding: var(--spacing-md);
  }

  .header-actions {
    flex-direction: column;
  }
}
</style>
