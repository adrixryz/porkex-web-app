import { describe, expect, it } from 'vite-plus/test'
import { mount } from '@vue/test-utils'
import AppCard from './AppCard.vue'
import AppCardBody from './AppCardBody.vue'
import AppEmptyState from './AppEmptyState.vue'
import AppPage from './AppPage.vue'
import AppPageHeader from './AppPageHeader.vue'
import AppStatCard from './AppStatCard.vue'

const stubs = {
  'v-container': { template: '<div class="v-container"><slot /></div>' },
  'v-row': { template: '<div class="v-row"><slot /></div>' },
  'v-col': { template: '<div class="v-col"><slot /></div>' },
  'v-spacer': { template: '<div class="v-spacer" />' },
  'v-card': { template: '<div class="v-card"><slot /></div>' },
  'v-card-title': { template: '<div class="v-card-title"><slot /></div>' },
  'v-card-text': { template: '<div class="v-card-text"><slot /></div>' },
  'v-card-actions': { template: '<div class="v-card-actions"><slot /></div>' },
  'v-avatar': { template: '<div class="v-avatar"><slot /></div>' },
  'v-icon': { template: '<i class="v-icon" />' }
}

describe('AppPage', () => {
  it('centers authentication content without dashboard width and spacing', () => {
    const wrapper = mount(AppPage, {
      props: { centered: true },
      slots: { default: '<form>Log In and Sign Up</form>' },
      global: { stubs }
    })

    expect(wrapper.classes()).toContain('app-page-centered')
    expect(wrapper.classes()).not.toContain('max-w-1200')
    expect(wrapper.find('form').exists()).toBe(true)
  })
  it('renders its content and merges caller attributes', () => {
    const wrapper = mount(AppPage, {
      attrs: { class: 'custom-page', 'data-test': 'page' },
      slots: { default: '<p class="content">Dashboard</p>' },
      global: { stubs }
    })

    expect(wrapper.find('.content').text()).toBe('Dashboard')
    expect(wrapper.classes()).toContain('custom-page')
    expect(wrapper.classes()).toContain('max-w-1200')
    expect(wrapper.attributes('data-test')).toBe('page')
  })
})

describe('AppPageHeader', () => {
  it('renders a title, subtitle and action slot', () => {
    const wrapper = mount(AppPageHeader, {
      props: { title: 'Budgets', subtitle: 'Keep spending in check' },
      slots: { actions: '<button class="action">New budget</button>' },
      global: { stubs }
    })

    expect(wrapper.find('h1').text()).toBe('Budgets')
    expect(wrapper.text()).toContain('Keep spending in check')
    expect(wrapper.find('.action').text()).toBe('New budget')
  })

  it('lets callers replace the title', () => {
    const wrapper = mount(AppPageHeader, {
      props: { title: 'Fallback' },
      slots: { title: '<h1 class="custom-title">Custom</h1>' },
      global: { stubs }
    })

    expect(wrapper.find('.custom-title').text()).toBe('Custom')
    expect(wrapper.find('h1').text()).toBe('Custom')
  })
})

describe('AppCard', () => {
  it('renders the card shell, header, body and actions', () => {
    const wrapper = mount(AppCard, {
      props: { title: 'Recent', subtitle: 'Last five' },
      attrs: { class: 'custom-card', role: 'region' },
      slots: {
        default: '<p class="body">Body</p>',
        'header-actions': '<button class="header-action">View all</button>',
        actions: '<button class="footer-action">Done</button>'
      },
      global: { stubs }
    })

    const card = wrapper.find('.v-card')
    expect(card.classes()).toContain('custom-card')
    expect(card.attributes('role')).toBe('region')
    expect(wrapper.find('.v-card-title').text()).toContain('Recent')
    expect(wrapper.find('.v-card-title .text-subtitle-1').text()).toBe('Recent')
    expect(wrapper.text()).toContain('Last five')
    expect(wrapper.find('.header-action').exists()).toBe(true)
    expect(wrapper.find('.body').text()).toBe('Body')
    expect(wrapper.find('.footer-action').exists()).toBe(true)
  })

  it('lets callers replace the whole header', () => {
    const wrapper = mount(AppCard, {
      slots: { header: '<div class="custom-header">Custom header</div>', default: 'Body' },
      global: { stubs }
    })

    expect(wrapper.find('.custom-header').text()).toBe('Custom header')
    expect(wrapper.find('.v-card-title').exists()).toBe(false)
  })

  it('uses a title slot when one is provided', () => {
    const wrapper = mount(AppCard, {
      slots: { title: '<span class="title-slot">Custom title</span>', default: 'Body' },
      global: { stubs }
    })

    expect(wrapper.find('.title-slot').text()).toBe('Custom title')
  })
})

describe('AppCardBody', () => {
  it('shares body padding while allowing flush lists and custom dialog spacing', () => {
    const standard = mount(AppCardBody, { slots: { default: 'Chart' }, global: { stubs } })
    expect(standard.classes()).toContain('pa-6')
    const flush = mount(AppCardBody, {
      props: { padding: 'pa-0' },
      attrs: { class: 'overflow-x-auto', role: 'region' },
      slots: { default: '<table />' },
      global: { stubs }
    })
    expect(flush.classes()).toContain('pa-0')
    expect(flush.classes()).not.toContain('pa-6')
    expect(flush.classes()).toContain('overflow-x-auto')
    expect(flush.attributes('role')).toBe('region')
    expect(flush.find('table').exists()).toBe(true)
  })
})

describe('AppEmptyState', () => {
  it('renders icon, title, description and actions', () => {
    const wrapper = mount(AppEmptyState, {
      props: {
        icon: 'mdiReceiptTextClockOutline',
        title: 'No transactions yet',
        description: 'Add your first movement.',
        padding: '12'
      },
      slots: { actions: '<button class="empty-action">Add</button>' },
      global: { stubs }
    })

    expect(wrapper.classes()).toContain('pa-12')
    expect(wrapper.find('.v-icon').attributes('icon')).toBe('mdiReceiptTextClockOutline')
    expect(wrapper.text()).toContain('No transactions yet')
    expect(wrapper.text()).toContain('Add your first movement.')
    expect(wrapper.find('.empty-action').exists()).toBe(true)
  })

  it('omits the icon when none is provided and keeps description spacing without actions', () => {
    const wrapper = mount(AppEmptyState, {
      props: { description: 'Nothing here.' },
      global: { stubs }
    })

    expect(wrapper.find('.v-icon').exists()).toBe(false)
    expect(wrapper.find('p').classes()).not.toContain('mb-6')
  })
})

describe('AppStatCard', () => {
  it('renders an icon, label, value and caption', () => {
    const wrapper = mount(AppStatCard, {
      props: {
        label: 'Total Income',
        value: '+$120',
        icon: 'mdiArrowUpCircleOutline',
        color: 'success',
        valueClass: 'text-success',
        caption: 'This month'
      },
      global: { stubs }
    })

    const avatar = wrapper.find('.v-avatar')
    expect(avatar.attributes('color')).toBe('success')
    expect(avatar.attributes('size')).toBe('56')
    expect(wrapper.find('.v-icon').attributes('icon')).toBe('mdiArrowUpCircleOutline')
    expect(wrapper.text()).toContain('Total Income')
    expect(wrapper.text()).toContain('+$120')
    expect(wrapper.text()).toContain('This month')
    expect(wrapper.find('.text-h5').classes()).toContain('text-success')
  })

  it('omits the avatar when there is no icon', () => {
    const wrapper = mount(AppStatCard, {
      props: { label: 'Remaining', value: '$40' },
      global: { stubs }
    })

    expect(wrapper.find('.v-avatar').exists()).toBe(false)
  })

  it('supports custom label, value and caption slots', () => {
    const wrapper = mount(AppStatCard, {
      props: { label: 'Top Category', value: 'Fallback', labelClass: 'custom-label' },
      slots: {
        value: '<span class="value-slot">Food</span>',
        caption: '<span class="caption-slot">40% of spending</span>'
      },
      global: { stubs }
    })

    expect(wrapper.find('.custom-label').text()).toBe('Top Category')
    expect(wrapper.find('.value-slot').text()).toBe('Food')
    expect(wrapper.text()).not.toContain('Fallback')
    expect(wrapper.find('.caption-slot').text()).toBe('40% of spending')
  })
})
