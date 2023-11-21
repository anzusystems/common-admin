import { useAssetApi } from '@/services/api/coreDam/assetApi'
import { useAssetListFilter } from '@/model/coreDam/filter/AssetFilter'
import { type AssetSelectListItem, useAssetSelectStore } from '@/services/stores/coreDam/assetSelectStore'
import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import { ref } from 'vue'
import type { DamAssetType } from '@/types/coreDam/Asset'
import { usePagination } from '@/composables/system/pagination'
import { useFilterHelpers } from '@/composables/filter/filterHelpers'
import { useAlerts } from '@/composables/system/alerts'
import type { DocId } from '@/types/common'
import { useCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'

const filter = useAssetListFilter()
const pagination = usePagination()
const filterIsTouched = ref(false)

export function useAssetListActions(configName = 'default') {
  const { damClient } = useCommonAdminCoreDamOptions(configName)

  const { fetchAssetList: apiFetchAssetList } = useAssetApi(damClient)

  const assetListStore = useAssetSelectStore()
  const { selectedCount, selectedAssets, assetListItems, loader } = storeToRefs(assetListStore)

  const { resetFilter } = useFilterHelpers()
  const { showErrorsDefault } = useAlerts()

  const fetchAssetList = async () => {
    pagination.page = 1
    try {
      assetListStore.showLoader()
      assetListStore.setList(await apiFetchAssetList(assetListStore.licenceId, pagination, filter))
    } catch (error) {
      showErrorsDefault(error)
    } finally {
      assetListStore.hideLoader()
    }
  }
  const fetchNextPage = async () => {
    pagination.page = pagination.page + 1
    try {
      assetListStore.showLoader()
      assetListStore.appendList(await apiFetchAssetList(assetListStore.licenceId, pagination, filter))
    } catch (error) {
      showErrorsDefault(error)
    } finally {
      assetListStore.hideLoader()
    }
  }

  const onItemClick = (data: { assetId: DocId; index: number }) => {
    assetListStore.toggleSelectedByIndex(data.index)
  }

  const resetAssetList = async () => {
    assetListStore.reset()
    filter.type.default = [assetListStore.assetType]
    resetFilter(filter, pagination, fetchAssetList)
  }

  const filterTouch = () => {
    filterIsTouched.value = true
  }
  const filterUnTouch = () => {
    filterIsTouched.value = false
  }

  const initStoreContext = (
    licenceId: number,
    assetType: DamAssetType,
    singleMode: boolean,
    minCount: number,
    maxCount: number
  ): void => {
    assetListStore.clearSelected()
    assetListStore.setAssetType(assetType)
    assetListStore.setLicenceId(licenceId)
    assetListStore.setSingleMode(singleMode)
    assetListStore.setMinCount(minCount)
    assetListStore.setMaxCount(maxCount)
  }

  return {
    filterIsTouched,
    filter,
    selectedCount,
    selectedAssets,
    pagination,
    loader,
    assetListItems: assetListItems as Ref<Array<AssetSelectListItem>>,
    getSelectedData: assetListStore.getSelectedData,
    onItemClick,
    fetchAssetList,
    fetchNextPage,
    resetAssetList,
    filterTouch,
    filterUnTouch,
    initStoreContext,
  }
}
