import type { AxiosInstance } from 'axios'
import type { DocId, IntegerId } from '@/types/common'

export interface SingleUseHolder {
  damId: DocId
  holderDocIds: DocId[]
  holderGalleryIds: IntegerId[]
}

export interface SingleUseHolders {
  docIds: DocId[]
  galleryIds: IntegerId[]
}

/**
 * Mirrors core-cms `ImageListUsageFilterDto::MAX_DAM_IDS` - a longer list is rejected with a 422, which
 * would leave the whole page without holder data and silently un-dim held photos.
 */
const MAX_DAM_IDS_PER_REQUEST = 100

/**
 * core-cms `GET /adm/v1/image/single-use-holders?damIds=<csv>` - who already holds a single-use photo,
 * keyed by the DAM main-file id (`Image.dam.damId`). A holder is an article, or a gallery embedded in no
 * article (those have no docId, and can never be the article the caller is editing). Asked in chunks of
 * MAX_DAM_IDS_PER_REQUEST and merged into one map, never per item.
 */
export const fetchSingleUseHolders = async (
  imageClient: () => AxiosInstance,
  damIds: DocId[],
): Promise<Map<DocId, SingleUseHolders>> => {
  const holders = new Map<DocId, SingleUseHolders>()

  for (let offset = 0; offset < damIds.length; offset += MAX_DAM_IDS_PER_REQUEST) {
    const chunk = damIds.slice(offset, offset + MAX_DAM_IDS_PER_REQUEST)
    const res = await imageClient().get('/adm/v1/image/single-use-holders', {
      params: { damIds: chunk.join(',') },
    })
    const data = res.data?.data as SingleUseHolder[] | undefined
    ;(data ?? []).forEach((holder) => {
      holders.set(holder.damId, {
        docIds: Array.isArray(holder.holderDocIds) ? holder.holderDocIds : [],
        galleryIds: Array.isArray(holder.holderGalleryIds) ? holder.holderGalleryIds : [],
      })
    })
  }

  return holders
}
