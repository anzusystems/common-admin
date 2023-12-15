import type { DamAssetLicence } from '@/types/coreDam/AssetLicence'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import type { AxiosInstance } from 'axios'

const END_POINT = '/adm/v1/asset-licence'

export const fetchDamAssetLicence = (client: () => AxiosInstance, id: number) =>
  apiFetchOne<DamAssetLicence>(client, END_POINT + '/:id', { id }, 'coreDam', 'assetLicence')
