import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { useAnzuUserFactory } from '@/domains/anzuUser/factory/AnzuUserFactory'
import type { AnzuUser } from '@/shared/types/AnzuUser'

/**
 * The single user the owning form edits. Cross-system pages keep per-system results instead.
 */
export const useAnzuUserOneStore = defineStore('commonAdminAnzuUserOneStore', () => {
  const { createAnzuUser } = useAnzuUserFactory()

  const anzuUser = ref<AnzuUser>(createAnzuUser())
  const loadingAnzuUser = ref(false)

  function setAnzuUser(newAnzuUser: AnzuUser) {
    anzuUser.value = newAnzuUser
  }

  function setLoadingAnzuUser(loading: boolean) {
    loadingAnzuUser.value = loading
  }

  function reset(system = '', resourceName = 'user') {
    anzuUser.value = createAnzuUser(system, resourceName)
    loadingAnzuUser.value = false
  }

  return {
    anzuUser,
    loadingAnzuUser,
    setAnzuUser,
    setLoadingAnzuUser,
    reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAnzuUserOneStore, import.meta.hot))
}
