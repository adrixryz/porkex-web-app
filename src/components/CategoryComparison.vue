<template>
  <v-card
    color="surface"
    elevation="1"
    class="rounded-xl fill-height category-comparison"
    role="region"
    aria-label="Category comparison"
  >
    <v-card-title class="comparison-heading px-6 py-4 border-b border-outline-variant">
      <div>
        <div class="font-weight-medium text-subtitle-1">Category comparison</div>
        <div class="comparison-subtitle text-on-surface-variant">{{ subtitle }}</div>
      </div>
      <v-select
        :model-value="mode"
        :items="options"
        label="Compare categories"
        density="compact"
        hide-details
        variant="outlined"
        rounded="xl"
        class="comparison-selector"
        @update:model-value="selectMode"
      />
    </v-card-title>
    <v-progress-linear v-if="loading" indeterminate height="2" />
    <v-card-text class="pa-0">
      <v-alert v-if="error" type="error" density="compact" class="ma-4">{{ error }}</v-alert>
      <div v-else-if="!loading && !rows.length" class="text-center text-on-surface-variant pa-8">
        No spending data to compare yet
      </div>
      <div v-if="rows.length" class="overflow-x-auto">
        <v-table theme="dark" class="bg-surface comparison-table">
          <thead>
            <tr>
              <th class="text-left font-weight-bold">Category</th>
              <th class="text-right font-weight-bold">This {{ mode }}</th>
              <th class="text-right font-weight-bold">Last {{ mode }}</th>
              <th class="text-right font-weight-bold">Change</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="category in rows" :key="category.name">
              <td>
                <div class="d-flex align-center">
                  <span class="category-dot mr-2" :style="{ backgroundColor: category.color }" />{{
                    category.name
                  }}
                </div>
              </td>
              <td class="text-right font-weight-bold">
                {{ cs }}{{ formatMoney(category.current) }}
              </td>
              <td class="text-right text-on-surface-variant">
                {{ cs }}{{ formatMoney(category.previous) }}
              </td>
              <td class="text-right">
                <v-chip
                  size="x-small"
                  variant="tonal"
                  :color="
                    category.changePercent === null || category.changePercent > 0
                      ? 'error'
                      : category.changePercent < 0
                        ? 'success'
                        : 'on-surface-variant'
                  "
                >
                  <v-icon
                    start
                    size="12"
                    :icon="
                      category.changePercent === null || category.changePercent > 0
                        ? mdiTrendingUp
                        : category.changePercent < 0
                          ? mdiTrendingDown
                          : mdiMinus
                    "
                  />
                  {{
                    category.changePercent === null
                      ? 'New'
                      : `${category.changePercent > 0 ? '+' : ''}${category.changePercent}%`
                  }}
                </v-chip>
              </td>
            </tr>
          </tbody>
        </v-table>
      </div>
    </v-card-text>
  </v-card>
</template>
<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import { mdiTrendingUp, mdiTrendingDown, mdiMinus } from '@mdi/js'
import { useAsyncData } from '@/composables/useAsyncData'
import { fetchJson } from '@/utils/api'
import { todayInput } from '@/utils/date'
import { getFirstDayOfWeek } from '@/utils/preferences'
import { useCurrencySymbol, formatMoney } from '@/utils/currency'
interface Comparison {
  mode: 'month' | 'week' | 'year'
  partial: boolean
  categoryComparison: {
    name: string
    color: string
    current: number
    previous: number
    changePercent: number | null
  }[]
}
const route = useRoute(),
  router = useRouter(),
  cs = useCurrencySymbol()
const mode = computed(() =>
  route.query.comparison === 'week' || route.query.comparison === 'year'
    ? route.query.comparison
    : 'month'
)
const options = [
  { title: 'Month vs month', value: 'month' },
  { title: 'Week vs week', value: 'week' },
  { title: 'Year vs year', value: 'year' }
]
const key = () =>
  `/analytics/category-comparison?mode=${mode.value}&weekStart=${getFirstDayOfWeek()}`
const { data, loading, error, run } = useAsyncData<Comparison>(
  signal => fetchJson(`${key()}&today=${todayInput()}`, { signal }),
  { cacheKey: key }
)
const rows = computed(() => (data.value?.mode === mode.value ? data.value.categoryComparison : []))
const subtitle = computed(() =>
  mode.value === 'month'
    ? 'This month vs last month'
    : data.value?.partial
      ? 'Same elapsed portion of each period'
      : `This ${mode.value} vs last ${mode.value}`
)
function selectMode(value: unknown) {
  if (!['month', 'week', 'year'].includes(String(value)) || value === mode.value) return
  const query: LocationQueryRaw = { ...route.query, comparison: String(value) }
  delete query.anchor
  void router.push({ query })
}
watch(mode, () => {
  void run()
})
onMounted(() => {
  void run()
})
</script>
<style scoped>
.comparison-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  white-space: normal;
}
.comparison-selector {
  flex: 0 0 190px;
  margin-left: auto;
  max-width: 100%;
}
.comparison-heading > div:first-child {
  flex: 1 1 180px;
  min-width: 0;
}
.comparison-heading .comparison-subtitle {
  font-size: 12px;
  line-height: 1.4;
  font-weight: 400;
}
.category-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.comparison-table :deep(table) {
  min-width: 380px;
}
.comparison-table :deep(td),
.comparison-table :deep(th) {
  padding-inline: 12px;
}
@media (max-width: 599px) {
  .comparison-selector {
    flex: 1 1 190px;
  }
}
</style>
