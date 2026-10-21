import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import {
  canLeaveForms,
  hasBusyForms,
  hasUnsavedChanges,
  useUnsavedChanges
} from './useUnsavedChanges'

const wrappers: VueWrapper[] = []
afterEach(() => {
  vi.restoreAllMocks()
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
})

function form(dirtyValue = false, busyValue = false) {
  const dirty = ref(dirtyValue)
  const busy = ref(busyValue)
  const wrapper = mount(
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
  wrappers.push(wrapper)
  return { dirty, busy, wrapper }
}

describe('form ownership for update safety', () => {
  it('keeps a dirty form when leaving is canceled and blocks a busy form', () => {
    const current = form(true)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    expect(canLeaveForms()).toBe(false)
    confirm.mockReturnValue(true)
    expect(canLeaveForms()).toBe(true)
    current.busy.value = true
    expect(canLeaveForms()).toBe(false)
  })
  it('protects a browser reload only while there are unfinished changes', () => {
    const current = form(true)
    const event = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    current.dirty.value = false
    const clean = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(clean)
    expect(clean.defaultPrevented).toBe(false)
  })
  it('updates synchronously before a reload can be requested', () => {
    const current = form()
    expect(hasUnsavedChanges.value).toBe(false)
    expect(hasBusyForms.value).toBe(false)
    current.dirty.value = true
    current.busy.value = true
    expect(hasUnsavedChanges.value).toBe(true)
    expect(hasBusyForms.value).toBe(true)
    current.dirty.value = false
    current.busy.value = false
    expect(hasUnsavedChanges.value).toBe(false)
    expect(hasBusyForms.value).toBe(false)
  })

  it('one clean or unmounted form cannot erase another form protection', () => {
    const first = form(true, true)
    const second = form(true, true)
    first.dirty.value = false
    first.busy.value = false
    expect(hasUnsavedChanges.value).toBe(true)
    expect(hasBusyForms.value).toBe(true)
    first.wrapper.unmount()
    expect(hasUnsavedChanges.value).toBe(true)
    second.wrapper.unmount()
    expect(hasUnsavedChanges.value).toBe(false)
    expect(hasBusyForms.value).toBe(false)
  })

  it('removes its own protection when navigation disposes the form', () => {
    const current = form(true, true)
    current.wrapper.unmount()
    expect(hasUnsavedChanges.value).toBe(false)
    expect(hasBusyForms.value).toBe(false)
  })
})
