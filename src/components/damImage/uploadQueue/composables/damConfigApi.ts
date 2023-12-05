import type { DamExtSystemConfig, DamPrvConfig, DamPubConfig } from '@/types/coreDam/DamConfig'
import type { AxiosInstance } from 'axios'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import type { IntegerId } from '@/types/common'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'

const END_POINT = '/adm/v1/configuration'
const PUB_END_POINT_PREFIX = '/pub'
const PUB_END_POINT = PUB_END_POINT_PREFIX + '/v1/configuration'
const ENTITY = 'settings'

export const fetchPubConfiguration = (damClient: () => AxiosInstance) =>
  apiFetchOne<DamPubConfig>(damClient, PUB_END_POINT, {}, SYSTEM_CORE_DAM, ENTITY)

export const fetchConfiguration = (damClient: () => AxiosInstance) =>
  apiFetchOne<DamPrvConfig>(damClient, END_POINT, {}, SYSTEM_CORE_DAM, ENTITY)

export const fetchExtSystemConfiguration = (extSystem: IntegerId, damClient: () => AxiosInstance) =>
  apiFetchOne<DamExtSystemConfig>(damClient, END_POINT + '/ext-system/' + extSystem, {}, SYSTEM_CORE_DAM, ENTITY)
