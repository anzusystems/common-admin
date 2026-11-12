import { useStorage } from '@vueuse/core'

const NAME = 'unreleasedFeatures'

export function useUnreleasedFeatures() {
  const showUnreleasedFeatures = useStorage(NAME, false, localStorage, { writeDefaults: false })

  return {
    showUnreleasedFeatures,
  }
}
