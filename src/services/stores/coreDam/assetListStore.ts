import { acceptHMRUpdate, defineStore } from 'pinia'
import type { AssetSearchListItemDto } from '@/types/coreDam/Asset'
import type { DocId } from '@/types/common'
import { isNull } from '@/lib'
import { th } from 'vuetify/locale'

export interface AssetListItem {
  asset: AssetSearchListItemDto
  active: boolean
  selected: boolean
}

interface State {
  list: AssetListItem[]
  activeItemIndex: null | number
  loader: boolean
}

export const useAssetListStore = defineStore('damAssetListStore', {
  state: (): State => ({
    list: [],
    activeItemIndex: null,
    loader: false,
  }),
  actions: {
    showLoader() {
      this.loader = true
    },
    hideLoader() {
      this.loader = false
    },
    setList(assets: AssetSearchListItemDto[]) {
      this.list = assets.map((asset) => {
        return {
          asset: asset,
          active: false,
          selected: false,
        }
      })
    },
    appendList(assets: AssetSearchListItemDto[]) {
      const items = assets.map((asset) => {
        return {
          asset: asset,
          active: false,
          selected: false,
        }
      })
      this.list = this.list.concat(items)
    },
    toggleSelectedByIndex(index: number) {
      if (!this.list[index]) return
      this.list[index].selected = !this.list[index].selected
    },
    getSelectedIds(): DocId[] {
      return this.list.filter(
        (asset: AssetListItem ) => asset.selected && asset.asset.mainFile
      ).map(
        (asset: AssetListItem ) => asset.asset.mainFile?.id || ''
      )
    },
    reset() {
      this.list = []
      this.activeItemIndex = null
    },
  },
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAssetListStore, import.meta.hot))
}
