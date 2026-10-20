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
  // The saves of the detail that are on their way, each under the DAM configuration and the asset it saves, until the
  // DAM answers them; they never reject. The detail can be closed before that: a host that reads the asset again once
  // the detail has closed waits for the saves of that asset first. One for the page, it had the closing of the detail
  // of an asset wait for the save of another one; two DAMs may give one asset id.
  const saves = new Map<string, Promise<void>>()
  const saveKey = (assetId: DocId, configName: string) => `${configName}\u0000${assetId}`
  // Counts the openings and the closings of the detail: a read is taken while the count is the one it began under.
  let turn = 0

  function setAsset(data: AssetDetailItemDto | null) {
    asset.value = data
    mainFileSingleUse.value = data?.mainFileSingleUse || false
  }

  /**
   * Opens the detail of the queue `key` on its loader, and has it show the asset `read` answers with. The store is one
   * for the page, and a read may end once its detail has closed, or after another has been opened: only the read of
   * the detail opened last is taken, and only while that detail is open. An answer that is not taken shows no asset
   * and leaves the loader as it is. `beforeShown` runs for the answer that is taken, before the detail shows it.
   * A read that fails rejects here as it did, for the host to say. When it is the read the detail waits for, the
   * detail has nothing to show and is closed: a dialog that draws nothing is still over the whole page, and nothing
   * but its own button closes it.
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

  /** Closes the detail. A read it was opened with and still waits for is given up: its answer is not taken. */
  function close() {
    turn++
    loading.value = false
    setAsset(null)
    dialog.value = null
  }

  /**
   * Reads the asset for a host that shows the asset of the store beside the detail, as the asset list does in its side
   * panel. The answer is taken only while no detail is open, and none has been opened since the read began: a detail
   * would show that asset in place of its own, and its save would go into it. The read rejects here as it did.
   * `wanted`: asked once the read has answered, by a host whose reads have an order of their own; an answer that host
   * no longer wants is not taken either. `beforeShown` runs for the answer that is taken, before the host shows it.
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

  /** A save of the detail of the asset `assetId` under the DAM configuration `configName`. */
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

  /**
   * The saves of the detail of the asset `assetId` under the DAM configuration `configName` on their way, till they are
   * all answered; `null` while none is.
   */
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
