import type { RegionOfInterest } from '@/domains/dam/types/Roi'
import type { AxiosInstance } from 'axios'
import type { DocId } from '@/shared/types/common'
import { useApiFetchList } from '@/domains/api/composables/useApiFetchList'
import { useApiRequest } from '@/domains/api/composables/useApiRequest'
import { SYSTEM_CORE_DAM } from '@/domains/dam/api/damConstants'

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
