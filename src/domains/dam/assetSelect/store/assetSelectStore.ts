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

  function setList(items: AssetSearchListItemDto[]) {
    assetListItems.value = items.map((item) => {
      return {
        asset: item,
        selected: false,
        active: false,
      }
    })
  }

  function appendList(items: AssetSearchListItemDto[]) {
    const assets = items.map((asset) => {
      return {
        asset: asset,
        selected: false,
        active: false,
      }
    })
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
    if (isNull(oldActiveIndex)) return
    if (!(oldActiveIndex in assetListItems.value)) return
    assetListItems.value[oldActiveIndex]!.active = false
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
    loader.value = false
    clearSelected()
    if (!all) return
    assetType.value = DamAssetTypeDefault
    inPodcast.value = null
    singleMode.value = false
    minCount.value = 0
    maxCount.value = 0
    activeItemIndex.value = null
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
