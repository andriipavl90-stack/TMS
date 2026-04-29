<template>
  <div class="dash-view">
    <!-- ── Page Hero ─────────────────────────────────── -->
    <header class="page-hero">
      <div class="page-hero__inner">
        <p class="page-hero__eyebrow">Overview</p>
        <h1 class="page-hero__title">Dashboard</h1>
        <p class="page-hero__subtitle">
          A snapshot of every active member — worked hours, daily report status, and your monthly income.
        </p>
      </div>
    </header>

    <!-- ── Group tabs ────────────────────────────────── -->
    <div class="tabs-card">
      <div class="tabs" role="tablist" aria-label="Filter by group">
        <button
          v-for="g in tabs"
          :key="g"
          role="tab"
          :aria-selected="selectedGroup === g"
          class="tab"
          :class="{ 'tab--active': selectedGroup === g }"
          @click="selectGroup(g)"
        >
          {{ g === 'all' ? 'All' : g }}
          <span v-if="countsByTab[g] != null" class="tab__count">{{ countsByTab[g] }}</span>
        </button>
      </div>
    </div>

    <!-- ── Content ───────────────────────────────────── -->
    <div v-if="loading && !cards.length" class="grid">
      <div v-for="n in 6" :key="n" class="skeleton-card">
        <div class="skeleton skeleton--avatar"></div>
        <div class="skeleton skeleton--bar"></div>
        <div class="skeleton skeleton--bar skeleton--bar-sm"></div>
        <div class="skeleton skeleton--bar skeleton--bar-sm"></div>
      </div>
    </div>

    <div v-else-if="error" class="error-banner">⚠️ {{ error }}</div>

    <div v-else-if="filteredCards.length === 0" class="empty-state">
      <span>👥</span>
      <p>No members in this group.</p>
    </div>

    <div v-else class="groups">
      <section
        v-for="bucket in groupedCards"
        :key="bucket.group"
        class="group-card"
      >
        <header class="group-card__head">
          <h2 class="group-card__title">{{ bucket.group }}</h2>
          <span class="group-card__count">
            {{ bucket.cards.length }} {{ bucket.cards.length === 1 ? 'member' : 'members' }}
          </span>
        </header>
        <div class="grid">
          <DashboardCard
            v-for="c in bucket.cards"
            :key="c.userId"
            :card="c"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { getDashboard } from '../services/dashboard';
import DashboardCard from '../components/dashboard/DashboardCard.vue';

const loading = ref(false);
const error = ref(null);
const cards = ref([]);
const groups = ref([]);
const selectedGroup = ref('all');

const tabs = computed(() => ['all', ...groups.value]);

// Card counts per tab (computed from full unfiltered set)
const countsByTab = computed(() => {
  const map = { all: cards.value.length };
  for (const g of groups.value) {
    map[g] = cards.value.filter(c => c.group === g).length;
  }
  return map;
});

const filteredCards = computed(() => {
  if (selectedGroup.value === 'all') return cards.value;
  return cards.value.filter(c => c.group === selectedGroup.value);
});

// Bucket cards by group while preserving the controller-defined order
// (group asc → admins first → name asc). Walks the filtered list once.
const groupedCards = computed(() => {
  const buckets = [];
  const indexByGroup = new Map();
  for (const c of filteredCards.value) {
    let i = indexByGroup.get(c.group);
    if (i == null) {
      i = buckets.length;
      indexByGroup.set(c.group, i);
      buckets.push({ group: c.group, cards: [] });
    }
    buckets[i].cards.push(c);
  }
  return buckets;
});

const fetch = async ({ silent = false } = {}) => {
  if (!silent) loading.value = true;
  error.value = null;
  try {
    // Always fetch the full set so the tabs (and counts) are accurate;
    // we filter client-side. This also keeps the auto-refresh cheap.
    const res = await getDashboard();
    const data = res.data?.data || {};
    cards.value = data.cards || [];
    groups.value = data.groups || [];
  } catch (err) {
    if (!silent) {
      error.value = err.response?.data?.message || err.message || 'Failed to load dashboard';
      cards.value = [];
    }
  } finally {
    if (!silent) loading.value = false;
  }
};

const selectGroup = (g) => {
  selectedGroup.value = g;
};

// Auto-refresh every 10 minutes (matches WorkflowView)
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;
let refreshTimerId = null;
onMounted(() => {
  fetch();
  refreshTimerId = setInterval(() => fetch({ silent: true }), REFRESH_INTERVAL_MS);
});
onUnmounted(() => {
  if (refreshTimerId) clearInterval(refreshTimerId);
});
</script>

<style scoped>
.dash-view {
  max-width: 1920px;
  margin: 0 auto;
  padding: clamp(1rem, 3vw, 1.75rem);
  display: flex;
  flex-direction: column;
  gap: clamp(1.25rem, 3vw, 1.75rem);
}

/* ── Hero (matches WorkflowView aesthetic) ── */
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
}
.page-hero__subtitle {
  margin: 0;
  font-size: 1rem;
  line-height: 1.6;
  font-weight: 500;
  color: #475569;
  max-width: 48rem;
}

/* ── Tabs card ── */
.tabs-card {
  background: #ffffff;
  border: 1px solid var(--border-light, #e5e7eb);
  border-radius: 14px;
  padding: 0.55rem 0.65rem;
  box-shadow:
    0 1px 2px rgba(17, 24, 39, 0.04),
    0 8px 24px -12px rgba(99, 102, 241, 0.12);
}
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.95rem;
  border: 1px solid transparent;
  background: transparent;
  color: #6b7280;
  border-radius: 999px;
  font-size: 0.825rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s, color 0.15s, transform 0.15s, box-shadow 0.2s;
}
.tab:hover {
  background: #f1f5f9;
  color: #111827;
}
.tab--active {
  background: linear-gradient(135deg, #6366f1, #8b5cf6 50%, #ec4899);
  color: #ffffff;
  box-shadow: 0 4px 14px -4px rgba(99, 102, 241, 0.5);
}
.tab--active .tab__count {
  background: rgba(255, 255, 255, 0.25);
  color: #ffffff;
}
.tab__count {
  font-size: 0.7rem;
  font-weight: 800;
  background: #eef2ff;
  color: #4338ca;
  padding: 0.05rem 0.5rem;
  border-radius: 999px;
  min-width: 1.4rem;
  text-align: center;
  line-height: 1.5;
}

/* ── Group containers ── */
.groups {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
.group-card {
  background:
    radial-gradient(900px 240px at -10% -20%, rgba(99, 102, 241, 0.08), transparent 60%),
    radial-gradient(700px 220px at 110% 120%, rgba(236, 72, 153, 0.06), transparent 60%),
    #ffffff;
  border: 1px solid var(--border-light, #e5e7eb);
  border-radius: 18px;
  padding: 1.25rem 1.25rem 1.4rem;
  box-shadow:
    0 1px 2px rgba(17, 24, 39, 0.04),
    0 12px 30px -16px rgba(99, 102, 241, 0.18);
  position: relative;
  overflow: hidden;
}
.group-card::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 4px;
  background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);
  opacity: 0.85;
}
.group-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
  padding-bottom: 0.65rem;
  border-bottom: 1px dashed #e5e7eb;
}
.group-card__title {
  margin: 0;
  font-size: 1.05rem;
  font-weight: 800;
  color: #111827;
  letter-spacing: -0.01em;
  text-transform: uppercase;
}
.group-card__count {
  font-size: 0.7rem;
  font-weight: 700;
  color: #6366f1;
  background: #eef2ff;
  border: 1px solid #c7d2fe;
  padding: 0.2rem 0.65rem;
  border-radius: 999px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* ── Grid ── */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

/* ── States ── */
.error-banner {
  padding: 1rem 1.25rem;
  background: #fef2f2;
  border: 1px solid #fca5a5;
  color: #dc2626;
  border-radius: 8px;
  font-size: 0.875rem;
}
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: #6b7280;
  font-size: 0.9375rem;
  background: #ffffff;
  border: 1px dashed var(--border-light, #e5e7eb);
  border-radius: 14px;
}
.empty-state span {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 0.75rem;
}

/* ── Skeletons ── */
.skeleton-card {
  background: #ffffff;
  border: 1px solid var(--border-light, #e5e7eb);
  border-radius: 16px;
  padding: 1.1rem 1.15rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  min-height: 220px;
}
.skeleton {
  background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 8px;
}
.skeleton--avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
}
.skeleton--bar { height: 18px; }
.skeleton--bar-sm { height: 12px; }
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
