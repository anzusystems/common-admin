import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AssetDetailItemDto } from '@/types/coreDam/Asset'
import type { DocId } from '@/types/common'
import type { UploadQueueKey } from '@/types/coreDam/UploadQueue'

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

  function setAsset(data: AssetDetailItemDto | null) {
    asset.value = data
  }

  function reset() {
    asset.value = null
  }

  return {
    metadataAreTouched,
    authorConflicts,
    asset,
    loading,
    dialog,
    activeTab,
    updateUploadStore,
    setAsset,
    reset,
  }
})
