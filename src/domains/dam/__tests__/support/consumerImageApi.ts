import type { ConsumerProfile, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDamAnswer, type FakeDamRequest } from '@/domains/dam/__tests__/support/fakeDam'
import { initCommonAdminImageOptions } from '@/domains/dam/imageWidget/composables/commonAdminImageOptions'
import type { ImageAware, ImageCreateUpdateAware } from '@/domains/dam/types/ImageAware'
import type { IntegerId } from '@/shared/types/common'

// Where an image widget saves its images, under each of the two applications. admin-cms leaves it to the library,
// which asks the CMS backend through the image client of the options (`/adm/v1/image`); admin-ugc brings six
// functions of its own. Either way a test reads the same thing back: what was asked to be saved, in order.

export type ImageApiCall =
  | ['createImage', ImageCreateUpdateAware]
  | ['updateImage', IntegerId, ImageCreateUpdateAware]
  | ['bulkUpdateImages', ImageCreateUpdateAware[]]
  | ['fetchImage', IntegerId]
  | ['fetchImageListByIds', IntegerId[]]
  | ['deleteImage', IntegerId]

// What the widget hands over is reactive: the record keeps it as it was at that moment.
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

const ONE = /^\/adm\/v1\/image\/(\d+)$/
const ALL = '/adm/v1/image'

/**
 * Replaces the image part of an installed profile with one that answers. Call after `installConsumerProfile`, with
 * what it returned.
 */
export function installConsumerImageApi(profile: ConsumerProfile, options: ReturnType<typeof installConsumerProfile>) {
  const calls: ImageApiCall[] = []
  /** The images the backend has, by id. */
  const images = new Map<IntegerId, ImageAware>()
  let lastId = 500
  const store = (image: ImageCreateUpdateAware, id = image.id ?? ++lastId): ImageAware => {
    const stored = { ...image, id }
    images.set(id, stored)
    return stored
  }
  // The saves of one image a test holds (`holdSaves`): each is recorded as it is asked for, and answered once the test
  // lets it, as saved or as one that failed.
  type HeldSave = (failed: boolean) => void
  let held: HeldSave[] | undefined
  const whenLet = () => new Promise<boolean>((resolve) => held!.push(resolve))
  const answerSave = (saved: () => FakeDamAnswer) =>
    held ? whenLet().then((failed) => (failed ? { status: 500 } : saved())) : saved()

  // The reads of one image a test holds (`holdReads`): each is recorded as it is asked for, and answered once the test
  // lets it.
  let heldReads: Array<() => void> | undefined
  const whenReadLet = () => new Promise<void>((resolve) => heldReads!.push(resolve))

  // The CMS backend as the browser sees it: a client that records its requests.
  const server = createFakeDam({ asset: '/not-the-dam/asset', image: '/not-the-dam/image' })
  const body = (request: FakeDamRequest) => JSON.parse(request.data as string) as never
  server.reply((request) => {
    const [path, query = ''] = request.url.split('?')
    const one = path!.match(ONE)
    if (request.method === 'POST' && path === ALL) {
      calls.push(['createImage', body(request)])
      return answerSave(() => ({ status: 201, data: store(body(request)) }))
    }
    if (request.method === 'PUT' && one) {
      calls.push(['updateImage', Number(one[1]), body(request)])
      return answerSave(() => ({ status: 200, data: store(body(request), Number(one[1])) }))
    }
    if (request.method === 'PUT' && path === ALL) {
      const sent = (body(request) as { images: ImageCreateUpdateAware[] }).images
      calls.push(['bulkUpdateImages', sent])
      return { status: 200, data: { images: sent.map((image) => store(image)) } }
    }
    if (request.method === 'GET' && one) {
      calls.push(['fetchImage', Number(one[1])])
      const read = (): FakeDamAnswer => {
        const found = images.get(Number(one[1]))
        return found ? { status: 200, data: found } : { status: 404 }
      }
      return heldReads ? whenReadLet().then<FakeDamAnswer>(read) : read()
    }
    if (request.method === 'GET' && path === ALL) {
      const ids = (new URLSearchParams(query).get('filter_in[id]') ?? '').split(',').filter(Boolean).map(Number)
      calls.push(['fetchImageListByIds', ids])
      const found = ids.map((id) => images.get(id)).filter((image) => image !== undefined)
      return { status: 200, data: { data: found, totalCount: found.length } }
    }
    if (request.method === 'DELETE' && one) {
      calls.push(['deleteImage', Number(one[1])])
      images.delete(Number(one[1]))
      return { status: 204 }
    }
    return undefined
  })

  const own = options.image.configs.default!
  const bringsItsOwn = !!own.imageApi
  initCommonAdminImageOptions({
    ...options.image,
    configs: {
      default: {
        ...own,
        imageClient: server.client,
        // The six functions of admin-ugc are the application's own code: stand-ins that answer as its backend.
        ...(bringsItsOwn
          ? {
              imageApi: {
                fetchImage: async (_client, id) => {
                  calls.push(['fetchImage', id])
                  if (heldReads) await whenReadLet()
                  return images.get(id)!
                },
                createImage: async (_client, data) => {
                  calls.push(['createImage', plain(data)])
                  if (held && (await whenLet())) throw new Error('the image was not saved')
                  return store(plain(data))
                },
                updateImage: async (_client, id, data) => {
                  calls.push(['updateImage', id, plain(data)])
                  if (held && (await whenLet())) throw new Error('the image was not saved')
                  return store(plain(data), id)
                },
                deleteImage: async (_client, id) => {
                  calls.push(['deleteImage', id])
                  images.delete(id)
                },
                fetchImageListByIds: async (_client, ids) => {
                  calls.push(['fetchImageListByIds', [...ids]])
                  return ids.map((id) => images.get(id)!).filter(Boolean)
                },
                bulkUpdateImages: async (_client, items) => {
                  calls.push(['bulkUpdateImages', plain(items)])
                  return items.map((image) => store(plain(image)))
                },
              },
            }
          : {}),
      },
    },
  })

  return {
    /** What was asked of the image API, whoever answered it. */
    calls,
    images,
    /** The requests to the CMS backend: none when the application brings its own functions. */
    requests: server.requests,
    unanswered: server.unanswered,
    /** Whether the application brings its own image API (admin-ugc) or leaves it to the library (admin-cms). */
    bringsItsOwn,
    /** An image the backend already has. */
    has: (image: ImageAware) => store(image, image.id),
    /** From now on a read of one image waits until the test lets it answer: `waiting[n]()`, in the order asked. */
    holdReads: () => {
      const waiting: Array<() => void> = (heldReads = [])
      return { waiting }
    },
    /** From now on a create or an update of one image waits until the test lets it answer. */
    holdSaves: () => {
      const waiting: HeldSave[] = (held = [])
      return {
        waiting,
        /** Lets every save held so far answer: as saved, or as one that failed. */
        release: (how: 'saved' | 'failed' = 'saved') => waiting.splice(0).forEach((answer) => answer(how === 'failed')),
      }
    },
  }
}

export type ConsumerImageApi = ReturnType<typeof installConsumerImageApi>
