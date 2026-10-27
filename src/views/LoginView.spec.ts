import { afterEach, beforeEach, describe, expect, it, vi } from 'vite-plus/test'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import LoginView from './LoginView.vue'
import { hasBusyForms, hasUnsavedChanges } from '@/composables/useUnsavedChanges'
import { deferred } from '@/utils/locks.test-helper'

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  authApi: vi.fn(),
  setToken: vi.fn(),
  setUser: vi.fn(),
  applyPreferences: vi.fn(),
  protectProfileChanges: vi.fn((user: Record<string, unknown>) => user)
}))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('@/utils/api', () => ({
  authApi: mocks.authApi,
  setToken: mocks.setToken,
  setUser: mocks.setUser
}))
vi.mock('@/utils/currency', () => ({ setCurrencyByCode: vi.fn() }))
vi.mock('@/utils/preferences', () => ({ applyPreferences: mocks.applyPreferences }))
vi.mock('@/utils/profile', () => ({ protectProfileChanges: mocks.protectProfileChanges }))

const stubs = {
  'v-defaults-provider': { props: ['defaults'], template: '<slot />' },
  'v-container': { template: '<div><slot /></div>' },
  'v-card': { template: '<div><slot /></div>' },
  'v-card-text': { template: '<div><slot /></div>' },
  'v-tabs': { name: 'TabsStub', props: ['modelValue'], template: '<div><slot /></div>' },
  'v-tab': { template: '<button type="button"><slot /></button>' },
  'v-form': { template: '<form><slot /></form>' },
  'v-alert': { template: '<div role="alert"><slot /></div>' },
  'v-text-field': {
    props: ['modelValue', 'label', 'type'],
    emits: ['update:modelValue'],
    template:
      '<input :aria-label="label" :type="type" :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />'
  },
  'v-btn': { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' }
}

let wrapper: VueWrapper | undefined
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{"registrationEnabled":false}'))
  )
  mocks.authApi.mockResolvedValue(new Response('{"error":"Invalid credentials"}', { status: 401 }))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.unstubAllGlobals()
})

function render() {
  wrapper = mount(LoginView, { global: { stubs } })
  return wrapper
}

async function fillLogin() {
  await wrapper!.get('input[aria-label="Email"]').setValue('me@example.com')
  await wrapper!.get('input[aria-label="Password"]').setValue('secret123')
}

describe('registration configuration', () => {
  it('recovers a failed config without remounting and groups recovery events', async () => {
    const recovered = deferred<Response>()
    const fetch = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Offline'))
      .mockImplementation(() => recovered.promise)
    vi.stubGlobal('fetch', fetch)
    render()
    await flushPromises()
    expect(wrapper!.text()).toContain('Retry')
    window.dispatchEvent(new Event('online'))
    window.dispatchEvent(new Event('focus'))
    expect(fetch).toHaveBeenCalledTimes(2)
    recovered.resolve(new Response('{"registrationEnabled":true}'))
    await flushPromises()
    expect(wrapper!.text()).not.toContain('Retry')
    expect(wrapper!.text()).toContain('Sign Up')
  })
  it('keeps the registration tab visible while checking server permission', async () => {
    const config = deferred<Response>()
    vi.stubGlobal(
      'fetch',
      vi.fn(() => config.promise)
    )
    render()
    expect(wrapper!.text()).toContain('Sign Up')
    config.resolve(new Response('{"registrationEnabled":true}'))
    await flushPromises()
    expect(wrapper!.text()).toContain('Sign Up')
    const request = vi.mocked(fetch).mock.calls[0]
    expect(request?.[0]).toBe('/auth/config')
    expect(request?.[1]?.method ?? 'GET').toBe('GET')
  })

  it.each([
    ['disabled', () => Promise.resolve(new Response('{"registrationEnabled":false}'))],
    ['malformed permission', () => Promise.resolve(new Response('{"registrationEnabled":"true"}'))],
    ['invalid JSON', () => Promise.resolve(new Response('<html>offline</html>'))],
    ['server failure', () => Promise.resolve(new Response('{}', { status: 503 }))],
    ['network failure', () => Promise.reject(new TypeError('Offline'))]
  ])('keeps login available with %s configuration', async (_label, load) => {
    vi.stubGlobal('fetch', vi.fn(load))
    render()
    await flushPromises()
    expect(wrapper!.text().includes('Sign Up')).toBe(_label !== 'disabled')
    await fillLogin()
    await wrapper!.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.authApi).toHaveBeenCalledWith('/login', {
      email: 'me@example.com',
      password: 'secret123'
    })
  })

  it('does not register if the tab is changed without server permission', async () => {
    render()
    await flushPromises()
    wrapper!.findComponent({ name: 'TabsStub' }).vm.$emit('update:modelValue', 'register')
    await flushPromises()
    await wrapper!.get('form').trigger('submit')
    expect(mocks.authApi).not.toHaveBeenCalled()
  })

  it('registers through the existing endpoint when enabled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{"registrationEnabled":true}'))
    )
    render()
    await flushPromises()
    wrapper!.findComponent({ name: 'TabsStub' }).vm.$emit('update:modelValue', 'register')
    await flushPromises()
    await wrapper!.get('input[aria-label="Full Name"]').setValue('Me')
    await wrapper!.get('input[aria-label="Email"]').setValue('me@example.com')
    await wrapper!.get('input[aria-label="Password (min 6 chars)"]').setValue('secret123')
    await wrapper!.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.authApi).toHaveBeenCalledWith('/register', {
      name: 'Me',
      email: 'me@example.com',
      password: 'secret123'
    })
  })
})

describe('login and update protection', () => {
  it('stores a successful session and opens the dashboard', async () => {
    const user = { id: 1, name: 'Me', email: 'me@example.com' }
    mocks.authApi.mockResolvedValue(new Response(JSON.stringify({ token: 'token', user })))
    render()
    await fillLogin()
    await wrapper!.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.setToken).toHaveBeenCalledWith('token')
    expect(mocks.setUser).toHaveBeenCalledWith(user)
    expect(mocks.push).toHaveBeenCalledWith('/')
  })

  it('applies a pending language choice when signing back into its account', async () => {
    const user = { id: 1, name: 'Me', email: 'me@example.com', language: 'en' }
    const effective = { ...user, language: 'es' }
    mocks.protectProfileChanges.mockReturnValueOnce(effective)
    mocks.authApi.mockResolvedValue(new Response(JSON.stringify({ token: 'token', user })))
    render()
    await fillLogin()
    await wrapper!.get('form').trigger('submit')
    await flushPromises()
    expect(mocks.protectProfileChanges).toHaveBeenCalledWith(user)
    expect(mocks.setUser).toHaveBeenLastCalledWith(effective)
    expect(mocks.applyPreferences).toHaveBeenCalledWith(effective)
    expect(mocks.push).toHaveBeenCalledWith('/')
  })

  it('protects credentials and active login attempts from PWA reloads', async () => {
    const loggingIn = deferred<Response>()
    mocks.authApi.mockReturnValue(loggingIn.promise)
    render()
    expect(hasUnsavedChanges.value).toBe(false)
    await fillLogin()
    expect(hasUnsavedChanges.value).toBe(true)
    await wrapper!.get('form').trigger('submit')
    expect(hasBusyForms.value).toBe(true)
    // Repeated Enter cannot launch a duplicate authentication request.
    await wrapper!.get('form').trigger('submit')
    expect(mocks.authApi).toHaveBeenCalledOnce()
    loggingIn.resolve(new Response('{"error":"Invalid credentials"}', { status: 401 }))
    await flushPromises()
    expect(hasBusyForms.value).toBe(false)
    expect(wrapper!.text()).toContain('Invalid credentials')
    wrapper!.unmount()
    wrapper = undefined
    expect(hasUnsavedChanges.value).toBe(false)
    expect(hasBusyForms.value).toBe(false)
    expect(localStorage.getItem('secret123')).toBeNull()
  })
})
