import { afterEach, expect, it } from 'vite-plus/test'
import { getLanguage, setLanguage, t } from './index'
import { formatDateOnly } from '@/utils/date'

afterEach(() => setLanguage('en'))

it('changes interface language and document metadata while keeping calendar dates intact', () => {
  setLanguage('en')
  expect(t('New Expense')).toBe('New Expense')
  setLanguage('es')
  expect(t('New Expense')).toBe('Nuevo gasto')
  expect(t('Delete "{0}"?', { 0: 'Food' })).toBe('¿Eliminar "Food"?')
  expect(t('Invalid CSV quoting on line 12.')).toBe(
    'Las comillas del CSV no son válidas en la línea 12.'
  )
  expect(t('Category "Food" already belongs to Expense.')).toBe(
    'La categoría "Food" ya pertenece a gasto.'
  )
  expect(document.documentElement.lang).toBe('es')
  expect(localStorage.getItem('porkex_language')).toBe('es')
  expect(
    formatDateOnly('2024-05-20T00:00:00.000Z', { day: 'numeric', month: 'long', year: 'numeric' })
  ).toBe('20 de mayo de 2024')
  setLanguage('invalid')
  expect(getLanguage()).toBe('es')
})
