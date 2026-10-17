import { installTestLocks } from '@/utils/locks.test-helper'
import { setToken, setUser } from '@/utils/api'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest'
import { flushPromises, mount, enableAutoUnmount } from '@vue/test-utils'
import TransactionDialog from './TransactionDialog.vue'
import { writeCache } from '@/utils/cache'
import type { Category } from '@/types'

enableAutoUnmount(afterEach)

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
    budgetCount: 0,
    recurringCount: 0
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
    budgetCount: 0,
    recurringCount: 0
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
  installTestLocks()
  setToken('test-token')
  setUser({ id: 1, name: 'Test', email: 'test@example.com' })
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

it('reuses the create clientId after a failed write while keeping the form open', async () => {
  const bodies: { clientId: string }[] = []
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, options?: RequestInit) => {
      if (!options?.method || options.method === 'GET')
        return new Response(JSON.stringify(CATEGORIES))
      bodies.push(JSON.parse(options.body as string))
      return new Response(bodies.length === 1 ? '{"error":"Retry"}' : '{"id":1}', {
        status: bodies.length === 1 ? 500 : 201
      })
    })
  )
  try {
    const wrapper = await openDialog()
    const vm = wrapper.vm as unknown as {
      form: Record<string, unknown>
      submit: () => Promise<void>
    }
    Object.assign(vm.form, { amount: '10', description: 'Lunch', categoryId: 1 })
    await vm.submit()
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await vm.submit()
    expect(bodies[0]!.clientId).toBeTruthy()
    expect(bodies[1]!.clientId).toBe(bodies[0]!.clientId)
    expect(wrapper.emitted('saved')![0]).toEqual([{ isEditing: false, queued: false }])
  } finally {
    vi.unstubAllGlobals()
  }
})
