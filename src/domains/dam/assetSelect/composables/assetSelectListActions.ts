import { useAssetListFilter } from '@/domains/dam/assetSelect/filter/AssetFilter'
import { type AssetSelectListItem, useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'
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
import { isNull } from '@/shared/utils/common'
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

export function useAssetSelectActions(configName = 'default') {
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

  /**
   * The asset the list remembers its active item by is forgotten once the side panel shows no asset and the list has
   * no item of it: a list read later is to mark no item beside a panel that shows none. Not while a read is on its
   * way, which may yet show that asset, nor while a detail is open, whose close has that asset read again. Asked
   * where these may have come true: a list is set, the read asked for last has ended.
   */
  const forgetAssetNotShown = () => {
    if (detailLoading.value || !isNull(assetDetailStore.asset) || !isNull(assetDetailStore.dialog)) return
    if (assetSelectStore.assetListItems.some((item) => item.active)) return
    assetSelectStore.forgetActiveAsset()
  }

  /**
   * A new list begins: one in another order, of another filter or type, of a list or picker opened again, the list
   * read anew once an upload is applied. The request of the list left that is on its way is given up: its rows would
   * come into a list that is being replaced or has been emptied, and its answer would say once more that a further
   * page follows. The new list is read from its first page, and has no further page until that page has come. "Load
   * more" is drawn while a further page follows, and asks by itself as it comes into view: over a list that had just
   * begun it asked for the page after the first before the first had been asked for, and the list was read from its
   * second page.
   */
  const startListAnew = () => {
    listController?.abort()
    const hasNextPage = isNull(pagination.value.hasNextPage) ? null : false
    pagination.value = { ...pagination.value, page: 1, hasNextPage }
  }

  const readListAfterPause = useDebounceFn(async () => {
    await fetchAssetList()
  })

  /** Every list that is read anew is asked for here: it begins at once, and is read after a pause. */
  const fetchAssetListDebounced = () => {
    startListAnew()
    return readListAfterPause()
  }

  const fetchAssetList = async () => {
    if (assetSelectStore.selectedLicenceId <= 0) return
    resolveTypeFilter(assetSelectStore.assetType, assetSelectStore.inPodcast)
    const { execute } = useFetchAssetList(damClient, endPointAsset, assetSelectStore.selectedLicenceId)
    // Once more as the read goes out, whatever was asked for during the pause before it.
    startListAnew()
    const controller = (listController = new AbortController())
    try {
      assetSelectStore.showLoader()
      const items = await execute(pagination, filterData, filterConfig, { signal: controller.signal })
      if (controller.signal.aborted) return
      assetSelectStore.setList(items)
      forgetAssetNotShown()
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
      // Not when something has put the page back meanwhile: rolling back would overwrite that.
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
      // Not written over a detail, as the read made once a detail has closed is not: the detail of a row of the queue
      // may have been opened since the click, and would show this asset in place of its own, and save into it.
      await assetDetailStore.readBesideDetail(
        () => fetchAsset(damClient, endPointAsset, data.assetId),
        () => request === detailRequest,
        (asset) => {
          // Once more for the read that is shown, as before: the value is one for the page, and another widget may
          // have written its own since the click, when an upload or a copy of its own ended.
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
        }
      )
    } catch (e) {
      if (request === detailRequest) showErrorsDefault(e)
    } finally {
      if (request === detailRequest) {
        detailLoading.value = false
        forgetAssetNotShown()
      }
    }
  }

  /**
   * Reads the asset of the active item again, for the side panel of a list whose detail has closed. In one order with
   * the read of a click: only the latest of the two is written, and only the latest turns the loading of the panel
   * off. On its own, the answer for the detail just closed came after that of a click made since, and the panel showed
   * the asset of the detail beside another active item.
   * The asset is the one the list remembers its active item by, also when the list read last has no item of it: the
   * panel went on showing that asset, and "edit" of the panel opened its detail. Read by the active item alone, the
   * panel was left empty once that detail closed, though it was that asset that had just been edited.
   */
  const readActiveItemAgain = async () => {
    const assetId = assetSelectStore.getActiveAssetId()
    // Nothing is read: the list remembers no asset, and the side panel the detail emptied as it closed stays empty.
    if (isNull(assetId)) return
    detailLoading.value = true
    const request = ++detailRequest
    try {
      // Not written over a detail: one of a row of the queue closes by itself when its asset cannot be read, and can be
      // opened again before this read answers.
      await assetDetailStore.readBesideDetail(
        () => fetchAsset(damClient, endPointAsset, assetId),
        () => request === detailRequest
      )
    } catch (e) {
      if (request === detailRequest) showErrorsDefault(e)
    } finally {
      if (request === detailRequest) {
        detailLoading.value = false
        forgetAssetNotShown()
      }
    }
  }

  const { clearAll } = useFilterClearHelpers()

  const resetAssetList = async () => {
    clearAll(filterData, filterConfig)
    resolveTypeFilter(assetSelectStore.assetType, assetSelectStore.inPodcast)
    await fetchAssetListDebounced()
  }

  /** A read of the detail that is on its way is given up: its answer is not shown, and nothing loads meanwhile. */
  const giveUpDetailRead = () => {
    detailRequest++
    detailLoading.value = false
  }

  const reset = async () => {
    clearAll(filterData, filterConfig)
    // The list opened next begins anew: what this one left of its paging, a further page that follows, is not its.
    startListAnew()
    assetSelectStore.reset(true)
    // Its answer would be written into the store emptied here.
    giveUpDetailRead()
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
    giveUpDetailRead,
    fetchAssetListDebounced,
    fetchNextPage,
    resetAssetList,
    reset,
    initStoreContext,
  }
}
