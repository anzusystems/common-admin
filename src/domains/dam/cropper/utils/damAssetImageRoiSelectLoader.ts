import type { Component } from 'vue'
import { withTimeout } from '@/domains/listEditor/utils/listEditorLoader'

export const ROI_SELECT_LOAD_TIMEOUT = 15_000

/**
 * Loads the region editor of the upload queue detail dialogs lazily, so
 * it and cropper.js do not ship with every page that has an upload queue.
 * Rejects after `timeout`, so a chunk that never arrives ends in a retryable error.
 * A retry helps when the chunk was only slow. After a failed fetch it helps only if the browser fetches
 * again: Chrome and Firefox cached the failure until reload before the 2026 spec change (whatwg/html#10327).
 */
export const loadDamAssetImageRoiSelect = (timeout = ROI_SELECT_LOAD_TIMEOUT): Promise<Component> =>
  withTimeout(
    import('@/domains/dam/cropper/components/DamAssetImageRoiSelect.vue').then((module) => module.default),
    timeout,
    `The region editor did not load within ${timeout} ms.`
  )
