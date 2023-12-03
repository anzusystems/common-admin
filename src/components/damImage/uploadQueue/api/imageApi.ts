import type { AxiosInstance, AxiosResponse } from 'axios'
import { apiCreateOne } from '@/services/api/apiCreateOne'
import { apiUpdateOne } from '@/services/api/apiUpdateOne'
import { apiDeleteOne } from '@/services/api/apiDeleteOne'
import { apiFetchOne } from '@/services/api/apiFetchOne'
import type { IntegerId } from '@/types/common'
import type { ImageAware, ImageCreateUpdateAware } from '@/types/ImageAware'
import { apiFetchByIds } from '@/services/api/apiFetchByIds'
import { HTTP_STATUS_OK } from '@/composables/statusCodes'

const END_POINT = '/adm/v1/image'
export const ENTITY = 'image'
export const SYSTEM_CMS = 'cms'

const BULK_METADATA_LIMIT = 20

export const fetchImageListByIds = (client: () => AxiosInstance, ids: IntegerId[]) =>
  apiFetchByIds<ImageAware[]>(client, ids, END_POINT, {}, SYSTEM_CMS, ENTITY)

export const fetchImage = (client: () => AxiosInstance, id: IntegerId) =>
  apiFetchOne<ImageAware>(client, END_POINT + '/:id', { id }, SYSTEM_CMS, ENTITY)

export const createImage = (client: () => AxiosInstance, data: ImageCreateUpdateAware) =>
  apiCreateOne<ImageCreateUpdateAware, ImageAware>(client, data, END_POINT, {}, SYSTEM_CMS, ENTITY)

export const updateImage = (client: () => AxiosInstance, id: IntegerId, data: ImageCreateUpdateAware) =>
  apiUpdateOne<ImageCreateUpdateAware, ImageAware>(client, data, END_POINT + '/:id', { id }, SYSTEM_CMS, ENTITY)

export const deleteImage = (client: () => AxiosInstance, id: IntegerId) =>
  apiDeleteOne<ImageAware>(client, END_POINT + '/:id', { id }, SYSTEM_CMS, ENTITY)

export const bulkUpdateImages = (client: () => AxiosInstance, items: ImageCreateUpdateAware[]) => {
  return new Promise<ImageAware[]>((resolve, reject) => {
    updateImagesSequence(client, items)
      .then((responses) => {
        if (items.length === 0) {
          return resolve([])
        } else if (responses.length === 0) {
          return reject(responses)
        } else if (
          responses.every((res) => {
            return res.status === HTTP_STATUS_OK
          })
        ) {
          const images: ImageAware[] = responses.flatMap(response => response.data.images)
          return resolve(images)
        } else {
          return reject(responses)
        }
      })
      .catch((err) => {
        //
        return reject(err)
      })
  })
}

async function updateImagesSequence(client: () => AxiosInstance, items: ImageCreateUpdateAware[]) {
  const totalCalls = Math.ceil(items.length / BULK_METADATA_LIMIT)
  const responses: AxiosResponse[] = []
  if (items.length === 0) return Promise.resolve([])

  for (let i = 0; i < totalCalls; i++) {
    const offset = i * BULK_METADATA_LIMIT
    const reduced = items.slice(offset, offset + BULK_METADATA_LIMIT)
    const reqData = { images: reduced }
    const res = await client().put(END_POINT, JSON.stringify(reqData))
    responses.push(res)
  }
  return responses
}
