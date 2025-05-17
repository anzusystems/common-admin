import { useDocumentVisibility } from '@vueuse/core'
import { computed } from 'vue'

export function useUserActivity() {
  const visibility = useDocumentVisibility()

  const isWindowActive = computed(() => visibility.value === 'visible')

  return {
    isWindowActive,
    visibility,
  }
}
