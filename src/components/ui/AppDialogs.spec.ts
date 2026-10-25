import { afterEach, describe, expect, it, vi } from 'vite-plus/test'
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { defineComponent, nextTick } from 'vue'
import AppConfirmDialog from './AppConfirmDialog.vue'
import AppDialog from './AppDialog.vue'
import AppSnackbar from './AppSnackbar.vue'
import { useSnackbar } from '@/composables/useSnackbar'

enableAutoUnmount(afterEach)

const VDialogStub = {
  props: ['modelValue', 'maxWidth', 'persistent'],
  emits: ['update:modelValue'],
  template: `<div
    v-if="modelValue"
    class="v-dialog"
    :data-max-width="maxWidth"
    :data-persistent="String(persistent)"
  >
    <slot />
  </div>`
}

const VSnackbarStub = {
  props: ['modelValue', 'color', 'timeout', 'location'],
  emits: ['update:modelValue'],
  template: `<div
    v-if="modelValue"
    class="v-snackbar"
    :data-color="color"
    :data-timeout="timeout"
    :data-location="location"
  >
    <slot />
  </div>`
}

const stubs = {
  'v-dialog': VDialogStub,
  'v-snackbar': VSnackbarStub,
  'v-card': { template: '<div class="v-card"><slot /></div>' },
  'v-card-title': { template: '<div class="v-card-title"><slot /></div>' },
  'v-card-text': { template: '<div class="v-card-text"><slot /></div>' },
  'v-card-actions': { template: '<div class="v-card-actions"><slot /></div>' },
  'v-spacer': { template: '<div class="v-spacer" />' },
  'v-btn': { template: '<button><slot /></button>' },
  'v-icon': { template: '<i class="v-icon" />' }
}

describe('AppDialog', () => {
  it('keeps a dirty persistent draft on Escape until discard is accepted', async () => {
    const confirmation = vi.spyOn(window, 'confirm').mockReturnValue(false)
    try {
      const wrapper = mount(AppDialog, {
        props: { modelValue: true, title: 'Draft', persistent: true, dirty: true },
        global: { stubs }
      })
      await wrapper.find('.v-dialog').trigger('keydown', { key: 'Escape' })
      expect(confirmation).toHaveBeenCalledWith(
        'Discard your unsaved changes and leave? Cancel to keep editing.'
      )
      expect(wrapper.emitted('update:modelValue')).toBeUndefined()
      confirmation.mockReturnValue(true)
      await wrapper.find('.v-dialog').trigger('keydown', { key: 'Escape' })
      expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
      expect(wrapper.emitted('close')).toHaveLength(1)
    } finally {
      confirmation.mockRestore()
    }
  })

  it('renders a titled dialog with its default and action slots', () => {
    const wrapper = mount(AppDialog, {
      props: { modelValue: true, title: 'Edit category', maxWidth: 520, persistent: true },
      slots: {
        default: '<p class="body">Body</p>',
        actions: '<button class="save">Save</button>'
      },
      global: { stubs }
    })

    const dialog = wrapper.find('.v-dialog')
    expect(dialog.attributes('data-max-width')).toBe('520')
    expect(dialog.attributes('data-persistent')).toBe('true')
    expect(dialog.attributes('aria-label')).toBe('Edit category')
    expect(wrapper.find('.v-card-title').text()).toContain('Edit category')
    expect(wrapper.find('.v-card-text').classes()).toContain('pa-6')
    expect(wrapper.find('.body').text()).toBe('Body')
    expect(wrapper.find('.save').text()).toBe('Save')
  })

  it('closes from the shared close button', async () => {
    const wrapper = mount(AppDialog, {
      props: { modelValue: true, title: 'Edit category' },
      global: { stubs }
    })

    await wrapper.find('button[aria-label="Close dialog"]').trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('can hide the close button or disable it', async () => {
    const hidden = mount(AppDialog, {
      props: { modelValue: true, title: 'Edit', closable: false },
      global: { stubs }
    })
    expect(hidden.find('button[aria-label="Close dialog"]').exists()).toBe(false)

    const disabled = mount(AppDialog, {
      props: { modelValue: true, title: 'Edit', closeDisabled: true },
      global: { stubs }
    })
    const button = disabled.find('button[aria-label="Close dialog"]')
    expect(button.attributes('disabled')).toBeDefined()

    await button.trigger('click')
    expect(disabled.emitted('update:modelValue')).toBeUndefined()
  })

  it('supports a title slot and opens when the model becomes true', async () => {
    const wrapper = mount(AppDialog, {
      props: { modelValue: false },
      slots: { title: '<span class="custom-title">Custom title</span>', default: 'Body' },
      global: { stubs }
    })

    expect(wrapper.find('.v-dialog').exists()).toBe(false)

    await wrapper.setProps({ modelValue: true })
    expect(wrapper.find('.custom-title').text()).toBe('Custom title')
  })
})

describe('AppConfirmDialog', () => {
  it('treats Escape as cancellation but blocks it while saving or cancellation is disabled', async () => {
    const wrapper = mount(AppConfirmDialog, {
      props: { modelValue: true, title: 'Confirm', persistent: true },
      global: { stubs }
    })
    await wrapper.find('.v-dialog').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    for (const flags of [{ loading: true }, { loading: false, cancelDisabled: true }]) {
      const locked = mount(AppConfirmDialog, {
        props: { modelValue: true, title: 'Saving', persistent: true, ...flags },
        global: { stubs }
      })
      await locked.find('.v-dialog').trigger('keydown', { key: 'Escape' })
      expect(locked.emitted('cancel')).toBeUndefined()
      expect(locked.emitted('update:modelValue')).toBeUndefined()
    }
  })

  it('closes and emits cancel from the cancel button', async () => {
    const wrapper = mount(AppConfirmDialog, {
      props: {
        modelValue: true,
        title: 'Delete tag?',
        message: 'This cannot be undone.',
        confirmLabel: 'Delete',
        cancelLabel: 'Keep'
      },
      global: { stubs }
    })

    expect(wrapper.find('.v-dialog').attributes('aria-label')).toBe('Delete tag?')
    expect(wrapper.text()).toContain('Delete tag?')
    expect(wrapper.text()).toContain('This cannot be undone.')

    const cancel = wrapper.findAll('button').find(button => button.text() === 'Keep')!
    await cancel.trigger('click')

    expect(wrapper.emitted('cancel')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toEqual([[false]])
  })

  it('emits confirm without closing itself', async () => {
    const wrapper = mount(AppConfirmDialog, {
      props: { modelValue: true, title: 'Delete tag?', confirmLabel: 'Delete' },
      global: { stubs }
    })

    const confirm = wrapper.findAll('button').find(button => button.text() === 'Delete')!
    await confirm.trigger('click')

    expect(wrapper.emitted('confirm')).toHaveLength(1)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('locks both buttons and the backdrop while loading', () => {
    const wrapper = mount(AppConfirmDialog, {
      props: { modelValue: true, title: 'Deleting', loading: true },
      global: { stubs }
    })

    expect(wrapper.find('.v-dialog').attributes('data-persistent')).toBe('true')
    for (const button of wrapper.findAll('button')) {
      expect(button.attributes('disabled')).toBeDefined()
    }
  })

  it('honours confirm and cancel disabled flags', () => {
    const wrapper = mount(AppConfirmDialog, {
      props: {
        modelValue: true,
        title: 'Delete',
        confirmDisabled: true,
        cancelDisabled: true
      },
      global: { stubs }
    })

    for (const button of wrapper.findAll('button')) {
      expect(button.attributes('disabled')).toBeDefined()
    }
  })

  it('supports an icon slot and a custom message slot', () => {
    const wrapper = mount(AppConfirmDialog, {
      props: { modelValue: true, title: 'Delete tag?', maxWidth: 420 },
      slots: {
        icon: '<span class="icon-slot">!</span>',
        default: '<strong class="detail">Custom detail</strong>'
      },
      global: { stubs }
    })

    expect(wrapper.find('.v-dialog').attributes('data-max-width')).toBe('420')
    expect(wrapper.find('.icon-slot').text()).toBe('!')
    expect(wrapper.find('.detail').text()).toBe('Custom detail')
    expect(wrapper.find('.v-icon').exists()).toBe(false)
  })
})

describe('AppSnackbar', () => {
  it('shows shared messages and colours', async () => {
    const Host = defineComponent({
      components: { AppSnackbar },
      setup() {
        const { showSnack } = useSnackbar()
        return { showSnack }
      },
      template: `<div>
        <AppSnackbar />
        <button class="show-success" @click="showSnack('Saved')">success</button>
        <button class="show-error" @click="showSnack('Failed', 'error')">error</button>
      </div>`
    })

    const wrapper = mount(Host, { global: { stubs } })

    await wrapper.find('.show-success').trigger('click')
    await nextTick()
    expect(wrapper.find('.v-snackbar').text()).toContain('Saved')
    expect(wrapper.find('.v-snackbar').attributes('data-color')).toBe('success')
    expect(wrapper.find('.v-snackbar').attributes('data-timeout')).toBe('3000')
    expect(wrapper.find('.v-snackbar').attributes('data-location')).toBe('bottom right')

    await wrapper.find('.show-error').trigger('click')
    await nextTick()
    expect(wrapper.find('.v-snackbar').text()).toContain('Failed')
    expect(wrapper.find('.v-snackbar').attributes('data-color')).toBe('error')
  })
})
