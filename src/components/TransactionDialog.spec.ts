import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import TransactionDialog from './TransactionDialog.vue'
import { writeCache } from '@/utils/cache'
import type { Category } from '@/types'

const CATEGORIES: Category[] = [
  {
    id: 1,
    name: 'Food',
    type: 'EXPENSE',
    color: '#EA4335',
    userId: 1,
    transactionCount: 0,
    total: 0,
    allTimeCount: 0,
    budgetCount: 0
  },
  {
    id: 2,
    name: 'Freelance',
    type: 'INCOME',
    color: '#4285F4',
    userId: 1,
    transactionCount: 0,
    total: 0,
    allTimeCount: 0,
    budgetCount: 0
  }
]

// The parent passes no categories (the dashboard quick-add), so the dialog has
// to load its own. Vuetify is stubbed down to what the assertions need.
const VSelectStub = { props: ['items'], template: '<div class="category-select" />' }

const stubs = {
  'v-dialog': {
    props: ['modelValue'],
    template: '<div v-if="modelValue"><slot /></div>'
  },
  'v-card': { template: '<div><slot /></div>' },
  'v-card-title': { template: '<div><slot /></div>' },
  'v-card-text': { template: '<div><slot /></div>' },
  'v-spacer': { template: '<div />' },
  'v-form': { template: '<form><slot /></form>' },
  'v-text-field': { template: '<div><slot name="append-inner" /></div>' },
  'v-select': VSelectStub,
  'v-alert': { template: '<div class="categories-alert"><slot /></div>' },
  'v-btn': { template: '<button type="button"><slot /></button>' },
  'v-icon': { template: '<i />' }
}

// A fetch that fails the way a dead network does: fetch() itself rejects.
const networkDown = () =>
  vi.fn(async () => {
    throw new TypeError('Failed to fetch')
  })

async function openDialog() {
  const wrapper = mount(TransactionDialog, {
    props: { modelValue: false, type: 'EXPENSE' },
    global: { stubs }
  })
  await wrapper.setProps({ modelValue: true })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('TransactionDialog categories offline', () => {
  it('shows the cached categories when the API is unreachable', async () => {
    writeCache('/categories', CATEGORIES)
    vi.stubGlobal('fetch', networkDown())

    const wrapper = await openDialog()

    const items = wrapper.findComponent(VSelectStub).props('items') as Category[]
    expect(items.map(c => c.name)).toEqual(['Food'])
    expect(wrapper.find('.categories-alert').exists()).toBe(false)
    vi.unstubAllGlobals()
  })

  it('warns instead of leaving a silent empty dropdown with no cache', async () => {
    vi.stubGlobal('fetch', networkDown())

    const wrapper = await openDialog()

    expect(wrapper.findComponent(VSelectStub).props('items')).toEqual([])
    expect(wrapper.find('.categories-alert').exists()).toBe(true)
    vi.unstubAllGlobals()
  })
})
