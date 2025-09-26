import type { AxiosInstance } from 'axios'
import { apiCreateOne } from '@/services/api/apiCreateOne'
import type { MediaAware } from '@/types/MediaAware'

const END_POINT = '/adm/v1/media'
export const ENTITY = 'media'
export const SYSTEM_CMS = 'cms'

export const createOrFetchMedia = (client: () => AxiosInstance, data: MediaAware) =>
  apiCreateOne<MediaAware, MediaAware>(client, data, END_POINT, {}, SYSTEM_CMS, ENTITY)
