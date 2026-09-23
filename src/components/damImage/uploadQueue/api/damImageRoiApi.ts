import type { RegionOfInterest } from '@/types/coreDam/Roi'
import type { AxiosInstance } from 'axios'
import type { DocId } from '@/types/common'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import { useApiRequest } from '@/labs/api/useApiRequest'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'

export const ENTITY = 'asset'

export const fetchRoi = (client: () => AxiosInstance, endPointRoi: string, id: DocId) => {
  const { execute } = useApiRequest<RegionOfInterest, null>({
    client,
    method: 'GET',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPointRoi + '/:id',
  })

  return execute({ urlParams: { id } })
}

export const updateRoi = (client: () => AxiosInstance, endPointRoi: string, id: DocId, data: RegionOfInterest) => {
  const { execute } = useApiRequest<RegionOfInterest, RegionOfInterest>({
    client,
    method: 'PUT',
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPointRoi + '/:id',
  })

  return execute({ urlParams: { id }, body: data })
}

export const useFetchImageRoiList = (client: () => AxiosInstance, endPointImage: string, imageId: DocId) =>
  useApiFetchList<any>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPointImage + '/:id/roi',
    urlParams: { id: imageId },
  })
