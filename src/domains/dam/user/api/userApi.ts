import type { AxiosInstance } from 'axios'
import type { DamUser, DamUserUpdateDto } from '@/domains/dam/user/types/DamUser'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { useApiFetchByIds } from '@/domains/api/composables/useApiFetchByIds'
import { useApiRequest } from '@/domains/api/composables/useApiRequest'

const END_POINT = '/adm/v1/user'
export const ENTITY = 'user'

export const fetchDamUserListByIds = (client: () => AxiosInstance, ids: number[]) => {
  const { execute } = useApiFetchByIds<DamUser>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })

  return execute(ids)
}

export const useFetchDamUserList = (client: () => AxiosInstance) =>
  useApiFetchList<DamUser>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })

export const updateDamUser = (client: () => AxiosInstance, id: number, data: DamUserUpdateDto) => {
  const { execute } = useApiRequest<DamUser, DamUserUpdateDto>({
    client,
    method: 'PUT',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT + '/:id',
  })

  return execute({ urlParams: { id }, body: data })
}

export const fetchDamUser = (client: () => AxiosInstance, id: number) => {
  const { execute } = useApiRequest<DamUser, null>({
    client,
    method: 'GET',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT + '/:id',
  })

  return execute({ urlParams: { id } })
}
