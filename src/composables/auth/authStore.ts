import { ref } from 'vue'
import type { AnzuUser } from '@/types/AnzuUser'

const currentUsers = ref<Map<string, AnzuUser | undefined>>(new Map())
const currentUsersLoaded = ref<Map<string, undefined | true>>(new Map())
const isAdminRoleBySystem = ref<Map<string, string>>(new Map())

export const useAuthStore = () => {
  function getCurrentUserBySystem(system: string) {
    return currentUsers.value.get(system)
  }

  function isCurrentUserLoadedBySystem(system: string) {
    return currentUsersLoaded.value.get(system)
  }

  function getAdminRoleBySystem(system: string) {
    return isAdminRoleBySystem.value.get(system)
  }

  function reset() {
    currentUsers.value.clear()
    currentUsersLoaded.value.clear()
    isAdminRoleBySystem.value.clear()
  }

  return {
    currentUsers,
    currentUsersLoaded,
    isAdminRoleBySystem,
    getCurrentUserBySystem,
    getAdminRoleBySystem,
    isCurrentUserLoadedBySystem,
    reset,
  }
}
