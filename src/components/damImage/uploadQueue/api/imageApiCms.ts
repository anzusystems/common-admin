import type { AxiosInstance, AxiosResponse } from 'axios'
import type { IntegerId } from '@/types/common'
import type { ImageAware, ImageCreateUpdateAware } from '@/types/ImageAware'
import { HTTP_STATUS_OK } from '@/composables/statusCodes'
import { useApiFetchByIds } from '@/labs/api/useApiFetchByIds'
import { useApiCommand, useApiRequest } from '@/labs/api/useApiRequest'

const END_POINT = '/adm/v1/image'
export const ENTITY = 'image'
export const SYSTEM_CMS = 'cms'

const BULK_METADATA_LIMIT = 20

export const fetchImageListByIds = (client: () => AxiosInstance, ids: IntegerId[]) => {
  const { execute } = useApiFetchByIds<ImageAware>({
    client,
    system: SYSTEM_CMS,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })

  return execute(ids)
}

export const fetchImage = async (client: () => AxiosInstance, id: IntegerId) => {
  const { execute } = useApiRequest<ImageAware, null>({
    client,
    method: 'GET',
    system: SYSTEM_CMS,
    entity: ENTITY,
    urlTemplate: END_POINT + '/:id',
  })

  // `null` for a body-less response, which is what the old helper answered and what every caller
  // still guards with: `isNull` is a strict `=== null`, so an `undefined` would walk straight
  // through the guard and be dereferenced.
  return (await execute({ urlParams: { id } })) ?? null
}

export const createImage = (client: () => AxiosInstance, data: ImageCreateUpdateAware) => {
  const { execute } = useApiRequest<ImageAware, ImageCreateUpdateAware>({
    client,
    method: 'POST',
    system: SYSTEM_CMS,
    entity: ENTITY,
    urlTemplate: END_POINT,
  })

  return execute({ body: data })
}

export const updateImage = (client: () => AxiosInstance, id: IntegerId, data: ImageCreateUpdateAware) => {
  const { execute } = useApiRequest<ImageAware, ImageCreateUpdateAware>({
    client,
    method: 'PUT',
    system: SYSTEM_CMS,
    entity: ENTITY,
    urlTemplate: END_POINT + '/:id',
  })

  return execute({ urlParams: { id }, body: data })
}

export const deleteImage = (client: () => AxiosInstance, id: IntegerId) => {
  const { execute } = useApiCommand({
    client,
    method: 'DELETE',
    system: SYSTEM_CMS,
    entity: ENTITY,
    urlTemplate: END_POINT + '/:id',
  })

  return execute({ urlParams: { id } })
}

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
          const images: ImageAware[] = responses.flatMap((response) => response.data.images)
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
