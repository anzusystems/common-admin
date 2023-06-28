import type { AxiosInstance } from 'axios'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { apiFetchList } from '@/lib'
import type { ArticleKind } from '@/types/coreCms/ArticleKind'

const END_POINT = '/adm/v1/article-kind'
export const ENTITY = 'articleKind'
export const SYSTEM_CORE_CMS = 'cms'

export function useCmsApi(client: () => AxiosInstance) {
  const fetchArticleList = (pagination: Pagination, filterBag: FilterBag) =>
    apiFetchList<ArticleKind[]>(
      client,
      END_POINT,
      {},
      pagination,
      filterBag,
      SYSTEM_CORE_CMS,
      ENTITY
    )

  return {
    fetchArticleList,
  }
}
