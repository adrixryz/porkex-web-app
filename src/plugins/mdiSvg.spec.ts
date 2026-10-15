import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createVuetify } from 'vuetify'
// From the components barrel on purpose: the deep path 'vuetify/components/VIcon'
// resolves to the bare genericComponent, which renders nothing in a test.
import { VIcon } from 'vuetify/components'
import { mdi, aliases } from './mdiSvg'
import { mdiPlus, mdiChevronUp } from '@mdi/js'

// The icon set is registered through a cast (Vuetify types it as a JSX
// component), so the runtime contract is what matters: a VIcon given an MDI
// path must render an <svg> with a real <path d="..."> inside it.
const vuetify = createVuetify({
  icons: { defaultSet: 'mdi', aliases, sets: { mdi } } as never
})
const global = { plugins: [vuetify] }

// VIcon is mounted through a host component: @vue/test-utils tries to stub the
// root component it is given, and stubbing Vuetify's genericComponent fails
// with "Invalid value used as weak map key".
const Host = defineComponent({
  name: 'Host',
  props: { icon: { type: String, default: '' } },
  setup(props) {
    return () => h(VIcon, { icon: props.icon })
  }
})

const render = (icon: string) => mount(Host, { props: { icon }, global })

describe('the MDI icon set', () => {
  it('renders a VIcon with an svg path when given a path string', () => {
    const wrapper = render(mdiPlus)

    const svg = wrapper.find('svg')
    expect(svg.exists()).toBe(true)
    expect(svg.attributes('viewBox')).toBe('0 0 24 24')

    expect(wrapper.find('path').attributes('d')).toBe(mdiPlus)
  })

  it('keeps the path non-empty, so a bad import cannot pass silently', () => {
    expect(render(mdiPlus).find('path').attributes('d')!.length).toBeGreaterThan(10)
  })

  it('renders inside the tag element VIcon asks for, not a bare path', () => {
    // Without the wrapping <i> the icon loses its size and colour classes.
    expect(render(mdiPlus).element.querySelector('i > svg')).not.toBeNull()
  })

  it('two different icons produce two different paths', () => {
    const a = render(mdiPlus).find('path').attributes('d')
    const b = render(mdiChevronUp).find('path').attributes('d')
    expect(a).not.toBe(b)
  })

  it('resolves an alias to its path', () => {
    // $expand is the alias Vuetify uses on accordions and selects.
    expect(render('$expand').find('path').attributes('d')).toBe(aliases.expand)
  })

  it('renders an empty path rather than crashing on a missing icon', () => {
    expect(render('mdi-does-not-exist').find('svg').exists()).toBe(true)
  })
})

describe('the alias table', () => {
  it('covers the aliases Vuetify looks up through $name', () => {
    for (const name of [
      'close', 'delete', 'clear', 'success', 'info', 'warning', 'error',
      'prev', 'next', 'expand', 'menu', 'dropdown', 'checkboxOn', 'checkboxOff',
      'sortAsc', 'sortDesc', 'edit', 'loading', 'search'
    ]) {
      expect(aliases[name], `falta el alias ${name}`).toBeTruthy()
    }
  })

  it('has a real path for every alias', () => {
    for (const [name, path] of Object.entries(aliases)) {
      expect(typeof path, `alias ${name}`).toBe('string')
      expect(path.length, `alias ${name} vacio`).toBeGreaterThan(10)
      expect(path.startsWith('M'), `alias ${name} no parece un path`).toBe(true)
    }
  })
})