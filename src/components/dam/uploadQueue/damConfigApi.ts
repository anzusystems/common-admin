import type { DamConfig, DamConfigExtSystem, DamPubConfig } from '@/types/coreDam/DamConfig'
import type { AxiosInstance } from 'axios'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import { SYSTEM_CORE_DAM } from '@/services/api/coreDam/assetApi'
import type { IntegerId } from '@/types/common'

const END_POINT = '/adm/v1/configuration'
const PUB_END_POINT_PREFIX = '/pub'
const PUB_END_POINT = PUB_END_POINT_PREFIX + '/v1/configuration'
const ENTITY = 'settings'

export const fetchPubConfiguration = (damClient: () => AxiosInstance) =>
  apiFetchOne<DamPubConfig>(damClient, PUB_END_POINT, {}, SYSTEM_CORE_DAM, ENTITY)

export const fetchConfiguration = (damClient: () => AxiosInstance) =>
  apiFetchOne<DamConfig>(damClient, END_POINT, {}, SYSTEM_CORE_DAM, ENTITY)

export const fetchExtSystemConfiguration = (extSystem: IntegerId, damClient: () => AxiosInstance) =>
  apiFetchOne<DamConfigExtSystem>(damClient, END_POINT + '/ext-system/' + extSystem, {}, SYSTEM_CORE_DAM, ENTITY)
