import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { defineComponent, h, reactive } from 'vue'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { DamAssetType } from '@/domains/dam/types/Asset'
import type { DamExtSystemConfig } from '@/domains/dam/types/DamConfig'
import { type UploadQueueItem, UploadQueueItemStatus, UploadQueueItemType } from '@/domains/dam/types/UploadQueue'
import UploadQueueItemEditable from '@/domains/dam/uploadQueue/components/UploadQueueItemEditable.vue'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'

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
const waits = new Map<number, () => void>()
let lastWait = 1_000_000
const elapse = async () => {
  const due = [...waits.values()]
  waits.clear()
  due.forEach((run) => run())
  await flushPromises()
}

let wrapper: VueWrapper | undefined
let forget: () => void = () => {}
beforeEach(() => {
  window.setTimeout = ((run: () => void, ms?: number, ...rest: unknown[]) => {
    if ((ms ?? 0) < 10_000) return realSetTimeout(run, ms, ...rest)
    waits.set(++lastWait, run)
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

// An uploaded row, still without its metadata.
const mountRow = async () => {
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

// Its form is disabled and the save skips it. When its metadata notification is lost, nothing else in the dialog
// loads the metadata.
describe('the refresh button of an uploaded row still without its metadata', () => {
  it('is offered once the row has waited, and goes when the metadata is there', async () => {
    const item = await mountRow()
    expect(refreshButton().exists()).toBe(false)

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

  it.each([
    ['its metadata comes', (item: UploadQueueItem) => (item.canEditMetadata = true)],
    ['the row fails', (item: UploadQueueItem) => (item.status = UploadQueueItemStatus.Failed)],
  ])('is not offered when %s before the wait is over', async (_name, change) => {
    const item = await mountRow()
    change(item)
    await flushPromises()

    await elapse()
    expect(refreshButton().exists()).toBe(false)
  })
})
