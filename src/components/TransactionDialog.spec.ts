import { ref, computed } from 'vue'
import { installTestLocks } from '@/utils/locks.test-helper'
import { setToken, setUser } from '@/utils/api'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vite-plus/test'
import { flushPromises, mount, enableAutoUnmount } from '@vue/test-utils'
import TransactionDialog from './TransactionDialog.vue'
import { writeCache } from '@/utils/cache'
import type { Category } from '@/types'
import { todayInput } from '@/utils/date'

enableAutoUnmount(afterEach)

const CATEGORIES: Category[] = [
  {
    id: 1,
    name: 'Food',
    type: 'Expense',
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
    type: 'Income',
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
const VSelectStub = { props: ['items', 'label'], template: '<div class="category-select" />' }

const stubs = {
  TagPicker: true,
  'v-dialog': {
    props: ['modelValue'],
    template: '<div v-if="modelValue"><slot /></div>'
  },
  'v-card': { template: '<div><slot /></div>' },
  'v-card-title': { template: '<div><slot /></div>' },
  'v-card-text': { template: '<div><slot /></div>' },
  'v-spacer': { template: '<div />' },
  'v-form': { template: '<form><slot /></form>' },
  'v-text-field': { props: ['prefix'], template: '<div><slot name="append-inner" /></div>' },
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
    props: { modelValue: false, type: 'Expense' },
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

    const items = wrapper
      .findAllComponents(VSelectStub)
      .find(c => c.props('label') === 'Category')!
      .props('items') as Category[]
    expect(items.map(c => c.name)).toEqual(['Food'])
    expect(wrapper.find('.categories-alert').exists()).toBe(false)
    vi.unstubAllGlobals()
  })

  it('warns instead of leaving a silent empty dropdown with no cache', async () => {
    vi.stubGlobal('fetch', networkDown())

    const wrapper = await openDialog()

    expect(
      wrapper
        .findAllComponents(VSelectStub)
        .find(c => c.props('label') === 'Category')!
        .props('items')
    ).toEqual([])
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

it('edits the pinned next occurrence through its own endpoint', async () => {
  const fetch = vi.fn(
    async (_url: string, options?: RequestInit) =>
      new Response(options?.method === 'PUT' ? '{}' : JSON.stringify(CATEGORIES))
  )
  vi.stubGlobal('fetch', fetch)
  try {
    const wrapper = mount(TransactionDialog, {
      props: {
        modelValue: false,
        type: 'Expense',
        occurrence: { ruleId: 7, date: '2090-01-01' },
        transaction: {
          id: 0,
          amount: 10,
          type: 'Expense',
          categoryId: 1,
          category: null,
          description: '',
          userId: 1,
          recurringId: 7,
          date: '2090-01-01',
          createdAt: ''
        }
      },
      global: { stubs }
    })
    await wrapper.setProps({ modelValue: true })
    await flushPromises()
    const vm = wrapper.vm as unknown as { submit: () => Promise<void> }
    await vm.submit()
    const write = fetch.mock.calls.find(args => args[1]?.method === 'PUT')!
    expect(write[0]).toBe('/api/recurring/7/occurrences/2090-01-01')
    expect(JSON.parse(write[1]!.body as string)).toMatchObject({
      kind: 'EDIT',
      comment: '',
      tagIds: []
    })
    expect(wrapper.text()).toContain('Edit next occurrence')
  } finally {
    vi.unstubAllGlobals()
  }
})

it.each([
  { status: 400, code: 'DEVICE_CLOCK_AHEAD', renew: true },
  { status: 400, code: 'INVALID_INPUT', renew: false },
  { status: 500, code: undefined, renew: false }
])('retries an edit after $status/$code with renew=$renew', async ({ status, code, renew }) => {
  const now = Date.now()
  const bodies: { mutationId: string; editedAt: string }[] = []
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method !== 'PUT') return new Response(JSON.stringify(CATEGORIES))
      bodies.push(JSON.parse(options.body as string))
      return bodies.length === 1
        ? new Response(JSON.stringify({ code, error: 'Retry after correcting the clock.' }), {
            status
          })
        : new Response('{"id":1}')
    })
  )
  try {
    const wrapper = mount(TransactionDialog, {
      props: {
        modelValue: false,
        type: 'Expense',
        categories: CATEGORIES,
        transaction: {
          id: 1,
          amount: 10,
          type: 'Expense',
          categoryId: 1,
          category: null,
          description: 'Lunch',
          userId: 1,
          recurringId: null,
          date: todayInput(),
          createdAt: new Date(now).toISOString()
        }
      },
      global: { stubs }
    })
    await wrapper.setProps({ modelValue: true })
    const vm = wrapper.vm as unknown as { submit: () => Promise<void> }
    vi.setSystemTime(now + 3_600_000)
    await vm.submit()
    expect(wrapper.emitted('saved')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    vi.setSystemTime(now)
    await vm.submit()
    expect(bodies).toHaveLength(2)
    expect(bodies[0]!.editedAt).toBe(new Date(now + 3_600_000).toISOString())
    if (renew) {
      expect(bodies[1]!.mutationId).not.toBe(bodies[0]!.mutationId)
      expect(bodies[1]!.editedAt).toBe(new Date(now).toISOString())
    } else {
      expect(bodies[1]).toEqual(bodies[0])
    }
    expect(wrapper.emitted('saved')).toHaveLength(1)
  } finally {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  }
})

it('walks the amount stepper back to empty instead of parking it on 0.01', async () => {
  vi.stubGlobal('fetch', networkDown())
  try {
    const wrapper = await openDialog()
    const vm = wrapper.vm as unknown as { form: Record<string, unknown> }
    const increase = wrapper.find('button[aria-label="Increase expense amount"]')
    const decrease = wrapper.find('button[aria-label="Decrease expense amount"]')

    await increase.trigger('click')
    expect(vm.form.amount).toBe('1')

    // 1 → 0 clears the box: no 0.01 left behind, the amount is simply missing.
    await decrease.trigger('click')
    expect(vm.form.amount).toBe('')
    await decrease.trigger('click')
    expect(vm.form.amount).toBe('')

    vm.form.amount = '2.5'
    await decrease.trigger('click')
    expect(vm.form.amount).toBe('1.5')
  } finally {
    vi.unstubAllGlobals()
  }
})

vi.mock('@/composables/useAccounts', () => ({
  useAccounts: () => {
    const accounts = ref([
      {
        id: 'main-1',
        name: 'Main',
        balance: 1000,
        openingBalance: 1000,
        isMain: true,
        archived: false,
        userId: 1
      }
    ])
    return { accounts, activeAccounts: computed(() => accounts.value), run: vi.fn() }
  }
}))
