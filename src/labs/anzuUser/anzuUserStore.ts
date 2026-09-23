import { acceptHMRUpdate, defineStore } from 'pinia'
import { ref } from 'vue'
import { useAnzuUserFactory } from '@/model/factory/AnzuUserFactory'
import type { AnzuUser } from '@/types/AnzuUser'

/**
 * The one user the owning form is editing. Cross-system pages do not use this -- they hold a
 * result per system and never a single "current" user -- so it stays a single record, the way the
 * admins have it.
 */
export const useAnzuUserOneStore = defineStore('labsAnzuUserOneStore', () => {
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
