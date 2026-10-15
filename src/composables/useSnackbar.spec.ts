import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, nextTick } from 'vue'
import { useSnackbar } from './useSnackbar'

type SnackbarApi = ReturnType<typeof useSnackbar>

// useSnackbar() registers an onUnmounted hook, so it always has to be called
// from inside a component. Each mount gets its own handle to the shared state.
function mountConsumer() {
  let api!: SnackbarApi
  const wrapper = mount(
    defineComponent({
      setup() {
        api = useSnackbar()
        return () => h('div', String(api.snackbar.value))
      }
    })
  )
  return { wrapper, api }
}

describe('useSnackbar', () => {
  it('starts hidden', () => {
    const { wrapper, api } = mountConsumer()
    expect(api.snackbar.value).toBe(false)
    expect(wrapper.text()).toBe('false')
  })

  it('shows the message with the default success color', async () => {
    const { wrapper, api } = mountConsumer()
    api.showSnack('Saved')
    await nextTick()

    expect(api.snackbar.value).toBe(true)
    expect(api.snackMessage.value).toBe('Saved')
    expect(api.snackColor.value).toBe('success')
    expect(wrapper.text()).toBe('true')
  })

  it('accepts a custom color', () => {
    const { api } = mountConsumer()
    api.showSnack('Failed', 'error')

    expect(api.snackMessage.value).toBe('Failed')
    expect(api.snackColor.value).toBe('error')
  })

  // The reason for the refactor: the refs live at module scope, so two
  // components asking for the snackbar get the same state, not a private copy.
  it('is shared between callers', () => {
    const a = mountConsumer()
    const b = mountConsumer()

    expect(a.api.snackbar).toBe(b.api.snackbar)
    expect(a.api.snackMessage).toBe(b.api.snackMessage)
    expect(a.api.snackColor).toBe(b.api.snackColor)
  })

  it('one caller can make the other one visible', async () => {
    const a = mountConsumer()
    const b = mountConsumer()

    a.api.showSnack('From the other view')
    await nextTick()

    expect(b.wrapper.text()).toBe('true')
    expect(b.api.snackMessage.value).toBe('From the other view')
  })

  it('the last message wins when both fire', async () => {
    const a = mountConsumer()
    const b = mountConsumer()

    a.api.showSnack('First')
    b.api.showSnack('Second')
    await nextTick()

    expect(a.api.snackMessage.value).toBe('Second')
  })

  it('resets when the owning view unmounts', async () => {
    const { wrapper, api } = mountConsumer()
    api.showSnack('Leaving soon')
    await nextTick()
    expect(api.snackbar.value).toBe(true)

    // Leaving a view while its message is still on screen must not make the
    // next view mount already showing the old text.
    wrapper.unmount()
    expect(api.snackbar.value).toBe(false)
  })

  it('a view mounting after another closed sees no stale message', async () => {
    const first = mountConsumer()
    first.api.showSnack('Old message')
    await nextTick()
    first.wrapper.unmount()

    const second = mountConsumer()
    await nextTick()

    expect(second.api.snackbar.value).toBe(false)
    expect(second.wrapper.text()).toBe('false')
  })
})