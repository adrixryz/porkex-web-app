<template>
  <v-card color="surface" class="rounded-xl my-6" elevation="1">
    <v-card-title>Period comparison</v-card-title>
    <v-card-text>
      <div class="comparison-controls">
        <v-btn-toggle
          :model-value="mode"
          mandatory
          color="primary"
          aria-label="Comparison mode"
          @update:model-value="changeMode"
          ><v-btn value="year">Year vs year</v-btn
          ><v-btn value="week">Week vs week</v-btn></v-btn-toggle
        >
        <v-text-field
          v-if="mode === 'year'"
          v-model="year"
          label="Comparison year"
          type="number"
          min="1900"
          :max="currentYear()"
          hide-details
          density="compact"
          @change="applyYear"
          @keydown.enter.prevent="applyYear"
        />
        <v-text-field
          v-else
          v-model="week"
          label="Comparison week"
          type="date"
          :max="todayInput()"
          hide-details
          density="compact"
          @change="applyWeek"
        />
      </div>
      <v-progress-linear v-if="loading" indeterminate class="my-3" />
      <v-alert v-if="error" type="error" density="compact" class="my-3">{{ error }}</v-alert>
      <template v-if="comparison">
        <p class="text-caption mt-4">
          {{ comparison.ranges.current.from }} – {{ comparison.ranges.current.to }} vs
          {{ comparison.ranges.previous.from }} – {{ comparison.ranges.previous.to }}
        </p>
        <p v-if="comparison.partial" class="text-caption text-info mb-3">
          Same elapsed portion of each period.
        </p>
        <div class="comparison-totals my-4">
          <div v-for="key in metrics" :key="key" class="pa-3 rounded-lg bg-surface-light">
            <div class="text-caption">{{ titles[key] }}</div>
            <div class="font-weight-bold">{{ cs }}{{ formatMoney(comparison.current[key]) }}</div>
            <div class="text-caption">
              Previous: {{ cs }}{{ formatMoney(comparison.previous[key]) }}
            </div>
            <div class="text-caption">
              Δ {{ cs }}{{ formatMoney(comparison.delta[key].absolute) }} ·
              {{
                comparison.delta[key].percent === null
                  ? 'No percentage base'
                  : `${comparison.delta[key].percent}%`
              }}
            </div>
          </div>
        </div>
        <v-btn-toggle v-model="metric" mandatory density="compact" aria-label="Comparison metric"
          ><v-btn v-for="key in metrics" :key="key" :value="key">{{
            titles[key]
          }}</v-btn></v-btn-toggle
        >
        <div
          v-if="comparison.current.count || comparison.previous.count"
          class="comparison-chart mt-4"
          role="img"
          :aria-label="`${titles[metric]}: ${mode} versus previous ${mode}`"
        >
          <Bar :data="chart" :options="options" />
        </div>
        <p v-else class="py-8 text-center text-on-surface-variant">
          No movements in these periods.
        </p>
      </template>
    </v-card-text>
  </v-card>
</template>
<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js'
import { Bar } from 'vue-chartjs'
import { fetchJson } from '@/utils/api'
import { useAsyncData } from '@/composables/useAsyncData'
import { getFirstDayOfWeek } from '@/utils/preferences'
import { todayInput } from '@/utils/date'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'
ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)
type Metric = 'income' | 'expense' | 'net'
type Totals = Record<Metric, number> & { count: number }
interface Comparison {
  mode: 'year' | 'week'
  partial: boolean
  ranges: { current: { from: string; to: string }; previous: { from: string; to: string } }
  current: Totals
  previous: Totals
  delta: Record<Metric, { absolute: number; percent: number | null }>
  buckets: { index: number; included: boolean; current: Totals; previous: Totals }[]
}
const route = useRoute(),
  router = useRouter()
const cs = useCurrencySymbol()
const currentYear = () => new Date().getFullYear()
const mode = ref<'year' | 'week'>('year')
const anchor = ref(`${currentYear()}-01-01`)
const year = ref(String(currentYear())),
  week = ref(todayInput())
const metrics: Metric[] = ['income', 'expense', 'net']
const titles = { income: 'Income', expense: 'Expenses', net: 'Balance' }
const metric = ref<Metric>('expense')
const queryKey = () =>
  `/analytics/comparison?mode=${mode.value}&anchor=${anchor.value}&weekStart=${getFirstDayOfWeek()}`
const {
  data: comparison,
  loading,
  error,
  run
} = useAsyncData<Comparison>(
  signal => fetchJson(`${queryKey()}&today=${todayInput()}`, { signal }),
  { cacheKey: queryKey }
)
let reading = false
async function restore() {
  if (reading) return
  reading = true
  try {
    mode.value = route.query.comparison === 'week' ? 'week' : 'year'
    const raw = typeof route.query.anchor === 'string' ? route.query.anchor : ''
    const parsed = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(raw + 'T00:00:00Z') : null
    const valid =
      parsed &&
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === raw &&
      raw <= todayInput() &&
      parsed.getUTCFullYear() >= 1900
    anchor.value = valid
      ? mode.value === 'year'
        ? raw.slice(0, 4) + '-01-01'
        : raw
      : mode.value === 'year'
        ? `${currentYear()}-01-01`
        : todayInput()
    year.value = anchor.value.slice(0, 4)
    week.value = anchor.value
    if (route.query.comparison !== mode.value || route.query.anchor !== anchor.value)
      await router.replace({
        query: { ...route.query, comparison: mode.value, anchor: anchor.value }
      })
  } finally {
    reading = false
  }
  await run()
}
async function navigate(nextMode: 'year' | 'week', nextAnchor: string) {
  if (route.query.comparison === nextMode && route.query.anchor === nextAnchor) return
  await router.push({ query: { ...route.query, comparison: nextMode, anchor: nextAnchor } })
}
function changeMode(value: unknown) {
  if (value === 'year' || value === 'week')
    void navigate(value, value === 'year' ? `${currentYear()}-01-01` : todayInput())
}
function applyYear() {
  const value = Number(year.value)
  if (Number.isInteger(value) && value >= 1900 && value <= currentYear())
    void navigate('year', `${value}-01-01`)
  else year.value = anchor.value.slice(0, 4)
}
function applyWeek() {
  if (week.value && week.value <= todayInput()) void navigate('week', week.value)
  else week.value = anchor.value
}
watch([() => route.query.comparison, () => route.query.anchor], () => {
  if (!reading) void restore()
})
onMounted(restore)
const chart = computed(() => ({
  labels:
    comparison.value?.buckets.map(bucket => {
      if (mode.value === 'year')
        return new Date(Date.UTC(2000, bucket.index, 1)).toLocaleDateString('en', {
          month: 'short',
          timeZone: 'UTC'
        })
      const date = new Date(comparison.value!.ranges.current.from + 'T00:00:00Z')
      date.setUTCDate(date.getUTCDate() + bucket.index)
      return date.toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' })
    }) ?? [],
  datasets: [
    {
      label: 'Selected period',
      backgroundColor: '#8ab4f8',
      data:
        comparison.value?.buckets.map(bucket =>
          bucket.included ? bucket.current[metric.value] : null
        ) ?? []
    },
    {
      label: 'Previous period',
      backgroundColor: '#9aa0a6',
      data:
        comparison.value?.buckets.map(bucket =>
          bucket.included ? bucket.previous[metric.value] : null
        ) ?? []
    }
  ]
}))
const options = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { labels: { color: '#e3e3e3' } } },
  scales: { x: { ticks: { color: '#bdbdbd' } }, y: { ticks: { color: '#bdbdbd' } } }
}
</script>
<style scoped>
.comparison-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
}
.comparison-controls > .v-input {
  flex: 1 1 160px;
  min-width: 0;
}
.comparison-controls :deep(.v-btn-toggle) {
  max-width: 100%;
}
.comparison-controls :deep(.v-btn) {
  min-width: 0;
  padding-inline: 10px;
}
.comparison-totals {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}
.comparison-chart {
  height: 280px;
}
</style>
