import { type ComputedRef, computed } from 'vue'

export function useCachedItem<T extends { _loaded?: boolean; _unresolved?: boolean }>(
  getter: () => T | undefined,
): { cached: ComputedRef<T | undefined>; loaded: ComputedRef<boolean> } {
  const cached = computed<T | undefined>(() => {
    const value = getter()
    if (!value) return undefined
    // `_unresolved` is terminal: return the placeholder so consumers stop showing a spinner.
    return value._loaded !== false || value._unresolved === true ? value : undefined
  })
  const loaded = computed(() => cached.value !== undefined)

  return { cached, loaded }
}
