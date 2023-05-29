import { acceptHMRUpdate, defineStore } from 'pinia'
import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'
import type { DocId } from '@/types/common'
import type { AssetType } from '@/types/coreDam/Asset'
import { AssetType as AssetTypeValue } from '@/types/coreDam/Asset'

export interface AssetListItem {
  asset: AssetSearchListItemDto
  selected: boolean
}

interface State {
  list: AssetListItem[]
  loader: boolean
  licenceId: number
  assetType: AssetType
  selectedAssets: Record<string, AssetListItem>
  singleMode: boolean
  minCount: number
  maxCount: number
  selectedCount: number
}

export const useAssetListStore = defineStore('commonAdminCoreDamAssetListStore', {
  state: (): State => ({
    list: [],
    loader: false,
    licenceId: 0,
    assetType: AssetTypeValue.Default,
    selectedAssets: {},
    singleMode: true,
    minCount: 0,
    maxCount: 0,
    selectedCount: 0,
  }),
  actions: {
    showLoader() {
      this.loader = true
    },
    hideLoader() {
      this.loader = false
    },
    setLicenceId(licenceId: number) {
      this.licenceId = licenceId
    },
    setSingleMode(singleMode: boolean) {
      this.singleMode = singleMode
    },
    setAssetType(assetType: AssetType) {
      this.assetType = assetType
    },
    setMinCount(count: number) {
      this.minCount = count
    },
    setMaxCount(count: number) {
      this.maxCount = count
    },
    setList(assets: AssetSearchListItemDto[]) {
      this.list = assets.map((asset) => {
        return {
          asset: asset,
          selected: false,
        }
      })
    },
    appendList(assets: AssetSearchListItemDto[]) {
      const items = assets.map((asset) => {
        return {
          asset: asset,
          selected: false,
        }
      })
      this.list = this.list.concat(items)
    },
    toggleSelectedByIndex(index: number) {
      if (!this.list[index]) return

      if (!this.singleMode && this.isSelectedMax() && !this.list[index].selected) {
        return
      }

      this.list[index].selected = !this.list[index].selected

      if (this.singleMode && this.list[index].selected) {
        this.unselectAllExcept(index)
        this.clearSelected()
        this.addToSelected(this.list[index])
        return
      }

      if (!this.singleMode && this.list[index].selected) {
        this.addToSelected(this.list[index])
        return
      }

      this.removeFromSelected(this.list[index].asset.id)
    },
    unselectAllExcept(ignoreIndex: number) {
      this.list
        .filter((item: AssetListItem, index: number) => item.selected && index !== ignoreIndex)
        .map((item: AssetListItem) => (item.selected = false))
    },
    clearSelected() {
      this.selectedAssets = {}
      this.selectedCount = 0
    },
    addToSelected(assetItem: AssetListItem) {
      if (!(assetItem.asset.id in this.selectedAssets)) {
        this.selectedAssets[assetItem.asset.id] = assetItem
        this.selectedCount++
      }
    },
    removeFromSelected(assetId: DocId) {
      if (assetId in this.selectedAssets) {
        delete this.selectedAssets[assetId]
        this.selectedCount--
      }
    },
    getSelectedIds(): DocId[] {
      return Object.keys(this.selectedAssets).map((key) => this.selectedAssets[key].asset.mainFile?.id || '')
    },
    isSelectedMax() {
      return this.selectedCount >= this.maxCount
    },
    reset() {
      this.list = []
      this.loader = false
      this.clearSelected()
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAssetListStore, import.meta.hot))
}
