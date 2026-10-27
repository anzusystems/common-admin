import type { Component } from 'vue'

export const LIST_EDITOR_LOAD_TIMEOUT = 15_000

/** `promise`, or a rejection with `message` once `timeout` ms pass without it settling. */
export const withTimeout = <T>(promise: Promise<T>, timeout: number, message: string): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeout)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })

/**
 * Loads the list editor for the bookmark dialog's manage tab when the tab opens. It
 * and sortablejs are most of the dialog, and every list page has the bookmark button.
 * Gives up after `timeout`, so a chunk that never arrives ends in a retryable error.
 * A retry helps when the chunk was only slow. After a failed fetch it helps only where the browser fetches again.
 * Chrome and Firefox kept the failure until reload, until the 2026 spec change (whatwg/html#10327).
 */
export const loadListEditor = (timeout = LIST_EDITOR_LOAD_TIMEOUT): Promise<Component> =>
  withTimeout(
    import('@/domains/listEditor/components/ASortableListEditor.vue').then((module) => module.default),
    timeout,
    `The list editor did not load within ${timeout} ms.`
  )
