import { describe, expect, it, vi } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import { h } from 'vue'
import { createVuetify } from 'vuetify'
import { mdiPencil } from '@mdi/js'
import { mdi, aliases } from '@/plugins/mdiSvg'
import AppButton from './AppButton.vue'
import AppIconButton from './AppIconButton.vue'
import AppSelect from './AppSelect.vue'
import AppTextField from './AppTextField.vue'

const VBtnStub = { template: '<button><slot /></button>' }

const VIconStub = {
  props: ['icon'],
  template: '<i class="v-icon" :data-icon="icon" />'
}

const VTextFieldStub = {
  props: ['modelValue', 'density', 'hideDetails', 'prefix'],
  emits: ['update:modelValue'],
  template: `<div
    class="v-text-field"
    :data-density="density"
    :data-hide-details="hideDetails === undefined ? undefined : String(hideDetails)"
  >
    <input :value="modelValue" @input="$emit('update:modelValue', $event.target.value)" />
    <slot name="append-inner" />
  </div>`
}

const VSelectStub = {
  props: ['modelValue', 'items', 'density', 'hideDetails'],
  emits: ['update:modelValue'],
  template: `<div
    class="v-select"
    :data-density="density"
    :data-hide-details="hideDetails === undefined ? undefined : String(hideDetails)"
  >
    <button class="select-change" @click="$emit('update:modelValue', 'next')">change</button>
    <slot name="selection" :item="items && items[0]" />
    <slot name="item" :item="items && items[0]" />
  </div>`
}

const stubs = {
  'v-btn': VBtnStub,
  'v-icon': VIconStub,
  'v-text-field': VTextFieldStub,
  'v-select': VSelectStub
}

const realVuetify = createVuetify({
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } } as never
})

describe('AppButton', () => {
  it('renders the default slot and shared defaults', () => {
    const wrapper = mount(AppButton, { slots: { default: 'Save' }, global: { stubs } })
    const button = wrapper.find('button')

    expect(button.text()).toBe('Save')
    expect(button.attributes('elevation')).toBe('0')
    expect(button.attributes('rounded')).toBe('pill')
  })

  it('lets callers override the defaults and forwards listeners', async () => {
    const onClick = vi.fn()
    const wrapper = mount(AppButton, {
      attrs: { elevation: '4', rounded: 'lg', onClick },
      global: { stubs }
    })
    const button = wrapper.find('button')

    expect(button.attributes('elevation')).toBe('4')
    expect(button.attributes('rounded')).toBe('lg')

    await button.trigger('click')
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe('AppIconButton', () => {
  it('labels the button and defaults to a non-submitting button', () => {
    const wrapper = mount(AppIconButton, {
      props: { icon: 'mdiPencil', label: 'Edit item' },
      global: { stubs }
    })
    const button = wrapper.find('button')

    expect(button.attributes('aria-label')).toBe('Edit item')
    expect(button.attributes('type')).toBe('button')
    expect(button.attributes('icon')).toBeDefined()
    expect(wrapper.find('.v-icon').attributes('data-icon')).toBe('mdiPencil')
  })

  it('allows overriding type and size', () => {
    const wrapper = mount(AppIconButton, {
      props: { icon: 'mdiCheck', label: 'Save', type: 'submit', size: 'large' },
      global: { stubs }
    })
    const button = wrapper.find('button')

    expect(button.attributes('type')).toBe('submit')
    expect(button.attributes('size')).toBe('large')
  })

  it('renders a real Vuetify icon inside the button', async () => {
    const wrapper = mount(AppIconButton, {
      props: { icon: mdiPencil, label: 'Edit item' },
      global: { plugins: [realVuetify] }
    })
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.v-icon svg').exists()).toBe(true)
    expect(wrapper.find('.v-icon path').attributes('d')).toBe(mdiPencil)
  })
})

describe('AppTextField', () => {
  it('leaves density and details to the Vuetify defaults', () => {
    const wrapper = mount(AppTextField, { global: { stubs } })
    const field = wrapper.find('.v-text-field')

    expect(field.attributes('data-density')).toBeUndefined()
    expect(field.attributes('data-hide-details')).toBeUndefined()
  })

  it('forwards v-model and caller overrides', async () => {
    const update = vi.fn()
    const wrapper = mount(AppTextField, {
      attrs: {
        modelValue: 'abc',
        'onUpdate:modelValue': update,
        density: 'comfortable',
        hideDetails: false
      },
      global: { stubs }
    })

    const field = wrapper.find('.v-text-field')
    expect(field.attributes('data-density')).toBe('comfortable')
    expect(field.attributes('data-hide-details')).toBe('false')
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('abc')

    await wrapper.find('input').setValue('xyz')
    expect(update).toHaveBeenCalledWith('xyz')
  })

  it('forwards named slots to the underlying field', () => {
    const wrapper = mount(AppTextField, {
      slots: { 'append-inner': '<span class="append-inner">+</span>' },
      global: { stubs }
    })

    expect(wrapper.find('.append-inner').exists()).toBe(true)
  })
})

describe('AppSelect', () => {
  it('uses Vuetify defaults and forwards v-model', async () => {
    const update = vi.fn()
    const wrapper = mount(AppSelect, {
      attrs: {
        modelValue: 1,
        items: [{ name: 'Food' }],
        'onUpdate:modelValue': update
      },
      global: { stubs }
    })
    const select = wrapper.find('.v-select')

    expect(select.attributes('data-density')).toBeUndefined()
    expect(select.attributes('data-hide-details')).toBeUndefined()

    await wrapper.find('.select-change').trigger('click')
    expect(update).toHaveBeenCalledWith('next')
  })

  it('forwards selection and item slots with their scope', () => {
    const wrapper = mount(AppSelect, {
      attrs: { modelValue: 1, items: [{ name: 'Food' }] },
      slots: {
        selection: ({ item }: { item: { name: string } }) =>
          h('span', { class: 'selection' }, item.name),
        item: ({ item }: { item: { name: string } }) =>
          h('span', { class: 'item-option' }, item.name)
      },
      global: { stubs }
    })

    expect(wrapper.find('.selection').text()).toBe('Food')
    expect(wrapper.find('.item-option').text()).toBe('Food')
  })

  it('forwards caller overrides', () => {
    const wrapper = mount(AppSelect, {
      attrs: { density: 'comfortable', hideDetails: false },
      global: { stubs }
    })
    const select = wrapper.find('.v-select')

    expect(select.attributes('data-density')).toBe('comfortable')
    expect(select.attributes('data-hide-details')).toBe('false')
  })
})
