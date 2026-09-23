import type { DamExtSystemConfig, DamPrvConfig, DamPubConfig } from '@/types/coreDam/DamConfig'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/types/common'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useApiRequest } from '@/labs/api/useApiRequest'

const END_POINT = '/adm/v1/configuration'
const PUB_END_POINT_PREFIX = '/pub'
const PUB_END_POINT = PUB_END_POINT_PREFIX + '/v1/configuration'
const ENTITY = 'settings'

export const fetchPubConfiguration = (damClient: () => AxiosInstance) => {
  const { execute } = useApiRequest<DamPubConfig, null>({
    client: damClient,
    method: 'GET',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: PUB_END_POINT,
  })

  return execute()
}

export const fetchConfiguration = (damClient: () => AxiosInstance) => {
  const { execute } = useApiRequest<DamPrvConfig, null>({
    client: damClient,
    method: 'GET',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })

  return execute()
}

// The id goes through `urlParams` rather than into the string, because that is the shape the rest
// of the migrated calls use. It does not bring the call under `anzu/url-params-match-template`:
// that rule wants `urlTemplate` and `urlParams` in one object literal, and every call here passes
// `urlParams` to `execute` instead, so the rule checks none of them either way.
export const fetchExtSystemConfiguration = (extSystem: IntegerId, damClient: () => AxiosInstance) => {
  const { execute } = useApiRequest<DamExtSystemConfig, null>({
    client: damClient,
    method: 'GET',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT + '/ext-system/:extSystem',
  })

  return execute({ urlParams: { extSystem } })
}
