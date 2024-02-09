import type { DamExtSystem } from '@/components/damImage/uploadQueue/composables/DamExtSystem'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { apiFetchList } from '@/services/api/apiFetchList'
import type { AxiosInstance } from 'axios'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'
import type { IntegerId } from '@/types/common'

const END_POINT = '/adm/v1/ext-system'
export const ENTITY = 'extSystem'

export const fetchDamExtSystemListByIds = (client: () => AxiosInstance, ids: IntegerId[]) =>
  apiFetchByIds<DamExtSystem[]>(client, ids, END_POINT, {}, SYSTEM_CORE_DAM, ENTITY)

export const fetchDamExtSystemList = (client: () => AxiosInstance, pagination: Pagination, filterBag: FilterBag) =>
  apiFetchList<DamExtSystem[]>(client, END_POINT, {}, pagination, filterBag, SYSTEM_CORE_DAM, ENTITY)
