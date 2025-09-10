import type { RegionOfInterest } from '@/types/coreDam/Roi'
import type { AxiosInstance } from 'axios'
import type { DocId } from '@/types/common'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import { apiUpdateOne } from '@/services/api/apiUpdateOne'
import { useApiFetchList } from '@/labs/api/useApiFetchList'
import { SYSTEM_CORE_DAM } from '@/components/damImage/uploadQueue/api/damAssetApi'

const END_POINT = '/adm/v1/roi'
const END_POINT_IMAGE_ROI = '/adm/v1/image/:id/roi'
export const ENTITY = 'asset'

export const fetchRoi = (client: () => AxiosInstance, id: DocId) =>
  apiFetchOne<RegionOfInterest>(client, END_POINT + '/:id', { id }, SYSTEM_CORE_DAM, ENTITY)

export const updateRoi = (client: () => AxiosInstance, id: DocId, data: RegionOfInterest) =>
  apiUpdateOne<RegionOfInterest>(client, data, END_POINT + '/:id', { id }, SYSTEM_CORE_DAM, ENTITY)

export const useFetchImageRoiList = (client: () => AxiosInstance, imageId: DocId) =>
  useApiFetchList<any[]>(client, SYSTEM_CORE_DAM, ENTITY, END_POINT_IMAGE_ROI, { id: imageId })
