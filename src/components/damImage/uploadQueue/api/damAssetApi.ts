import type { AxiosInstance } from 'axios'
import type { DocId } from '@/types/common'
import { SYSTEM_CORE_DAM } from '@/services/api/coreDam/assetApi'
import type { AssetDetailItemDto } from '@/types/coreDam/Asset'
import { apiFetchOne } from '@/services/api/apiFetchOne'

const END_POINT = '/adm/v1/asset'
const ENTITY = 'asset'

export const fetchAsset = (client: () => AxiosInstance, id: DocId) =>
  apiFetchOne<AssetDetailItemDto>(client, END_POINT + '/:id', { id }, SYSTEM_CORE_DAM, ENTITY)
