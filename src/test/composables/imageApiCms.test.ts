import { describe, expect, it, vi } from 'vitest'
import { bulkUpdateImages, extractImageSaveErrorInfo } from '@/components/damImage/uploadQueue/api/imageApiCms'
import type { ImageAware, ImageCreateUpdateAware } from '@/types/ImageAware'

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

describe('extractImageSaveErrorInfo', () => {
  // m-A8: a reason the backend renamed or that this admin doesn't know about must fall back to the
  // generic wording instead of silently pretending it's a known one.
  it('narrows an unknown reason to undefined instead of passing it through', () => {
    const info = extractImageSaveErrorInfo(
      axiosError({ error: 'image_single_use_violation', reason: 'something_new', damId: 'dam-a' })
    )

    expect(info?.reason).toBeUndefined()
    expect(info?.damId).toBe('dam-a')
  })

  it('keeps a known reason', () => {
    const info = extractImageSaveErrorInfo(axiosError({ error: 'image_single_use_violation', reason: 'gallery_copy' }))

    expect(info?.reason).toBe('gallery_copy')
  })
})

describe('bulkUpdateImages', () => {
  it('attaches the error only to the item its damId names', async () => {
    const a = item('dam-a')
    const b = item('dam-b')
    const client = () => ({
      put: vi
        .fn()
        .mockRejectedValue(
          axiosError({ error: 'image_single_use_violation', reason: 'shared_gallery', damId: 'dam-a' })
        ),
    })

    const res = await bulkUpdateImages(client as never, [a, b])

    expect(res.failed).toHaveLength(2)
    expect(res.failed.find((f) => f.item.dam.damId === 'dam-a')?.errorInfo?.reason).toBe('shared_gallery')
    expect(res.failed.find((f) => f.item.dam.damId === 'dam-b')?.errorInfo).toBeUndefined()
    expect(res.batchErrors).toEqual([])
  })

  // R13: an error with no damId, or a damId the chunk doesn't contain, used to be silently dropped -
  // the editor was told "saving again will retry them" for a failure that would repeat identically.
  it('carries an error without a matching damId in batchErrors instead of dropping it', async () => {
    const a = item('dam-a')
    const client = () => ({
      put: vi.fn().mockRejectedValue(axiosError({ error: 'image_single_use_violation', reason: 'invalid_owner' })),
    })

    const res = await bulkUpdateImages(client as never, [a])

    expect(res.failed).toHaveLength(1)
    expect(res.failed[0]?.errorInfo).toBeUndefined()
    expect(res.batchErrors).toEqual([expect.objectContaining({ reason: 'invalid_owner' })])
  })

  it('carries a damId that does not belong to the chunk in batchErrors, not on any item', async () => {
    const a = item('dam-a')
    const client = () => ({
      put: vi
        .fn()
        .mockRejectedValue(
          axiosError({ error: 'image_single_use_violation', reason: 'owner_immutable', damId: 'dam-elsewhere' })
        ),
    })

    const res = await bulkUpdateImages(client as never, [a])

    expect(res.failed[0]?.errorInfo).toBeUndefined()
    expect(res.batchErrors).toHaveLength(1)
    expect(res.batchErrors[0]?.damId).toBe('dam-elsewhere')
  })

  // m-A9: the widget merges `images` from earlier successful chunks into its store before giving up
  // on a later failed one, so a retry updates instead of re-creating them - this is the contract that
  // merge relies on: a failed chunk must not erase what an earlier one already returned.
  it('keeps the images already saved by an earlier successful chunk when a later one fails', async () => {
    const first = item('dam-1')
    const second = item('dam-2')
    let call = 0
    const client = () => ({
      put: vi.fn().mockImplementation(() => {
        call += 1
        if (call === 1) {
          return Promise.resolve({ status: 200, data: { images: [asImageAware(first, 1)] } })
        }
        return Promise.reject(
          axiosError({ error: 'image_single_use_violation', reason: 'shared_gallery', damId: 'dam-2' })
        )
      }),
    })

    // BULK_METADATA_LIMIT is 20, so 21 items force a second chunk.
    const filler = Array.from({ length: 19 }, (_, i) => item(`dam-filler-${i}`))
    const res = await bulkUpdateImages(client as never, [first, ...filler, second])

    expect(res.images).toEqual([asImageAware(first, 1)])
    expect(res.failed.find((f) => f.item.dam.damId === 'dam-2')).toBeDefined()
  })
})
