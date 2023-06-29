import { storeToRefs } from 'pinia'
import type { Ref } from 'vue'
import { inject, ref } from 'vue'
import type { AxiosInstance } from 'axios'
import { CmsClientSymbol } from '@/components/injectionKeys'
import { usePagination } from '@/composables/system/pagination'
import { isUndefined } from '@/utils/common'
import { useFilterHelpers } from '@/composables/filter/filterHelpers'
import { useAlerts } from '@/composables/system/alerts'
import { useCmsApi } from '@/services/api/coreCms/articleApi'
import { type ArticleListItem, useArticleListStore } from '@/services/stores/coreCms/articleListStore'
import { useArticleListFilter } from '@/model/coreCms/filter/ArticleFilter'
import type { IntegerId } from '@/types/common'

const filter = useArticleListFilter()
const pagination = usePagination()
const filterIsTouched = ref(false)

export function useArticleListActions() {
  const cmsClient = inject<(() => AxiosInstance) | undefined>(CmsClientSymbol, undefined)

  if (isUndefined(cmsClient)) {
    throw new Error("Composable useArticleListActions can't be used without configured damClient.")
  }

  const { fetchArticleList: apiFetchArticleList } = useCmsApi(cmsClient)

  const articleListStore = useArticleListStore()
  const { selectedCount, selectedArticles, articleListItems, loader } = storeToRefs(articleListStore)
  const { resetFilter } = useFilterHelpers()
  const { showErrorsDefault } = useAlerts()

  const fetchArticleList = async () => {
    pagination.page = 1
    try {
      articleListStore.showLoader()
      articleListStore.setList(await apiFetchArticleList(pagination, filter))
    } catch (error) {
      showErrorsDefault(error)
    } finally {
      articleListStore.hideLoader()
    }
  }
  const fetchNextPage = async () => {
    pagination.page = pagination.page + 1
    try {
      articleListStore.showLoader()
      articleListStore.appendList(await apiFetchArticleList(pagination, filter))
    } catch (error) {
      showErrorsDefault(error)
    } finally {
      articleListStore.hideLoader()
    }
  }

  const onItemClick = (data: { articleId: IntegerId; index: number }) => {
    articleListStore.toggleSelectedByIndex(data.index)
  }

  const resetArticleList = async () => {
    articleListStore.reset()
    resetFilter(filter, pagination, fetchArticleList)
  }

  const filterTouch = () => {
    filterIsTouched.value = true
  }
  const filterUnTouch = () => {
    filterIsTouched.value = false
  }

  const initStoreContext = (
    singleMode: boolean,
    minCount: number,
    maxCount: number
  ): void => {
    articleListStore.clearSelected()
    articleListStore.setSingleMode(singleMode)
    articleListStore.setMinCount(minCount)
    articleListStore.setMaxCount(maxCount)
  }

  return {
    filterIsTouched,
    filter,
    selectedCount,
    selectedArticles,
    pagination,
    loader,
    articleListItems: articleListItems as Ref<Array<ArticleListItem>>,
    getSelectedData: articleListStore.getSelectedData,
    onItemClick,
    fetchArticleList,
    fetchNextPage,
    resetArticleList,
    filterTouch,
    filterUnTouch,
    initStoreContext,
  }
}
