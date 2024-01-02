import type { RegionOfInterest } from '@/types/coreDam/Roi'
import type { AxiosInstance } from 'axios'
import type { DocId } from '@/types/common'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import { apiUpdateOne } from '@/services/api/apiUpdateOne'
import { apiFetchList } from '@/services/api/apiFetchList'
import type { Pagination } from '@/types/Pagination'
import type { FilterBag } from '@/types/Filter'

// export interface AssetMetadataBulkItem {
//   id: DocId
//   title: string
//   description: string
//   described: boolean
// }

const END_POINT = '/adm/v1/roi'
const END_POINT_IMAGE_ROI = '/adm/v1/image/:id/roi'
export const ENTITY = 'asset'

export const fetchRoi = (client: () => AxiosInstance, id: DocId) =>
  apiFetchOne<RegionOfInterest>(client, END_POINT + '/:id', { id }, 'coreDam', ENTITY)

export const updateRoi = (client: () => AxiosInstance, id: DocId, data: RegionOfInterest) =>
  apiUpdateOne<RegionOfInterest>(client, data, END_POINT + '/:id', { id }, 'coreDam', ENTITY)

export const fetchImageRoiList = (
  client: () => AxiosInstance,
  imageId: DocId,
  pagination: Pagination,
  filterBag: FilterBag
) => apiFetchList<any[]>(client, END_POINT_IMAGE_ROI, { id: imageId }, pagination, filterBag, 'coreDam', ENTITY)
