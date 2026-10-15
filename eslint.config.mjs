import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import pluginVue from 'eslint-plugin-vue'

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      // vue-eslint-parser only understands <script setup lang="ts"> when it is
      // told to hand the block to the TypeScript parser.
      parserOptions: { parser: tseslint.parser }
    }
  },
  {
    files: ['**/*.{ts,vue}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.es2021 }
    },
    rules: {
      // The API types mirror the backend responses; some views legitimately need
      // a loose value while a dialog is being filled in.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', caughtErrors: 'none' }
      ],
      'vue/multi-word-component-names': 'off',
      // Vuetify's IconValue union uses the bare Function type; the icon set
      // mirrors it on purpose.
      '@typescript-eslint/no-unsafe-function-type': 'off',
      // Formatting rules below are off on purpose: the views use long-form
      // v-slot, blank lines after opening tags and wide tables consistently.
      // Re-enabling them would reformat the whole app for no functional gain.
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/first-attribute-linebreak': 'off',
      'vue/v-slot-style': 'off',
      'vue/html-self-closing': 'off',
      'vue/html-indent': 'off',
      'vue/attributes-order': 'off',
      'vue/html-closing-bracket-newline': 'off'
    }
  },
  {
    files: ['**/*.spec.ts'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } }
  }
)