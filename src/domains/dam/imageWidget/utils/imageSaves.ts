import type { ImageCreateUpdateAware } from '@/domains/dam/types/ImageAware'
import type { IntegerId } from '@/shared/types/common'
import { cloneDeep } from '@/shared/utils/common'

// Tracks image saves across the page's image widgets.
// A re-rendered widget (sidebar pin in admin-cms) may read the image before the
// previous widget's save lands, and "edit metadata" then saved stale texts back.
// A gallery widget holds and notes each of its images.
// A note lives while a widget holds the image or a save is pending, since the copy
// may mount late, and a reopened article may also read before the save lands.
interface SavesOfImage {
  holders: Set<symbol>
  /** Pending saves, by mark. */
  onTheirWay: Set<symbol>
  /** Number of answered saves. */
  answered: number
  /** The image as returned by the last answered save. */
  saved: ImageCreateUpdateAware | null
  /** Waiters for pending saves to finish; each runs once `mayGo` allows. */
  waiting: Array<{ mayGo: () => boolean; go: () => void }>
}
const saves = new Map<string, SavesOfImage>()
/** Images held by each widget, by note key. */
const held = new Map<symbol, Set<string>>()

const keyOf = (config: string, id: IntegerId) => JSON.stringify([config, id])

const savesOf = (key: string) => {
  const known = saves.get(key)
  if (known) return known
  const of: SavesOfImage = { holders: new Set(), onTheirWay: new Set(), answered: 0, saved: null, waiting: [] }
  saves.set(key, of)
  return of
}

/** Drops the note once no widget holds the image and no save is pending. */
const dropUnheld = (key: string, of: SavesOfImage) => {
  if (of.holders.size > 0 || of.onTheirWay.size > 0 || saves.get(key) !== of) return
  saves.delete(key)
}

/**
 * Sets the images `holder` holds to exactly `ids`, on read, on receive, or on unmount (empty).
 * Returns the answered save count per id at that moment.
 */
export const holdImages = (config: string, holder: symbol, ids: IntegerId[]) => {
  const keys = new Map(ids.map((id) => [id, keyOf(config, id)]))
  const kept = new Set(keys.values())
  held.get(holder)?.forEach((key) => {
    if (kept.has(key)) return
    const of = saves.get(key)
    if (!of) return
    of.holders.delete(holder)
    dropUnheld(key, of)
  })
  if (kept.size === 0) held.delete(holder)
  else held.set(holder, kept)
  const answered = new Map<IntegerId, number>()
  keys.forEach((key, id) => {
    const of = savesOf(key)
    of.holders.add(holder)
    answered.set(id, of.answered)
  })
  return answered
}

/** Single-image form of `holdImages`; `null` holds none. Returns the answered save count of that image. */
export const holdImage = (config: string, holder: symbol, id: IntegerId | null) =>
  id === null ? (holdImages(config, holder, []), 0) : holdImages(config, holder, [id]).get(id)!

/**
 * Notes a sent image save so other widgets of the image know it is pending and, once answered, what it saved.
 * `own`: marks of the widget's own pending saves, which it does not wait for.
 */
export const noteImageSave = async <T extends ImageCreateUpdateAware>(
  config: string,
  id: IntegerId,
  own: Set<symbol>,
  save: Promise<T>
) => {
  const key = keyOf(config, id)
  const of = savesOf(key)
  const mark = Symbol('save')
  of.onTheirWay.add(mark)
  own.add(mark)
  try {
    const saved = await save
    of.answered++
    of.saved = cloneDeep(saved)
    return saved
  } finally {
    of.onTheirWay.delete(mark)
    own.delete(mark)
    of.waiting = of.waiting.filter((one) => {
      if (!one.mayGo()) return true
      one.go()
      return false
    })
    dropUnheld(key, of)
  }
}

/**
 * Notes a multi-image save per id in `ids`, as `noteImageSave` does, using each image from the answer.
 * An image missing from the answer counts as not saved.
 */
export const noteImagesSave = async <T extends ImageCreateUpdateAware>(
  config: string,
  ids: IntegerId[],
  own: Set<symbol>,
  save: Promise<T[]>
) => {
  ids.forEach((id) => {
    const one = save.then((saved) => {
      const image = saved.find((answered) => answered.id === id)
      if (!image) throw new Error('not in the answer')
      return image
    })
    // The error is reported by the save itself to its widget.
    noteImageSave(config, id, own, one).catch(() => undefined)
  })
  return save
}

/**
 * Waits until no other widget's save of the image is pending (`own`: the widget's own saves).
 * Returns `over` and `cancel`, which ends the wait and removes it, for a closed opening. `null` if none is pending.
 */
export const imageSavesOfOthersOver = (config: string, id: IntegerId, own: Set<symbol>) => {
  const of = saves.get(keyOf(config, id))
  if (!of) return null
  const othersOnTheirWay = () => [...of.onTheirWay].some((mark) => !own.has(mark))
  if (!othersOnTheirWay()) return null
  let waiter: SavesOfImage['waiting'][number] | null = null
  const over = new Promise<void>((go) => {
    waiter = { mayGo: () => !othersOnTheirWay(), go }
    of.waiting.push(waiter)
  })
  const cancel = () => {
    of.waiting = of.waiting.filter((one) => one !== waiter)
    waiter?.go()
  }
  return { over, cancel }
}

/** The last saved image, if a save was answered after `answeredBefore` answers. */
export const imageSavedSince = (config: string, id: IntegerId, answeredBefore: number) => {
  const of = saves.get(keyOf(config, id))
  return !of || !of.saved || of.answered === answeredBefore ? null : cloneDeep(of.saved)
}
