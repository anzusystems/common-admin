import type { ImageAware } from '@/types/ImageAware'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import { cmsClient } from '@/playground/imageView/cmsClient'
import type { IntegerId } from '@/types/common'

export const playgroundFetchImageCms = (id: IntegerId) =>
  apiFetchOne<ImageAware>(cmsClient, '/adm/v1/image/:id', { id }, 'cms', 'image')
