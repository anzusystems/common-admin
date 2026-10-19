import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ImageStoreItem } from '@/domains/dam/types/ImageAware'

export const useImageStore = defineStore('commonAdminImageStore', () => {
  const images = ref<ImageStoreItem[]>([])
  const maxPosition = ref(0)
  // Set by the widget: a read-only one saves nothing, so the mass operations must not change what it shows.
  const readonly = ref(false)
  // The source a pick of authors wrote into a row, by the key of the row: "fill empty" of the mass operations writes
  // their names into the source of a row that offers the authors of the DAM, which does not show it. Once the asset of
  // the row turns out to have authors, the widget gives such a source their names, and leaves one of the image's own.
  // Anything else that writes the source of the row takes the mark away: the source is no pick's from then on, also
  // when its text is the same. A row that goes takes its mark with it.
  const sourcesOfPicks = new Map<string, string>()

  function setImages(data: ImageStoreItem[]) {
    const keys = new Set(data.map((item) => item.key))
    for (const key of sourcesOfPicks.keys()) {
      if (!keys.has(key)) sourcesOfPicks.delete(key)
    }
    images.value = data
  }

  function addImages(data: ImageStoreItem[]) {
    images.value.push(...data)
  }

  function updateMaxPositionIfGreater(newPosition: number) {
    if (newPosition > maxPosition.value) {
      maxPosition.value = newPosition
    }
  }

  function removeImageByIndex(index: number) {
    const [removed] = images.value.splice(index, 1)
    if (removed) sourcesOfPicks.delete(removed.key)
  }

  /** A pick of authors has written their names into the source of the row. */
  function noteSourceOfPick(item: ImageStoreItem) {
    sourcesOfPicks.set(item.key, item.texts.source)
  }

  /** Something else than a pick of authors has written the source of the row. */
  function forgetSourceOfPick(item: ImageStoreItem) {
    sourcesOfPicks.delete(item.key)
  }

  /** Whether the row still has the source a pick of authors wrote into it. */
  function hasSourceOfPick(item: ImageStoreItem) {
    return sourcesOfPicks.get(item.key) === item.texts.source
  }

  function reset() {
    images.value = []
    maxPosition.value = 0
    readonly.value = false
    sourcesOfPicks.clear()
  }

  return {
    images,
    maxPosition,
    readonly,
    setImages,
    addImages,
    updateMaxPositionIfGreater,
    removeImageByIndex,
    noteSourceOfPick,
    forgetSourceOfPick,
    hasSourceOfPick,
    reset,
  }
})
