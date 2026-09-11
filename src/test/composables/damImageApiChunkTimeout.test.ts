import { describe, expect, it, vi } from 'vitest'
import type { AxiosInstance } from 'axios'
import type { UploadQueueItem } from '@/types/coreDam/UploadQueue'
import { imageUploadChunk } from '@/components/damImage/uploadQueue/api/damImageApi'

// imageUploadChunk passed the raw 420 into a factory declared `() => AxiosInstance`, so it was
// dropped and the chunk fell back to the instance default. Pins factory arity and the timeout.

const CHUNK_TIMEOUT_MS = 420 * 1000

const buildClient = () => {
  const post = vi.fn().mockResolvedValue({ status: 201, data: { id: 'chunk-1' } })
  const factory = vi.fn(() => ({ post }) as unknown as AxiosInstance)
  return { factory, post }
}

const item = { latestChunkCancelToken: null } as unknown as UploadQueueItem

const uploadOneChunk = (factory: () => AxiosInstance) =>
  imageUploadChunk(factory, '/adm/v1/image', item, 'image-id', new Blob(['chunk-payload']), 13, 0)

describe('imageUploadChunk chunk timeout', () => {
  it('calls the client factory without arguments', async () => {
    const { factory } = buildClient()

    await uploadOneChunk(factory)

    expect(factory).toHaveBeenCalledTimes(1)
    expect(factory.mock.calls[0]).toHaveLength(0)
  })

  it('sends the chunk timeout in the per-request config, in milliseconds', async () => {
    const { factory, post } = buildClient()

    await uploadOneChunk(factory)

    expect(post).toHaveBeenCalledTimes(1)
    expect(post.mock.calls[0][2]).toMatchObject({ timeout: CHUNK_TIMEOUT_MS })
  })
})
