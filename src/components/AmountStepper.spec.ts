import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import AmountStepper from './AmountStepper.vue'

// Vuetify components need to be resolved; the plugin would pull the whole
// theme in for two buttons.
const global = {
  stubs: {
    'v-icon': { template: '<i />' }
  }
}

describe('AmountStepper', () => {
  it('emits +1 when the top button is clicked', async () => {
    const wrapper = mount(AmountStepper, { global })
    await wrapper.findAll('button')[0].trigger('click')
    expect(wrapper.emitted('step')).toEqual([[1]])
  })

  it('emits -1 when the bottom button is clicked', async () => {
    const wrapper = mount(AmountStepper, { global })
    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.emitted('step')).toEqual([[-1]])
  })

  it('uses type="button" so it never submits an enclosing form', () => {
    const wrapper = mount(AmountStepper, { global })
    for (const button of wrapper.findAll('button')) {
      expect(button.attributes('type')).toBe('button')
    }
  })

  it('labels the buttons for screen readers', () => {
    const wrapper = mount(AmountStepper, { global })
    const labels = wrapper.findAll('button').map(b => b.attributes('aria-label'))

    expect(labels).toEqual(['Increase amount', 'Decrease amount'])
  })

  it('uses the given label in the aria-labels', () => {
    const wrapper = mount(AmountStepper, { props: { label: 'budget' }, global })
    const labels = wrapper.findAll('button').map(b => b.attributes('aria-label'))

    expect(labels).toEqual(['Increase budget', 'Decrease budget'])
  })
})
