import { acceptHMRUpdate, defineStore } from 'pinia'
import type { AssetSearchListItemDto, DamAssetType } from '@/types/coreDam/Asset'
import { DamAssetType as AssetTypeValue } from '@/types/coreDam/Asset'
import type { DocId } from '@/types/common'
import { computed, ref } from 'vue'

export interface AssetListItem {
  asset: AssetSearchListItemDto
  selected: boolean
}

export const useAssetListStore = defineStore('commonAdminCoreDamAssetListStore', () => {
  const assetListItems = ref<Array<AssetListItem>>([])
  const loader = ref(false)
  const licenceId = ref(0)
  const assetType = ref<AssetTypeValue>(AssetTypeValue.Default)
  const selectedAssets = ref<Map<DocId, AssetListItem>>(new Map())
  const singleMode = ref(false)
  const minCount = ref(0)
  const maxCount = ref(0)

  function showLoader() {
    loader.value = true
  }

  function hideLoader() {
    loader.value = false
  }

  function setLicenceId(value: number) {
    licenceId.value = value
  }

  function setSingleMode(value: boolean) {
    singleMode.value = value
  }

  function setAssetType(value: DamAssetType) {
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
      }
    })
  }

  function appendList(items: AssetSearchListItemDto[]) {
    const assets = items.map((asset) => {
      return {
        asset: asset,
        selected: false,
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

  function addToSelected(assetItem: AssetListItem) {
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
    const fileIds = []
    for (const value of selectedAssets.value.values()) {
      fileIds.push(value.asset.mainFile?.id || '')
    }
    return fileIds
  }

  const isSelectedMax = computed(() => {
    return selectedCount.value >= maxCount.value
  })

  const selectedCount = computed(() => {
    return selectedAssets.value.size
  })

  function reset() {
    assetListItems.value = []
    loader.value = false
    clearSelected()
  }

  return {
    licenceId,
    assetType,
    singleMode,
    minCount,
    maxCount,
    selectedCount,
    selectedAssets,
    loader,
    assetListItems,
    setAssetType,
    setLicenceId,
    setSingleMode,
    setMinCount,
    setMaxCount,
    showLoader,
    hideLoader,
    setList,
    appendList,
    toggleSelectedByIndex,
    getSelectedMainFileIds,
    clearSelected,
    reset,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useAssetListStore, import.meta.hot))
}
