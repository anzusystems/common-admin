import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ImageStoreItem } from '@/domains/dam/types/ImageAware'
import { hasNoDamCredit } from '@/domains/dam/author/composables/damCredit'

/**
 * A saved gallery row with the DAM sources and authors of the row it was sent as. The rows are paired by position:
 * a row taken over into the upload licence comes back with another file. Its asset is then another one, unknown here,
 * so the row keeps no asset and does not offer the pick; its credit was written into the saved asset.
 * Only a row that offered the pick keeps offering it.
 */
export const keepSentDamCredit = (saved: ImageStoreItem, sent: ImageStoreItem): ImageStoreItem => {
  const takenOver = saved.dam.damId !== sent.dam.damId
  return {
    ...saved,
    damAuthors: sent.damAuthors,
    damSources: sent.damSources,
    showDamAuthors: !takenOver && sent.showDamAuthors && hasNoDamCredit(sent.damAuthors, sent.damSources),
    assetId: takenOver ? undefined : sent.assetId,
  }
}

export const useImageStore = defineStore('commonAdminImageStore', () => {
  const images = ref<ImageStoreItem[]>([])
  const maxPosition = ref(0)
  // Set by the widget. A read-only widget saves nothing, so mass operations must not change what it shows.
  const readonly = ref(false)
  // Source written into a row by an author pick, by row key. "Fill empty"
  // writes names into the hidden source of rows offering DAM authors.
  // When the asset turns out to have authors, such a source gets their names; a user's own source stays.
  // Any other write to the source removes the mark, even with the same text. Removing a row removes its mark.
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

  function noteSourceOfPick(item: ImageStoreItem) {
    sourcesOfPicks.set(item.key, item.texts.source)
  }

  function forgetSourceOfPick(item: ImageStoreItem) {
    sourcesOfPicks.delete(item.key)
  }

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
