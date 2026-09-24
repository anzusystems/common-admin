import type { Component } from 'vue'
import { withTimeout } from '@/labs/filters/listEditorLoader'

export const ROI_SELECT_LOAD_TIMEOUT = 15_000

/**
 * The region editor the upload queue's detail dialogs show, loaded when it first shows: it and
 * cropper.js under it would otherwise ride along with every page that has an upload queue.
 * Gives up after `timeout`, so a chunk that never arrives ends in an error the user can retry.
 * A retry helps when the chunk was only slow. After a failed fetch it helps only where the browser fetches
 * again: Chrome and Firefox kept the failure until the page reloaded, until the 2026 spec change (whatwg/html#10327).
 */
export const loadDamAssetImageRoiSelect = (timeout = ROI_SELECT_LOAD_TIMEOUT): Promise<Component> =>
  withTimeout(
    import('@/components/damImage/uploadQueue/components/DamAssetImageRoiSelect.vue').then((module) => module.default),
    timeout,
    `The region editor did not load within ${timeout} ms.`
  )
