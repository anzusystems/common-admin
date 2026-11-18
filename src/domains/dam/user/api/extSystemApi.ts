import type { DamExtSystem } from '@/domains/dam/types/DamExtSystem'
import type { AxiosInstance } from 'axios'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import type { IntegerId } from '@/shared/types/common'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'

const END_POINT = '/adm/v1/ext-system'
export const ENTITY = 'extSystem'

export const fetchDamExtSystemListByIds = (client: () => AxiosInstance, ids: IntegerId[]) => {
  const { execute } = useApiFetchByIds<DamExtSystem>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })

  return execute(ids)
}

export const useFetchDamExtSystemList = (client: () => AxiosInstance) =>
  useApiFetchList<DamExtSystem>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })
