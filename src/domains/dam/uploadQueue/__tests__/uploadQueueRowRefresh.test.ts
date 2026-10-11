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

// The row waits twenty seconds before it offers refresh. Fake timers stall the browser runner, so only a wait that
// long is held back, until the test lets it pass.
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

// What the queue tells the row of a failed item: whether the server may still finish its file. The store has it
// for the rows whose finish request went out (`uploadStatusFallback.test.ts`); here the row is shown by itself.
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

// An uploaded row, still without its metadata, unless the test says otherwise.
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
      // The configuration the row reads, in the pinia the components use.
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
    // What the keyword input renders asks the API for its items.
    global: { stubs: { AFormRemoteAutocompleteWithCached: true } },
  })
  await flushPromises()
  return item
}
const refreshButton = () => wrapper!.find('.mdi-refresh')
const removeButton = () => wrapper!.find('[data-cy="button-delete"]')
const cancelButton = () => wrapper!.find('.mdi-close-circle-outline')
const row = () => wrapper!.findComponent(UploadQueueItemEditable)

// Its form is disabled and the save skips it. When its metadata notification is lost, nothing else in the dialog
// loads the metadata.
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

    // What the queue does with that gives the row its metadata, and its form.
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

// What the settlement leaves of a row whose file the server finished while its asset could not be read: uploaded,
// without its metadata, and warned that its data could not be loaded (N-Z21 of `uploadSettlement.test.ts`). A row
// shown so from the start waits as any uploaded row does; the warning offers nothing sooner.
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

// A failed row is done as far as the queue counts go, and stays in the dialog: the user takes it out. Refresh asks
// the server what became of the file, which only one kind of failed row has a use for: the one whose finish
// request went out before the client gave it up, and about which the server has said nothing final. A row whose
// chunk the server never took, and one the server itself has failed, would only be told to wait.
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

  // A file of no bytes, a start request the server refused: nothing was created to ask about, whatever the
  // queue says of the row.
  it('is remove alone, at once, when the row failed before it had an asset', async () => {
    queueSays.refreshMayHelp = true
    await mountRow({ ...failed, assetId: null })

    expect(heldWaits()).toEqual([])
    expect(buttons()).toEqual([true, false, false])
  })

  // Nothing says the server may finish it: the row is shown by a parent that has no queue to ask.
  it('are remove alone for a row shown outside a queue, whatever its asset', async () => {
    queueSays.refreshMayHelp = undefined
    await mountRow(failed)

    expect(buttons()).toEqual([true, false, false])
  })

  it('takes the row out of the queue once the user confirms', async () => {
    await mountRow({ ...failed, assetId: null })

    await removeButton().trigger('click')
    await flushPromises()
    // The confirmation renders into the body.
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

      // The queue says so in the same breath as it fails the row.
      item.status = UploadQueueItemStatus.Failed
      queueSays.refreshMayHelp = refreshMayHelp
      await flushPromises()

      expect(heldWaits()).toEqual([])
      expect(buttons()).toEqual([true, refreshMayHelp, false])
    }
  )

  // Twenty seconds into a slow upload the row offers refresh; a chunk that then fails takes it back.
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

  // The finish request went out, the client gave the row up, and then the server said the file failed: there is
  // nothing left to ask it.
  it('lose refresh, and keep remove, when the server reports the file failed after all', async () => {
    queueSays.refreshMayHelp = true
    await mountRow(failed)
    expect(buttons()).toEqual([true, true, false])

    queueSays.refreshMayHelp = false
    await flushPromises()

    expect(buttons()).toEqual([true, false, false])
  })

  // The client gives a row up when one of its requests fails; the server may have finished the file all the same.
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

// What the fix of the failed row must leave alone.
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
