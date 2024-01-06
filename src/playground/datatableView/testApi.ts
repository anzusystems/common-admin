import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import { cmsClient } from '@/playground/mock/cmsClient'
import { apiFetchList } from '@/services/api/apiFetchList'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const fetchTestList = (pagination: Pagination, filterBag: FilterBag) =>
  apiFetchList<any[]>(cmsClient, '/adm/v1/article-kind', {}, pagination, filterBag, 'cms', 'articleKind')
