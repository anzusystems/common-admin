import { useStorage } from '@vueuse/core'

const NAME = 'debugFeatures'

/**
 * Developer diagnostics switch, separate from `useUnreleasedFeatures` on purpose. Enabling
 * work in progress must not arm the error-reporting test buttons, and vice versa.
 * Uses plain localStorage, so it needs no current user and works where the user has no account in a system yet.
 */
export function useDebugFeatures() {
  const showDebugFeatures = useStorage(NAME, false, localStorage, { writeDefaults: false })

  return {
    showDebugFeatures,
  }
}
