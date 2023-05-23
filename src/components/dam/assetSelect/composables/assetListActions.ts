import { useDamApi } from '@/services/api/coreDam/assetApi'
import { type DocId, useAlerts, useFilterHelpers, usePagination } from '@/lib'
import { useAssetListFilter } from '@/model/coreDam/filter/AssetFilter'
import { useAssetListStore } from '@/services/stores/coreDam/assetListStore'
import { storeToRefs } from 'pinia'
import { ref } from 'vue'

const filter = useAssetListFilter()
const pagination = usePagination()

const filterIsTouched = ref(false)

// todo move to config
const assetLicenceId = 100000

export function useAssetListActions() {
  const { fetchAssetList: apiFetchAssetList } = useDamApi()
  const assetListStore = useAssetListStore()
  const { list, loader, activeItemIndex } = storeToRefs(assetListStore)
  const { resetFilter } = useFilterHelpers()
  const { showWarning, showErrorsDefault } = useAlerts()

  const fetchAssetList = async () => {
    pagination.page = 1
    try {
      assetListStore.showLoader()

      console.log('Fetch', filter.type)

      assetListStore.setList(
        await apiFetchAssetList(assetLicenceId, pagination, filter),
      )
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
      assetListStore.appendList(
        await apiFetchAssetList(assetLicenceId, pagination, filter),
      )
    } catch (error) {
      showErrorsDefault(error)
    } finally {
      assetListStore.hideLoader()
    }
  }

  const onItemClick = (data: { assetId: DocId; index: number }) =>{
    assetListStore.toggleSelectedByIndex(data.index)
  }

  const resetAssetList = async () => {
    assetListStore.reset()
    resetFilter(filter, pagination, fetchAssetList)
  }

  const listMounted = async () => {
    assetListStore.reset()
    await fetchAssetList()
  }

  const filterTouch = () => {
    filterIsTouched.value = true
  }
  const filterUnTouch = () => {
    filterIsTouched.value = false
  }

  const getSelectedIds = (): DocId[] => {
    return assetListStore.getSelectedIds()
  }

  return {
    filterIsTouched,
    filter,
    pagination,
    loader,
    items: list,
    onItemClick,
    fetchAssetList,
    listMounted,
    fetchNextPage,
    resetAssetList,
    filterTouch,
    filterUnTouch,
    getSelectedIds,
  }
}
