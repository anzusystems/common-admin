import type { DamExtSystem } from '@/components/damImage/uploadQueue/composables/DamExtSystem'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import type { AxiosInstance } from 'axios'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { IntegerId } from '@/types/common'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
// eslint-disable-next-line deprecation/no-deprecated-imports
import { apiFetchList } from '@/services/api/apiFetchList'
// eslint-disable-next-line deprecation/no-deprecated-imports
import type { FilterBag } from '@/types/Filter'
import type { Pagination } from '@/types/Pagination'

const END_POINT = '/adm/v1/ext-system'
export const ENTITY = 'extSystem'

export const fetchDamExtSystemListByIds = (client: () => AxiosInstance, ids: IntegerId[]) =>
  apiFetchByIds<DamExtSystem[]>(client, ids, END_POINT, {}, SYSTEM_CORE_DAM, ENTITY)

export const useFetchDamExtSystemList = (client: () => AxiosInstance) =>
  useApiFetchList<DamExtSystem[]>(client, SYSTEM_CORE_DAM, ENTITY, END_POINT)

/**
 * @deprecated
 */
export const fetchDamExtSystemList = (client: () => AxiosInstance, pagination: Pagination, filterBag: FilterBag) =>
  apiFetchList<DamExtSystem[]>(client, END_POINT, {}, pagination, filterBag, SYSTEM_CORE_DAM, ENTITY)
