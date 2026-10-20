import type { DamExtSystemConfig, DamPrvConfig, DamPubConfig } from '@/domains/dam/types/DamConfig'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/shared/types/common'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import { useApiRequest } from '@/domains/api/composables/useApiRequest'
import { DAM_END_POINT_CONFIGURATION, DAM_END_POINT_PUB_CONFIGURATION } from '@/domains/dam/api/damEndPoints'

const ENTITY = 'settings'

// `endPoint`: the address of the configuration of DAM the caller goes by; the default one where it gives none.

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

// The id goes through `urlParams` rather than into the string, because that is the shape the rest
// of the migrated calls use. It does not bring the call under `anzu/url-params-match-template`:
// that rule wants `urlTemplate` and `urlParams` in one object literal, and every call here passes
// `urlParams` to `execute` instead, so the rule checks none of them either way.
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
