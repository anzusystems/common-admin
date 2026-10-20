import type { DamAssetLicence } from '@/domains/dam/types/AssetLicence'
import type { AxiosInstance } from 'axios'
import type { IntegerId } from '@/shared/types/common'
import { useApiRequest } from '@/domains/api/composables/useApiRequest'
import { DAM_END_POINT_ASSET_LICENCE } from '@/domains/dam/api/damEndPoints'

/** `endPoint`: the address of the licences the caller goes by; the default one where it gives none. */
export const fetchDamAssetLicence = (
  client: () => AxiosInstance,
  id: IntegerId,
  endPoint: string = DAM_END_POINT_ASSET_LICENCE
) => {
  const { execute } = useApiRequest<DamAssetLicence, null>({
    client,
    method: 'GET',
    system: 'coreDam',
    entity: 'assetLicence',
    urlTemplate: endPoint + '/:id',
  })

  return execute({ urlParams: { id } })
}
