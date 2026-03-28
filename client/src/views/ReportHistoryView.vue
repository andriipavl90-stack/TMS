<template>
  <div class="profiles-view">

    <!-- LEFT FILTER PANEL -->
    <div class="filters-section">
      <div class="filter-2group">
        <div class="filter-group">
          <label>Date From</label>
          <input
            v-model="filters.from"
            type="date"
            class="filter-input"
          />
        </div>

        <div class="filter-group">
          <label>Date To</label>
          <input
            v-model="filters.to"
            type="date"
            class="filter-input"
          />
        </div>
      </div>

      <div class="filter-3group">
        <label>Content</label>
        <input
          v-model="filters.content"
          type="text"
          placeholder="Search notes..."
          @input="debounceSearch"
          class="filter-input"
        />
      </div>
      <table class="styled-table">
        <thead>
          <tr>
            <th>No</th>
            <th>Date</th>
            <!-- <th>Abbreviations</th> -->
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(item, index) in filteredData"
            :key="item._id"
            @click="handleRowClick(item)"
          >
            <td>{{ index + 1 }}</td>
            <td>{{ formatDate(item.date) }}</td>
            <!-- <td>{{ getAbbreviations(item) }}</td> -->
          </tr>

          <tr v-if="filteredData.length === 0">
            <td colspan="4" class="no-data">No data found</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="report-panel">
      <DailyReportView v-if="s_reportId" :p_id="s_reportId" />
      <div v-else class="empty-state">
        <p>Select a report from the list to view or edit</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import DailyReportView from './DailyReportView_MemberChild.vue'
import { useAuthStore } from '../stores/auth';
import { getDailys } from '../services/daily.js';
import { useToast } from 'vue-toastification';

const toast = useToast();
const authStore = useAuthStore();
const loadingStats = ref(false);
const stats = ref([]);
const s_reportId = ref('');

const loadStats = async () => {
  loadingStats.value = true;
  try {
    const response = await getDailys(authStore.user.id);

    if (response.data) {
      stats.value = response.data;    
    }
  } catch (err) {
    console.error('Error loading stats:', err);
    toast.error('Failed to load database statistics');
  } finally {
    loadingStats.value = false;
  }
};
onMounted(() => {
  loadStats();
});


/* ------------------ FILTER STATE ------------------ */
const filters = ref({
  from: new Date().toLocaleDateString("en-CA"),
  to: new Date().toLocaleDateString("en-CA"),
  content: ""
})

/* ------------------ FORMAT DATE ------------------ */
const formatDate = (date) => {
  return new Date(date).toISOString().slice(0, 10)
}

/* ------------------ ABBREVIATION LOGIC ------------------ */
const abbreviate = (text) => {
  if (!text) return ""
  return text.length > 10 ? text.slice(0, 10) + "..." : text
}

const getAbbreviations = (item) => {
  if (!item.sections?.length) return ''
  return item.sections
    .map((s) => abbreviate(s.notes || s.title))
    .filter(Boolean)
    .join(' | ')
}

/* ------------------ FILTER LOGIC (OPTIMIZED) ------------------ */
const filteredData = computed(() => {
  return stats.value.filter((item) => {
    const itemDate = new Date(item.date)
    const from = new Date(filters.value.from)
    from.setHours(0, 0, 0, 0)
    const to = new Date(filters.value.to || filters.value.from)
    to.setHours(23, 59, 59, 999)

    const inDateRange = itemDate >= from && itemDate <= to

    let combinedNotes = ''
    if (item.sections?.length) {
      combinedNotes = item.sections
        .map((s) => `${s.title || ''} ${s.notes || ''}`)
        .join(' ')
        .toLowerCase()
    }

    const matchesContent =
      !filters.value.content.trim() ||
      combinedNotes.includes(filters.value.content.toLowerCase())

    return inDateRange && matchesContent
  })
})

/* ------------------ DEBOUNCE ------------------ */
let timeout = null
const debounceSearch = () => {
  clearTimeout(timeout)
  timeout = setTimeout(() => {}, 300)
}

/* ------------------ ROW CLICK ------------------ */
const handleRowClick = (item) => {
  // alert(item._id)
  s_reportId.value = item._id;
}
</script>

<style scoped>
.profiles-view {
  display: flex;
  flex-direction: row;
  gap: 24px;
  max-width: 95vw;
  min-width: 95vw;
  max-height: 85vh;
  min-height: 85vh;
}

.report-panel {
  flex: 1;
  min-width: 0;
  overflow: auto;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  border: 1px dashed var(--border-medium);
}

.empty-state p {
  color: var(--text-secondary);
  font-size: 1rem;
}

/* FILTER PANEL */
.filters-section {
  min-width: 20vw;
  max-width: 20vw;
  max-height: 80vh;
  min-height: 80vh;
  
  background: white;
  padding: 20px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.filter-group,
.filter-3group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.filter-2group {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 12px;
}

label {
  font-size: 12px;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
}

.filter-input {
  padding: 8px 10px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 14px;
  transition: 0.2s;
}

.filter-input:focus {
  outline: none;
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99,102,241,0.15);
}

/* TABLE */
.table-section {
  flex: 1;
  background: white;
  padding: 20px;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
}

.styled-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.styled-table thead {
  background: #f9fafb;
}

.styled-table th {
  text-align: left;
  padding: 12px;
  font-weight: 600;
  color: #374151;
  border-bottom: 2px solid #e5e7eb;
}

.styled-table td {
  padding: 12px;
  border-bottom: 1px solid #f1f5f9;
  color: #4b5563;
}

.styled-table tbody tr {
  cursor: pointer;
  transition: 0.2s;
}

.styled-table tbody tr:hover {
  background: #f3f4f6;
}

.no-data {
  text-align: center;
  padding: 20px;
  color: #9ca3af;
}

/* RESPONSIVE */
@media (max-width: 900px) {
  .profiles-view {
    flex-direction: column;
  }

  .filters-section {
    width: 100%;
  }
}
</style>