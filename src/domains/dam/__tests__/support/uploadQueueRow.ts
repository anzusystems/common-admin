import type { UploadQueueItem } from '@/domains/dam/types/UploadQueue'

/**
 * What a row of the upload queue shows and saves, as plain data: for "nothing about the row changed". Left out is
 * what moves by itself while a file is sent (the progress, the request in flight) and how the queue keeps time.
 */
export const rowState = (item: UploadQueueItem) =>
  JSON.parse(
    JSON.stringify({
      ...item,
      file: undefined,
      progress: undefined,
      currentChunkIndex: undefined,
      latestChunkAbortController: undefined,
      notificationFallbackTimer: undefined,
      notificationFallbackTry: undefined,
    })
  ) as Record<string, unknown>
