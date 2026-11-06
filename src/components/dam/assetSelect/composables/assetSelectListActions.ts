import { useAssetListFilter } from '@/model/coreDam/filter/AssetFilter'
import {
  type AssetSelectListItem,
  useAssetSelectStore,
} from '@/services/stores/coreDam/assetSelectStore'
import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import { ref, unref } from 'vue'
import { type AssetDetailItemDto, DamAssetType, type DamAssetTypeType } from '@/types/coreDam/Asset'
import { usePagination } from '@/labs/filters/pagination'
import { useAlerts } from '@/composables/system/alerts'
import type { DocId } from '@/types/common'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { fetchAsset, useFetchAssetListByLicences } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { useDamCachedAuthors } from '@/components/damImage/uploadQueue/author/cachedAuthors'
import { useDamCachedKeywords } from '@/components/damImage/uploadQueue/keyword/cachedKeywords'
import { useExtSystemIdForCached } from '@/components/damImage/uploadQueue/composables/extSystemIdForCached'
import { cloneDeep, isNull, isUndefined } from '@/utils/common'
import { useDamCachedUsers } from '@/components/damImage/uploadQueue/author/cachedUsers'
import { useDamCachedAssetLicences } from '@/components/damImage/composables/cachedDamAssetLicences'
import { useSidebar } from '@/components/dam/assetSelect/composables/assetSelectFilterSidebar'
import { SORT_BY_SCORE_DATE } from '@/composables/system/datatableColumns'
import { useFilterClearHelpers } from '@/labs/filters/filterFactory'
import { useDebounceFn } from '@vueuse/core'
import { useDisplay } from 'vuetify'

const { pagination } = usePagination(SORT_BY_SCORE_DATE)
const detailLoading = ref(false)
let latestListRequest = 0

// One debounce for every instance: the filter's mount and the picker's licence watcher fetch in the same tick.
const debouncedFetch = useDebounceFn((fetch: () => Promise<void>) => fetch())

export function useAssetSelectActions(
  configName = 'default',
  onDetailLoadedCallback?: (asset: AssetDetailItemDto) => void,
) {
  const { damClient, endPointAsset, showFileInfoEnabled } = useCommonAdminCoreDamOptions(configName)

  const assetSelectStore = useAssetSelectStore()
  const { selectedCount, selectedAssets, assetListItems, loader } = storeToRefs(assetSelectStore)
  const assetDetailStore = useAssetDetailStore()
  const { openSidebarRight } = useSidebar()
  const { mdAndDown } = useDisplay()

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

  const fetchAssetListDebounced = () => debouncedFetch(fetchAssetList)

  // A stale request must not write the pagination of the list that is on screen.
  const fetchLatestList = async (request: number) => {
    const { executeFetch } = useFetchAssetListByLicences(damClient, endPointAsset)
    const requestPagination = ref(cloneDeep(pagination.value))
    const list = await executeFetch(requestPagination, filterData, filterConfig)
    if (request !== latestListRequest) return null
    const answered = unref(requestPagination)
    pagination.value = {
      ...pagination.value,
      hasNextPage: answered.hasNextPage,
      currentViewCount: answered.currentViewCount,
      totalCount: answered.totalCount,
    }
    return list
  }

  const fetchAssetList = async () => {
    if (assetSelectStore.selectedLicenceIds.length === 0) return
    resolveTypeFilter(assetSelectStore.assetType, assetSelectStore.inPodcast)
    filterData.licences = assetSelectStore.selectedLicenceIds
    const request = ++latestListRequest
    try {
      assetSelectStore.showLoader()
      const list = await fetchLatestList(request)
      if (isNull(list)) return
      assetSelectStore.setList(list)
    } catch (error) {
      if (request === latestListRequest) showErrorsDefault(error)
    } finally {
      if (request === latestListRequest) assetSelectStore.hideLoader()
    }
  }

  const fetchNextPage = async () => {
    if (assetSelectStore.loader) return
    pagination.value.page = pagination.value.page + 1
    resolveTypeFilter(assetSelectStore.assetType, assetSelectStore.inPodcast)
    filterData.licences = assetSelectStore.selectedLicenceIds
    const request = ++latestListRequest
    try {
      assetSelectStore.showLoader()
      const list = await fetchLatestList(request)
      if (isNull(list)) return
      assetSelectStore.appendList(list)
    } catch (error) {
      if (request === latestListRequest) showErrorsDefault(error)
    } finally {
      if (request === latestListRequest) assetSelectStore.hideLoader()
    }
  }

  const { addToCachedAuthors, fetchCachedAuthors } = useDamCachedAuthors()
  const { addToCachedKeywords, fetchCachedKeywords } = useDamCachedKeywords()
  const { addToCachedUsers, fetchCachedUsers } = useDamCachedUsers()
  const { addToCachedAssetLicences, fetchCachedAssetLicences } = useDamCachedAssetLicences()

  const onItemClick = async (data: { assetId: DocId; index: number }) => {
    const { cachedExtSystemId } = useExtSystemIdForCached()
    if (!mdAndDown.value) openSidebarRight()
    assetSelectStore.toggleSelectedByIndex(data.index)
    assetSelectStore.setActiveByIndex(data.index)
    detailLoading.value = true
    try {
      const asset = await fetchAsset(damClient, endPointAsset, data.assetId)
      cachedExtSystemId.value = assetSelectStore.selectedSelectConfig.extSystem
      addToCachedAuthors(asset.authors)
      addToCachedKeywords(asset.keywords)
      if (showFileInfoEnabled) {
        addToCachedUsers(asset.modifiedBy, asset.createdBy)
      }
      fetchCachedAuthors()
      fetchCachedKeywords()
      if (showFileInfoEnabled) {
        fetchCachedUsers()
      }
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
    latestListRequest++
    clearAll(filterData, filterConfig)
    pagination.value.page = 1
    assetSelectStore.reset(true)
    assetDetailStore.reset()
  }

  const initStoreContext = (
    selectConfig: DamConfigLicenceExtSystemReturnType[],
    assetType: DamAssetTypeType,
    inPodcast: boolean | null,
    singleMode: boolean,
    minCount: number,
    maxCount: number,
  ): void => {
    assetSelectStore.clearSelected()
    assetSelectStore.setAssetType(assetType)
    assetSelectStore.setSelectConfig(selectConfig)
    addToCachedAssetLicences(selectConfig.map((config) => config.licence))
    fetchCachedAssetLicences()
    assetSelectStore.setSingleMode(singleMode)
    assetSelectStore.setMinCount(minCount)
    assetSelectStore.setMaxCount(maxCount)
    assetSelectStore.inPodcast = inPodcast
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
