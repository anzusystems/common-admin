import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { AssetDetailItemDto } from '@/domains/dam/types/Asset'
import type { DocId } from '@/shared/types/common'
import type { UploadQueueKey } from '@/domains/dam/types/UploadQueue'

export const AssetDetailTabImageWithRoi = {
  Info: 'meta',
  ROI: 'roi',
} as const
export type AssetDetailTabImageWithRoiType =
  (typeof AssetDetailTabImageWithRoi)[keyof typeof AssetDetailTabImageWithRoi]
export const AssetDetailTabImageWithRoiDefault = AssetDetailTabImageWithRoi.Info

export const useAssetDetailStore = defineStore('commonAssetDetailStore', () => {
  const asset = ref<AssetDetailItemDto | null>(null)
  const authorConflicts = ref<DocId[]>([])
  const dialog = ref<null | UploadQueueKey>(null)
  const loading = ref(false)
  const metadataAreTouched = ref(false)
  const activeTab = ref<AssetDetailTabImageWithRoiType>(AssetDetailTabImageWithRoiDefault)
  const updateUploadStore = ref(false)
  const mainFileSingleUse = ref(false)
  // The save of the detail that is on its way, until the DAM answers it; it never rejects. The detail can be closed
  // before that: a host that reads the asset again once the detail has closed waits for the save first.
  const saving = shallowRef<Promise<void> | null>(null)

  function setAsset(data: AssetDetailItemDto | null) {
    asset.value = data
    mainFileSingleUse.value = data?.mainFileSingleUse || false
  }

  function setSaving(save: Promise<unknown>) {
    const answered = save.then(
      () => undefined,
      () => undefined
    )
    saving.value = answered
    void answered.then(() => {
      if (saving.value === answered) saving.value = null
    })
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
    saving,
    setAsset,
    setSaving,
    reset,
  }
})
