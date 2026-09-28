import { useAssetListFilter } from '@/domains/dam/assetSelect/filter/AssetFilter'
import { type AssetSelectListItem, useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { type AssetDetailItemDto, DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'
import { usePagination } from '@/domains/api/composables/pagination'
import { useAlerts } from '@/domains/system/composables/alerts'
import type { DocId, IntegerId } from '@/shared/types/common'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { fetchAsset, useFetchAssetList } from '@/domains/dam/api/damAssetApi'
import type { DamConfigLicenceExtSystemReturnType } from '@/domains/dam/types/DamConfig'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { useDamCachedAuthors } from '@/domains/dam/author/composables/cachedAuthors'
import { useDamCachedKeywords } from '@/domains/dam/keyword/composables/cachedKeywords'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { isUndefined } from '@/shared/utils/common'
import { useDamCachedUsers } from '@/domains/dam/author/composables/cachedUsers'
import { useSidebar } from '@/domains/dam/assetSelect/composables/assetSelectFilterSidebar'
import { SORT_BY_SCORE_DATE } from '@/domains/filters/datatable/utils/datatableColumns'
import { useFilterClearHelpers } from '@/domains/filters/composables/filterFactory'
import { useDebounceFn } from '@vueuse/core'
import { useDisplay } from 'vuetify'

const { pagination } = usePagination(SORT_BY_SCORE_DATE)
const detailLoading = ref(false)
// Shared like the pagination: every asset select part asks through here, and only the last ask counts.
let listController: AbortController | undefined
let detailRequest = 0

export function useAssetSelectActions(
  configName = 'default',
  onDetailLoadedCallback?: (asset: AssetDetailItemDto) => void
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

  const fetchAssetListDebounced = useDebounceFn(async () => {
    await fetchAssetList()
  })

  const fetchAssetList = async () => {
    if (assetSelectStore.selectedLicenceId <= 0) return
    resolveTypeFilter(assetSelectStore.assetType, assetSelectStore.inPodcast)
    const { execute } = useFetchAssetList(damClient, endPointAsset, assetSelectStore.selectedLicenceId)
    listController?.abort()
    const controller = (listController = new AbortController())
    try {
      assetSelectStore.showLoader()
      const items = await execute(pagination, filterData, filterConfig, { signal: controller.signal })
      if (controller.signal.aborted) return
      assetSelectStore.setList(items)
    } catch (error) {
      if (!controller.signal.aborted) showErrorsDefault(error)
    } finally {
      if (listController === controller) assetSelectStore.hideLoader()
    }
  }

  const fetchNextPage = async () => {
    if (assetSelectStore.loader) return
    const page = pagination.value.page
    pagination.value.page = page + 1
    resolveTypeFilter(assetSelectStore.assetType, assetSelectStore.inPodcast)
    const { execute } = useFetchAssetList(damClient, endPointAsset, assetSelectStore.selectedLicenceId)
    // A new list (filter submit) aborts this page too: appended, it would be the old filter's page.
    listController?.abort()
    const controller = (listController = new AbortController())
    try {
      assetSelectStore.showLoader()
      const items = await execute(pagination, filterData, filterConfig, { signal: controller.signal })
      if (controller.signal.aborted) return
      assetSelectStore.appendList(items)
    } catch (error) {
      if (controller.signal.aborted) return
      // Not when something reset the page meanwhile (a filter submit waits out its debounce before it
      // aborts this request): rolling back would overwrite that reset.
      if (pagination.value.page === page + 1) pagination.value.page = page
      showErrorsDefault(error)
    } finally {
      if (listController === controller) assetSelectStore.hideLoader()
    }
  }

  const { addToCachedAuthors, fetchCachedAuthors } = useDamCachedAuthors()
  const { addToCachedKeywords, fetchCachedKeywords } = useDamCachedKeywords()
  const { addToCachedUsers, fetchCachedUsers } = useDamCachedUsers()

  const onItemClick = async (data: { assetId: DocId; index: number }, extSystem: IntegerId) => {
    const { cachedExtSystemId } = useExtSystemIdForCached()
    if (!mdAndDown.value) openSidebarRight()
    assetSelectStore.toggleSelectedByIndex(data.index)
    assetSelectStore.setActiveByIndex(data.index)
    detailLoading.value = true
    const request = ++detailRequest
    try {
      const asset = await fetchAsset(damClient, endPointAsset, data.assetId)
      if (request !== detailRequest) return
      cachedExtSystemId.value = extSystem
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
      if (request === detailRequest) showErrorsDefault(e)
    } finally {
      if (request === detailRequest) detailLoading.value = false
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
    inPodcast: boolean | null,
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
