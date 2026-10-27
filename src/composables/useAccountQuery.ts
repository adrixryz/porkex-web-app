import { computed, watch, type Ref } from 'vue'
import { useRoute, useRouter, type LocationQueryRaw } from 'vue-router'
import { catalogId, catalogSlug } from '@/utils/catalogSlugs'

/** URLs contain readable names; UI values and API requests retain account IDs. */
export function useAccountQuery(accounts: Ref<{ id: string; name: string }[]>) {
  const route = useRoute()
  const router = useRouter()
  const token = () => route.query.account ?? route.query.accountId
  const selection = computed({
    get: () => catalogId(token(), accounts.value, route.query.account === undefined),
    set: (id: string | null) => {
      const query = { ...route.query }
      delete query.accountId
      if (id) query.account = catalogSlug(id, accounts.value)
      else delete query.account
      void router.push({ query })
    }
  })
  watch(
    [accounts, token],
    () => {
      const id = selection.value
      if (!id) return
      const slug = catalogSlug(id, accounts.value)
      if (route.query.account === slug && route.query.accountId === undefined) return
      const query: LocationQueryRaw = { ...route.query, account: slug }
      delete query.accountId
      void router.replace({ query })
    },
    { immediate: true }
  )
  return selection
}
