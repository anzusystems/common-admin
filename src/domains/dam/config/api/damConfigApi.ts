import type { DamExtSystemConfig, DamPrvConfig, DamPubConfig } from '@/domains/dam/types/DamConfig'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/shared/types/common'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import { useApiRequest } from '@/domains/api/composables/useApiRequest'
import { DAM_END_POINT_CONFIGURATION, DAM_END_POINT_PUB_CONFIGURATION } from '@/domains/dam/api/damEndPoints'

const ENTITY = 'settings'

// `endPoint`: DAM configuration address. Defaults when not given.

export const fetchPubConfiguration = (
  damClient: () => AxiosInstance,
  endPoint: string = DAM_END_POINT_PUB_CONFIGURATION
) => {
  const { execute } = useApiRequest<DamPubConfig, null>({
    client: damClient,
    method: 'GET',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint,
  })

  return execute()
}

export const fetchConfiguration = (damClient: () => AxiosInstance, endPoint: string = DAM_END_POINT_CONFIGURATION) => {
  const { execute } = useApiRequest<DamPrvConfig, null>({
    client: damClient,
    method: 'GET',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint,
  })

  return execute()
}

// The id goes through `urlParams` to match the other migrated calls.
// `anzu/url-params-match-template` does not check these calls: it needs `urlTemplate`
// and `urlParams` in one object literal, and here `urlParams` goes to `execute`.
export const fetchExtSystemConfiguration = (
  extSystem: IntegerId,
  damClient: () => AxiosInstance,
  endPoint: string = DAM_END_POINT_CONFIGURATION
) => {
  const { execute } = useApiRequest<DamExtSystemConfig, null>({
    client: damClient,
    method: 'GET',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint + '/ext-system/:extSystem',
  })

  return execute({ urlParams: { extSystem } })
}
