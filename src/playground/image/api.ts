import type { ImageWidgetImage } from '@/types/ImageWidgetImage'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import { cmsClient } from '@/playground/image/cmsClient'
import type { IntegerId } from '@/types/common'

export const playgroundFetchImageCms = (id: IntegerId) =>
  apiFetchOne<ImageWidgetImage>(cmsClient, '/adm/v1/image/:id', { id }, 'cms', 'image')
