import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AssetDetailItemDto } from '@/domains/dam/types/Asset'
import type { DocId } from '@/shared/types/common'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'
import { isNull } from '@/shared/utils/common'

export const AssetDetailTabImageWithRoi = {
  Info: 'meta',
  ROI: 'roi',
} as const
export type AssetDetailTabImageWithRoiType =
  (typeof AssetDetailTabImageWithRoi)[keyof typeof AssetDetailTabImageWithRoi]
export const AssetDetailTabImageWithRoiDefault = AssetDetailTabImageWithRoi.Info

export const useAssetDetailStore = defineStore('commonAdminAssetDetailStore', () => {
  const asset = ref<AssetDetailItemDto | null>(null)
  const authorConflicts = ref<DocId[]>([])
  const dialog = ref<null | UploadQueueKey>(null)
  const loading = ref(false)
  const metadataAreTouched = ref(false)
  const activeTab = ref<AssetDetailTabImageWithRoiType>(AssetDetailTabImageWithRoiDefault)
  const updateUploadStore = ref(false)
  const mainFileSingleUse = ref(false)
  // Pending detail saves, keyed by DAM configuration and asset, until the DAM answers. They never reject.
  // The detail can close before that. A host that rereads the asset after close waits for that asset's saves first.
  // A single page-wide entry made closing one asset wait for another's save. Two DAMs can share an asset id.
  const saves = new Map<string, Promise<void>>()
  const saveKey = (assetId: DocId, configName: string) => `${configName}\u0000${assetId}`
  // Counts detail openings and closings. A read is applied only if the count is unchanged since it began.
  let turn = 0

  function setAsset(data: AssetDetailItemDto | null) {
    asset.value = data
    mainFileSingleUse.value = data?.mainFileSingleUse || false
  }

  /**
   * Opens the detail of queue `key` in loading state and shows the asset returned by `read`.
   * The store is page-wide. Only the read of the last opened detail is applied, and
   * only while it is open. Other answers are ignored and leave the loader as is.
   * `beforeShown` runs for the applied answer before it is shown.
   * A failed read rejects for the host to report. If the detail waits for it, the detail
   * is closed: an empty dialog still covers the page and only its own button closes it.
   */
  async function open(
    key: UploadQueueKey,
    read: () => Promise<AssetDetailItemDto>,
    beforeShown?: (answer: AssetDetailItemDto) => void
  ) {
    const mine = ++turn
    setAsset(null)
    loading.value = true
    dialog.value = key
    try {
      const answer = await read()
      if (mine !== turn) return
      beforeShown?.(answer)
      setAsset(answer)
      loading.value = false
    } catch (e) {
      if (mine === turn) close()
      throw e
    }
  }

  /** Closes the detail. A pending read it was opened with is ignored. */
  function close() {
    turn++
    loading.value = false
    setAsset(null)
    dialog.value = null
  }

  /**
   * Reads the asset for a host that shows the store's asset beside the detail, like the asset list side panel.
   * Applied only if no detail is open and none was opened since the read
   * began. Otherwise the detail would show and save into that asset.
   * Rejects on failure. `wanted`: checked after the response by
   * hosts with their own read order; unwanted answers are ignored.
   * `beforeShown` runs for the applied answer before it is shown.
   */
  async function readBesideDetail(
    read: () => Promise<AssetDetailItemDto>,
    wanted?: () => boolean,
    beforeShown?: (answer: AssetDetailItemDto) => void
  ) {
    const begun = turn
    const answer = await read()
    if (begun !== turn || !isNull(dialog.value)) return
    if (wanted && !wanted()) return
    beforeShown?.(answer)
    setAsset(answer)
  }

  /** Registers a detail save of asset `assetId` under DAM configuration `configName`. */
  function setSaving(assetId: DocId, save: Promise<unknown>, configName: string) {
    const key = saveKey(assetId, configName)
    const answered = save.then(
      () => undefined,
      () => undefined
    )
    const before = saves.get(key)
    const all = before ? Promise.all([before, answered]).then(() => undefined) : answered
    saves.set(key, all)
    void all.then(() => {
      if (saves.get(key) === all) saves.delete(key)
    })
  }

  /** Resolves when all pending saves of `assetId` under `configName` are answered. `null` when none is pending. */
  function savingOf(assetId: DocId, configName: string) {
    return saves.get(saveKey(assetId, configName)) ?? null
  }

  function reset() {
    asset.value = null
    mainFileSingleUse.value = false
  }

  return {
    metadataAreTouched,
    authorConflicts,
    asset,
    loading,
    dialog,
    activeTab,
    updateUploadStore,
    mainFileSingleUse,
    setAsset,
    open,
    close,
    readBesideDetail,
    setSaving,
    savingOf,
    reset,
  }
})
