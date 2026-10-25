import { expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import CategoryComparisonChart from './CategoryComparisonChart.vue'

vi.mock('vue-chartjs', () => ({
  Bar: { name: 'BarChartStub', props: ['data', 'options', 'plugins'], template: '<div />' }
}))
vi.mock('vuetify', () => ({ useTheme: () => ({ current: { value: { colors: {} } } }) }))

it('orders each stack independently, keeps tiny categories visible and reports real tooltip amounts', async () => {
  const wrapper = mount(CategoryComparisonChart, {
    props: {
      rows: [
        { name: 'Salary', color: '#00ff00', previous: 100, current: 10 },
        { name: 'Sales', color: '#0000ff', previous: 0.01, current: 200 }
      ],
      previousLabel: 'Last Month',
      currentLabel: 'This Month',
      previousRange: 'September',
      currentRange: 'October'
    }
  })
  const chart = wrapper.findComponent({ name: 'BarChartStub' })
  const data = chart.props('data')
  expect(data.labels).toEqual(['Last Month', 'This Month'])
  expect(data.datasets[0].data).toEqual([100, 200])
  expect(data.datasets[0].backgroundColor).toEqual(['#00ff00', '#0000ff'])
  expect(data.datasets[1].data).toEqual([0.01, 10])
  expect(data.datasets[1].minBarLength).toBe(5)
  const tooltip = chart.props('options').plugins.tooltip
  expect(tooltip.itemSort({ raw: 10 }, { raw: 200 })).toBeLessThan(0)
  const item = { dataIndex: 0, datasetIndex: 1, raw: 0.01 }
  expect(tooltip.callbacks.title([item])).toEqual(['Last Month', 'September'])
  expect(tooltip.callbacks.beforeBody([item])).toContain('100.01')
  expect(tooltip.callbacks.label(item)).toContain('Sales: $0.01')
  expect(tooltip.callbacks.labelColor(item).backgroundColor).toBe('#0000ff')
  await wrapper.setProps({ rows: [] })
  expect(chart.props('data').datasets).toEqual([])
  wrapper.unmount()
})
