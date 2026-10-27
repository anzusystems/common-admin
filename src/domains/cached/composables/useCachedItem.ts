import { type ComputedRef, computed, onScopeDispose, watch } from 'vue'
import type { DocId, IntegerId } from '@/shared/types/common'

/**
 * How a component showing a cached item keeps it pinned and requests it (`useCachedItem`).
 */
export interface CachedItemPinning<I extends DocId | IntegerId> {
  /**
   * Id of the shown item. None while the component shows none, e.g. when it has its own title.
   */
  id: () => I | null | undefined
  pin: (id: I) => void
  unpin: (id: I) => void
  /**
   * Adds the id to the cache and fetches it, for an id its page never added.
   */
  askFor: (id: I) => void
}

/**
 * `pinning`: the shown item stays pinned in its cache while the
 * component shows it, across id changes, and is released on unmount.
 * The cache (1 000 items) never drops pinned items. Without this a chip spun after its item was dropped.
 * An id the cache does not have is requested once when shown.
 */
export function useCachedItem<
  T extends { _loaded?: boolean; _unresolved?: boolean },
  I extends DocId | IntegerId = DocId | IntegerId,
>(
  getter: () => T | undefined,
  pinning?: CachedItemPinning<I>
): { cached: ComputedRef<T | undefined>; loaded: ComputedRef<boolean>; unresolved: ComputedRef<boolean> } {
  if (pinning) {
    let shown: I | null = null
    watch(
      pinning.id,
      (id) => {
        // Pin the new id first. Unpinning the old one first could let the cache drop the new one.
        const before = shown
        shown = id || null
        if (shown) pinning.pin(shown)
        if (before) pinning.unpin(before)
        if (shown && getter() === undefined) pinning.askFor(shown)
      },
      { immediate: true }
    )
    onScopeDispose(() => {
      if (shown) pinning.unpin(shown)
      shown = null
    })
  }
  const cached = computed<T | undefined>(() => {
    const value = getter()
    if (!value) return undefined
    // `_unresolved` settles the item: return the placeholder so consumers stop showing a spinner.
    return value._loaded !== false || value._unresolved === true ? value : undefined
  })
  const loaded = computed(() => cached.value !== undefined)
  // Separate from `loaded`, because an unresolved item is only a placeholder.
  // A consumer reading its fields would draw an empty chip.
  const unresolved = computed(() => cached.value?._unresolved === true)

  return { cached, loaded, unresolved }
}
