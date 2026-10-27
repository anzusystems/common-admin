import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/shared/types/common'
import type { DamAssetTypeType, DamDistributionServiceName } from '@/domains/dam/types/Asset'
import type { CustomDataFormElement } from '@/domains/customDataForm/types/CustomDataForm'

import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'
import { useApiFetchItems } from '@/domains/api/composables/useApiFetchItems'
import { DAM_END_POINT_ASSET_CUSTOM_FORM } from '@/domains/dam/api/damEndPoints'

const ENTITY = 'assetCustomForm'

// `endPoint`: custom forms address. Defaults when not given.

// todo limit set to 100 for now, add load for pagination?
export const fetchAssetCustomFormElements = (
  damClient: () => AxiosInstance,
  extSystem: IntegerId,
  assetType: DamAssetTypeType,
  endPoint: string = DAM_END_POINT_ASSET_CUSTOM_FORM
) => {
  const { execute } = useApiFetchItems<CustomDataFormElement>({
    client: damClient,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint + '/ext-system/:extSystem/type/:assetType/element?order[position]=asc&limit=100',
  })

  return execute({ urlParams: { extSystem, assetType } })
}

// todo limit set to 100 for now, add load for pagination?
export const fetchDistributionCustomFormElements = (
  damClient: () => AxiosInstance,
  distributionService: DamDistributionServiceName,
  endPoint: string = DAM_END_POINT_ASSET_CUSTOM_FORM
) => {
  const { execute } = useApiFetchItems<CustomDataFormElement>({
    client: damClient,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPoint + '/distribution-service/:distributionService/element?order[position]=asc&limit=100',
  })

  return execute({ urlParams: { distributionService } })
}
