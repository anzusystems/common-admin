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
import { fetchAssetList as apiFetchAssetList } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { ImageWidgetSelectConfig } from '@/types/ImageAware'

const filter = useAssetListFilter()
const pagination = usePagination()
const filterIsTouched = ref(false)

export function useAssetSelectActions(configName = 'default') {
  const { damClient } = useCommonAdminCoreDamOptions(configName)

  const assetSelectStore = useAssetSelectStore()
  const { selectedCount, selectedAssets, assetListItems, loader } = storeToRefs(assetSelectStore)

  const { resetFilter } = useFilterHelpers()
  const { showErrorsDefault } = useAlerts()

  const fetchAssetList = async () => {
    pagination.page = 1
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
  const fetchNextPage = async () => {
    pagination.page = pagination.page + 1
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

  const onItemClick = (data: { assetId: DocId; index: number }) => {
    assetSelectStore.toggleSelectedByIndex(data.index)
  }

  const resetAssetList = async () => {
    assetSelectStore.reset()
    filter.type.default = [assetSelectStore.assetType]
    resetFilter(filter, pagination, fetchAssetList)
  }

  const filterTouch = () => {
    filterIsTouched.value = true
  }
  const filterUnTouch = () => {
    filterIsTouched.value = false
  }

  const initStoreContext = (
    selectConfig: ImageWidgetSelectConfig[],
    assetType: DamAssetType,
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
    filterIsTouched,
    filter,
    selectedCount,
    selectedAssets,
    pagination,
    loader,
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
