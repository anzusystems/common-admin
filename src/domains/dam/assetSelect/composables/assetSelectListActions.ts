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
// Shared like the pagination: every asset select part requests through here, and only the last request counts.
let listController: AbortController | undefined
let detailRequest = 0
// Counts list restarts, so a failed further page is tracked per list.
let listTurn = 0

/**
 * Scroll position of the scroll container of the "Load more" button: the nearest scrollable ancestor, else the page.
 * A layout change moves the button without changing it.
 */
const scrolledTo = (button: Element | undefined) => {
  for (let element = button?.parentElement; element; element = element.parentElement) {
    const { overflowY } = getComputedStyle(element)
    if ((overflowY === 'auto' || overflowY === 'scroll') && element.scrollHeight > element.clientHeight) {
      return element.scrollTop
    }
  }
  return document.scrollingElement?.scrollTop ?? 0
}

export function useAssetSelectActions(configName: string) {
  const { damClient, endPointAsset, showFileInfoEnabled } = useCommonAdminCoreDamOptions(configName)
  // A further page of this list failed (list `failedInListTurn`). The
  // button then does not request it again just by coming into view.
  // A press does, or coming into view again after the list was scrolled while the button was hidden.
  // A page-wide flag made the button retry when only a layout change (a side panel) had hidden it.
  let failedInListTurn: number | null = null
  let scrolledAtLeave: number | null = null

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
   * Forgets the remembered active asset once the side panel shows none
   * and the list has no item for it, so a later list marks no item.
   * Not while a read is pending, which may still show that asset, nor while a detail is open, whose close rereads it.
   * Called where this may have become true: a list is set, or the last requested read has ended.
   */
  const forgetAssetNotShown = () => {
    if (detailLoading.value || !isNull(assetDetailStore.asset) || !isNull(assetDetailStore.dialog)) return
    if (assetSelectStore.assetListItems.some((item) => item.active)) return
    assetSelectStore.forgetActiveAsset()
  }

  /**
   * Starts a new list: new order, filter or type, a reopened list or picker, or a reload after applying an upload.
   * The pending list request is aborted. Its rows would land in a replaced list and re-flag a further page.
   * The new list reads from page one and has no further page until it arrives.
   * "Load more" auto-requests when in view. Without this it requested page two before page one.
   */
  const startListAnew = () => {
    // Aborted and released: its end does not turn the loader off. The new list keeps it on until read.
    // Turning it off during the debounce let an empty list show "nothing found".
    listController?.abort()
    listController = undefined
    listTurn++
    const hasNextPage = isNull(pagination.value.hasNextPage) ? null : false
    pagination.value = { ...pagination.value, page: 1, hasNextPage }
  }

  const readListAfterPause = useDebounceFn(async () => {
    await fetchAssetList()
  })

  /**
   * Every list reload goes through here: it restarts at once and is read after a debounce.
   */
  const fetchAssetListDebounced = () => {
    startListAnew()
    return readListAfterPause()
  }

  const fetchAssetList = async () => {
    if (assetSelectStore.selectedLicenceId <= 0) {
      // Nothing is read, so the loader of the abandoned list is turned off.
      if (!listController) assetSelectStore.hideLoader()
      return
    }
    resolveTypeFilter(assetSelectStore.assetType, assetSelectStore.inPodcast)
    const { execute } = useFetchAssetList(damClient, endPointAsset, assetSelectStore.selectedLicenceId)
    // Restart again as the read starts, covering anything requested during the debounce.
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
    failedInListTurn = null
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
      failedInListTurn = listTurn
      scrolledAtLeave = null
      showErrorsDefault(error)
    } finally {
      if (listController === controller) assetSelectStore.hideLoader()
    }
  }

  /**
   * "Load more" requests the next page itself when it comes into
   * view. Its directive fires again on every re-render while in view.
   * After a failure it used to retry at once and on each failure, with an error each time.
   * After a failure it no longer auto-requests while in view. A press does, or reappearing
   * after the list was scrolled while it was hidden. A new list auto-requests as before.
   */
  const fetchNextPageInView = (isIntersecting: boolean, entries?: IntersectionObserverEntry[]) => {
    const button = entries?.[0]?.target
    if (!isIntersecting) {
      scrolledAtLeave = scrolledTo(button)
      return
    }
    if (failedInListTurn === listTurn) {
      if (isNull(scrolledAtLeave) || scrolledTo(button) === scrolledAtLeave) return
      failedInListTurn = null
    }
    scrolledAtLeave = null
    if (pagination.value.hasNextPage !== true) return
    fetchNextPage()
  }

  const { addToCachedAuthors, fetchCachedAuthors } = useDamCachedAuthors(configName)
  const { addToCachedKeywords, fetchCachedKeywords } = useDamCachedKeywords(configName)
  const { addToCachedUsers, fetchCachedUsers } = useDamCachedUsers(configName)

  const onItemClick = async (data: { assetId: DocId; index: number }, extSystem: IntegerId) => {
    const { cachedExtSystemId } = useExtSystemIdForCached(configName)
    if (!mdAndDown.value) openSidebarRight()
    assetSelectStore.toggleSelectedByIndex(data.index)
    assetSelectStore.setActiveByIndex(data.index)
    // Set the ext system for author names at the click, where it is known, not after the read.
    // A pick confirmed before the answer drops the read, and the picked image dialog then used the previous ext system.
    cachedExtSystemId.value = extSystem
    detailLoading.value = true
    const request = ++detailRequest
    try {
      // Not applied over an open detail. A queue row detail may have
      // opened since the click and would show and save into this asset.
      await assetDetailStore.readBesideDetail(
        () => fetchAsset(damClient, endPointAsset, data.assetId),
        () => request === detailRequest,
        (asset) => {
          // Set again for the shown read. The value is per configuration, and another
          // widget may have overwritten it since the click when its upload or copy ended.
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
      if (request === detailRequest) {
        showErrorsDefault(e)
        // Mark the item of the asset the side panel still shows, or none. The
        // clicked item was marked beside a panel showing another asset or none.
        assetSelectStore.setActiveByAssetId(assetDetailStore.asset?.id ?? null)
      }
    } finally {
      if (request === detailRequest) {
        detailLoading.value = false
        forgetAssetNotShown()
      }
    }
  }

  /**
   * Rereads the active item's asset for the side panel after its detail closed.
   * Ordered with click reads: only the latest is applied and turns the panel loading off.
   * Otherwise a stale answer showed the closed detail's asset beside another active item.
   * Uses the remembered asset even if the current list lacks its item. Reading
   * by the active item alone emptied the panel after editing that asset.
   * `shown`: the asset the closed detail showed when the panel opened it. It is read
   * and made active, because after a failed click read the remembered asset differs.
   */
  const readActiveItemAgain = async (shown: DocId | null = null) => {
    if (!isNull(shown)) assetSelectStore.setActiveByAssetId(shown)
    const assetId = assetSelectStore.getActiveAssetId()
    // Nothing to read: the list remembers no asset, so the panel emptied by the closing detail stays empty.
    if (isNull(assetId)) return
    detailLoading.value = true
    const request = ++detailRequest
    try {
      // Not applied over an open detail. A queue row detail closes itself when
      // its asset cannot be read, and can reopen before this read answers.
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

  /**
   * Drops a pending detail read: its answer is not shown, and loading stops.
   */
  const giveUpDetailRead = () => {
    detailRequest++
    detailLoading.value = false
  }

  const reset = async () => {
    clearAll(filterData, filterConfig)
    // The next opened list starts fresh, without this list's paging state.
    startListAnew()
    assetSelectStore.reset(true)
    // Otherwise its answer would be written into the store emptied here.
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
    fetchNextPageInView,
    resetAssetList,
    reset,
    initStoreContext,
  }
}
