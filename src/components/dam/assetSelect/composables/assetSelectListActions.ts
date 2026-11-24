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
import type { AssetSelectUsageHolder } from '@/types/coreDam/AssetSelect'
import { getSingleUseGroupId } from '@/components/dam/assetSelect/composables/assetSelectSingleUseUsage'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useImageSingleUseUsageFetch } from '@/components/damImage/composables/commonAdminImageOptions'
import { fetchAsset, useFetchAssetListByLicences } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { useDamCachedAuthors } from '@/components/damImage/uploadQueue/author/cachedAuthors'
import { useDamCachedKeywords } from '@/components/damImage/uploadQueue/keyword/cachedKeywords'
import { useExtSystemIdForCached } from '@/components/damImage/uploadQueue/composables/extSystemIdForCached'
import { cloneDeep, isNull, isUndefined } from '@/utils/common'
import { useDamCachedUsers } from '@/components/damImage/uploadQueue/author/cachedUsers'
import { useDamCachedAssetLicences } from '@/components/damImage/composables/cachedDamAssetLicences'
import { resolveDisabledReasons } from '@/components/dam/assetSelect/composables/assetSelectDisabledReason'
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
  const fetchSingleUseUsage = useImageSingleUseUsageFetch(configName)

  const assetSelectStore = useAssetSelectStore()
  const { selectedCount, selectedHasDisabled, selectedAssets, assetListItems, loader } =
    storeToRefs(assetSelectStore)
  const assetDetailStore = useAssetDetailStore()
  const { openSidebarRight } = useSidebar()
  const { mdAndDown } = useDisplay()

  const { showErrorsDefault } = useAlerts()
  const { filterData, filterConfig } = useAssetListFilter()
  const {
    getCachedAssetLicence,
    addToCachedAssetLicences,
    fetchCachedAssetLicences,
    fetchCachedAssetLicencesImmediate,
  } = useDamCachedAssetLicences()

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

  // DAM searches only the licences the picker chose; without one there is nothing to ask for. A record
  // type that may not use a single use photo does not list one at all, and only photos have a usage check.
  const prepareListRequest = () => {
    if (assetSelectStore.selectedLicenceIds.length === 0) return false
    resolveTypeFilter(assetSelectStore.assetType, assetSelectStore.inPodcast)
    filterData.licences = assetSelectStore.selectedLicenceIds
    filterData.mainFileSingleUse =
      assetSelectStore.assetType !== DamAssetType.Image ||
      assetSelectStore.selectability?.singleUseAllowed === false
        ? false
        : null
    return true
  }

  // A failed lookup leaves the photos selectable: the save in core-cms checks the photo again.
  const applySingleUseUsage = async (
    items: AssetSelectListItem[],
    usageHolder: AssetSelectUsageHolder | null,
  ) => {
    if (isUndefined(fetchSingleUseUsage)) return
    const groupIds = new Map<DocId, DocId[]>()
    items.forEach((item) => {
      const groupId = getSingleUseGroupId(item.asset)
      if (
        isNull(groupId) ||
        !item.asset.mainFile?.flags.singleUse ||
        item.asset.attributes.assetType !== DamAssetType.Image
      ) {
        return
      }
      groupIds.set(groupId, [...(groupIds.get(groupId) ?? []), item.asset.id])
    })
    if (groupIds.size === 0) return
    try {
      const usages = await fetchSingleUseUsage([...groupIds.keys()], usageHolder)
      groupIds.forEach((assetIds, groupId) => {
        const usage = usages[groupId]
        if (isUndefined(usage)) return
        assetIds.forEach((assetId) => assetSelectStore.setSingleUseUsage(assetId, usage))
      })
    } catch (error) {
      showErrorsDefault(error)
    }
  }

  // The selectability lives in the store, not in this instance: the initial listing, the filter and
  // the picker's licence watcher all fetch through different instances.
  const applyDisabledReasons = async (items: AssetSelectListItem[]) => {
    const selectability = assetSelectStore.selectability
    if (isNull(selectability)) return
    await applySingleUseUsage(items, selectability.usageHolder)
    // An uncached licence answers from a placeholder that allows direct use, so the licences of the page
    // are loaded before the reasons are resolved.
    addToCachedAssetLicences(items.map((item) => item.asset.licence))
    await fetchCachedAssetLicencesImmediate()
    assetSelectStore.setDisabledReasons(
      resolveDisabledReasons(items, getCachedAssetLicence, selectability),
    )
  }

  const fetchAssetList = async () => {
    if (!prepareListRequest()) return
    const request = ++latestListRequest
    try {
      assetSelectStore.showLoader()
      const list = await fetchLatestList(request)
      if (isNull(list)) return
      assetSelectStore.setList(list)
      await applyDisabledReasons(assetSelectStore.assetListItems)
    } catch (error) {
      if (request === latestListRequest) showErrorsDefault(error)
    } finally {
      if (request === latestListRequest) assetSelectStore.hideLoader()
    }
  }

  const fetchNextPage = async () => {
    if (assetSelectStore.loader || !prepareListRequest()) return
    pagination.value.page = pagination.value.page + 1
    const request = ++latestListRequest
    try {
      assetSelectStore.showLoader()
      const list = await fetchLatestList(request)
      if (isNull(list)) return
      await applyDisabledReasons(assetSelectStore.appendList(list))
    } catch (error) {
      if (request === latestListRequest) showErrorsDefault(error)
    } finally {
      if (request === latestListRequest) assetSelectStore.hideLoader()
    }
  }

  const { addToCachedAuthors, fetchCachedAuthors } = useDamCachedAuthors()
  const { addToCachedKeywords, fetchCachedKeywords } = useDamCachedKeywords()
  const { addToCachedUsers, fetchCachedUsers } = useDamCachedUsers()

  const onItemClick = async (data: { assetId: DocId; index: number }) => {
    const { cachedExtSystemId } = useExtSystemIdForCached()
    if (!mdAndDown.value) openSidebarRight()
    assetSelectStore.toggleSelectedByIndex(data.index)
    assetSelectStore.setActiveByIndex(data.index)
    detailLoading.value = true
    try {
      const asset = await fetchAsset(damClient, endPointAsset, data.assetId)
      cachedExtSystemId.value = assetSelectStore.selectedSelectConfig.extSystem
      addToCachedAuthors(asset.authors, asset.sources)
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
    selectedHasDisabled,
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
