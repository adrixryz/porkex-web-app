/// <reference types="vite/client" />

// Vuetify only exposes "vuetify/styles" as CSS/Sass (no types).
// This declaration lets vue-tsc resolve the import without changing anything at runtime.
declare module 'vuetify/styles' {
  const content: string
  export default content
}

interface ImportMetaEnv {
  // Origin of the API, e.g. https://porkex-api.onrender.com. Leave it unset to
  // use the dev server proxy, which is what local development wants.
  readonly VITE_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
