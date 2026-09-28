import { describe, expect, it } from 'vitest'
import axios from 'axios'
import type { UploadQueueItem } from '@/domains/dam/types/UploadQueue'
import { imageUploadChunk } from '@/domains/dam/api/damImageApi'
import { uploadStop } from '@/domains/dam/uploadQueue/composables/uploadService'

// Stop aborts the chunk request in flight through the item's AbortController (axios's CancelToken is
// deprecated). A real axios instance whose adapter only settles when the request is aborted.
describe('Stop during a chunk request', () => {
  it('aborts the request, and the rejection reads as a cancel', async () => {
    const client = axios.create({
      adapter: (config) =>
        new Promise((_, reject) => {
          config.signal?.addEventListener?.('abort', () =>
            reject(new axios.CanceledError(undefined, undefined, config))
          )
        }),
    })
    const item = { latestChunkAbortController: new AbortController() } as unknown as UploadQueueItem
    const request = imageUploadChunk(() => client, '/adm/v1/image', item, 'image-id', new Blob(['chunk']), 5, 0)

    uploadStop(item.latestChunkAbortController!)

    const error = await request.catch((e: unknown) => e)
    expect(axios.isCancel(error)).toBe(true)
  })
})
