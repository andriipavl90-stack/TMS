<template>
  <div class="profiles-view">

    <!-- LEFT FILTER PANEL -->
    <div class="filters-section">
      <div class="filter-2group">
        <div class="filter-group">
          <label>Date</label>
          <input
            v-model="filters.from"
            type="date"
            class="filter-input"
          />
        </div>

        <!-- <div class="filter-group">
          <label>Date To</label>
          <input
            v-model="filters.to"
            type="date"
            class="filter-input"
          />
        </div> -->
      </div>
      <div class="btn-group" style="width:100%">
        <button
          :style="{ width: groups.length ? `${100 / (groups.length + 1)}%` : '28%' }"
          :class="{ active: filters.group === 'All' }"
          @click="filters.group = 'All'"
        >
          All
        </button>

        <button
          v-for="g in groups"
          :key="g.code"
          :style="{ width: groups.length ? `${100 / (groups.length + 1)}%` : '18%' }"
          :class="{ active: filters.group === g.code }"
          @click="filters.group = g.code"
        >
          {{ g.name.replace(/Group\s*/i, 'G') || g.code.replace('GROUP_', 'G') }}
          <span v-if="getFilteredCountForGroup(g.code)">❗</span>
        </button>
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
            <!-- <th>Date</th> -->
            <th>Name</th>
            <!-- <th>Abbreviations</th> -->
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="(item, index) in filteredData"
            :key="item._id"
            @click="handleRowClick(item)"
          >
            <td>{{ index + 1 }}</td>
            <!-- <td>{{ formatDate(item.date) }}</td> -->
            <td><b>{{ (item.username) }}</b></td>
            <!-- <td>{{ getAbbreviations(item) }}</td> -->
            <td :style="{ color: STATE_LABELS[item.state]?.color || '#6b7280' }">
              {{ STATE_LABELS[item.state]?.text || '—' }}
            </td>
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
        <p>Select a report from the list to review</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import DailyReportView from './DailyReportView_ManagerChild.vue'
import { useAuthStore } from '../stores/auth.js';
import { getAll } from '../services/daily.js';
import { fetchGroups } from '../services/admin.js';
import { useToast } from 'vue-toastification';

const toast = useToast();
const authStore = useAuthStore();
const groups = ref([]);
const loadingStats = ref(false);
const stats = ref([]);
const s_reportId = ref('');
const STATE_LABELS = {
  4: { text: 'Rejected', color: '#dc2626' },
  5: { text: 'Awaiting', color: '#2563eb' },
  6: { text: 'Approved', color: '#16a34a' }
}

const loadStats = async () => {
  loadingStats.value = true;
  try {
    const response = await getAll();

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
const loadGroups = async () => {
  try {
    const res = await fetchGroups();
    groups.value = res?.data?.groups || res?.groups || [];
  } catch (err) {
    groups.value = [];
  }
};

const getFilteredCountForGroup = (code) => {
  return stats.value.filter((item) => {
    const itemDate = new Date(item.date);
    const from = new Date(filters.value.from);
    from.setHours(0, 0, 0, 0);
    const to = new Date(filters.value.from);
    to.setHours(23, 59, 59, 999);
    const st = item.state;
    const grp = item.group;
    const inDateRange = itemDate >= from && itemDate <= to && st >= 5 && st < 6;
    const matchesGroup = grp === code;
    return inDateRange && matchesGroup;
  }).length;
};

onMounted(() => {
  loadStats();
  loadGroups();
});


/* ------------------ FILTER STATE ------------------ */
const filters = ref({
  from: new Date().toLocaleDateString("en-CA"),
  to: new Date().toLocaleDateString("en-CA"),
  content: "",
  group: "All"
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
  if (!item.sections?.length) return '';
  return item.sections
    .map((s) => abbreviate(s.notes || s.title))
    .filter(Boolean)
    .join(' | ');
}

/* ------------------ FILTER LOGIC (OPTIMIZED) ------------------ */

const filteredData = computed(() => {
  return stats.value.filter((item) => {
    const itemDate = new Date(item.date);
    const from = new Date(filters.value.from);
    from.setHours(0, 0, 0, 0);
    const to = new Date(filters.value.to || filters.value.from);
    to.setHours(23, 59, 59, 999);
    const st = item.state;
    const grp = item.group;

    const inDateRange = itemDate >= from && itemDate <= to && st > 4;

    let combinedNotes = '';
    if (item.sections?.length) {
      combinedNotes = item.sections
        .map((s) => `${s.title || ''} ${s.notes || ''}`)
        .join(' ')
        .toLowerCase();
    }

    const matchesContent =
      !filters.value.content.trim() ||
      combinedNotes.includes(filters.value.content.toLowerCase());

    const matchesGroup =
      filters.value.group === 'All' || grp === filters.value.group;

    return inDateRange && matchesContent && matchesGroup;
  });
});



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
  width: 99%;
  gap: 6px;
}

.filter-2group {
  display: flex;
  flex-direction: row;
  justify-content: space-around;
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

.btn-group button {
  background-color: #ffffff; /* Green background */
  border: 1px solid rgba(5, 5, 5, 0.13); /* Green border */
  color: rgb(12, 12, 12); /* White text */  
  padding: 10px 24px; /* Some padding */
  cursor: pointer; /* Pointer/hand icon */
  float: left; /* Float the buttons side by side */
}

/* Clear floats (clearfix hack) */
.btn-group:after {
  content: "";
  clear: both;
  display: table;
}

.btn-group button:not(:last-child) {
  border-right: none; /* Prevent double borders */
}

/* Add a background color on hover */
.btn-group button:hover {
  background-color: #73856f57;
  color:white
}

.btn-group button.active {
  background-color: #d7d9dbb7;
  /* color: white; */
}
</style>