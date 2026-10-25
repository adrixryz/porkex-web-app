<template>
  <div class="comparison-chart" role="img" :aria-label="chartDescription">
    <Bar :data="chartData" :options="chartOptions" :plugins="[roundedStacks]" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions,
  type Plugin
} from 'chart.js'
import { useTheme } from 'vuetify'
import { themeColors } from '@/utils/color'
import { BAR_CORNER_RADIUS } from '@/utils/chartStyle'
import { formatMoney, useCurrencySymbol } from '@/utils/currency'

ChartJS.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend)
interface Segment {
  name: string
  color: string
  current: number
  previous: number
}
const props = defineProps<{
  rows: Segment[]
  previousLabel: string
  currentLabel: string
  previousRange: string
  currentRange: string
}>()
const cs = useCurrencySymbol()
// Round the whole stack so a thin top category does not limit the corner radius.
const roundedStacks: Plugin<'bar'> = {
  id: 'rounded-category-stacks',
  beforeDatasetsDraw(chart) {
    const { ctx } = chart
    ctx.save()
    ctx.beginPath()
    for (let index = 0; index < (chart.data.labels?.length ?? 0); index++) {
      const bars = chart
        .getSortedVisibleDatasetMetas()
        .filter(meta => Number(chart.data.datasets[meta.index]?.data[index]) > 0)
        .map(meta => meta.data[index])
        .filter((bar): bar is BarElement => bar instanceof BarElement)
        .map(bar => bar.getProps(['x', 'y', 'base', 'width'], false))
        .filter(
          (bar): bar is { x: number; y: number; base: number; width: number } =>
            typeof bar.x === 'number' && typeof bar.y === 'number'
        )
      if (!bars.length) continue
      const top = Math.min(...bars.map(bar => bar.y))
      const bottom = Math.max(...bars.map(bar => bar.base))
      const width = Math.max(...bars.map(bar => bar.width))
      const radius = Math.min(BAR_CORNER_RADIUS, width / 2, bottom - top)
      if (width > 0 && bottom > top)
        ctx.roundRect(bars[0]!.x - width / 2, top, width, bottom - top, [radius, radius, 0, 0])
    }
    ctx.clip()
  },
  afterDatasetsDraw(chart) {
    chart.ctx.restore()
  }
}
const theme = useTheme()
const colors = computed(() => themeColors(name => theme.current.value.colors[name]))
// Each period has its own ordering: largest segments at the base, smallest at the top.
const columns = computed(() =>
  (['previous', 'current'] as const).map(period =>
    props.rows
      .filter(row => row[period] > 0)
      .map(row => ({ name: row.name, color: row.color, amount: row[period] }))
      .sort((a, b) => b.amount - a.amount || a.name.localeCompare(b.name))
  )
)
const totals = computed(() =>
  columns.value.map(
    column => column.reduce((sum, row) => sum + Math.round(row.amount * 100), 0) / 100
  )
)
const chartData = computed<ChartData<'bar'>>(() => ({
  labels: [props.previousLabel, props.currentLabel],
  datasets: Array.from(
    { length: Math.max(0, ...columns.value.map(column => column.length)) },
    (_, rank) => ({
      label: `Category ${rank + 1}`,
      data: columns.value.map(column => column[rank]?.amount ?? 0),
      backgroundColor: columns.value.map(column => column[rank]?.color ?? 'transparent'),
      borderWidth: 0,
      borderSkipped: false,
      borderRadius: 0,
      minBarLength: 5,
      maxBarThickness: 56,
      categoryPercentage: 0.7,
      barPercentage: 0.75
    })
  )
}))
const chartOptions = computed<ChartOptions<'bar'>>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  scales: {
    x: {
      stacked: true,
      grid: { display: false },
      border: { display: false },
      ticks: { color: colors.value.muted }
    },
    y: {
      stacked: true,
      beginAtZero: true,
      border: { display: false },
      grid: { color: colors.value.grid },
      ticks: {
        color: colors.value.muted,
        maxTicksLimit: 6,
        callback: value => `${cs.value}${formatMoney(Number(value))}`
      }
    }
  },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: colors.value.surface,
      titleColor: colors.value.muted,
      bodyColor: '#ededed',
      borderColor: '#2e2e2e',
      borderWidth: 1,
      padding: 12,
      filter: item => Number(item.raw) > 0,
      itemSort: (a, b) =>
        Number(a.raw) - Number(b.raw) ||
        (columns.value[a.dataIndex]?.[a.datasetIndex]?.name ?? '').localeCompare(
          columns.value[b.dataIndex]?.[b.datasetIndex]?.name ?? ''
        ),
      callbacks: {
        title: items => {
          const index = items[0]?.dataIndex ?? 0
          return [
            index === 0 ? props.previousLabel : props.currentLabel,
            index === 0 ? props.previousRange : props.currentRange
          ]
        },
        beforeBody: items =>
          `Total: ${cs.value}${formatMoney(totals.value[items[0]?.dataIndex ?? 0])}`,
        label: item =>
          ` ${columns.value[item.dataIndex]?.[item.datasetIndex]?.name ?? ''}: ${cs.value}${formatMoney(Number(item.raw))}`,
        labelColor: item => ({
          borderColor: columns.value[item.dataIndex]?.[item.datasetIndex]?.color ?? '#5F6368',
          backgroundColor: columns.value[item.dataIndex]?.[item.datasetIndex]?.color ?? '#5F6368'
        })
      }
    }
  }
}))
const chartDescription = computed(
  () =>
    `${props.previousLabel}: ${cs.value}${formatMoney(totals.value[0])}. ${props.currentLabel}: ${cs.value}${formatMoney(totals.value[1])}. Stacked by category, largest at the bottom.`
)
</script>

<style scoped>
.comparison-chart {
  height: 340px;
  position: relative;
  min-width: 0;
}
</style>
