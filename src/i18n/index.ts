import { ref } from 'vue'
import type { Language } from '@/types'
import es from './es'
import errors from './esErrors'
import { translateDynamicError } from './esDynamic'

const storageKey = 'porkex_language'
const language = ref<Language>(localStorage.getItem(storageKey) === 'es' ? 'es' : 'en')

export function getLanguage(): Language {
  return language.value
}

export function setLanguage(value: unknown): void {
  if (value !== 'en' && value !== 'es') return
  localStorage.setItem(storageKey, value)
  language.value = value
  document.documentElement.lang = value
}

export function useLanguage() {
  return language
}

export function t(
  message: string,
  params: Record<string, string | number | null | undefined> = {}
): string {
  const translated =
    language.value === 'es'
      ? (es[message] ?? errors[message] ?? translateDynamicError(message) ?? message)
      : message
  return translated.replace(/\{(\w+)\}/g, (match, key: string) =>
    Object.hasOwn(params, key) ? String(params[key] ?? '') : match
  )
}

document.documentElement.lang = language.value
window.addEventListener('storage', event => {
  if (event.key === storageKey) {
    language.value = event.newValue === 'es' ? 'es' : 'en'
    document.documentElement.lang = language.value
  }
})
