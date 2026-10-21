import { installTestLocks } from '@/utils/locks.test-helper'
import { setToken, setUser } from '@/utils/api'
import { beforeEach, describe, expect, it, vi, afterEach } from 'vite-plus/test'
import { flushPromises, mount, enableAutoUnmount } from '@vue/test-utils'
import { nextTick } from 'vue'
import RecurringDialog from './RecurringDialog.vue'
import { writeCache } from '@/utils/cache'
import type { Category, RecurringRule } from '@/types'

enableAutoUnmount(afterEach)

const CATEGORIES: Category[] = [
  {
    id: 1,
    name: 'Housing',
    type: 'EXPENSE',
    color: '#5F6368',
    userId: 1,
    transactionCount: 0,
    total: 0,
    allTimeCount: 0,
    budgetCount: 0,
    recurringCount: 0
  },
  {
    id: 2,
    name: 'Salary',
    type: 'INCOME',
    color: '#34A853',
    userId: 1,
    transactionCount: 0,
    total: 0,
    allTimeCount: 0,
    budgetCount: 0,
    recurringCount: 0
  }
]

const RULE: RecurringRule = {
  id: 7,
  userId: 1,
  categoryId: 1,
  type: 'EXPENSE',
  amount: 800,
  description: 'Rent',
  frequency: 'MONTH',
  interval: 2,
  startDate: '2026-01-31T00:00:00.000Z',
  endDate: null,
  nextDate: '2026-11-30T00:00:00.000Z',
  active: true,
  createdAt: '2026-01-31T10:00:00.000Z',
  updatedAt: '2026-01-31T10:00:00.000Z',
  category: { id: 1, name: 'Housing', color: '#5F6368', type: 'EXPENSE' }
}

// Vuetify is stubbed down to what the assertions need.
const VSelectStub = { props: ['items', 'label'], template: '<div class="v-select-stub" />' }

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
  'v-btn-toggle': { template: '<div><slot /></div>' },
  'v-row': { template: '<div><slot /></div>' },
  'v-col': { template: '<div><slot /></div>' },
  'v-icon': { template: '<i />' }
}

// A fetch that fails the way a dead network does: fetch() itself rejects.
const networkDown = () =>
  vi.fn(async () => {
    throw new TypeError('Failed to fetch')
  })

async function openDialog(rule: RecurringRule | null = null) {
  const wrapper = mount(RecurringDialog, {
    props: { modelValue: false, rule },
    global: { stubs }
  })
  await wrapper.setProps({ modelValue: true })
  await flushPromises()
  return wrapper
}

// script setup bindings may come back wrapped in a ref, depending on how the
// test-utils proxy exposes them: unwrap defensively.
const unwrap = <T>(value: T | { value: T }): T =>
  (value as { value?: T })?.value !== undefined ? (value as { value: T }).value : (value as T)

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
  installTestLocks()
  setToken('test-token')
  setUser({ id: 1, name: 'Test', email: 'test@example.com' })
})

describe('RecurringDialog categories offline', () => {
  it('shows the cached categories when the API is unreachable', async () => {
    writeCache('/categories', CATEGORIES)
    vi.stubGlobal('fetch', networkDown())

    const wrapper = await openDialog()

    const select = wrapper.findAllComponents(VSelectStub)[0]
    const items = select.props('items') as Category[]
    expect(items.map(c => c.name)).toEqual(['Housing'])
    expect(wrapper.find('.categories-alert').exists()).toBe(false)
    vi.unstubAllGlobals()
  })

  it('warns instead of leaving a silent empty dropdown with no cache', async () => {
    vi.stubGlobal('fetch', networkDown())

    const wrapper = await openDialog()

    const select = wrapper.findAllComponents(VSelectStub)[0]
    expect(select.props('items')).toEqual([])
    expect(wrapper.find('.categories-alert').exists()).toBe(true)
    vi.unstubAllGlobals()
  })
})

describe('RecurringDialog form', () => {
  const fetchMock = () =>
    vi.fn(async (_url: string, init?: RequestInit) =>
      (init?.method ?? 'GET') === 'GET'
        ? new Response(JSON.stringify(CATEGORIES), { status: 200 })
        : new Response(JSON.stringify({ id: 9 }), { status: 201 })
    )

  it('creates with the schedule in the payload', async () => {
    const fetch = fetchMock()
    vi.stubGlobal('fetch', fetch)

    const wrapper = await openDialog()
    const vm = wrapper.vm as unknown as {
      form: { value?: unknown }
      isValid: unknown
      submit: () => Promise<void>
    }

    expect(unwrap(vm.isValid as boolean)).toBe(false)
    const form = unwrap(vm.form) as Record<string, unknown>
    form.amount = '25'
    form.description = 'Rent'
    form.categoryId = 1
    form.interval = '3'
    await nextTick()
    expect(unwrap(vm.isValid as boolean)).toBe(true)

    // The interval is typed: only whole numbers up to the API's maximum pass.
    form.interval = '25'
    await nextTick()
    expect(unwrap(vm.isValid as boolean)).toBe(false)
    form.interval = '1.5'
    await nextTick()
    expect(unwrap(vm.isValid as boolean)).toBe(false)
    form.interval = '24'
    await nextTick()
    expect(unwrap(vm.isValid as boolean)).toBe(true)
    form.interval = '3'
    await nextTick()

    await vm.submit()
    await flushPromises()

    const post = fetch.mock.calls.find(c => (c[1] as RequestInit)?.method === 'POST')
    expect(post).toBeTruthy()
    const body = JSON.parse((post![1] as RequestInit).body as string)
    expect(body).toMatchObject({
      type: 'EXPENSE',
      amount: 25,
      description: 'Rent',
      categoryId: 1,
      frequency: 'MONTH',
      interval: 3,
      endDate: null
    })
    expect(body.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(wrapper.emitted('saved')).toBeTruthy()
    vi.unstubAllGlobals()
  })

  it('steps the interval with the custom stepper, clamped to the valid range', async () => {
    vi.stubGlobal('fetch', fetchMock())

    const wrapper = await openDialog()
    const vm = wrapper.vm as unknown as { form: { value?: unknown }; isValid: unknown }
    const form = unwrap(vm.form) as Record<string, unknown>

    form.amount = '25'
    form.description = 'Gym'
    form.categoryId = 1
    await nextTick()

    const increase = wrapper.find('button[aria-label="Increase interval"]')
    const decrease = wrapper.find('button[aria-label="Decrease interval"]')
    expect(increase.exists()).toBe(true)
    expect(decrease.exists()).toBe(true)

    await increase.trigger('click')
    expect(form.interval).toBe('2')

    // Extra clicks cannot push it past the API maximum or below one.
    for (let i = 0; i < 30; i++) await increase.trigger('click')
    expect(form.interval).toBe('24')
    await nextTick()
    expect(unwrap(vm.isValid as boolean)).toBe(true)

    for (let i = 0; i < 30; i++) await decrease.trigger('click')
    expect(form.interval).toBe('1')
    await nextTick()
    expect(unwrap(vm.isValid as boolean)).toBe(true)
    vi.unstubAllGlobals()
  })

  it('walks the amount stepper back to empty instead of parking it on 0.01', async () => {
    vi.stubGlobal('fetch', fetchMock())

    const wrapper = await openDialog()
    const vm = wrapper.vm as unknown as { form: { value?: unknown } }
    const form = unwrap(vm.form) as Record<string, unknown>
    const increase = wrapper.find('button[aria-label="Increase expense amount"]')
    const decrease = wrapper.find('button[aria-label="Decrease expense amount"]')

    await increase.trigger('click')
    expect(form.amount).toBe('1')

    // 1 → 0 clears the box: no 0.01 left behind, the amount is simply missing.
    await decrease.trigger('click')
    expect(form.amount).toBe('')

    form.amount = '2.5'
    await nextTick()
    await decrease.trigger('click')
    expect(form.amount).toBe('1.5')
    vi.unstubAllGlobals()
  })

  it('edits an existing rule against its id, in UTC days', async () => {
    const fetch = fetchMock()
    vi.stubGlobal('fetch', fetch)

    const wrapper = await openDialog(RULE)
    const vm = wrapper.vm as unknown as { form: { value?: unknown }; submit: () => Promise<void> }
    const form = unwrap(vm.form) as Record<string, unknown>

    expect(form.description).toBe('Rent')
    expect(form.frequency).toBe('MONTH')
    expect(form.interval).toBe('2')
    // Stored dates are UTC midnights: the input must show that same day.
    expect(form.startDate).toBe('2026-01-31')

    await vm.submit()
    await flushPromises()

    const put = fetch.mock.calls.find(c => (c[1] as RequestInit)?.method === 'PUT')
    expect(put?.[0]).toContain('/recurring/7')
    const body = JSON.parse((put![1] as RequestInit).body as string)
    expect(body.startDate).toBe('2026-01-31')
    expect(wrapper.emitted('saved')).toBeTruthy()
    vi.unstubAllGlobals()
  })

  it('keeps the category of an income rule while the list is still empty', async () => {
    vi.stubGlobal('fetch', networkDown())

    const incomeRule: RecurringRule = {
      ...RULE,
      id: 8,
      type: 'INCOME',
      categoryId: 2,
      description: 'Salary',
      category: { id: 2, name: 'Salary', color: '#34A853', type: 'INCOME' }
    }
    const wrapper = await openDialog(incomeRule)
    const vm = wrapper.vm as unknown as { form: { value?: unknown } }
    const form = unwrap(vm.form) as Record<string, unknown>

    // The type toggle must not mistake the edit prefill for a user switch.
    expect(form.type).toBe('INCOME')
    expect(form.categoryId).toBe(2)
    vi.unstubAllGlobals()
  })
})

it('reuses the rule clientId after a failed write without closing the form', async () => {
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
    Object.assign(vm.form, { amount: '10', description: 'Monthly', categoryId: 1 })
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
