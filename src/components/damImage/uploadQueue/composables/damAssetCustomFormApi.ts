import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/types/common'
import type { DamAssetType, DamDistributionServiceName } from '@/types/coreDam/Asset'
import type { CustomDataFormElement } from '@/components/customDataForm/CustomDataForm'
import { apiFetchOne } from '@/services/api/apiFetchOne'

import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'

const END_POINT = '/adm/v1/asset-custom-form'
const ENTITY = 'assetCustomForm'

// todo limit set to 100 for now, add load for pagination?
export const fetchAssetCustomFormElements = (
  damClient: () => AxiosInstance,
  extSystem: IntegerId,
  assetType: DamAssetType
) =>
  apiFetchOne<{ data: CustomDataFormElement[] }>(
    damClient,
    END_POINT + '/ext-system/:extSystem/type/:assetType/element?order[position]=asc&limit=100',
    { extSystem, assetType },
    SYSTEM_CORE_DAM,
    ENTITY
  )

// todo limit set to 100 for now, add load for pagination?
export const fetchDistributionCustomFormElements = (
  damClient: () => AxiosInstance,
  distributionService: DamDistributionServiceName
) =>
  apiFetchOne<{ data: CustomDataFormElement[] }>(
    damClient,
    END_POINT + '/distribution-service/:distributionService/element?order[position]=asc&limit=100',
    { distributionService },
    SYSTEM_CORE_DAM,
    ENTITY
  )
