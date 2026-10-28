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
  // The active item is found by its asset id, since a reloaded list may have it at another position or not at all.
  // Tracking by position left the new list without an active item, and
  // the item now at that position could not be activated by a click.
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

  // The selection outlives the list it was made in. A list read anew or a further page may bring a selected asset.
  // Its item must show it as selected. Otherwise a click only
  // re-marks it, and at the full count no click can deselect it.
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
    // The active asset may arrive only with a later page of a re-read list.
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

  // An asset listed twice (two pages returned it) is one asset. A click toggles it and every item of it reflects that.
  // Otherwise deselecting one item left the check on the other.
  function toggleSelectedByIndex(index: number) {
    const item = assetListItems.value[index]
    if (!item) return

    if (!singleMode.value && isSelectedMax.value && !item.selected) {
      return
    }

    const assetId = item.asset.id
    const selected = !item.selected
    assetListItems.value.forEach((one) => {
      if (one.asset.id === assetId) one.selected = selected
    })

    if (singleMode.value && selected) {
      unselectAllExcept(assetId)
      clearSelected()
      addToSelected(item)
      return
    }

    if (!singleMode.value && selected) {
      addToSelected(item)
      return
    }

    removeFromSelected(assetId)
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
   * Marks the item of the asset the side panel shows as active. The list keeps finding its active item by that asset.
   * No item is active for `null` or for an asset the list has no item of.
   */
  function setActiveByAssetId(assetId: DocId | null) {
    const index = isNull(assetId) ? -1 : assetListItems.value.findIndex((item) => item.asset.id === assetId)
    assetListItems.value.forEach((item, itemIndex) => {
      item.active = itemIndex === index
    })
    activeItemIndex.value = index < 0 ? null : index
    activeAssetId.value = assetId
  }

  /**
   * Call when the side panel lost the active asset and the list has no item of it.
   * A later list then marks no item beside a panel that shows no asset.
   */
  function forgetActiveAsset() {
    activeAssetId.value = null
  }

  /**
   * The asset the list finds its active item by. It persists while the last list has no item of it, until forgotten.
   */
  function getActiveAssetId() {
    return activeAssetId.value
  }

  function unselectAllExcept(assetId: DocId) {
    assetListItems.value.forEach((item) => {
      if (item.selected && item.asset.id !== assetId) item.selected = false
    })
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

  // The ext system of the licence a picked asset came from, for the image widgets.
  // The config is always set inside the `initStoreContext` flow,
  // so a missing one means a caller reads it outside that flow.
  // A function, not a throwing computed: Pinia devtools read every getter without a try.
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
    setActiveByAssetId,
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
