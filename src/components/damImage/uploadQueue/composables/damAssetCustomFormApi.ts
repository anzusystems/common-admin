import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/types/common'
import type { DamAssetTypeType, DamDistributionServiceName } from '@/types/coreDam/Asset'
import type { CustomDataFormElement } from '@/components/customDataForm/CustomDataForm'

import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'
import { useApiFetchItems } from '@/labs/api/useApiFetchItems'

const END_POINT = '/adm/v1/asset-custom-form'
const ENTITY = 'assetCustomForm'

// todo limit set to 100 for now, add load for pagination?
export const fetchAssetCustomFormElements = (
  damClient: () => AxiosInstance,
  extSystem: IntegerId,
  assetType: DamAssetTypeType
) => {
  const { execute } = useApiFetchItems<CustomDataFormElement>({
    client: damClient,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT + '/ext-system/:extSystem/type/:assetType/element?order[position]=asc&limit=100',
  })

  return execute({ urlParams: { extSystem, assetType } })
}

// todo limit set to 100 for now, add load for pagination?
export const fetchDistributionCustomFormElements = (
  damClient: () => AxiosInstance,
  distributionService: DamDistributionServiceName
) => {
  const { execute } = useApiFetchItems<CustomDataFormElement>({
    client: damClient,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: END_POINT + '/distribution-service/:distributionService/element?order[position]=asc&limit=100',
  })

  return execute({ urlParams: { distributionService } })
}
