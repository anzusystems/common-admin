import { useAssetListFilter } from '@/model/coreDam/filter/AssetFilter'
import { type AssetSelectListItem, useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import { ref } from 'vue'
import type { DamAssetTypeType } from '@/types/coreDam/Asset'
import { usePagination } from '@/composables/system/pagination'
import { useFilterHelpers } from '@/composables/filter/filterHelpers'
import { useAlerts } from '@/composables/system/alerts'
import type { DocId, IntegerId } from '@/types/common'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { fetchAsset, fetchAssetList as apiFetchAssetList } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { useDamCachedAuthors } from '@/components/damImage/uploadQueue/author/cachedAuthors'
import { useDamCachedKeywords } from '@/components/damImage/uploadQueue/keyword/cachedKeywords'
import { useExtSystemIdForCached } from '@/components/damImage/uploadQueue/composables/extSystemIdForCached'

const filter = useAssetListFilter()
const pagination = usePagination()
const filterIsTouched = ref(false)
const detailLoading = ref(false)

export function useAssetSelectActions(configName = 'default') {
  const { damClient } = useCommonAdminCoreDamOptions(configName)

  const assetSelectStore = useAssetSelectStore()
  const { selectedCount, selectedAssets, assetListItems, loader } = storeToRefs(assetSelectStore)
  const assetDetailStore = useAssetDetailStore()

  const { resetFilter } = useFilterHelpers()
  const { showErrorsDefault } = useAlerts()

  const fetchAssetList = async () => {
    pagination.page = 1
    try {
      assetSelectStore.showLoader()
      assetSelectStore.setList(
        await apiFetchAssetList(damClient, assetSelectStore.selectedLicenceId, pagination, filter)
      )
    } catch (error) {
      showErrorsDefault(error)
    } finally {
      assetSelectStore.hideLoader()
    }
  }
  const fetchNextPage = async () => {
    pagination.page = pagination.page + 1
    try {
      assetSelectStore.showLoader()
      assetSelectStore.appendList(
        await apiFetchAssetList(damClient, assetSelectStore.selectedLicenceId, pagination, filter)
      )
    } catch (error) {
      showErrorsDefault(error)
    } finally {
      assetSelectStore.hideLoader()
    }
  }

  const { addToCachedAuthors, fetchCachedAuthors } = useDamCachedAuthors()
  const { addToCachedKeywords, fetchCachedKeywords } = useDamCachedKeywords()

  const onItemClick = async (data: { assetId: DocId; index: number }, extSystem: IntegerId) => {
    const { cachedExtSystemId } = useExtSystemIdForCached()
    assetSelectStore.toggleSelectedByIndex(data.index)
    detailLoading.value = true
    try {
      const asset = await fetchAsset(damClient, data.assetId)
      cachedExtSystemId.value = extSystem
      addToCachedAuthors(asset.authors)
      addToCachedKeywords(asset.keywords)
      fetchCachedAuthors()
      fetchCachedKeywords()
      assetDetailStore.setAsset(asset)
    } catch (e) {
      showErrorsDefault(e)
    } finally {
      detailLoading.value = false
    }
  }

  const resetAssetList = async () => {
    assetSelectStore.reset()
    filter.type.default = [assetSelectStore.assetType]
    resetFilter(filter, pagination, fetchAssetList)
  }

  const filterTouch = () => {
    filterIsTouched.value = true
  }
  const filterUnTouch = () => {
    filterIsTouched.value = false
  }

  const initStoreContext = (
    selectConfig: DamConfigLicenceExtSystemReturnType[],
    assetType: DamAssetTypeType,
    singleMode: boolean,
    minCount: number,
    maxCount: number
  ): void => {
    assetSelectStore.clearSelected()
    assetSelectStore.setAssetType(assetType)
    assetSelectStore.setSelectConfig(selectConfig)
    assetSelectStore.setSingleMode(singleMode)
    assetSelectStore.setMinCount(minCount)
    assetSelectStore.setMaxCount(maxCount)
  }

  return {
    damClient,
    filterIsTouched,
    filter,
    selectedCount,
    selectedAssets,
    pagination,
    loader,
    detailLoading,
    assetListItems: assetListItems as Ref<Array<AssetSelectListItem>>,
    getSelectedData: assetSelectStore.getSelectedData,
    onItemClick,
    fetchAssetList,
    fetchNextPage,
    resetAssetList,
    filterTouch,
    filterUnTouch,
    initStoreContext,
  }
}
