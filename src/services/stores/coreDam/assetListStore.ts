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
}

export const useAssetListStore = defineStore('commonAdminCoreDamAssetListStore', {
  state: (): State => ({
    list: [],
    loader: false,
    licenceId: 0,
    assetType: AssetTypeValue.Default,
    selectedAssets: {},
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
    setAssetType(assetType: AssetType) {
      this.assetType = assetType
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
      this.list[index].selected = !this.list[index].selected

      if (this.list[index].selected) {
        this.addToSelected(this.list[index])
        return
      }

      this.removeFromSelected(this.list[index].asset.id)
    },
    addToSelected(assetItem: AssetListItem) {
      this.selectedAssets[assetItem.asset.id] = assetItem
    },
    removeFromSelected(assetId: DocId) {
      delete this.selectedAssets[assetId]
    },
    getSelectedIds(): DocId[] {
      return Object.keys(this.selectedAssets).map((key) => this.selectedAssets[key].asset.mainFile?.id || '')
    },
    reset() {
      this.list = []
      this.loader = false
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAssetListStore, import.meta.hot))
}
