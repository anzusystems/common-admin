import type { UploadQueueItem } from '@/domains/dam/types/UploadQueue'

/**
 * The state a queue row shows and saves, as plain data, for "nothing about the row changed".
 * Left out are values that move while a file is sent (progress, request in flight) and the queue's timekeeping.
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
