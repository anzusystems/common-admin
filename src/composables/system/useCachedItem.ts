import { type ShallowRef, nextTick, shallowRef, watch } from 'vue'
import { isUndefined } from '@/utils/common'

export function useCachedItem<T extends { _loaded?: boolean }>(
  getter: () => T | undefined,
): { cached: ShallowRef<T | undefined>; loaded: ShallowRef<boolean> } {
  const cached = shallowRef<T | undefined>(undefined) as ShallowRef<T | undefined>
  const loaded = shallowRef(false)

  const stopWatch = watch(
    getter,
    (newValue) => {
      if (isUndefined(newValue) || newValue._loaded === false) return
      cached.value = newValue
      loaded.value = true
      nextTick(() => stopWatch())
    },
    { immediate: true },
  )

  return { cached, loaded }
}
