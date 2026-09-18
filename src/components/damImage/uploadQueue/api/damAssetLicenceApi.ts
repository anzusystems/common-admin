import type { DamAssetLicence } from '@/types/coreDam/AssetLicence'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/types/common'
import { useApiRequest } from '@/labs/api/useApiRequest'

const END_POINT = '/adm/v1/asset-licence'

export const fetchDamAssetLicence = (client: () => AxiosInstance, id: IntegerId) => {
  const { executeRequest } = useApiRequest<DamAssetLicence, null>({
    client,
    method: 'GET',
    system: 'coreDam',
    entity: 'assetLicence',
    urlTemplate: END_POINT + '/:id',
  })

  return executeRequest({ urlParams: { id } })
}
