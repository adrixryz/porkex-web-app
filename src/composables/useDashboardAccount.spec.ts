import { afterEach, beforeEach, expect, it, vi } from 'vite-plus/test'
import { defineComponent, h } from 'vue'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { useDashboardAccount } from './useDashboardAccount'

const identity = vi.hoisted(() => ({ id: 1 as number | undefined }))
vi.mock('@/utils/api', () => ({
  getUser: () => (identity.id ? { id: identity.id } : null),
  USER_CHANGE_EVENT: 'dashboard-test-user'
}))
enableAutoUnmount(afterEach)
function consumer() {
  let selected!: ReturnType<typeof useDashboardAccount>
  mount(
    defineComponent({
      setup() {
        selected = useDashboardAccount()
        return () => h('div')
      }
    })
  )
  return selected
}
beforeEach(() => {
  localStorage.clear()
  identity.id = 1
})
it('persists locally across mounts without leaking between users', () => {
  const selected = consumer()
  expect(selected.value).toBe('global')
  selected.value = 'cash-1'
  expect(consumer().value).toBe('cash-1')
  identity.id = 2
  window.dispatchEvent(new Event('dashboard-test-user'))
  expect(selected.value).toBe('global')
  selected.value = 'cash-2'
  identity.id = 1
  window.dispatchEvent(new Event('dashboard-test-user'))
  expect(selected.value).toBe('cash-1')
})
it('ignores corrupt storage and tolerates unavailable persistence', () => {
  localStorage.setItem('porkex_dashboard_account_1', 'bad/id')
  const selected = consumer()
  expect(selected.value).toBe('global')
  const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('Denied')
  })
  selected.value = 'cash'
  expect(selected.value).toBe('cash')
  spy.mockRestore()
})
