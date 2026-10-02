import { type ComputedRef, computed } from 'vue'

export function useCachedItem<T extends { _loaded?: boolean; _unresolved?: boolean }>(
  getter: () => T | undefined
): { cached: ComputedRef<T | undefined>; loaded: ComputedRef<boolean>; unresolved: ComputedRef<boolean> } {
  const cached = computed<T | undefined>(() => {
    const value = getter()
    if (!value) return undefined
    // `_unresolved` settles the item: return the placeholder so consumers stop showing a spinner.
    return value._loaded !== false || value._unresolved === true ? value : undefined
  })
  const loaded = computed(() => cached.value !== undefined)
  // Apart from `loaded`, because the placeholder is all an unresolved item has: a consumer reading
  // its fields would draw an empty chip.
  const unresolved = computed(() => cached.value?._unresolved === true)

  return { cached, loaded, unresolved }
}
