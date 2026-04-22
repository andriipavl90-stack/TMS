<template>
  <div class="wf-view">

    <!-- ── Page Hero ─────────────────────────────────── -->
    <header class="page-hero">
      <div class="page-hero__inner">
        <p class="page-hero__eyebrow">Analytics</p>
        <h1 class="page-hero__title">Workflow</h1>
        <p class="page-hero__subtitle">
          Worked hours per team member — tracked time plus any manually added time.
        </p>
      </div>
    </header>


    <!-- ── Top Filter Card ───────────────────────────── -->
    <div class="wf-card filter-card">
      <div class="filter-row">
        <div class="filter-group">
          <label class="filter-label">View</label>
          <select class="filter-input" v-model="preset" @change="applyPreset">
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label">From</label>
          <input
            type="date"
            class="filter-input"
            v-model="dateFrom"
            @change="onRangeInputChange"
          />
        </div>
        <div class="filter-group">
          <label class="filter-label">To</label>
          <input
            type="date"
            class="filter-input"
            v-model="dateTo"
            @change="onRangeInputChange"
          />
        </div>
        <button class="btn btn--primary" @click="fetchChart" :disabled="loading">
          {{ loading ? 'Loading…' : 'Apply' }}
        </button>
      </div>
    </div>

    <!-- ── Chart Card ────────────────────────────────── -->
    <div class="wf-card chart-card">
      <div v-if="loading" class="chart-loading">
        <div class="skeleton skeleton--chart"></div>
      </div>
      <div v-else-if="error" class="error-banner">⚠️ {{ error }}</div>
      <div v-else-if="displayData.length === 0" class="empty-state">
        <span>📊</span>
        <p>No users found. Make sure there are active users in the system.</p>
      </div>
      <div v-else class="chart-wrap">
        <canvas ref="chartCanvas" class="chart-canvas"></canvas>
      </div>
    </div>

    <!-- ── Bottom Controls ───────────────────────────── -->
    <div class="wf-card controls-card">
      <div class="controls-left">
        <button
          class="btn btn--sort"
          :class="{ 'btn--sort-active': sortOrder === 'desc' }"
          @click="setSortOrder('desc')"
        >
          ↓ Descending
        </button>
        <button
          class="btn btn--sort"
          :class="{ 'btn--sort-active': sortOrder === 'asc' }"
          @click="setSortOrder('asc')"
        >
          ↑ Ascending
        </button>
      </div>

      <div class="controls-center">
        <button class="btn-nav" @click="shiftDay(-1)" title="Previous day">◀</button>
        <input
          type="date"
          class="filter-input single-date"
          v-model="singleDate"
          @change="onSingleDateChange"
        />
        <button class="btn-nav" @click="shiftDay(1)" title="Next day">▶</button>
      </div>

      <div class="controls-right">
        <button class="btn btn--add" @click="openModal">＋ ADD TIME</button>
      </div>
    </div>

    <!-- ── ADD TIME Modal ─────────────────────────────── -->
    <teleport to="body">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <div class="modal-header">
            <h3 id="modal-title" class="modal-title">Add Time</h3>
            <button class="modal-close" @click="closeModal" aria-label="Close">✕</button>
          </div>

          <div class="modal-body">
            <!-- Member select -->
            <div class="form-group">
              <label class="form-label">Member</label>
              <select v-model="modalForm.userId" class="form-input" :disabled="usersLoading">
                <option value="">
                  {{ usersLoading ? 'Loading members…' : 'Select member…' }}
                </option>
                <option v-for="u in users" :key="u._id" :value="u._id">
                  {{ u.name }}
                  <template v-if="u.email"> — {{ u.email }}</template>
                </option>
              </select>
            </div>

            <!-- Date -->
            <div class="form-group">
              <label class="form-label">Date</label>
              <input type="date" v-model="modalForm.date" class="form-input" />
            </div>

            <!-- Hours / Minutes -->
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Hours</label>
                <input
                  type="number"
                  v-model.number="modalForm.hours"
                  min="0"
                  max="23"
                  class="form-input"
                  placeholder="0"
                />
              </div>
              <div class="form-group">
                <label class="form-label">Minutes</label>
                <input
                  type="number"
                  v-model.number="modalForm.minutes"
                  min="0"
                  max="59"
                  class="form-input"
                  placeholder="0"
                />
              </div>
            </div>

            <!-- Total preview -->
            <div class="time-preview" v-if="(modalForm.hours || 0) + (modalForm.minutes || 0) > 0">
              Total: <strong>{{ modalForm.hours || 0 }}h {{ modalForm.minutes || 0 }}m</strong>
            </div>

            <!-- Description -->
            <div class="form-group">
              <label class="form-label">Description <span class="optional">(optional)</span></label>
              <textarea
                v-model="modalForm.description"
                class="form-input form-textarea"
                rows="3"
                placeholder="What was worked on?"
              ></textarea>
            </div>
          </div>

          <div class="modal-footer">
            <button class="btn btn--cancel" @click="closeModal">Cancel</button>
            <button class="btn btn--primary" @click="handleAddTime" :disabled="modalLoading">
              {{ modalLoading ? 'Saving…' : 'Submit' }}
            </button>
          </div>
        </div>
      </div>
    </teleport>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useToast } from 'vue-toastification';
import Chart from 'chart.js/auto';
import { getWorkflowChartData, getWorkflowUsers, addWorkflowTime } from '../services/workflow';

const toast = useToast();

// ── Helpers ────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0, 10);

const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const startOfWeek = () => {
  const d = new Date();
  const day = d.getDay(); // 0 = Sunday
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
};

const startOfMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

// ── State ───────────────────────────────────────────────────────────
const preset = ref('today');
const dateFrom = ref(todayStr());
const dateTo = ref(addDays(todayStr(), 1));
const singleDate = ref(todayStr());

const loading = ref(false);
const error = ref(null);
const rawData = ref([]); // original order from API

const sortOrder = ref('desc'); // 'asc' | 'desc'

// Chart
const chartCanvas = ref(null);
let chartInstance = null;

// Modal
const showModal = ref(false);
const modalLoading = ref(false);
const users = ref([]);
const usersLoading = ref(false);
const modalForm = ref({
  userId: '',
  date: todayStr(),
  hours: null,
  minutes: null,
  description: '',
});

// ── Computed ────────────────────────────────────────────────────────

// Number of days in the selected range: max(1, dateTo - dateFrom in days)
const numDays = computed(() => {
  if (!dateFrom.value || !dateTo.value) return 1;
  const from = new Date(dateFrom.value + 'T00:00:00');
  const to = new Date(dateTo.value + 'T00:00:00');
  const diff = Math.round((to - from) / 86400000);
  return Math.max(1, diff);
});

// Y-axis ceiling in hours
const yAxisMax = computed(() => 24 * numDays.value);

// Sorted display data (no refetch — just re-orders the existing rawData)
const displayData = computed(() => {
  const copy = [...rawData.value];
  copy.sort((a, b) =>
    sortOrder.value === 'desc'
      ? b.total_hours - a.total_hours
      : a.total_hours - b.total_hours
  );
  return copy;
});


// ── Preset logic ────────────────────────────────────────────────────
const applyPreset = () => {
  switch (preset.value) {
    case 'today':
      dateFrom.value = todayStr();
      dateTo.value = addDays(todayStr(), 1);
      singleDate.value = todayStr();
      break;
    case 'week':
      dateFrom.value = startOfWeek();
      dateTo.value = todayStr();
      break;
    case 'month':
      dateFrom.value = startOfMonth();
      dateTo.value = todayStr();
      break;
    // 'custom' — user edits the inputs manually, no change needed
  }
  fetchChart();
};

const onRangeInputChange = () => {
  preset.value = 'custom';
  fetchChart();
};

// ── Single date picker ──────────────────────────────────────────────
// Behavior: selecting a date sets From = that date, To = next day
const onSingleDateChange = () => {
  if (!singleDate.value) return;
  dateFrom.value = singleDate.value;
  dateTo.value = addDays(singleDate.value, 1);
  preset.value = 'custom';
  fetchChart();
};

const shiftDay = (direction) => {
  const base = singleDate.value || todayStr();
  singleDate.value = addDays(base, direction);
  onSingleDateChange();
};

// ── Data fetch ──────────────────────────────────────────────────────
// `silent: true` skips the loading skeleton so background refreshes
// don't make the chart disappear and re-animate from scratch.
const fetchChart = async ({ silent = false } = {}) => {
  if (!silent) loading.value = true;
  error.value = null;
  try {
    const res = await getWorkflowChartData({ date_from: dateFrom.value, date_to: dateTo.value });
    rawData.value = res.data?.data?.chartData || [];
  } catch (err) {
    if (!silent) {
      error.value = err.response?.data?.message || err.message;
      rawData.value = [];
    }
  } finally {
    if (!silent) loading.value = false;
  }
};

// Auto-refresh: pull fresh worked-hours from the workflow collection every 10 minutes.
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
let refreshTimerId = null;
const startAutoRefresh = () => {
  stopAutoRefresh();
  refreshTimerId = setInterval(() => {
    fetchChart({ silent: true });
  }, REFRESH_INTERVAL_MS);
};
const stopAutoRefresh = () => {
  if (refreshTimerId) {
    clearInterval(refreshTimerId);
    refreshTimerId = null;
  }
};

// ── Chart management ────────────────────────────────────────────────

// Decimal hours → "Xh Ym"
const formatHm = (hoursDecimal) => {
  const totalMinutes = Math.round(hoursDecimal * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0 && m === 0) return '';
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

// Linear gradient brush for the bars — indigo → pink vibe
const makeBarGradient = (ctx, chartArea) => {
  if (!chartArea) return 'rgba(99,102,241,.85)';
  const gradient = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
  gradient.addColorStop(0,   'rgba(99, 102, 241, 0.95)');  // indigo-500
  gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.95)');  // violet-500
  gradient.addColorStop(1,   'rgba(236, 72, 153, 0.95)');  // pink-500
  return gradient;
};

// Soft glow/shadow under bars that renders BEFORE the bar
const barGlowPlugin = {
  id: 'barGlow',
  beforeDatasetDraw(chart, args) {
    if (args.index !== 0) return;
    const { ctx } = chart;
    ctx.save();
    ctx.shadowColor = 'rgba(99, 102, 241, 0.35)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 6;
  },
  afterDatasetDraw(chart, args) {
    if (args.index !== 0) return;
    chart.ctx.restore();
  },
};

// Animated value labels inside (or above) each bar
const barValueLabelsPlugin = {
  id: 'barValueLabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data) return;
    const dataset = chart.data.datasets[0];
    const progress = chart._wfLabelOpacity ?? 1; // fade-in, set by onProgress

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    meta.data.forEach((bar, i) => {
      const value = dataset.data[i];
      const label = formatHm(value);
      if (!label) return;

      const barHeight = Math.abs(bar.base - bar.y);
      const barWidth = bar.width || 40;
      const cx = bar.x;

      if (barHeight >= 30 && barWidth >= 50) {
        // INSIDE: big bold white with dark shadow
        ctx.globalAlpha = progress;
        ctx.font = '800 16px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, cx, (bar.y + bar.base) / 2);
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
      } else if (barHeight > 0) {
        // ABOVE: pill-shaped indigo label
        ctx.globalAlpha = progress;
        ctx.font = '800 14px system-ui, -apple-system, Segoe UI, Roboto, sans-serif';
        const padX = 9;
        const textWidth = ctx.measureText(label).width;
        const pillW = textWidth + padX * 2;
        const pillH = 24;
        const pillX = cx - pillW / 2;
        const pillY = bar.y - pillH - 6;

        ctx.fillStyle = 'rgba(79, 70, 229, 0.95)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(pillX, pillY, pillW, pillH, 12);
        else ctx.rect(pillX, pillY, pillW, pillH);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, cx, pillY + pillH / 2 + 0.5);
      }
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  },
};

const buildChart = () => {
  if (!chartCanvas.value) return;
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
  if (displayData.value.length === 0) return;

  const labels = displayData.value.map(u => u.name);
  const values = displayData.value.map(u => +u.total_hours.toFixed(2));
  const maxY = yAxisMax.value;

  chartInstance = new Chart(chartCanvas.value, {
    type: 'bar',
    plugins: [barGlowPlugin, barValueLabelsPlugin],
    data: {
      labels,
      datasets: [
        {
          label: 'Hours Worked',
          data: values,
          backgroundColor(context) {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            return makeBarGradient(ctx, chartArea);
          },
          hoverBackgroundColor(context) {
            const { chart } = context;
            const { ctx, chartArea } = chart;
            if (!chartArea) return 'rgba(236, 72, 153, 1)';
            const g = ctx.createLinearGradient(0, chartArea.bottom, 0, chartArea.top);
            g.addColorStop(0,   'rgba(79, 70, 229, 1)');
            g.addColorStop(0.5, 'rgba(168, 85, 247, 1)');
            g.addColorStop(1,   'rgba(244, 114, 182, 1)');
            return g;
          },
          borderWidth: 0,
          borderRadius: { topLeft: 10, topRight: 10, bottomLeft: 2, bottomRight: 2 },
          borderSkipped: false,
          barThickness: 'flex',
          maxBarThickness: 40,
          categoryPercentage: 0.8,
          barPercentage: 0.5,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 36, right: 14, bottom: 10, left: 6 } },
      animation: {
        duration: 900,
        easing: 'easeOutCubic',
        delay: (ctx) => (ctx.type === 'data' ? ctx.dataIndex * 35 : 0),
        onProgress(anim) {
          // Fade value labels in during the last 40% of the bar animation
          const p = anim.currentStep / anim.numSteps;
          anim.chart._wfLabelOpacity = Math.max(0, Math.min(1, (p - 0.55) / 0.45));
        },
        onComplete(anim) {
          anim.chart._wfLabelOpacity = 1;
          anim.chart.draw();
        },
      },
      interaction: { mode: 'nearest', intersect: true, axis: 'x' },
      scales: {
        y: {
          beginAtZero: true,
          max: maxY,
          border: { display: false },
          title: {
            display: true,
            text: 'Worked Hours',
            font: { size: 15, weight: '800', family: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
            color: '#4f46e5',
            padding: { bottom: 12 },
          },
          ticks: {
            callback: (v) => `${v}h`,
            color: '#1f2937',
            font: { size: 15, weight: '700', family: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
            padding: 10,
          },
          grid: { color: 'rgba(99, 102, 241, 0.1)', drawTicks: false, lineWidth: 1 },
        },
        x: {
          border: { display: false },
          ticks: {
            color: '#0f172a',
            font: { size: 15, weight: '800', family: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' },
            padding: 12,
            maxRotation: 30,
            minRotation: 0,
            autoSkip: false,
          },
          grid: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          enabled: true,
          backgroundColor: 'rgba(17, 24, 39, 0.95)',
          titleColor: '#ffffff',
          titleFont: { weight: '700', size: 13 },
          bodyColor: '#e5e7eb',
          bodyFont: { size: 12 },
          padding: 12,
          cornerRadius: 10,
          displayColors: false,
          caretSize: 6,
          titleMarginBottom: 6,
          callbacks: {
            title: (items) => items[0]?.label || '',
            label: (ctx) => {
              const totalH = ctx.parsed.y;
              const row = displayData.value[ctx.dataIndex];
              const rtH = Math.floor((row?.real_time || 0) / 3600);
              const rtM = Math.round(((row?.real_time || 0) % 3600) / 60);
              const atH = Math.floor((row?.add_time || 0) / 3600);
              const atM = Math.round(((row?.add_time || 0) % 3600) / 60);
              return [
                `Total:    ${formatHm(totalH) || '0m'}`,
                `Tracked:  ${rtH}h ${rtM}m`,
                `Added:    ${atH}h ${atM}m`,
              ];
            },
          },
        },
      },
    },
  });
};

// Re-render chart whenever displayData or yAxisMax changes
watch(
  [displayData, yAxisMax],
  async () => {
    await nextTick();
    buildChart();
  },
  { deep: false }
);

// ── Sort ─────────────────────────────────────────────────────────────
const setSortOrder = (order) => {
  sortOrder.value = order; // watcher on displayData triggers chart rebuild
};

// ── Modal ─────────────────────────────────────────────────────────────
const loadUsers = async () => {
  if (users.value.length > 0) return; // already loaded
  usersLoading.value = true;
  try {
    const res = await getWorkflowUsers();
    users.value = res.data?.data?.users || [];
  } catch {
    users.value = [];
  } finally {
    usersLoading.value = false;
  }
};

const openModal = async () => {
  modalForm.value = {
    userId: '',
    date: dateFrom.value || todayStr(),
    hours: null,
    minutes: null,
    description: '',
  };
  showModal.value = true;
  await loadUsers();
};

const closeModal = () => {
  showModal.value = false;
};

const handleAddTime = async () => {
  const { userId, date, hours, minutes, description } = modalForm.value;

  if (!userId) {
    toast.warning('Please select a member.');
    return;
  }
  if (!date) {
    toast.warning('Please select a date.');
    return;
  }
  const h = Number(hours) || 0;
  const m = Number(minutes) || 0;
  if (h === 0 && m === 0) {
    toast.warning('Please enter hours or minutes greater than 0.');
    return;
  }
  if (m > 59) {
    toast.warning('Minutes must be between 0 and 59.');
    return;
  }

  modalLoading.value = true;
  try {
    const res = await addWorkflowTime({ userId, date, hours: h, minutes: m, description });
    toast.success(res.data?.message || 'Time added successfully.');
    closeModal();
    await fetchChart();
  } catch (err) {
    toast.error(err.response?.data?.message || err.message || 'Failed to add time.');
  } finally {
    modalLoading.value = false;
  }
};

// ── Lifecycle ─────────────────────────────────────────────────────────
onMounted(() => {
  fetchChart();
  startAutoRefresh();
});

onUnmounted(() => {
  stopAutoRefresh();
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
});
</script>

<style scoped>
/* ── Layout ── */
.wf-view {
  --wf-radius: 14px;
  --wf-line: var(--border-light, #e5e7eb);
  --wf-surface: var(--bg-primary, #fff);
  --wf-elevated: var(--bg-secondary, #f9fafb);
  --wf-muted: var(--text-secondary, #6b7280);
  max-width: 1920px;
  margin: 0 auto;
  padding: clamp(1rem, 3vw, 1.75rem);
  display: flex;
  flex-direction: column;
  gap: clamp(1.25rem, 3vw, 1.75rem);
}

/* ── Hero ── */
.page-hero {
  position: relative;
  border-radius: 20px;
  padding: clamp(1.5rem, 4vw, 2.25rem) clamp(1.5rem, 3vw, 2.25rem);
  background:
    radial-gradient(1200px 400px at 100% -20%, rgba(236, 72, 153, 0.12), transparent 50%),
    radial-gradient(900px 400px at -10% 120%, rgba(99, 102, 241, 0.14), transparent 55%),
    linear-gradient(135deg, #ffffff 0%, #fafbff 100%);
  border: 1px solid rgba(99, 102, 241, 0.12);
  box-shadow:
    0 1px 2px rgba(17, 24, 39, 0.04),
    0 12px 32px -16px rgba(99, 102, 241, 0.18);
  overflow: hidden;
}
.page-hero::before {
  content: '';
  position: absolute;
  top: 0; right: 0;
  width: 200px; height: 200px;
  background: radial-gradient(circle, rgba(236, 72, 153, 0.15), transparent 70%);
  filter: blur(40px);
  pointer-events: none;
}
.page-hero__eyebrow {
  margin: 0 0 .6rem;
  font-size: .78rem;
  font-weight: 800;
  letter-spacing: .22em;
  text-transform: uppercase;
  color: #6366f1;
  display: inline-flex;
  align-items: center;
  gap: .55rem;
}
.page-hero__eyebrow::before {
  content: '';
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, #6366f1, #ec4899);
  box-shadow: 0 0 0 3px rgba(99, 102, 241, .18);
  animation: pulse 2.2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(99, 102, 241, .18); }
  50%      { box-shadow: 0 0 0 7px rgba(99, 102, 241, 0); }
}
.page-hero__title {
  margin: 0 0 .75rem;
  font-size: clamp(2.2rem, 5vw, 3rem);
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: -.03em;
  background: linear-gradient(135deg, #111827 0%, #4f46e5 45%, #ec4899 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  animation: title-shine 6s ease-in-out infinite;
  background-size: 200% 100%;
}
@keyframes title-shine {
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
}
.page-hero__subtitle {
  margin: 0;
  font-size: 1rem;
  line-height: 1.6;
  font-weight: 500;
  color: #475569;
  max-width: 48rem;
}

/* ── Card ── */
.wf-card {
  background: var(--wf-surface);
  border: 1px solid var(--wf-line);
  border-radius: var(--wf-radius);
  padding: var(--spacing-lg, 1.25rem) var(--spacing-xl, 1.5rem);
  box-shadow:
    0 1px 2px rgba(17, 24, 39, 0.04),
    0 8px 24px -12px rgba(99, 102, 241, 0.12);
  transition: box-shadow .2s ease, transform .2s ease;
}
.wf-card:hover {
  box-shadow:
    0 1px 2px rgba(17, 24, 39, 0.05),
    0 14px 32px -14px rgba(99, 102, 241, 0.2);
}

/* staggered entry for each card on page load */
.filter-card    { animation: card-rise .5s cubic-bezier(.2,.7,.3,1) .00s both; }
.controls-card  { animation: card-rise .5s cubic-bezier(.2,.7,.3,1) .10s both; }

/* ── Filter Card ── */
.filter-row {
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
}
.filter-group {
  display: flex;
  flex-direction: column;
  gap: .3rem;
}
.filter-label {
  font-size: .6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--wf-muted);
}
.filter-input {
  padding: .45rem .75rem;
  border: 1px solid var(--border-medium, #d1d5db);
  border-radius: var(--radius-md, 8px);
  background: var(--wf-elevated);
  color: var(--text-primary, #111827);
  font-size: .875rem;
  font-family: inherit;
  min-width: 130px;
}
.filter-input:focus {
  outline: none;
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 0 0 3px rgba(99,102,241,.15);
}

/* ── Chart Card ── */
.chart-card {
  min-height: 440px;
  display: flex;
  align-items: stretch;
  background:
    radial-gradient(1200px 400px at 10% -10%, rgba(99, 102, 241, 0.08), transparent 60%),
    radial-gradient(900px 300px at 110% 120%, rgba(236, 72, 153, 0.07), transparent 60%),
    var(--wf-surface);
  animation: card-rise .55s cubic-bezier(.2,.7,.3,1) .05s both;
}
.chart-wrap {
  width: 100%;
  position: relative;
  min-height: 460px;
}
.chart-canvas {
  width: 100% !important;
  height: 460px !important;
}

@keyframes card-rise {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: none; }
}

/* Skeleton */
.chart-loading { width: 100%; }
.skeleton--chart {
  width: 100%;
  height: 340px;
  border-radius: var(--radius-md, 8px);
  background: linear-gradient(90deg, var(--bg-tertiary, #f3f4f6) 25%, var(--wf-line) 50%, var(--bg-tertiary, #f3f4f6) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Empty / Error */
.empty-state {
  width: 100%;
  text-align: center;
  padding: 3rem 1rem;
  color: var(--wf-muted);
  font-size: .9375rem;
}
.empty-state span { font-size: 2.5rem; display: block; margin-bottom: .75rem; }
.error-banner {
  width: 100%;
  padding: 1rem 1.25rem;
  background: #fef2f2;
  border: 1px solid #fca5a5;
  color: #dc2626;
  border-radius: var(--radius-md, 8px);
  font-size: .875rem;
}

/* ── Controls Card ── */
.controls-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: space-between;
  padding: .875rem 1.25rem;
}
.controls-left,
.controls-right {
  display: flex;
  gap: .5rem;
  align-items: center;
}
.controls-center {
  display: flex;
  align-items: center;
  gap: .375rem;
}
.single-date {
  min-width: 140px;
}

/* ── Buttons ── */
.btn {
  padding: .5rem 1.15rem;
  border: 1px solid transparent;
  border-radius: var(--radius-md, 8px);
  font-size: .8125rem;
  font-weight: 600;
  letter-spacing: .01em;
  cursor: pointer;
  transition: transform .15s ease, box-shadow .2s ease, filter .15s ease, background-position .4s ease;
  white-space: nowrap;
  font-family: inherit;
  position: relative;
  overflow: hidden;
}
.btn:disabled { opacity: .6; cursor: not-allowed; }

.btn--primary {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%);
  background-size: 200% 100%;
  color: #fff;
  box-shadow: 0 4px 14px -4px rgba(99, 102, 241, .55);
}
.btn--primary:hover:not(:disabled) {
  transform: translateY(-1px);
  background-position: 100% 50%;
  box-shadow: 0 8px 22px -6px rgba(236, 72, 153, .55);
}
.btn--primary:active:not(:disabled) { transform: translateY(0); }

.btn--sort {
  background: var(--wf-elevated);
  border-color: var(--wf-line);
  color: var(--wf-muted);
}
.btn--sort:hover { background: var(--wf-line); color: var(--text-primary, #111827); transform: translateY(-1px); }
.btn--sort-active {
  background: linear-gradient(135deg, #6366f1, #4f46e5);
  border-color: transparent;
  color: #fff;
  box-shadow: 0 4px 12px -3px rgba(99, 102, 241, .5);
}
.btn--sort-active:hover { filter: brightness(1.08); transform: translateY(-1px); }

.btn--add {
  background: linear-gradient(135deg, #10b981 0%, #14b8a6 50%, #06b6d4 100%);
  background-size: 200% 100%;
  color: #fff;
  font-size: .875rem;
  padding: .55rem 1.4rem;
  letter-spacing: .04em;
  box-shadow: 0 4px 14px -4px rgba(16, 185, 129, .55);
}
.btn--add:hover {
  transform: translateY(-1px);
  background-position: 100% 50%;
  box-shadow: 0 8px 22px -6px rgba(6, 182, 212, .55);
}

.btn--cancel {
  background: var(--wf-elevated);
  border-color: var(--wf-line);
  color: var(--wf-muted);
}
.btn--cancel:hover { background: var(--wf-line); }

.btn-nav {
  padding: .4rem .7rem;
  border: 1px solid var(--wf-line);
  border-radius: var(--radius-md, 8px);
  background: var(--wf-elevated);
  cursor: pointer;
  font-size: .875rem;
  color: var(--wf-muted);
  transition: background .15s;
  font-family: inherit;
}
.btn-nav:hover { background: var(--wf-line); color: var(--text-primary, #111827); }

/* ── Modal ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 1rem;
}
.modal {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: var(--wf-radius);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.35);
  width: 100%;
  max-width: 480px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  opacity: 1;
  animation: modal-in .2s ease;
}
@keyframes modal-in {
  from { opacity: 0; transform: scale(.96) translateY(8px); }
  to   { opacity: 1; transform: none; }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem 1rem;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
}
.modal-title {
  font-size: 1.0625rem;
  font-weight: 700;
  color: #111827;
  margin: 0;
}
.modal-close {
  background: none;
  border: none;
  font-size: .875rem;
  color: var(--wf-muted);
  cursor: pointer;
  padding: .25rem .5rem;
  border-radius: var(--radius-sm, 6px);
  transition: background .15s, color .15s;
  font-family: inherit;
}
.modal-close:hover { background: #fef2f2; color: #ef4444; }

.modal-body {
  padding: 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  overflow-y: auto;
  max-height: 60vh;
  background: #ffffff;
}

.modal-footer {
  display: flex;
  gap: .75rem;
  justify-content: flex-end;
  padding: 1rem 1.5rem;
  border-top: 1px solid #e5e7eb;
  background: #ffffff;
}

.modal .form-input {
  background: #ffffff;
  border-color: #d1d5db;
  color: #111827;
}
.modal .form-input:focus {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, .15);
}
.modal .form-label {
  color: #6b7280;
}
.modal .time-preview {
  background: #eef2ff;
  border-color: #c7d2fe;
  color: #4f46e5;
}

/* ── Form elements ── */
.form-group {
  display: flex;
  flex-direction: column;
  gap: .3rem;
}
.form-row {
  display: flex;
  gap: 1rem;
}
.form-row .form-group { flex: 1; }

.form-label {
  font-size: .6875rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: .06em;
  color: var(--wf-muted);
}
.optional {
  font-weight: 400;
  text-transform: none;
  letter-spacing: 0;
  font-size: .6875rem;
  color: var(--wf-muted);
}
.form-input {
  padding: .5rem .75rem;
  border: 1px solid var(--border-medium, #d1d5db);
  border-radius: var(--radius-md, 8px);
  background: var(--wf-elevated);
  color: var(--text-primary, #111827);
  font-size: .875rem;
  font-family: inherit;
  width: 100%;
  box-sizing: border-box;
}
.form-input:focus {
  outline: none;
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 0 0 3px rgba(99,102,241,.15);
}
.form-textarea {
  resize: vertical;
  min-height: 80px;
}

.time-preview {
  font-size: .875rem;
  color: var(--color-primary, #6366f1);
  background: rgba(99,102,241,.08);
  border: 1px solid rgba(99,102,241,.2);
  border-radius: var(--radius-md, 8px);
  padding: .5rem .875rem;
}
</style>
