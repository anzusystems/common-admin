import { describe, expect, it, vi } from 'vitest'
import {
  bulkUpdateImages,
  extractImageSaveErrorInfo,
} from '@/components/damImage/uploadQueue/api/imageApiCms'
import { AnzuFatalError } from '@/model/error/AnzuFatalError'
import { AnzuApiAxiosError } from '@/model/error/AnzuApiAxiosError'
import {
  applyImageOwner,
  type ImageAware,
  type ImageCreateUpdateAware,
  type ImageOwner,
} from '@/types/ImageAware'

const item = (damId: string): ImageCreateUpdateAware => ({
  texts: { description: '', source: '' },
  dam: { damId, licenceId: 1, regionPosition: 0, internal: false },
  flags: { showSource: true, internal: false, overrideInternal: false },
  position: 0,
})

const asImageAware = (data: ImageCreateUpdateAware, id: number): ImageAware => ({ ...data, id })

const axiosError = (data: Record<string, unknown>) => ({
  isAxiosError: true,
  response: { data },
})

const singleUseBody = {
  error: 'image_single_use_violation',
  reason: 'exclusivity_conflict',
  damId: 'dam-a',
}

const rejectingClient = (data: Record<string, unknown>) => () => ({
  put: vi.fn().mockRejectedValue(axiosError(data)),
})

describe('extractImageSaveErrorInfo', () => {
  it.each<[string, unknown, Record<string, unknown> | undefined]>([
    [
      'plain axios error',
      axiosError(singleUseBody),
      { code: 'image_single_use_violation', reason: 'exclusivity_conflict', damId: 'dam-a' },
    ],
    [
      'wrapped by apiCreateOne and apiUpdateOne',
      new AnzuFatalError(axiosError(singleUseBody) as never),
      { code: 'image_single_use_violation', damId: 'dam-a' },
    ],
    [
      'wrapped by useApiRequest',
      new AnzuApiAxiosError(axiosError(singleUseBody) as never),
      { code: 'image_single_use_violation', damId: 'dam-a' },
    ],
    [
      'reason renamed on the backend',
      axiosError({ ...singleUseBody, reason: 'something_new' }),
      { reason: undefined, damId: 'dam-a' },
    ],
    [
      'known gallery copy reason',
      axiosError({ error: 'image_single_use_violation', reason: 'gallery_copy' }),
      { reason: 'gallery_copy' },
    ],
    [
      'take over refused',
      axiosError({ error: 'image_take_over_failed', reason: 'take_over_rejected' }),
      { code: 'image_take_over_failed', reason: 'take_over_rejected' },
    ],
    [
      'owner conflict',
      axiosError({ error: 'image_owner_conflict', damId: 'dam-a' }),
      { code: 'image_owner_conflict', damId: 'dam-a' },
    ],
    [
      'holder named by the server',
      axiosError({ ...singleUseBody, holderResourceName: 'gallery', holderResourceId: '12' }),
      { holderResourceName: 'gallery', holderResourceId: '12' },
    ],
    ['generic validation error', axiosError({ error: 'validation_failed' }), undefined],
    ['not an axios error', new Error('Network down'), undefined],
  ])('%s', (_name, error, expected) => {
    const info = extractImageSaveErrorInfo(error)

    if (expected === undefined) {
      expect(info).toBeUndefined()
      return
    }
    expect(info).toMatchObject(expected)
  })
})

describe('bulkUpdateImages', () => {
  it('attaches the error only to the item its damId names', async () => {
    const res = await bulkUpdateImages(
      rejectingClient({
        error: 'image_single_use_violation',
        reason: 'shared_gallery',
        damId: 'dam-a',
      }) as never,
      [item('dam-a'), item('dam-b')],
    )

    expect(res.failed).toHaveLength(2)
    expect(res.failed.find((f) => f.item.dam.damId === 'dam-a')?.errorInfo?.reason).toBe(
      'shared_gallery',
    )
    expect(res.failed.find((f) => f.item.dam.damId === 'dam-b')?.errorInfo).toBeUndefined()
    expect(res.batchErrors).toEqual([])
  })

  it.each<[string, Record<string, unknown>]>([
    ['error without a damId', { error: 'image_single_use_violation', reason: 'invalid_owner' }],
    [
      'damId outside the chunk',
      { error: 'image_single_use_violation', reason: 'owner_immutable', damId: 'dam-elsewhere' },
    ],
  ])('carries an %s in batchErrors instead of on an item', async (_name, body) => {
    const res = await bulkUpdateImages(rejectingClient(body) as never, [item('dam-a')])

    expect(res.failed).toHaveLength(1)
    expect(res.failed[0]?.errorInfo).toBeUndefined()
    expect(res.batchErrors).toEqual([expect.objectContaining({ reason: body.reason })])
  })

  it.each<[string, unknown]>([
    ['network error', new Error('Network Error')],
    ['server error without an image code', axiosError({ error: 'internal_server_error' })],
  ])('returns a %s in unknownErrors and fails its items without an error info', async (_name, error) => {
    const client = () => ({ put: vi.fn().mockRejectedValue(error) })

    const res = await bulkUpdateImages(client as never, [item('dam-a')])

    expect(res.unknownErrors).toEqual([error])
    expect(res.batchErrors).toEqual([])
    expect(res.failed).toEqual([{ item: item('dam-a'), index: 0 }])
  })

  it('keeps the images of saved chunks and processes the rest when an unknown error hits one chunk', async () => {
    const error = axiosError({ error: 'internal_server_error' })
    const first = item('dam-1')
    const put = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, data: { images: [asImageAware(first, 1)] } })
      .mockRejectedValueOnce(error)
      .mockResolvedValueOnce({ status: 200, data: { images: [asImageAware(item('dam-41'), 41)] } })
    const items = Array.from({ length: 41 }, (_, i) => (i === 0 ? first : item(`dam-${i + 1}`)))

    const res = await bulkUpdateImages((() => ({ put })) as never, items)

    expect(put).toHaveBeenCalledTimes(3)
    expect(res.images.map((image) => image.id)).toEqual([1, 41])
    expect(res.failed.map((failure) => failure.index)).toEqual(Array.from({ length: 20 }, (_, i) => i + 20))
    expect(res.unknownErrors).toEqual([error])
  })

  it('reports a chunk answered with a non 200 status as failed without an error', async () => {
    const client = () => ({ put: vi.fn().mockResolvedValue({ status: 204, data: {} }) })

    const res = await bulkUpdateImages(client as never, [item('dam-a')])

    expect(res.failed).toEqual([{ item: item('dam-a'), index: 0 }])
    expect(res.images).toEqual([])
  })

  it('keeps the images already saved by an earlier successful chunk when a later one fails', async () => {
    const first = item('dam-1')
    const second = item('dam-2')
    const put = vi
      .fn()
      .mockResolvedValueOnce({ status: 200, data: { images: [asImageAware(first, 1)] } })
      .mockRejectedValueOnce(
        axiosError({
          error: 'image_single_use_violation',
          reason: 'shared_gallery',
          damId: 'dam-2',
        }),
      )
    const filler = Array.from({ length: 19 }, (_, i) => item(`dam-filler-${i}`))

    const res = await bulkUpdateImages((() => ({ put })) as never, [first, ...filler, second])

    expect(put).toHaveBeenCalledTimes(2)
    expect(res.images).toEqual([asImageAware(first, 1)])
    expect(res.failed).toHaveLength(1)
    expect(res.failed[0]?.index).toBe(20)
    expect(res.failed[0]?.errorInfo?.reason).toBe('shared_gallery')
  })
})

describe('applyImageOwner', () => {
  it.each<
    [
      string,
      ImageOwner | null | undefined,
      Pick<ImageCreateUpdateAware, 'ownerResourceName' | 'ownerResourceId'>,
    ]
  >([
    [
      'owner of a saved entity',
      { resourceName: 'articleKindStandard', resourceId: 41 },
      { ownerResourceName: 'articleKindStandard', ownerResourceId: 41 },
    ],
    [
      'entity without an id keeps the stored owner',
      null,
      { ownerResourceName: 'minutePost', ownerResourceId: 7 },
    ],
    [
      'host without an owner keeps the stored owner',
      undefined,
      { ownerResourceName: 'minutePost', ownerResourceId: 7 },
    ],
  ])('%s', (_name, owner, expected) => {
    const payload = { ...item('dam-a'), ownerResourceName: 'minutePost', ownerResourceId: 7 }

    expect(applyImageOwner(payload, owner)).toMatchObject(expected)
  })
})
