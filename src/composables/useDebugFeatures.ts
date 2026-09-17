import { useStorage } from '@vueuse/core'

const NAME = 'debugFeatures'

/**
 * Developer tooling switch, kept apart from `useUnreleasedFeatures` on purpose: "unreleased"
 * means a feature still being built, this one means diagnostics. Turning on work in progress
 * should not also arm the error-reporting test buttons, and the other way round.
 *
 * Plain localStorage, so it needs no current user -- which is what makes it usable in an admin
 * where the user may not have an account in any particular system yet.
 */
export function useDebugFeatures() {
  const showDebugFeatures = useStorage(NAME, false, localStorage, { writeDefaults: false })

  return {
    showDebugFeatures,
  }
}
