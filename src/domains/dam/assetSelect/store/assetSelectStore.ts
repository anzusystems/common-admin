import { acceptHMRUpdate, defineStore } from 'pinia'
import type { AssetSearchListItemDto, AssetSingleUseUsage, DamAssetTypeType } from '@/domains/dam/types/Asset'
import { DamAssetTypeDefault } from '@/domains/dam/types/Asset'
import type { DocId, IntegerId } from '@/shared/types/common'
import { computed, ref, toRaw } from 'vue'
import {
  type AssetSelectReturnData,
  AssetSelectReturnType,
  type AssetSelectReturnTypeType,
  type AssetSelectUsageHolder,
} from '@/domains/dam/types/AssetSelect'
import type { DamConfigLicenceExtSystemReturnType } from '@/domains/dam/types/DamConfig'
import { isNull, isUndefined } from '@/shared/utils/common'

export interface AssetSelectListItem {
  asset: AssetSearchListItemDto
  selected: boolean
  active: boolean
  /** Why the asset cannot be picked here, shown on its item and in the side panel. `null` when it can. */
  disabledReason: string | null
}

/** What decides whether a listed asset may be picked: the picker's props (`AAssetSelect`, `AAssetSelectMedia`). */
export interface AssetSelectabilityOptions {
  singleUseAllowed: boolean
  uploadLicence: IntegerId | undefined
  usageHolder: AssetSelectUsageHolder | null
}

export const useAssetSelectStore = defineStore('commonAdminCoreDamAssetSelectStore', () => {
  const assetListItems = ref<Array<AssetSelectListItem>>([])
  const loader = ref(false)
  // The licences the list is read from: one, or those of a list view. The preset control chooses them.
  const selectedLicenceIds = ref<IntegerId[]>([])
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
  }

  // The list reloads on every change of the licences; the same licences again are no change.
  function setSelectedLicenceIds(ids: IntegerId[]) {
    const current = selectedLicenceIds.value
    if (ids.length === current.length && ids.every((id) => current.includes(id))) return
    selectedLicenceIds.value = ids
  }

  function licenceTitle(licenceId: IntegerId) {
    return selectConfig.value.find((config) => config.licence === licenceId)?.licenceName || String(licenceId)
  }

  function setSelectedPresetKey(key: string) {
    selectedPresetKey.value = key
  }

  function setSelectability(value: AssetSelectabilityOptions | null) {
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

  // The selection outlives the list it was made in. A list read anew or a further page may bring a selected asset.
  // Its item must show it as selected. Otherwise a click only
  // re-marks it, and at the full count no click can deselect it.
  // A selected asset keeps its reason until the reasons of the new items arrive, so it is not undimmed meanwhile.
  function setList(items: AssetSearchListItemDto[]) {
    const activeIndex = items.findIndex((item) => item.id === activeAssetId.value)
    assetListItems.value = items.map((item, index) => {
      return {
        asset: item,
        selected: selectedAssets.value.has(item.id),
        active: index === activeIndex,
        disabledReason: selectedAssets.value.get(item.id)?.disabledReason ?? null,
      }
    })
    activeItemIndex.value = activeIndex < 0 ? null : activeIndex
  }

  /** Returns the items it added, whose single use usage and reasons the caller resolves. */
  function appendList(items: AssetSearchListItemDto[]): AssetSelectListItem[] {
    // The active asset may arrive only with a later page of a re-read list.
    const activeIndex = isNull(activeItemIndex.value) ? items.findIndex((item) => item.id === activeAssetId.value) : -1
    const assets = items.map((asset, index) => {
      return {
        asset: asset,
        selected: selectedAssets.value.has(asset.id),
        active: index === activeIndex,
        disabledReason: selectedAssets.value.get(asset.id)?.disabledReason ?? null,
      }
    })
    if (activeIndex >= 0) activeItemIndex.value = assetListItems.value.length + activeIndex
    assetListItems.value = assetListItems.value.concat(assets)
    // The added items as the list holds them, reactive, for the reasons written into them later.
    return assetListItems.value.slice(assetListItems.value.length - assets.length)
  }

  /** Every item of an asset: its listed items (one per page that returned it) and the item of its selection. */
  const itemsOfAsset = (assetId: DocId) => {
    const items = assetListItems.value.filter((item) => item.asset.id === assetId)
    const selected = selectedAssets.value.get(assetId)
    if (selected && !items.includes(selected)) items.push(selected)
    return items
  }

  // An asset the map does not mention was not part of this computation (an earlier page), so its reason stays.
  // The selection keeps the item it was made in, which a re-read list replaced, so that item gets the reason too:
  // the confirm is blocked by a selected asset that turned out unusable.
  function setDisabledReasons(reasons: Map<DocId, string | null>) {
    reasons.forEach((reason, assetId) => {
      itemsOfAsset(assetId).forEach((item) => {
        item.disabledReason = reason
      })
    })
  }

  function setSingleUseUsage(assetId: DocId, usage: AssetSingleUseUsage | null) {
    itemsOfAsset(assetId).forEach((item) => {
      item.asset.singleUseUsage = usage
    })
  }

  // The latest usage read of each asset (`startUsageRead`), of the usage tab and of the pages of the list alike. Kept
  // here: the tab is mounted anew for every item shown and the pages are read by several instances, so a slow read
  // started before applied its older usage over a newer one.
  const usageReads = new Map<DocId, number>()
  let usageReadTurn = 0

  /** Starts a usage read of an asset. Its answer applies while `isLatestUsageRead`: no newer read, no reset. */
  function startUsageRead(assetId: DocId): number {
    usageReadTurn++
    usageReads.set(assetId, usageReadTurn)
    return usageReadTurn
  }

  function isLatestUsageRead(assetId: DocId, turn: number): boolean {
    return usageReads.get(assetId) === turn
  }

  // Every page of a list asks for its usages. An outage of that endpoint would show an alert per page.
  let usageFailureShown = false

  /** Whether a failed usage lookup of the list may show its alert: once per opened picker. */
  function claimUsageFailureAlert(): boolean {
    if (usageFailureShown) return false
    usageFailureShown = true
    return true
  }

  // An asset listed twice (two pages returned it) is one asset. A click toggles it and every item of it reflects that.
  // Otherwise deselecting one item left the check on the other.
  function toggleSelectedByIndex(index: number) {
    const item = assetListItems.value[index]
    if (!item) return
    // Deselecting stays possible: the reasons arrive after the page is fetched, so an already
    // selected item can turn out unusable and the user has to be able to drop it.
    // In single mode a click picks instead of the earlier pick, so a disabled one drops the earlier pick.
    if (item.disabledReason && !item.selected) {
      if (singleMode.value) {
        unselectAllExcept(item.asset.id)
        clearSelected()
      }
      return
    }

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

  function getSelectedData(type: AssetSelectReturnTypeType, forceTakeOver: boolean): AssetSelectReturnData {
    switch (type) {
      case AssetSelectReturnType.AssetId:
        return {
          type: AssetSelectReturnType.AssetId,
          forceTakeOver,
          value: getSelectedAssetIds(),
        }
      case AssetSelectReturnType.Asset:
        return {
          type: AssetSelectReturnType.Asset,
          forceTakeOver,
          value: getSelectedAssets(),
        }
      case AssetSelectReturnType.MainFileId:
      default:
        return {
          type: AssetSelectReturnType.MainFileId,
          forceTakeOver,
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

  function reset(all: boolean) {
    assetListItems.value = []
    activeItemIndex.value = null
    activeAssetId.value = null
    loader.value = false
    clearSelected()
    // A read still on its way is of the list or the picker left: its usage holder may be another record.
    usageReads.clear()
    if (!all) return
    usageFailureShown = false
    assetType.value = DamAssetTypeDefault
    inPodcast.value = null
    singleMode.value = false
    minCount.value = 0
    maxCount.value = 0
    selectability.value = null
    selectedPresetKey.value = ''
    selectedLicenceIds.value = []
  }

  // The config of the first selected licence. All licences of a list view share its ext system.
  const selectedSelectConfig = computed(() => {
    const primaryLicenceId = selectedLicenceIds.value[0]
    const found = selectConfig.value.find((configItem) => configItem.licence === primaryLicenceId)
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
    setActiveByAssetId,
    forgetActiveAsset,
    getActiveAssetId,
    getSelectedData,
    setAssetType,
    setSelectConfig,
    setSelectedLicenceIds,
    licenceTitle,
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
    setSingleUseUsage,
    startUsageRead,
    isLatestUsageRead,
    claimUsageFailureAlert,
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
