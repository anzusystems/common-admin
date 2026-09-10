import { acceptHMRUpdate, defineStore } from 'pinia'
import type { AssetSearchListItemDto, DamAssetTypeType } from '@/types/coreDam/Asset'
import { DamAssetTypeDefault } from '@/types/coreDam/Asset'
import type { DocId, IntegerId } from '@/types/common'
import { computed, ref, toRaw } from 'vue'
import {
  type AssetSelectOwner,
  type AssetSelectReturnData,
  AssetSelectReturnType,
  type AssetSelectReturnTypeType,
} from '@/types/coreDam/AssetSelect'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'
import { isNull } from '@/utils/common'

export interface AssetSelectListItem {
  asset: AssetSearchListItemDto
  selected: boolean
  active: boolean
  disabledReason: string | null
}

/**
 * What the subject being picked for allows. Lives with the state that holds it, because the listing
 * filter and the per-item disabled reasons are resolved by several components while only the picker
 * root is given these options.
 */
export interface AssetSelectabilityOptions {
  singleUseAllowed: boolean
  uploadLicence: IntegerId | undefined
  owner: AssetSelectOwner | null
}

export const useAssetSelectStore = defineStore('commonAdminCoreDamAssetSelectStore', () => {
  const assetListItems = ref<Array<AssetSelectListItem>>([])
  const loader = ref(false)
  const selectedLicenceIds = ref<IntegerId[]>([])
  // Which selection (a list view, all licences, or a single one) filled selectedLicenceIds. Shared
  // because the control lives in the filter sidebar while the chips showing the result live in the bar.
  const selectedPresetKey = ref<string>('')
  // `null` means a listing given no selectability rules (AAssetListInner), where nothing is dimmed.
  const selectability = ref<AssetSelectabilityOptions | null>(null)
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
    selectedLicenceIds.value = value.map((config) => config.licence)
  }

  function setSelectedLicenceIds(ids: IntegerId[]) {
    selectedLicenceIds.value = ids
  }

  function setSelectedPresetKey(key: string) {
    selectedPresetKey.value = key
  }

  function setSelectability(value: AssetSelectabilityOptions) {
    selectability.value = value
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
        disabledReason: null,
      }
    })
  }

  // Returns the appended items so the caller can resolve disabled reasons for the new page only,
  // instead of recomputing them for every page scrolled so far.
  function appendList(items: AssetSearchListItemDto[]): AssetSelectListItem[] {
    const assets = items.map((asset) => {
      return {
        asset: asset,
        selected: false,
        active: false,
        disabledReason: null,
      }
    })
    assetListItems.value = assetListItems.value.concat(assets)
    return assets
  }

  function setDisabledReasons(reasons: Map<DocId, string | null>) {
    assetListItems.value.forEach((item) => {
      const reason = reasons.get(item.asset.id)
      // An item the map does not mention was not part of this computation (an earlier page) - its
      // already resolved reason must survive, so a missing key is never applied as "no reason".
      if (reason === undefined) return
      item.disabledReason = reason
    })
  }

  function toggleSelectedByIndex(index: number) {
    if (!assetListItems.value[index]) return
    // Deselecting stays possible: the reasons arrive after the page is fetched, so an already selected
    // item can turn out unusable and the user has to be able to drop it.
    if (assetListItems.value[index].disabledReason && !assetListItems.value[index].selected) return

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
    assetListItems.value[oldActiveIndex].active = false
  }

  function unselectAllExcept(ignoreIndex: number) {
    const items = assetListItems.value
    for (let i = 0; i < items.length; i++) {
      if (items[i].selected && i !== ignoreIndex) {
        items[i].selected = false
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

  function getSelectedData(type: AssetSelectReturnTypeType): AssetSelectReturnData {
    switch (type) {
      case AssetSelectReturnType.AssetId:
        return {
          type: AssetSelectReturnType.AssetId,
          value: getSelectedAssetIds(),
        }
      case AssetSelectReturnType.Asset:
        return {
          type: AssetSelectReturnType.Asset,
          value: getSelectedAssets(),
        }
      case AssetSelectReturnType.MainFileId:
      default:
        return {
          type: AssetSelectReturnType.MainFileId,
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

  const selectedHasDisabled = computed(() => {
    for (const item of selectedAssets.value.values()) {
      if (item.disabledReason) return true
    }
    return false
  })

  // Kept for the upload-queue widgets (single-asset flows): resolves the ext system of the licence
  // the currently picked asset belongs to, defaulting to the first configured licence.
  const selectedSelectConfig = computed(() => {
    const primaryLicenceId = selectedLicenceIds.value[0]
    const found = selectConfig.value.find((configItem) => configItem.licence === primaryLicenceId)
    if (found) return found
    return selectConfig.value[0]
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
    // The store is shared by every picker on the page, so the whole context of the closing one has to
    // go: a kept selectability would dim tiles in a listing that has no such rules, and a kept preset
    // key would make the next picker show the previous selection's label as its own.
    selectability.value = null
    selectedPresetKey.value = ''
    selectedLicenceIds.value = []
  }

  return {
    selectedLicenceIds,
    selectedPresetKey,
    selectability,
    selectConfig,
    assetType,
    inPodcast,
    singleMode,
    minCount,
    maxCount,
    selectedCount,
    selectedHasDisabled,
    selectedAssets,
    loader,
    assetListItems,
    setActiveByIndex,
    getSelectedData,
    setAssetType,
    setSelectConfig,
    setSelectedLicenceIds,
    setSelectedPresetKey,
    setSelectability,
    setSingleMode,
    setMinCount,
    setMaxCount,
    showLoader,
    hideLoader,
    setList,
    appendList,
    setDisabledReasons,
    toggleSelectedByIndex,
    clearSelected,
    reset,
    selectedSelectConfig,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAssetSelectStore, import.meta.hot))
}
