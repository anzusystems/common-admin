import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AssetDetailItemDto } from '@/types/coreDam/Asset'

export enum AssetDetailTabImageWithRoi {
  Info = 'meta',
  ROI = 'roi',
  Default = Info,
}

export const useAssetDetailStore = defineStore('commonAssetDetailStore', () => {
  const asset = ref<AssetDetailItemDto | null>(null)
  const dialog = ref(false)
  const activeTab = ref<AssetDetailTabImageWithRoi>(AssetDetailTabImageWithRoi.Default)

  function setAsset(data: AssetDetailItemDto | null) {
    asset.value = data
  }

  function reset() {
    asset.value = null
  }

  return {
    asset,
    setAsset,
    dialog,
    reset,
    activeTab,
  }
})
