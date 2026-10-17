import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import TagPicker from './TagPicker.vue'
const catalog = vi.hoisted(() => ({ value: [] as { id: string; name: string; position: number }[] }))
vi.mock('@/composables/useTags', () => ({ useTags: () => ({ tags: ref(catalog.value), error: ref('') }) }))
const render = (selected: string[]) => mount(TagPicker, {
  props: { modelValue: selected }, global: { stubs: {
    TagManagerDialog: true,
    'v-chip': { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' },
    'v-btn': { template: '<button><slot /></button>' }
  } }
})
beforeEach(() => { catalog.value = Array.from({ length: 6 }, (_, i) => ({ id: String(i), name: `Tag ${i}`, position: i })) })
describe('tag selection', () => {
  it('selects and deselects using stable IDs without delete controls', async () => {
    const wrapper = render([])
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')![0]).toEqual([['0']])
    await wrapper.setProps({ modelValue: ['0'] })
    await wrapper.findAll('button')[0]!.trigger('click')
    expect(wrapper.emitted('update:modelValue')![1]).toEqual([[]])
    expect(wrapper.text()).toContain('Edit tags')
    expect(wrapper.find('[aria-label^="Delete"]').exists()).toBe(false)
    wrapper.unmount()
  })
  it('limits selection to five while allowing deselection', () => {
    const wrapper = render(['0', '1', '2', '3', '4'])
    expect(wrapper.findAll('button')[5]!.attributes('disabled')).toBeDefined()
    expect(wrapper.findAll('button')[0]!.attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })
})
