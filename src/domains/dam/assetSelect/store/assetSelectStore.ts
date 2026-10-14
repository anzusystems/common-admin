import { acceptHMRUpdate, defineStore } from 'pinia'
import type { AssetSearchListItemDto, DamAssetTypeType } from '@/domains/dam/types/Asset'
import { DamAssetTypeDefault } from '@/domains/dam/types/Asset'
import type { DocId, IntegerId } from '@/shared/types/common'
import { computed, ref, toRaw } from 'vue'
import {
  type AssetSelectReturnData,
  AssetSelectReturnType,
  type AssetSelectReturnTypeType,
} from '@/domains/dam/types/AssetSelect'
import type { DamConfigLicenceExtSystemReturnType } from '@/domains/dam/types/DamConfig'
import { isNull, isUndefined } from '@/shared/utils/common'

export interface AssetSelectListItem {
  asset: AssetSearchListItemDto
  selected: boolean
  active: boolean
}

export const useAssetSelectStore = defineStore('commonAdminCoreDamAssetSelectStore', () => {
  const assetListItems = ref<Array<AssetSelectListItem>>([])
  const loader = ref(false)
  const selectedLicenceId = ref<IntegerId>(0)
  const selectConfig = ref<DamConfigLicenceExtSystemReturnType[]>([])
  const assetType = ref<DamAssetTypeType>(DamAssetTypeDefault)
  const inPodcast = ref<boolean | null>(null)
  const selectedAssets = ref<Map<DocId, AssetSelectListItem>>(new Map())
  const singleMode = ref(false)
  const minCount = ref(0)
  const maxCount = ref(0)
  const activeItemIndex = ref<null | number>(null)
  // The asset of the active item: a list read anew has it at another place, or not at all, and the active item is
  // found by it. Kept by its place alone, the new list had no active item, and the one that had come to that place
  // could not be made active by a click.
  const activeAssetId = ref<null | DocId>(null)

  function showLoader() {
    loader.value = true
  }

  function hideLoader() {
    loader.value = false
  }

  function setSelectConfig(value: DamConfigLicenceExtSystemReturnType[]) {
    selectConfig.value = value
    if (value.length === 0) {
      selectedLicenceId.value = 0
      return
    }
    selectedLicenceId.value = value[0]!.licence
  }

  function setSingleMode(value: boolean) {
    singleMode.value = value
  }

  function setAssetType(value: DamAssetTypeType) {
    assetType.value = value
  }

  function setMinCount(value: number) {
    minCount.value = value
  }

  function setMaxCount(value: number) {
    maxCount.value = value
  }

  // The selection outlives the list it was made in: a list read anew (a search, another order) or a further page may
  // bring an asset that is selected. Its item says so, as the count does: drawn unselected, a click on it only put
  // the mark back, and at the full count no click took the asset out.
  function setList(items: AssetSearchListItemDto[]) {
    const activeIndex = items.findIndex((item) => item.id === activeAssetId.value)
    assetListItems.value = items.map((item, index) => {
      return {
        asset: item,
        selected: selectedAssets.value.has(item.id),
        active: index === activeIndex,
      }
    })
    activeItemIndex.value = activeIndex < 0 ? null : activeIndex
  }

  function appendList(items: AssetSearchListItemDto[]) {
    // The asset of the active item may come only with a later page of a list read anew.
    const activeIndex = isNull(activeItemIndex.value) ? items.findIndex((item) => item.id === activeAssetId.value) : -1
    const assets = items.map((asset, index) => {
      return {
        asset: asset,
        selected: selectedAssets.value.has(asset.id),
        active: index === activeIndex,
      }
    })
    if (activeIndex >= 0) activeItemIndex.value = assetListItems.value.length + activeIndex
    assetListItems.value = assetListItems.value.concat(assets)
  }

  function toggleSelectedByIndex(index: number) {
    if (!assetListItems.value[index]) return

    if (!singleMode.value && isSelectedMax.value && !assetListItems.value[index].selected) {
      return
    }

    assetListItems.value[index].selected = !assetListItems.value[index].selected

    if (singleMode.value && assetListItems.value[index].selected) {
      unselectAllExcept(index)
      clearSelected()
      addToSelected(assetListItems.value[index])
      return
    }

    if (!singleMode.value && assetListItems.value[index].selected) {
      addToSelected(assetListItems.value[index])
      return
    }

    removeFromSelected(assetListItems.value[index].asset.id)
  }

  function setActiveByIndex(index: number) {
    const oldActiveIndex = activeItemIndex.value
    if (index === activeItemIndex.value) return
    if (!assetListItems.value[index]) return
    assetListItems.value[index].active = true
    activeItemIndex.value = index
    activeAssetId.value = assetListItems.value[index].asset.id
    if (isNull(oldActiveIndex)) return
    if (!(oldActiveIndex in assetListItems.value)) return
    assetListItems.value[oldActiveIndex]!.active = false
  }

  /**
   * For a list whose side panel has lost the asset of the item that was active, while the list had no item of it: a
   * list read later is to mark no item beside a panel that shows no asset.
   */
  function forgetActiveAsset() {
    activeAssetId.value = null
  }

  /**
   * The asset the list finds its active item by: that of the active item, or of the one that was active, while the
   * list read last has no item of it and it has not been forgotten.
   */
  function getActiveAssetId() {
    return activeAssetId.value
  }

  function unselectAllExcept(ignoreIndex: number) {
    const items = assetListItems.value
    for (let i = 0; i < items.length; i++) {
      if (items[i]!.selected && i !== ignoreIndex) {
        items[i]!.selected = false
      }
    }
  }

  function clearSelected() {
    selectedAssets.value.clear()
  }

  function addToSelected(assetItem: AssetSelectListItem) {
    if (!selectedAssets.value.has(assetItem.asset.id)) {
      selectedAssets.value.set(assetItem.asset.id, assetItem)
    }
  }

  function removeFromSelected(assetId: DocId) {
    if (selectedAssets.value.has(assetId)) {
      selectedAssets.value.delete(assetId)
    }
  }

  function getSelectedMainFileIds(): DocId[] {
    const fileIds: Set<DocId> = new Set()
    for (const value of selectedAssets.value.values()) {
      if (value.asset.mainFile?.id) {
        fileIds.add(value.asset.mainFile.id)
      }
    }
    return Array.from(fileIds)
  }

  function getSelectedAssetIds(): DocId[] {
    return Array.from(selectedAssets.value.keys())
  }

  function getSelectedAssets(): AssetSearchListItemDto[] {
    const assets: Array<AssetSearchListItemDto> = []
    for (const value of selectedAssets.value.values()) {
      assets.push(toRaw(value.asset))
    }
    return assets
  }

  function getSelectedData(
    type: AssetSelectReturnTypeType,
    copyToLicence: undefined | IntegerId
  ): AssetSelectReturnData {
    switch (type) {
      case AssetSelectReturnType.AssetId:
        return {
          type: AssetSelectReturnType.AssetId,
          copyToLicence,
          value: getSelectedAssetIds(),
        }
      case AssetSelectReturnType.Asset:
        return {
          type: AssetSelectReturnType.Asset,
          copyToLicence,
          value: getSelectedAssets(),
        }
      case AssetSelectReturnType.MainFileId:
      default:
        return {
          type: AssetSelectReturnType.MainFileId,
          copyToLicence,
          value: getSelectedMainFileIds(),
        }
    }
  }

  const isSelectedMax = computed(() => {
    return selectedCount.value >= maxCount.value
  })

  const selectedCount = computed(() => {
    return selectedAssets.value.size
  })

  function reset(all: boolean) {
    assetListItems.value = []
    activeItemIndex.value = null
    activeAssetId.value = null
    loader.value = false
    clearSelected()
    if (!all) return
    assetType.value = DamAssetTypeDefault
    inPodcast.value = null
    singleMode.value = false
    minCount.value = 0
    maxCount.value = 0
  }

  const selectedSelectConfig = computed(() => {
    const found = selectConfig.value.find((configItem) => configItem.licence === selectedLicenceId.value)
    if (found) return found
    return selectConfig.value[0]
  })

  // For the image widgets once an asset was picked: the ext system of the licence it came from. The store
  // gets a licence config only when there is one (`initStoreContext` callers return early on an empty
  // list), the list fetch stops without a licence, and nothing empties the config afterwards, so a missing
  // one here is a caller reading it outside that flow. A function rather than the computed throwing: Pinia's
  // devtools read every getter without a try.
  function requireSelectedSelectConfig() {
    const config = selectedSelectConfig.value
    if (isUndefined(config)) {
      throw new Error('assetSelectStore: no licence config selected (the asset select dialog was not opened)')
    }
    return config
  }

  return {
    selectedLicenceId,
    selectConfig,
    assetType,
    inPodcast,
    singleMode,
    minCount,
    maxCount,
    selectedCount,
    selectedAssets,
    loader,
    assetListItems,
    setActiveByIndex,
    forgetActiveAsset,
    getActiveAssetId,
    getSelectedData,
    setAssetType,
    setSelectConfig,
    setSingleMode,
    setMinCount,
    setMaxCount,
    showLoader,
    hideLoader,
    setList,
    appendList,
    toggleSelectedByIndex,
    clearSelected,
    reset,
    selectedSelectConfig,
    requireSelectedSelectConfig,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAssetSelectStore, import.meta.hot))
}
