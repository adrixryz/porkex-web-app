import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import UpdateNotice from './UpdateNotice.vue'
import { useUnsavedChanges } from '@/composables/useUnsavedChanges'
import { activeWrites } from '@/utils/api'

const sw = vi.hoisted(() => ({
  options: undefined as
    | undefined
    | {
        onRegisteredSW: (url: string, registration: ServiceWorkerRegistration) => void
        onNeedReload: () => void
      },
  update: vi.fn(),
  helper: vi.fn(),
  needRefresh: undefined as undefined | { value: boolean }
}))
vi.mock('virtual:pwa-register/vue', async () => {
  const { ref } = await import('vue')
  return {
    useRegisterSW: (options: NonNullable<typeof sw.options>) => {
      sw.options = options
      sw.needRefresh = ref(false)
      return { needRefresh: sw.needRefresh, updateServiceWorker: sw.helper }
    }
  }
})

const stubs = {
  'v-snackbar': {
    props: ['modelValue'],
    template: '<div v-if="modelValue"><slot /><slot name="actions" /></div>'
  },
  'v-btn': { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' }
}
let notice: VueWrapper | undefined
const forms: VueWrapper[] = []
beforeEach(() => {
  vi.clearAllMocks()
  activeWrites.value = 0
  sw.update.mockReset()
  sw.update.mockImplementation(() => undefined)
})
afterEach(() => {
  notice?.unmount()
  notice = undefined
  forms.splice(0).forEach(wrapper => wrapper.unmount())
  activeWrites.value = 0
  vi.restoreAllMocks()
})

async function renderAvailable() {
  notice = mount(UpdateNotice, { global: { stubs } })
  waitingRegistration()
  sw.needRefresh!.value = true
  await flushPromises()
  return notice
}
function dirtyForm() {
  const dirty = ref(false)
  const busy = ref(false)
  forms.push(
    mount(
      defineComponent({
        setup() {
          useUnsavedChanges(
            () => dirty.value,
            () => busy.value
          )
          return () => null
        }
      })
    )
  )
  return { dirty, busy }
}
const updateButton = () => notice!.findAll('button').find(button => button.text() === 'Update')!
const laterButton = () => notice!.findAll('button').find(button => button.text() === 'Later')!

function waitingRegistration() {
  let state: ServiceWorkerState = 'installed'
  const worker = new EventTarget() as ServiceWorker
  Object.defineProperty(worker, 'state', { get: () => state })
  Object.defineProperty(worker, 'postMessage', { value: sw.update })
  const registration = {
    waiting: worker as ServiceWorker | null,
    active: null as ServiceWorker | null
  }
  sw.options!.onRegisteredSW('/sw.js', registration as ServiceWorkerRegistration)
  return {
    worker,
    advance(next: ServiceWorkerState) {
      state = next
      if (next === 'activated') {
        registration.active = worker
        registration.waiting = null
      }
      worker.dispatchEvent(new Event('statechange'))
    }
  }
}

describe('safe update prompts', () => {
  it('messages the observed worker without waiting for the registration helper', async () => {
    sw.helper.mockImplementationOnce(() => new Promise(() => {}))
    await renderAvailable()
    await updateButton().trigger('click')
    expect(sw.update).toHaveBeenCalledExactlyOnceWith({ type: 'SKIP_WAITING' })
    expect(sw.helper).not.toHaveBeenCalled()
  })
  it('waits for explicit acceptance rather than activating a waiting worker', async () => {
    await renderAvailable()
    expect(notice!.text()).toContain('A new version')
    expect(sw.update).not.toHaveBeenCalled()
    await laterButton().trigger('click')
    expect(notice!.text()).not.toContain('A new version')
    expect(sw.update).not.toHaveBeenCalled()
  })

  it('blocks updates for dirty forms, busy forms and in-flight API writes', async () => {
    const form = dirtyForm()
    await renderAvailable()
    form.dirty.value = true
    await flushPromises()
    expect(updateButton().attributes('disabled')).toBeDefined()
    await updateButton().trigger('click')
    expect(sw.update).not.toHaveBeenCalled()
    form.dirty.value = false
    form.busy.value = true
    await flushPromises()
    expect(updateButton().attributes('disabled')).toBeDefined()
    form.busy.value = false
    activeWrites.value = 1
    await flushPromises()
    expect(updateButton().attributes('disabled')).toBeDefined()
    activeWrites.value = 0
    await flushPromises()
    await updateButton().trigger('click')
    expect(sw.update).toHaveBeenCalledExactlyOnceWith({ type: 'SKIP_WAITING' })
  })

  it('keeps a form typed during activation and requires a new explicit reload', async () => {
    const form = dirtyForm()
    await renderAvailable()
    await updateButton().trigger('click')
    await flushPromises()
    form.dirty.value = true
    sw.options!.onNeedReload()
    await flushPromises()
    expect(notice!.text()).toContain('Finish or clear your form')
    expect(updateButton().attributes('disabled')).toBeDefined()
    expect(sw.needRefresh!.value).toBe(false)
    // The active worker no longer needs another SKIP_WAITING message.
    expect(sw.update).toHaveBeenCalledOnce()
  })

  it('another tab activating an update never reloads this tab automatically', async () => {
    await renderAvailable()
    sw.options!.onNeedReload()
    await flushPromises()
    expect(notice!.text()).toContain('A new version')
    expect(sw.update).not.toHaveBeenCalled()
    expect(sw.needRefresh!.value).toBe(false)
  })

  it('reports activation failures and lets the user retry', async () => {
    sw.update.mockImplementationOnce(() => {
      throw new TypeError('Offline')
    })
    await renderAvailable()
    await updateButton().trigger('click')
    await flushPromises()
    expect(notice!.text()).toContain('Could not download')
    expect(updateButton().attributes('disabled')).toBeUndefined()
    await updateButton().trigger('click')
    expect(sw.update).toHaveBeenCalledTimes(2)
  })

  it('observes activation without the Workbox reload callback and preserves a new draft', async () => {
    const form = dirtyForm()
    await renderAvailable()
    const registration = waitingRegistration()
    const remove = vi.spyOn(registration.worker, 'removeEventListener')
    await updateButton().trigger('click')
    form.dirty.value = true
    registration.advance('activated')
    await flushPromises()
    expect(sw.needRefresh!.value).toBe(false)
    expect(notice!.text()).toContain('Finish or clear your form')
    expect(updateButton().attributes('disabled')).toBeDefined()
    expect(remove).toHaveBeenCalledOnce()
    sw.options!.onNeedReload()
    expect(remove).toHaveBeenCalledOnce()
    expect(sw.update).toHaveBeenCalledOnce()
  })

  it('protects writes that start while the accepted worker is activating', async () => {
    await renderAvailable()
    const registration = waitingRegistration()
    await updateButton().trigger('click')
    activeWrites.value = 1
    registration.advance('activated')
    await flushPromises()
    expect(sw.needRefresh!.value).toBe(false)
    expect(updateButton().attributes('disabled')).toBeDefined()
    activeWrites.value = 0
    await flushPromises()
    expect(updateButton().attributes('disabled')).toBeUndefined()
    expect(sw.update).toHaveBeenCalledOnce()
  })

  it('reports a redundant accepted worker instead of remaining busy indefinitely', async () => {
    await renderAvailable()
    const registration = waitingRegistration()
    await updateButton().trigger('click')
    registration.advance('redundant')
    await flushPromises()
    expect(notice!.text()).toContain('Could not download')
    expect(updateButton().attributes('disabled')).toBeUndefined()
  })

  it('removes the activation listener if the update component unmounts', async () => {
    await renderAvailable()
    const registration = waitingRegistration()
    const remove = vi.spyOn(registration.worker, 'removeEventListener')
    await updateButton().trigger('click')
    notice!.unmount()
    notice = undefined
    expect(remove).toHaveBeenCalledOnce()
  })

  it('handles missing chunks with a prompt while retaining unfinished drafts', async () => {
    const form = dirtyForm()
    form.dirty.value = true
    notice = mount(UpdateNotice, { global: { stubs } })
    const event = new Event('vite:preloadError', { cancelable: true })
    window.dispatchEvent(event)
    await flushPromises()
    expect(event.defaultPrevented).toBe(true)
    expect(notice!.text()).toContain('A new version')
    expect(updateButton().attributes('disabled')).toBeDefined()
    expect(sw.update).not.toHaveBeenCalled()
    expect(form.dirty.value).toBe(true)
  })

  it('checks for updates when returning to a visible app and throttles repeated focus', async () => {
    notice = mount(UpdateNotice, { global: { stubs } })
    const update = vi.fn(async () => undefined)
    sw.options!.onRegisteredSW('/sw.js', { update } as unknown as ServiceWorkerRegistration)
    window.dispatchEvent(new Event('focus'))
    window.dispatchEvent(new Event('focus'))
    await flushPromises()
    expect(update).toHaveBeenCalledOnce()
    notice.unmount()
    notice = undefined
    window.dispatchEvent(new Event('focus'))
    expect(update).toHaveBeenCalledOnce()
  })
})
