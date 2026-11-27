import { useEventListener } from '@vueuse/core'
import { shallowRef } from 'vue'
import { compareLiveListingKeys, type LiveListingKey } from '@/domains/filters/datatable/composables/useLiveListing'

export interface UseSeenRecordsOptions<T> {
  /** localStorage key, one per list. */
  storageKey: string
  /** An autoincrement id, or a UTC datetime string in one format. */
  key: (item: T) => LiveListingKey
  /** How long a record stays seen after the user saw it. Default 7 days. */
  ttlMs?: number
}

interface SeenRecordsState {
  /** Everything up to this key was in the list when the user came the first time; `null` before that. */
  upTo: LiveListingKey | null
  /** Records seen since, by key, with the time they were seen. */
  seen: Record<string, number>
}

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Records the user has seen, kept in the browser. On the first visit everything the list shows counts as seen,
 * so only what comes later stands out.
 */
export function useSeenRecords<T>(options: UseSeenRecordsOptions<T>) {
  const ttlMs = options.ttlMs ?? 7 * DAY_MS
  const empty = (): SeenRecordsState => ({ upTo: null, seen: {} })
  const read = (): SeenRecordsState => {
    try {
      const raw = localStorage.getItem(options.storageKey)
      if (!raw) return empty()
      const parsed = JSON.parse(raw)
      return {
        upTo: typeof parsed?.upTo === 'number' || typeof parsed?.upTo === 'string' ? parsed.upTo : null,
        seen: parsed?.seen && typeof parsed.seen === 'object' ? parsed.seen : {},
      }
    } catch {
      return empty()
    }
  }
  const now = Date.now()
  const stored = read()
  const kept = Object.entries(stored.seen).filter(([, at]) => now - at < ttlMs)
  const state = shallowRef<SeenRecordsState>({ ...stored, seen: Object.fromEntries(kept) })
  // Written at once, without vueuse's useLocalStorage: it skips a second write within one tick, and a click
  // that opens a record may leave the page right after it.
  const write = (next: SeenRecordsState) => {
    state.value = next
    try {
      localStorage.setItem(options.storageKey, JSON.stringify(next))
    } catch {
      // Full or blocked storage: the marks last until the page closes.
    }
  }
  useEventListener(window, 'storage', (event: StorageEvent) => {
    if (event.key === options.storageKey) state.value = read()
  })

  if (kept.length !== Object.keys(stored.seen).length) write({ ...stored, seen: Object.fromEntries(kept) })

  /** Called with the first list the user sees; on the first visit it marks all of it as seen. */
  const initialize = (items: T[]) => {
    const first = items[0]
    if (state.value.upTo !== null || first === undefined) return
    const newest = items.reduce<LiveListingKey>((max, item) => {
      const key = options.key(item)
      return compareLiveListingKeys(key, max) > 0 ? key : max
    }, options.key(first))
    write({ ...state.value, upTo: newest })
  }

  const isSeen = (item: T) => {
    const key = options.key(item)
    const upTo = state.value.upTo
    return (upTo !== null && compareLiveListingKeys(key, upTo) <= 0) || String(key) in state.value.seen
  }

  const markSeen = (item: T | T[]) => {
    const items = Array.isArray(item) ? item : [item]
    const fresh = items.filter((one) => !isSeen(one))
    if (fresh.length === 0) return
    const at = Date.now()
    const seen = { ...state.value.seen }
    for (const one of fresh) seen[String(options.key(one))] = at
    write({ ...state.value, seen })
  }

  return {
    initialize,
    isSeen,
    markSeen,
  }
}
