import { useAssetListFilter } from '@/model/coreDam/filter/AssetFilter'
import { type AssetSelectListItem, useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import { ref } from 'vue'
import { type AssetDetailItemDto, DamAssetType, type DamAssetTypeType } from '@/types/coreDam/Asset'
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
import { isUndefined } from '@/utils/common'
import { useDamCachedUsers } from '@/components/damImage/uploadQueue/author/cachedUsers'
import { useSidebar } from '@/components/dam/assetSelect/composables/assetSelectFilterSidebar'

const filter = useAssetListFilter()
const pagination = usePagination()
pagination.sortBy = null
const filterIsTouched = ref(false)
const detailLoading = ref(false)

function resolveTypeFilter(assetType: DamAssetTypeType | 'podcast') {
  if (assetType === 'podcast') {
    filter.type.model = [DamAssetType.Audio]
    filter.inPodcast.model = true
    return
  }
  filter.type.model = [assetType]
  filter.inPodcast.model = null
}

export function useAssetSelectActions(
  configName = 'default',
  onDetailLoadedCallback?: (asset: AssetDetailItemDto) => void
) {
  const { damClient } = useCommonAdminCoreDamOptions(configName)

  const assetSelectStore = useAssetSelectStore()
  const { selectedCount, selectedAssets, assetListItems, loader } = storeToRefs(assetSelectStore)
  const assetDetailStore = useAssetDetailStore()
  const { openSidebarRight } = useSidebar()

  const { resetFilter } = useFilterHelpers()
  const { showErrorsDefault } = useAlerts()

  const fetchAssetList = async (assetType: DamAssetTypeType | 'podcast') => {
    pagination.page = 1
    resolveTypeFilter(assetType)
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

  const fetchNextPage = async (assetType: DamAssetTypeType | 'podcast') => {
    pagination.page = pagination.page + 1
    resolveTypeFilter(assetType)
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

  const resetAssetList = async () => {
    assetSelectStore.reset()
    filter.type.default = [assetSelectStore.assetType]
    resetFilter(filter, pagination)
    resolveTypeFilter(assetSelectStore.assetType)
    await fetchAssetList(assetSelectStore.assetType)
  }

  const filterTouch = () => {
    filterIsTouched.value = true
  }
  const filterUnTouch = () => {
    filterIsTouched.value = false
  }

  const initStoreContext = (
    selectConfig: DamConfigLicenceExtSystemReturnType[],
    assetType: DamAssetTypeType | 'podcast',
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
