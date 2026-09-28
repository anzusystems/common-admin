import type { RegionOfInterest } from '@/types/coreDam/Roi'
import type { AxiosInstance } from 'axios'
import type { DocId } from '@/types/common'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import { apiUpdateOne } from '@/services/api/apiUpdateOne'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'

export const ENTITY = 'asset'

export const fetchRoi = (client: () => AxiosInstance, endPointRoi: string, id: DocId) =>
  apiFetchOne<RegionOfInterest>(client, endPointRoi + '/:id', { id }, SYSTEM_CORE_DAM, ENTITY)

export const updateRoi = (
  client: () => AxiosInstance,
  endPointRoi: string,
  id: DocId,
  data: RegionOfInterest,
) =>
  apiUpdateOne<RegionOfInterest>(
    client,
    data,
    endPointRoi + '/:id',
    { id },
    SYSTEM_CORE_DAM,
    ENTITY,
  )

export const useFetchImageRoiList = (
  client: () => AxiosInstance,
  endPointImage: string,
  imageId: DocId,
) =>
  useApiFetchList<any[]>({
    client,
    system: SYSTEM_CORE_DAM,
    entity: ENTITY,
    urlTemplate: endPointImage + '/:id/roi',
    urlParams: { id: imageId },
  })
