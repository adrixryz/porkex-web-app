import { defineComponent, h, type PropType } from 'vue'

// What Vuetify accepts as an icon value. Mirrors its own IconValue union.
type IconValue = string | Function | object | unknown[]
import {
  // The aliases Vuetify reaches for through the `$name` syntax: pagination
  // arrows, select dropdown, chip close, checkbox states, sort arrows and so
  // on. Without them those slots render nothing.
  mdiChevronUp,
  mdiChevronDown,
  mdiChevronLeft,
  mdiChevronRight,
  mdiCheck,
  mdiCheckCircle,
  mdiCloseCircle,
  mdiClose,
  mdiInformation,
  mdiAlertCircle,
  mdiMenu,
  mdiMenuDown,
  mdiDotsHorizontal,
  mdiCheckboxMarked,
  mdiCheckboxBlankOutline,
  mdiMinusBox,
  mdiCircle,
  mdiArrowUp,
  mdiArrowDown,
  mdiRadioboxMarked,
  mdiRadioboxBlank,
  mdiPencil,
  mdiStarOutline,
  mdiStar,
  mdiStarHalfFull,
  mdiCached,
  mdiPageFirst,
  mdiPageLast,
  mdiUnfoldMoreHorizontal,
  mdiPaperclip,
  mdiPlus,
  mdiMinus,
  mdiCalendar,
  mdiEyedropper,
  mdiCloudUpload,
  mdiPalette,
  mdiAppleKeyboardCommand,
  mdiAppleKeyboardControl,
  mdiKeyboardSpace,
  mdiArrowLeft,
  mdiArrowRight,
  mdiBackspace,
  mdiPlay,
  mdiPause,
  mdiFullscreen,
  mdiFullscreenExit,
  mdiVolumeHigh,
  mdiVolumeMedium,
  mdiVolumeLow,
  mdiVolumeVariantOff,
  mdiMagnify,
  mdiClockOutline
} from '@mdi/js'

/**
 * Renders an MDI path as inline SVG.
 *
 * This replaces the icon font (@mdi/font) that used to be loaded: the font
 * shipped 7,477 class definitions and a 394 KB woff2 to render the 40 icons
 * this app uses. Vuetify's own `mdi-svg` iconset cannot be reused here — its
 * aliases carry a `svg:` prefix that Vuetify never strips, so they render as
 * an empty path — and VSvgIcon is not exported from `vuetify/components`.
 *
 * VIcon renders the set component with `tag` (an <i> by default) and `icon` (the
 * path string), so this mirrors the structure Vuetify's own SVG icon uses: the
 * tag element wrapping the <svg>.
 *
 * @mdi/js is a single ESM module full of named exports (`export var mdiFoo =
 * "path"`). It has no side effects, so Rollup drops the ~7,000 icons nobody
 * imports and only the paths named below and in the views survive in the
 * bundle. Adding an icon later means importing it from '@mdi/js' and using it
 * as `:icon="mdiFoo"` — the catalog is unchanged.
 */
const SvgPath = defineComponent({
  name: 'SvgPath',
  inheritAttrs: false,
  props: {
    // Mirrors Vuetify's IconProps: tag is required and may also be a component,
    // icon accepts the same union Vuetify does, disabled is forwarded untouched.
    icon: { type: [String, Function, Object, Array] as PropType<IconValue>, default: undefined },
    tag: { type: [String, Object, Function] as PropType<string | object>, required: true },
    disabled: { type: Boolean, default: undefined }
  },
  setup(props, { attrs }) {
    return () =>
      h(props.tag as string, attrs, [
        h(
          'svg',
          {
            class: 'v-icon__svg',
            xmlns: 'http://www.w3.org/2000/svg',
            viewBox: '0 0 24 24',
            role: 'img',
            'aria-hidden': 'true'
          },
          [h('path', { d: typeof props.icon === 'string' ? props.icon : '' })]
        )
      ])
  }
})

// Matches the key set of the iconset this replaces.
export const aliases: Record<string, string> = {
  collapse: mdiChevronUp,
  complete: mdiCheck,
  cancel: mdiCloseCircle,
  close: mdiClose,
  delete: mdiCloseCircle,
  clear: mdiCloseCircle,
  success: mdiCheckCircle,
  info: mdiInformation,
  warning: mdiAlertCircle,
  error: mdiCloseCircle,
  prev: mdiChevronLeft,
  next: mdiChevronRight,
  checkboxOn: mdiCheckboxMarked,
  checkboxOff: mdiCheckboxBlankOutline,
  checkboxIndeterminate: mdiMinusBox,
  delimiter: mdiCircle,
  sortAsc: mdiArrowUp,
  sortDesc: mdiArrowDown,
  expand: mdiChevronDown,
  menu: mdiMenu,
  subgroup: mdiMenuDown,
  dropdown: mdiMenuDown,
  radioOn: mdiRadioboxMarked,
  radioOff: mdiRadioboxBlank,
  edit: mdiPencil,
  ratingEmpty: mdiStarOutline,
  ratingFull: mdiStar,
  ratingHalf: mdiStarHalfFull,
  loading: mdiCached,
  first: mdiPageFirst,
  last: mdiPageLast,
  unfold: mdiUnfoldMoreHorizontal,
  file: mdiPaperclip,
  plus: mdiPlus,
  minus: mdiMinus,
  calendar: mdiCalendar,
  treeviewCollapse: mdiMenuDown,
  treeviewExpand: mdiChevronRight,
  tableGroupCollapse: mdiChevronDown,
  tableGroupExpand: mdiChevronRight,
  eyeDropper: mdiEyedropper,
  upload: mdiCloudUpload,
  color: mdiPalette,
  command: mdiAppleKeyboardCommand,
  ctrl: mdiAppleKeyboardControl,
  space: mdiKeyboardSpace,
  shift: mdiAppleKeyboardControl,
  alt: mdiAppleKeyboardCommand,
  enter: mdiArrowRight,
  arrowup: mdiArrowUp,
  arrowdown: mdiArrowDown,
  arrowleft: mdiArrowLeft,
  arrowright: mdiArrowRight,
  backspace: mdiBackspace,
  play: mdiPlay,
  pause: mdiPause,
  fullscreen: mdiFullscreen,
  fullscreenExit: mdiFullscreenExit,
  volumeHigh: mdiVolumeHigh,
  volumeMedium: mdiVolumeMedium,
  volumeLow: mdiVolumeLow,
  volumeOff: mdiVolumeVariantOff,
  search: mdiMagnify,
  // Used by the views themselves, not by Vuetify.
  clock: mdiClockOutline,
  more: mdiDotsHorizontal
}

/**
 * The shape `createVuetify({ icons })` expects. Vuetify's own `IconSet` is not
 * exported from the package root, and its `component` is typed as
 * `JSXComponent<IconProps>` — a JSX shape that only its untyped .js iconsets
 * satisfy. Declaring the minimal contract here keeps the app off that internal
 * type; mdiSvg.spec.ts mounts a real VIcon and checks the <path> it produces,
 * so the runtime behaviour is covered by a test rather than by a cast.
 */
export interface SvgIconSet {
  component: (props: { icon?: string; tag: string }) => unknown
}

export const mdi = { component: SvgPath } as unknown as SvgIconSet
