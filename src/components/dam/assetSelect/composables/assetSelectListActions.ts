import { useAssetListFilter } from '@/model/coreDam/filter/AssetFilter'
import {
  type AssetSelectListItem,
  useAssetSelectStore,
} from '@/services/stores/coreDam/assetSelectStore'
import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { type AssetDetailItemDto, DamAssetType, type DamAssetTypeType } from '@/types/coreDam/Asset'
import { usePagination } from '@/labs/filters/pagination'
import { useAlerts } from '@/composables/system/alerts'
import type { DocId } from '@/types/common'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import {
  fetchAsset,
  useFetchAssetListByLicences,
} from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { DamConfigLicenceExtSystemReturnType } from '@/types/coreDam/DamConfig'
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import { useDamCachedAuthors } from '@/components/damImage/uploadQueue/author/cachedAuthors'
import { useDamCachedKeywords } from '@/components/damImage/uploadQueue/keyword/cachedKeywords'
import { useExtSystemIdForCached } from '@/components/damImage/uploadQueue/composables/extSystemIdForCached'
import { isNull, isUndefined } from '@/utils/common'
import { useDamCachedUsers } from '@/components/damImage/uploadQueue/author/cachedUsers'
import { useSidebar } from '@/components/dam/assetSelect/composables/assetSelectFilterSidebar'
import { SORT_BY_SCORE_DATE } from '@/composables/system/datatableColumns'
import { useFilterClearHelpers } from '@/labs/filters/filterFactory'
import { useDebounceFn } from '@vueuse/core'
import { useDisplay } from 'vuetify'
import { useCommonAdminImageOptions } from '@/components/damImage/composables/commonAdminImageOptions'
import { useDamCachedAssetLicences } from '@/components/damImage/composables/cachedDamAssetLicences'
import { resolveDisabledReasons } from '@/components/dam/assetSelect/composables/assetSelectDisabledReason'
import type { AxiosInstance } from 'axios'

const { pagination } = usePagination(SORT_BY_SCORE_DATE)
const detailLoading = ref(false)

export function useAssetSelectActions(
  configName = 'default',
  onDetailLoadedCallback?: (asset: AssetDetailItemDto) => void,
) {
  const { damClient, endPointAsset, showFileInfoEnabled } = useCommonAdminCoreDamOptions(configName)

  // T4.5 needs the CMS Image client only for the single-use-holders precheck - video/audio selects never
  // configure it, so a missing config there is expected, not an error.
  const getImageClientSafe = (): (() => AxiosInstance) | undefined => {
    try {
      return useCommonAdminImageOptions(configName).imageClient
    } catch {
      return undefined
    }
  }

  const { getCachedAssetLicence } = useDamCachedAssetLicences()

  const assetSelectStore = useAssetSelectStore()
  const { selectedCount, selectedHasDisabled, selectedAssets, assetListItems, loader } =
    storeToRefs(assetSelectStore)
  const assetDetailStore = useAssetDetailStore()
  const { openSidebarRight } = useSidebar()
  const { mdAndDown } = useDisplay()

  const { showErrorsDefault } = useAlerts()
  const { filterData, filterConfig } = useAssetListFilter()

  // The filter hides single-use assets by default, from a time when nothing in CMS could hold one.
  // A subject that can hold one must see them; whether a given item is pickable is then decided per
  // item by resolveDisabledReasons, not by hiding the whole licence's content.
  const resolveSingleUseFilter = () => {
    filterData.mainFileSingleUse = assetSelectStore.selectability?.singleUseAllowed ? null : false
  }

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

  // The selectability lives in the store, not in this composable instance: the initial listing, the
  // filter submit and the filter reset are all fetched from the filter's own instance, which knows
  // nothing about the picker's options and would otherwise leave a whole page undimmed.
  const applyDisabledReasons = async (items: AssetSelectListItem[]) => {
    const selectability = assetSelectStore.selectability
    if (isNull(selectability)) return
    const reasons = await resolveDisabledReasons(
      getImageClientSafe(),
      items,
      getCachedAssetLicence,
      selectability,
    )
    assetSelectStore.setDisabledReasons(reasons)
  }

  const fetchAssetList = async () => {
    if (assetSelectStore.selectedLicenceIds.length === 0) return
    resolveTypeFilter(assetSelectStore.assetType, assetSelectStore.inPodcast)
    filterData.licences = assetSelectStore.selectedLicenceIds
    resolveSingleUseFilter()
    const { executeFetch } = useFetchAssetListByLicences(damClient, endPointAsset)
    try {
      assetSelectStore.showLoader()
      assetSelectStore.setList(await executeFetch(pagination, filterData, filterConfig))
      await applyDisabledReasons(assetSelectStore.assetListItems)
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
    filterData.licences = assetSelectStore.selectedLicenceIds
    resolveSingleUseFilter()
    const { executeFetch } = useFetchAssetListByLicences(damClient, endPointAsset)
    try {
      assetSelectStore.showLoader()
      // Only the freshly appended page: the earlier pages already carry their resolved reasons, and
      // asking about the whole scrolled-through list again would grow the precheck without bound.
      const appended = assetSelectStore.appendList(
        await executeFetch(pagination, filterData, filterConfig),
      )
      await applyDisabledReasons(appended)
    } catch (error) {
      showErrorsDefault(error)
    } finally {
      assetSelectStore.hideLoader()
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
      // Every licence in one search shares an ext system (LicenceCollectionSingleExtSystem), but resolve
      // it from the asset's own licence rather than the dialog-wide selection so this stays correct if
      // that backend constraint is ever relaxed.
      const assetSelectConfig = assetSelectStore.selectConfig.find(
        (config) => config.licence === asset.licence,
      )
      if (assetSelectConfig) {
        cachedExtSystemId.value = assetSelectConfig.extSystem
      }
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
