import { useAssetListFilter } from '@/model/coreDam/filter/AssetFilter'
import { type AssetSelectListItem, useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { type AssetDetailItemDto, DamAssetType, type DamAssetTypeType } from '@/types/coreDam/Asset'
import { usePagination } from '@/labs/filters/pagination'
import { useAlerts } from '@/composables/system/alerts'
import type { DocId, IntegerId } from '@/types/common'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { fetchAsset, useFetchAssetList } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { useDamCachedAuthors } from '@/components/damImage/uploadQueue/author/cachedAuthors'
import { useDamCachedKeywords } from '@/components/damImage/uploadQueue/keyword/cachedKeywords'
import { useExtSystemIdForCached } from '@/components/damImage/uploadQueue/composables/extSystemIdForCached'
import { isUndefined } from '@/utils/common'
import { useDamCachedUsers } from '@/components/damImage/uploadQueue/author/cachedUsers'
import { useSidebar } from '@/components/dam/assetSelect/composables/assetSelectFilterSidebar'
import { SORT_BY_SCORE } from '@/composables/system/datatableColumns'
import { useFilterClearHelpers } from '@/labs/filters/filterFactory'
import { useDebounceFn } from '@vueuse/core'

const { pagination } = usePagination(SORT_BY_SCORE)
const detailLoading = ref(false)

export function useAssetSelectActions(
  configName = 'default',
  onDetailLoadedCallback?: (asset: AssetDetailItemDto) => void
) {
  const { damClient } = useCommonAdminCoreDamOptions(configName)

  const assetSelectStore = useAssetSelectStore()
  const { selectedCount, selectedAssets, assetListItems, loader } = storeToRefs(assetSelectStore)
  const assetDetailStore = useAssetDetailStore()
  const { openSidebarRight } = useSidebar()

  const { showErrorsDefault } = useAlerts()
  const { filterData, filterConfig } = useAssetListFilter()

  const resolveTypeFilter = (assetType: DamAssetTypeType, inPodcast: boolean | null) => {
    if (inPodcast === true) {
      filterData.type = [DamAssetType.Audio]
      filterData.inPodcast = true
      return
    }
    filterData.type = [assetType]
    filterData.inPodcast = null
  }

  const fetchAssetListDebounced = useDebounceFn(async () => {
    await fetchAssetList()
  })

  const fetchAssetList = async () => {
    resolveTypeFilter(assetSelectStore.assetType, assetSelectStore.inPodcast)
    const { executeFetch } = useFetchAssetList(damClient, assetSelectStore.selectedLicenceId)
    try {
      assetSelectStore.showLoader()
      assetSelectStore.setList(await executeFetch(pagination, filterData, filterConfig))
    } catch (error) {
      showErrorsDefault(error)
    } finally {
      assetSelectStore.hideLoader()
    }
  }

  const fetchNextPage = async () => {
    if (assetSelectStore.loader) return
    pagination.value.page = pagination.value.page + 1
    resolveTypeFilter(assetSelectStore.assetType, assetSelectStore.inPodcast)
    const { executeFetch } = useFetchAssetList(damClient, assetSelectStore.selectedLicenceId)
    try {
      assetSelectStore.showLoader()
      assetSelectStore.appendList(await executeFetch(pagination, filterData, filterConfig))
    } catch (error) {
      showErrorsDefault(error)
    } finally {
      assetSelectStore.hideLoader()
    }
  }

  const { addToCachedAuthors, fetchCachedAuthors } = useDamCachedAuthors()
  const { addToCachedKeywords, fetchCachedKeywords } = useDamCachedKeywords()
  const { addToCachedUsers, fetchCachedUsers } = useDamCachedUsers()

  const onItemClick = async (data: { assetId: DocId; index: number }, extSystem: IntegerId) => {
    const { cachedExtSystemId } = useExtSystemIdForCached()
    openSidebarRight()
    assetSelectStore.toggleSelectedByIndex(data.index)
    assetSelectStore.setActiveByIndex(data.index)
    detailLoading.value = true
    try {
      const asset = await fetchAsset(damClient, data.assetId)
      cachedExtSystemId.value = extSystem
      addToCachedAuthors(asset.authors)
      addToCachedKeywords(asset.keywords)
      addToCachedUsers(asset.modifiedBy, asset.createdBy)
      fetchCachedAuthors()
      fetchCachedKeywords()
      fetchCachedUsers()
      if (!isUndefined(onDetailLoadedCallback)) onDetailLoadedCallback(asset)
      assetDetailStore.setAsset(asset)
    } catch (e) {
      showErrorsDefault(e)
    } finally {
      detailLoading.value = false
    }
  }

  const { clearAll } = useFilterClearHelpers()

  const resetAssetList = async () => {
    clearAll(filterData, filterConfig)
    resolveTypeFilter(assetSelectStore.assetType, assetSelectStore.inPodcast)
    pagination.value.page = 1
    await fetchAssetListDebounced()
  }

  const reset = async () => {
    clearAll(filterData, filterConfig)
    pagination.value.page = 1
    assetSelectStore.reset(true)
    assetDetailStore.reset()
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
    filterData,
    filterConfig,
    selectedCount,
    selectedAssets,
    pagination,
    loader,
    detailLoading,
    assetListItems: assetListItems as Ref<Array<AssetSelectListItem>>,
    getSelectedData: assetSelectStore.getSelectedData,
    onItemClick,
    fetchAssetListDebounced,
    fetchNextPage,
    resetAssetList,
    reset,
    initStoreContext,
  }
}
