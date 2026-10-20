import { type ComputedRef, computed, onScopeDispose, watch } from 'vue'
import type { DocId, IntegerId } from '@/shared/types/common'

/** How a component that shows an item of a cache keeps it there, and has it asked for (`useCachedItem`). */
export interface CachedItemPinning<I extends DocId | IntegerId> {
  /** The id the component shows the item of; none while it shows none (it is given a title of its own). */
  id: () => I | null | undefined
  /** `pin` and `unpin` of the cache (`defineCached`). */
  pin: (id: I) => void
  unpin: (id: I) => void
  /** Adds the id to the cache and has it fetched, for an id the cache does not have: one its page never added. */
  askFor: (id: I) => void
}

/**
 * `pinning`: the item shown is pinned in its cache while the component shows it, from the start and across a change
 * of its id, and let go as the component goes. The cache, which keeps 1 000 items, drops no pinned one: a chip whose
 * name it had dropped spun till something added the id again. An id the cache does not have is asked for once, as it
 * is shown.
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
        // The new one first: let go first, the one shown before could have the new one dropped.
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
  // Apart from `loaded`, because the placeholder is all an unresolved item has: a consumer reading
  // its fields would draw an empty chip.
  const unresolved = computed(() => cached.value?._unresolved === true)

  return { cached, loaded, unresolved }
}
