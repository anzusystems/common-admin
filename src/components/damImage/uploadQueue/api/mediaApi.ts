import type { AxiosInstance } from 'axios'
import { apiCreateOne } from '@/services/api/apiCreateOne'
import { apiUpdateOne } from '@/services/api/apiUpdateOne'
import { apiDeleteOne } from '@/services/api/apiDeleteOne'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import type { IntegerId } from '@/types/common'
import type { MediaAware } from '@/types/MediaAware'

const END_POINT = '/adm/v1/media'
export const ENTITY = 'media'
export const SYSTEM_CMS = 'cms'

export const fetchMedia = (client: () => AxiosInstance, id: IntegerId) =>
  apiFetchOne<MediaAware>(client, END_POINT + '/:id', { id }, SYSTEM_CMS, ENTITY)

export const createMedia = (client: () => AxiosInstance, data: MediaAware) =>
  apiCreateOne<MediaAware, MediaAware>(client, data, END_POINT, {}, SYSTEM_CMS, ENTITY)

export const updateMedia = (client: () => AxiosInstance, id: IntegerId, data: MediaAware) =>
  apiUpdateOne<MediaAware, MediaAware>(client, data, END_POINT + '/:id', { id }, SYSTEM_CMS, ENTITY)

export const deleteMedia = (client: () => AxiosInstance, id: IntegerId) =>
  apiDeleteOne<MediaAware>(client, END_POINT + '/:id', { id }, SYSTEM_CMS, ENTITY)
