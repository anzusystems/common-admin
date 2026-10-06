import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import UploadQueueDialog from '@/domains/dam/uploadQueue/components/UploadQueueDialog.vue'

const queue = vi.hoisted(() => ({ items: [] as unknown[] }))
vi.mock('@/domains/dam/uploadQueue/store/uploadQueuesStore', () => ({
  useUploadQueuesStore: () => ({
    getQueueItems: () => queue.items,
    getQueueTotalCount: () => queue.items.length,
    getQueueProcessedCount: () => queue.items.length,
  }),
}))
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointAsset: '/asset' }),
}))
// The save itself: nothing comes back for an item that was not sent.
vi.mock('@/domains/dam/api/damAssetApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  bulkUpdateAssetsMetadata: async () => [],
}))

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

/** Mounts the dialog over the given queue and answers its "save and apply" and "save" buttons. */
const mountDialog = async (items: unknown[]) => {
  queue.items = items
  wrapper = mount(UploadQueueDialog, {
    attachTo: document.body,
    props: { queueKey: 'queue', licenceId: 1, fileInputKey: 0, extSystem: 1, accept: undefined, maxSizes: undefined },
    // The parts of the dialog that have no say in the save.
    global: {
      stubs: { UploadQueueEditable: true, UploadQueueButtonStop: true, AFileInput: true, AFileDropzone: true },
    },
  })
  await flushPromises()
  // The dialog renders into the body.
  const buttons = Array.from(document.body.querySelectorAll<HTMLButtonElement>('.v-toolbar button'))
  const saveAndApply = buttons.find((button) => /apply/i.test(button.textContent ?? ''))
  const save = buttons.find((button) => button.querySelector('.mdi-content-save'))
  expect(saveAndApply && save).toBeTruthy()

  return { wrapper, saveAndApply: saveAndApply!, save: save! }
}

// What the bulk save sends is an item with an asset whose metadata can be edited. Each of these has its asset
// and file ids: an upload gets them when it starts.
const item = (name: string, status: string, canEditMetadata: boolean) => ({
  assetId: `asset-${name}`,
  fileId: `file-${name}`,
  status,
  canEditMetadata,
})
const failed = item('failed', UploadQueueItemStatus.Failed, false)
const waitingForMetadata = item('waiting', UploadQueueItemStatus.Uploaded, false)
const editable = item('editable', UploadQueueItemStatus.Uploaded, true)

describe('the upload dialog', () => {
  // "Save" sent nothing and said "saved".
  it('cannot be saved while no item of the queue would be sent', async () => {
    const { save, saveAndApply } = await mountDialog([failed, waitingForMetadata])
    expect([saveAndApply.disabled, save.disabled]).toEqual([false, true])
  })

  it('can be saved once one item would be sent, whatever the others', async () => {
    const { save, saveAndApply } = await mountDialog([failed, editable])
    expect([saveAndApply.disabled, save.disabled]).toEqual([false, false])
  })

  it('cannot be applied while no item of the queue is settled as uploaded', async () => {
    const { save, saveAndApply } = await mountDialog([failed])
    expect([saveAndApply.disabled, save.disabled]).toEqual([true, true])
  })

  // A failed row is no longer validated, so nothing else stops it on the way to the widget.
  it('applies the uploaded items and leaves a failed one out', async () => {
    const { wrapper, saveAndApply } = await mountDialog([failed, waitingForMetadata, editable])
    saveAndApply.click()
    await flushPromises()

    const applied = wrapper.emitted('apply')?.[0]?.[0] as { assetId: string }[]
    expect(applied.map((image) => image.assetId)).toEqual(['asset-waiting', 'asset-editable'])
  })
})
