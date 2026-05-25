import { type ComputedRef, computed } from 'vue'

export function useCachedItem<T extends { _loaded?: boolean }>(
  getter: () => T | undefined,
): { cached: ComputedRef<T | undefined>; loaded: ComputedRef<boolean> } {
  const cached = computed<T | undefined>(() => {
    const value = getter()
    return value && value._loaded !== false ? value : undefined
  })
  const loaded = computed(() => cached.value !== undefined)

  return { cached, loaded }
}
