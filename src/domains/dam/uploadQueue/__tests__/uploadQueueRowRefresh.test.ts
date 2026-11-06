import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, reactive } from 'vue'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileFailReason } from '@/domains/dam/types/AssetFile'
import type { DamExtSystemConfig } from '@/domains/dam/types/DamConfig'
import { type UploadQueueItem, UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import UploadQueueItemEditable from '@/domains/dam/uploadQueue/components/UploadQueueItemEditable.vue'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'
import { commonT } from '@/plugins/i18n'

vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}) }),
}))

const EXT_SYSTEM = 1
const extSystemConfig = {
  image: { keywords: { enabled: true, required: false }, customMetadataPinnedAmount: 2 },
} as unknown as DamExtSystemConfig

// The row waits twenty seconds before offering refresh.
// Fake timers stall the browser runner, so only a wait that long is held back until the test releases it.
const realSetTimeout = window.setTimeout
const realClearTimeout = window.clearTimeout
const waits = new Map<number, { run: () => void; ms: number }>()
let lastWait = 1_000_000
const heldWaits = () => [...waits.values()].map((wait) => wait.ms)
const elapse = async () => {
  const due = [...waits.values()]
  waits.clear()
  due.forEach((wait) => wait.run())
  await flushPromises()
}

// The queue tells a failed row whether the server may still finish its file.
// The store sets this for rows whose finish request went out
// (`uploadStatusPolling.test.ts`). Here the row is tested alone.
const queueSays = reactive<{ refreshMayHelp: boolean | undefined }>({ refreshMayHelp: false })

let wrapper: VueWrapper | undefined
let forget: () => void = () => {}
beforeEach(() => {
  queueSays.refreshMayHelp = false
  window.setTimeout = ((run: () => void, ms?: number, ...rest: unknown[]) => {
    if ((ms ?? 0) < 10_000) return realSetTimeout(run, ms, ...rest)
    waits.set(++lastWait, { run, ms: ms! })
    return lastWait
  }) as typeof window.setTimeout
  window.clearTimeout = ((id?: number) => {
    if (id === undefined || !waits.delete(id)) realClearTimeout(id)
  }) as typeof window.clearTimeout
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  forget()
  window.setTimeout = realSetTimeout
  window.clearTimeout = realClearTimeout
  waits.clear()
})

const mountRow = async (parts: Partial<UploadQueueItem> = {}) => {
  const item = reactive(
    useUploadQueueItemFactory().createDefault(
      'row',
      UploadQueueItemType.File,
      UploadQueueItemStatus.Uploaded,
      DamAssetType.Image,
      1,
      1
    )
  )
  item.assetId = 'asset-1'
  Object.assign(item, parts)
  const Queue = defineComponent({
    setup() {
      const store = useDamConfigStore()
      store.damConfigExtSystem.set(EXT_SYSTEM, extSystemConfig)
      store.damConfigAssetCustomFormElements.set(EXT_SYSTEM, {
        [DamAssetType.Image]: [],
        [DamAssetType.Audio]: [],
        [DamAssetType.Video]: [],
        [DamAssetType.Document]: [],
      })
      forget = () => {
        store.damConfigExtSystem.delete(EXT_SYSTEM)
        store.damConfigAssetCustomFormElements.delete(EXT_SYSTEM)
      }
      return () =>
        h(UploadQueueItemEditable, {
          index: 0,
          queueKey: 'queue',
          extSystem: EXT_SYSTEM,
          customData: item.customData,
          keywords: item.keywords,
          authors: item.authors,
          item,
          refreshDisabled: false,
          mainFileSingleUse: item.mainFileSingleUse,
          ...(queueSays.refreshMayHelp === undefined ? {} : { refreshMayHelp: queueSays.refreshMayHelp }),
        })
    },
  })
  wrapper = mount(Queue, {
    attachTo: document.body,
    global: { stubs: { AFormRemoteAutocompleteWithCached: true } },
  })
  await flushPromises()
  return item
}
const refreshButton = () => wrapper!.find('.mdi-refresh')
const removeButton = () => wrapper!.find('[data-cy="button-delete"]')
const cancelButton = () => wrapper!.find('.mdi-close-circle-outline')
const row = () => wrapper!.findComponent(UploadQueueItemEditable)

// The form is disabled and the save skips the row.
// If its metadata notification is lost, nothing else in the dialog loads the metadata.
describe('the refresh button of an uploaded row still without its metadata', () => {
  it('is offered once the row has waited, and goes when the metadata is there', async () => {
    const item = await mountRow()
    expect(refreshButton().exists()).toBe(false)
    expect(heldWaits()).toEqual([20_000])

    await elapse()
    expect(refreshButton().exists()).toBe(true)
    await refreshButton().trigger('click')
    expect(wrapper!.findComponent(UploadQueueItemEditable).emitted('refreshItem')).toEqual([
      [{ index: 0, assetId: 'asset-1' }],
    ])

    item.canEditMetadata = true
    await flushPromises()
    expect(refreshButton().exists()).toBe(false)
  })

  it('is not offered when its metadata comes before the wait is over', async () => {
    const item = await mountRow()
    item.canEditMetadata = true
    await flushPromises()

    await elapse()
    expect(refreshButton().exists()).toBe(false)
  })
})

// Result of settlement when the server finished the file but its asset could not
// be read: uploaded, no metadata, warned (N-Z21 of `uploadSettlement.test.ts`).
// A row shown so from the start waits like any uploaded row. The warning offers nothing sooner.
describe('the buttons of a row shown already uploaded, without its metadata and with a warning', () => {
  const warned: Partial<UploadQueueItem> = {
    status: UploadQueueItemStatus.Uploaded,
    canEditMetadata: false,
    error: {
      hasError: true,
      message: commonT('common.damImage.uploadErrors.readFailed'),
      assetFileFailReason: AssetFileFailReason.None,
    },
  }

  it('are neither refresh nor remove until the row has waited, and both after', async () => {
    const item = await mountRow(warned)
    expect(wrapper!.find('.dam-upload-queue__overlay--error').text()).toContain(warned.error!.message)
    expect(heldWaits()).toEqual([20_000])
    expect([removeButton().exists(), refreshButton().exists()]).toEqual([false, false])

    await elapse()
    expect([removeButton().exists(), refreshButton().exists()]).toEqual([true, true])
    await refreshButton().trigger('click')
    expect(row().emitted('refreshItem')).toEqual([[{ index: 0, assetId: item.assetId }]])
  })
})

// A failed row counts as done for the queue and stays in the dialog until the user removes it.
// Refresh helps only a row whose finish request went out before the client gave up, with no final word from the server.
// A row whose chunk the server never took, or one the server failed, would only be told to wait.
describe('the buttons of a failed row', () => {
  const failed = { status: UploadQueueItemStatus.Failed }
  const buttons = () => [removeButton().exists(), refreshButton().exists(), cancelButton().exists()]

  it('are remove alone, at once, when a chunk failed: it has an asset, and the server will never finish it', async () => {
    await mountRow(failed)

    expect(heldWaits()).toEqual([])
    expect(buttons()).toEqual([true, false, false])
  })

  it('are remove and refresh, at once, when its finish request went out: the server may finish the file yet', async () => {
    queueSays.refreshMayHelp = true
    await mountRow(failed)

    expect(heldWaits()).toEqual([])
    expect(buttons()).toEqual([true, true, false])

    await refreshButton().trigger('click')
    expect(row().emitted('refreshItem')).toEqual([[{ index: 0, assetId: 'asset-1' }]])
  })

  // An empty file or a refused start request creates nothing to ask about, whatever the queue says.
  it('is remove alone, at once, when the row failed before it had an asset', async () => {
    queueSays.refreshMayHelp = true
    await mountRow({ ...failed, assetId: null })

    expect(heldWaits()).toEqual([])
    expect(buttons()).toEqual([true, false, false])
  })

  // A parent that shows the row outside a queue has no queue to ask, so nothing says the server may finish it.
  it('are remove alone for a row shown outside a queue, whatever its asset', async () => {
    queueSays.refreshMayHelp = undefined
    await mountRow(failed)

    expect(buttons()).toEqual([true, false, false])
  })

  it('takes the row out of the queue once the user confirms', async () => {
    await mountRow({ ...failed, assetId: null })

    await removeButton().trigger('click')
    await flushPromises()
    document.body.querySelector<HTMLElement>('[data-cy="delete-panel"] [data-cy="button-confirm-delete"]')!.click()
    await flushPromises()

    expect(row().emitted('removeItem')).toEqual([[0]])
  })

  it.each([
    ['being sent, on a chunk', UploadQueueItemStatus.Uploading, true, false],
    ['being sent, on its finish request', UploadQueueItemStatus.Uploading, true, true],
    ['waiting for the server, by the word of the server', UploadQueueItemStatus.Processing, false, false],
  ])(
    'come as soon as a row fails that was %s, not when its wait would have been over',
    async (_was, status, cancel, refreshMayHelp) => {
      const item = await mountRow({ status })
      expect(heldWaits()).toEqual([20_000])
      expect(buttons()).toEqual([false, false, cancel])

      item.status = UploadQueueItemStatus.Failed
      queueSays.refreshMayHelp = refreshMayHelp
      await flushPromises()

      expect(heldWaits()).toEqual([])
      expect(buttons()).toEqual([true, refreshMayHelp, false])
    }
  )

  it('lose the refresh a row had come to offer while it was being sent, when a chunk of it fails', async () => {
    const item = await mountRow({ status: UploadQueueItemStatus.Uploading })
    await elapse()
    expect(buttons()).toEqual([true, true, true])

    item.status = UploadQueueItemStatus.Failed
    await flushPromises()

    expect(buttons()).toEqual([true, false, false])
  })

  it('are remove alone for a row the server failed after it was uploaded, in place of its wait for the metadata', async () => {
    const item = await mountRow()
    expect(heldWaits()).toEqual([20_000])

    item.status = UploadQueueItemStatus.Failed
    await flushPromises()

    expect(heldWaits()).toEqual([])
    expect(buttons()).toEqual([true, false, false])
  })

  // The finish request went out and the client gave the row up, then
  // the server reported the file failed. Nothing is left to ask.
  it('lose refresh, and keep remove, when the server reports the file failed after all', async () => {
    queueSays.refreshMayHelp = true
    await mountRow(failed)
    expect(buttons()).toEqual([true, true, false])

    queueSays.refreshMayHelp = false
    await flushPromises()

    expect(buttons()).toEqual([true, false, false])
  })

  // The client gives a row up when one of its requests fails, but the server may have finished the file anyway.
  it('go when the row turns out uploaded after all, with its metadata', async () => {
    queueSays.refreshMayHelp = true
    const item = await mountRow(failed)

    item.status = UploadQueueItemStatus.Uploaded
    item.canEditMetadata = true
    queueSays.refreshMayHelp = false
    await flushPromises()

    expect([removeButton().exists(), refreshButton().exists()]).toEqual([false, false])
    await elapse()
    expect([removeButton().exists(), refreshButton().exists()]).toEqual([false, false])
  })
})

describe('the buttons of a row that has not failed', () => {
  it.each([
    ['waiting its turn', UploadQueueItemStatus.Waiting, [], true],
    ['being sent', UploadQueueItemStatus.Uploading, [20_000], true],
    ['waiting for the server', UploadQueueItemStatus.Processing, [20_000], false],
  ])('%s: neither refresh nor remove until it has waited', async (_what, status, waiting, cancel) => {
    await mountRow({ status })

    expect(heldWaits()).toEqual(waiting)
    expect([removeButton().exists(), refreshButton().exists(), cancelButton().exists()]).toEqual([false, false, cancel])

    await elapse()
    const offered = waiting.length > 0
    expect([removeButton().exists(), refreshButton().exists(), cancelButton().exists()]).toEqual([
      offered,
      offered,
      cancel,
    ])
  })
})
