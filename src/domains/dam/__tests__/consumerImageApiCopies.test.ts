import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosInstance } from 'axios'
import { type ConsumerImageApi, installConsumerImageApi } from '@/domains/dam/__tests__/support/consumerImageApi'
import { consumerProfiles, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { useCommonAdminImageOptions } from '@/domains/dam/imageWidget/composables/commonAdminImageOptions'
import type { ImageAware } from '@/domains/dam/types/ImageAware'

// Image copies come back under both applications: admin-cms through
// the fake client, admin-ugc through its own six stand-in functions.
// Changes a widget makes to its input stay out of the backend under both. Otherwise
// a case for one could pass on an in-memory change that its twin catches.

const stored: ImageAware = {
  id: 7,
  texts: { description: 'image 7', source: 'source 7' },
  dam: { damId: 'file-7', licenceId: 100000, regionPosition: 0, internal: false },
  flags: { showSource: true, internal: false, overrideInternal: false },
  position: 1,
}

type Api = ReturnType<typeof useCommonAdminImageOptions>['imageApi']

describe.each(consumerProfiles)('the image API under the $name', (profile) => {
  let images: ConsumerImageApi
  beforeEach(() => {
    setActivePinia(createPinia())
    const dam = createFakeDam(profile.endPoints)
    images = installConsumerImageApi(profile, installConsumerProfile(profile, dam.client))
    images.has(structuredClone(stored))
  })

  it.each<[string, (api: Api, client: () => AxiosInstance) => Promise<ImageAware | null | undefined>]>([
    ['a read of an image', (api, client) => api.fetchImage(client, 7)],
    ['a list by ids', async (api, client) => (await api.fetchImageListByIds(client, [7]))[0]!],
    ['an image it saved', (api, client) => api.updateImage(client, 7, structuredClone(stored))],
  ])('hands out %s as a copy: what the widget changes in it stays out of the backend', async (_what, ask) => {
    const { imageApi, imageClient } = useCommonAdminImageOptions()

    const handed = (await ask(imageApi, imageClient))!
    expect(handed).toEqual(stored)
    handed.texts.description = 'changed by the widget'
    handed.flags.showSource = false

    expect(images.images.get(7)).toEqual(stored)
  })
})
