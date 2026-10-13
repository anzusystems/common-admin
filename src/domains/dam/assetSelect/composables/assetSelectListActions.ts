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
    // The ext system the page asks for names under is that of the list the click was made in. Written at the click,
    // where it is known, not once the read has answered: a pick confirmed before that gives the read up, and the
    // dialog of the picked image offers the authors of the DAM under whatever ext system was there before.
    cachedExtSystemId.value = extSystem
    detailLoading.value = true
    const request = ++detailRequest
    try {
      const asset = await fetchAsset(damClient, endPointAsset, data.assetId)
      if (request !== detailRequest) return
      // Once more for the read that is shown, as before: the value is one for the page, and another widget may have
      // written its own since the click, when an upload or a copy of its own ended.
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

  /**
   * Reads the asset of the active item again, for the side panel of a list whose detail has closed. In one order with
   * the read of a click: only the latest of the two is written, and only the latest turns the loading of the panel
   * off. On its own, the answer for the detail just closed came after that of a click made since, and the panel showed
   * the asset of the detail beside another active item.
   */
  const readActiveItemAgain = async () => {
    const activeItem = assetSelectStore.assetListItems.find((item) => item.active)
    if (!activeItem) return
    detailLoading.value = true
    const request = ++detailRequest
    try {
      // Not written over a detail: one of a row of the queue closes by itself when its asset cannot be read, and can be
      // opened again before this read answers.
      await assetDetailStore.readBesideDetail(
        () => fetchAsset(damClient, endPointAsset, activeItem.asset.id),
        () => request === detailRequest
      )
    } catch (e) {
      showErrorsDefault(e)
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
    // A read of the detail that is on its way is given up: its answer would be written into the store emptied here.
    detailRequest++
    detailLoading.value = false
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
    readActiveItemAgain,
    fetchAssetListDebounced,
    fetchNextPage,
    resetAssetList,
    reset,
    initStoreContext,
  }
}
