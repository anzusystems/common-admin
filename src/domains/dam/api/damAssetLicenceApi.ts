import type { DamAssetLicence } from '@/domains/dam/types/AssetLicence'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/shared/types/common'
import { useApiRequest } from '@/domains/api/composables/useApiRequest'

const END_POINT = '/adm/v1/asset-licence'

export const fetchDamAssetLicence = (client: () => AxiosInstance, id: IntegerId) => {
  const { execute } = useApiRequest<DamAssetLicence, null>({
    client,
    method: 'GET',
    system: 'coreDam',
    entity: 'assetLicence',
    urlTemplate: END_POINT + '/:id',
  })

  return execute({ urlParams: { id } })
}
