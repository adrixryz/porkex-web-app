import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Source: public/porkex-icon.svg (white pig on a black tile). The tile is baked
// into the source, and maskable/apple get their padding filled black as well:
// the generator's default background for them is white, which would show as a
// white ring around the icon.
export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: {
      ...minimal2023Preset.maskable,
      resizeOptions: { background: '#000000' }
    },
    apple: {
      ...minimal2023Preset.apple,
      resizeOptions: { background: '#000000' }
    }
  },
  images: ['public/porkex-icon.svg']
})
