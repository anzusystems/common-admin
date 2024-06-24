import { ref } from 'vue'
import type { AnzuUser } from '@/types/AnzuUser'

const currentUsers = ref<Map<string, AnzuUser | undefined>>(new Map())

export const useAuthStore = () => {
  function getCurrentUserBySystem(system: string) {
    return currentUsers.value.get(system)
  }

  function reset() {
    currentUsers.value.clear()
  }

  return {
    currentUsers,
    getCurrentUserBySystem,
    reset,
  }
}
