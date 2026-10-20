import type { ImageCreateUpdateAware } from '@/domains/dam/types/ImageAware'
import type { IntegerId } from '@/shared/types/common'
import { cloneDeep } from '@/shared/utils/common'

// The saves of an image by the image widgets of the page. A widget drawn again elsewhere (the pin of a sidebar widget
// in admin-cms) is a second widget of the same image, drawn while the save of the widget it replaced may still be on
// its way: it read the image before that save took effect, and "edit metadata" offered the texts it had read, whose
// confirm saved them back over the saved ones. The widget of several images (a gallery) holds each of its images, and
// its save is noted for each of them.
// The note of an image lives while a widget holds the image or a save of it is on its way: the copy may be drawn only
// once its configuration has been read, and a widget of the image drawn on the article opened again reads the image as
// well before that save took effect.
interface SavesOfImage {
  /** The widgets that hold the image. */
  holders: Set<symbol>
  /** The saves on their way, each by its mark. */
  onTheirWay: Set<symbol>
  /** How many have been answered. */
  answered: number
  /** The image as the save answered last has it. */
  saved: ImageCreateUpdateAware | null
  /** What waits for saves on their way to be over: let go once it may go. */
  waiting: Array<{ mayGo: () => boolean; go: () => void }>
}
const saves = new Map<string, SavesOfImage>()
/** The images each widget holds, by the keys of their notes. */
const held = new Map<symbol, Set<string>>()

const keyOf = (config: string, id: IntegerId) => JSON.stringify([config, id])

const savesOf = (key: string) => {
  const known = saves.get(key)
  if (known) return known
  const of: SavesOfImage = { holders: new Set(), onTheirWay: new Set(), answered: 0, saved: null, waiting: [] }
  saves.set(key, of)
  return of
}

/** Dropped once no widget holds the image and no save of it is on its way. */
const dropUnheld = (key: string, of: SavesOfImage) => {
  if (of.holders.size > 0 || of.onTheirWay.size > 0 || saves.get(key) !== of) return
  saves.delete(key)
}

/**
 * The widget `holder` holds the images `ids`, and no other: as it reads them, takes those it is given, or goes. The
 * answer is how many saves of each of them have been answered by then, by its id.
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

/**
 * The widget `holder` holds the image `id`, or none: as it reads the image, takes one it is given, or goes. The answer
 * is how many saves of that image have been answered by then.
 */
export const holdImage = (config: string, holder: symbol, id: IntegerId | null) =>
  id === null ? (holdImages(config, holder, []), 0) : holdImages(config, holder, [id]).get(id)!

/**
 * The save of the image a widget has sent: the other widgets of the image know it is on its way and, once it is
 * answered, what it saved. `own`: the marks of the saves the widget has on their way, which it does not wait for.
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
 * The save of several images at once, as the widget of several images saves them: noted for each image `ids` names, as
 * `noteImageSave` notes one, with that image as the answer has it. An image the answer does not have counts as not
 * saved.
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
    // Said by the save itself, to its widget.
    noteImageSave(config, id, own, one).catch(() => undefined)
  })
  return save
}

/**
 * Once no save of the image by another widget is on its way (`own`: the widget's own): `over`, and `cancel`, which lets
 * the wait go at once and takes it off the note, for an opening that has closed. `null` when none is on its way.
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

/** The image as the save answered last has it, when it has been answered since `answeredBefore` of them were. */
export const imageSavedSince = (config: string, id: IntegerId, answeredBefore: number) => {
  const of = saves.get(keyOf(config, id))
  return !of || !of.saved || of.answered === answeredBefore ? null : cloneDeep(of.saved)
}
