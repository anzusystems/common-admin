import type { AxiosInstance } from 'axios'
import { apiCreateOne } from '@/services/api/apiCreateOne'
import { apiUpdateOne } from '@/services/api/apiUpdateOne'
import { apiDeleteOne } from '@/services/api/apiDeleteOne'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import type { IntegerId } from '@/types/common'
import type { ImageAware, ImageCreateUpdateAware } from '@/types/ImageAware'

const END_POINT = '/adm/v1/image'
export const ENTITY = 'image'
export const SYSTEM_CMS = 'cms'

export const fetchImage = (client: () => AxiosInstance, id: IntegerId) =>
  apiFetchOne<ImageAware>(client, END_POINT + '/:id', { id }, SYSTEM_CMS, ENTITY)

export const createImage = (client: () => AxiosInstance, data: ImageCreateUpdateAware) =>
  apiCreateOne<ImageCreateUpdateAware, ImageAware>(client, data, END_POINT, {}, SYSTEM_CMS, ENTITY)

export const updateImage = (client: () => AxiosInstance, id: IntegerId, data: ImageCreateUpdateAware) =>
  apiUpdateOne<ImageCreateUpdateAware, ImageAware>(client, data, END_POINT + '/:id', { id }, SYSTEM_CMS, ENTITY)

export const deleteImage = (client: () => AxiosInstance, id: IntegerId) =>
  apiDeleteOne<ImageAware>(client, END_POINT + '/:id', { id }, SYSTEM_CMS, ENTITY)
