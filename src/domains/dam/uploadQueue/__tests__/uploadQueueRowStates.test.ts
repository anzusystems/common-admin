import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { defineComponent, h, reactive } from 'vue'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { damText, PIXEL, uiText } from '@/domains/dam/__tests__/support/uploadUi'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import KeywordRemoteAutocompleteWithCached from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue'
import { DamAssetStatus, DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileFailReason } from '@/domains/dam/types/AssetFile'
import {
  type UploadQueueItem,
  UploadQueueItemStatus,
  type UploadQueueItemStatusType,
  UploadQueueItemType,
} from '@/domains/dam/types/UploadQueue'
import UploadQueueItemEditable from '@/domains/dam/uploadQueue/components/UploadQueueItemEditable.vue'
import { useUploadQueueItemFactory } from '@/domains/dam/uploadQueue/factory/UploadQueueItemFactory'

// One real row with its real picture and form, shown alone in each upload state, under the admin-cms configuration.
// Nothing is asked of the DAM. Only the twenty-second wait before refresh is taken out of real time.
// Failed-row buttons and refresh are in `uploadQueueRowRefresh.test.ts`.

const { endPoints, extSystem, licence } = cmsConfiguration
const QUEUE = 'row-states'

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let wrapper: VueWrapper | undefined

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  installConsumerProfile(cmsConfiguration, dam.client)
  waits = holdLongWaits()
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  waits.restore()
})

const mountRow = async (
  status: UploadQueueItemStatusType,
  parts: Partial<UploadQueueItem> = {},
  rowProps: Record<string, unknown> = {}
) => {
  const item = reactive(
    useUploadQueueItemFactory().createDefault('row', UploadQueueItemType.File, status, DamAssetType.Image, 1, licence)
  )
  item.assetId = 'asset-1'
  item.fileId = 'file-1'
  Object.assign(item, parts)
  const Queue = defineComponent({
    setup: () => () =>
      h(UploadQueueItemEditable, {
        index: 3,
        queueKey: QUEUE,
        extSystem,
        customData: item.customData,
        keywords: item.keywords,
        authors: item.authors,
        item,
        refreshDisabled: false,
        mainFileSingleUse: item.mainFileSingleUse,
        ...rowProps,
      }),
  })
  wrapper = mount(Queue, {
    attachTo: document.body,
    // The keyword and author inputs ask the DAM for names to offer when rendered.
    global: { plugins: [pinia], stubs: { AFormRemoteAutocompleteWithCached: true } },
  })
  await flushPromises()
  return item
}

const row = () => wrapper!.findComponent(UploadQueueItemEditable)
const picture = () => wrapper!.find('.asset-image')
const overlay = () => wrapper!.find('.dam-upload-queue__overlay--error')
const editButton = () =>
  wrapper!.findAll('button').find((button) => button.text() === damText('image.button.editAsset'))!
const cancelButton = () => wrapper!.find(`button[aria-label="${uiText('common.button.cancel')}"]`)
const refreshButton = () => wrapper!.find(`button[aria-label="${uiText('common.button.refresh')}"]`)
const removeButton = () => wrapper!.find('[data-cy="button-delete"]')
const buttons = () => ({
  cancel: cancelButton().exists(),
  refresh: refreshButton().exists(),
  remove: removeButton().exists(),
})
// A growing text field has a hidden twin that measures it.
const fields = () =>
  wrapper!
    .findAll<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], textarea')
    .filter((field) => field.attributes('aria-hidden') !== 'true')
const singleUseSwitch = () => wrapper!.find<HTMLInputElement>('.v-switch input')

describe('a row of the upload queue that has not failed', () => {
  it.each<[string, string, UploadQueueItemStatusType, string]>([
    ['loads what it needs before it is sent', 'can be cancelled', UploadQueueItemStatus.Loading, 'upload.processing'],
    ['waits its turn', 'can be cancelled', UploadQueueItemStatus.Waiting, 'upload.waiting'],
    ['is being sent', 'can be cancelled', UploadQueueItemStatus.Uploading, 'upload.uploading'],
    ['waits for the server', 'cannot be cancelled', UploadQueueItemStatus.Processing, 'upload.processing'],
  ])('that %s: the picture says so, and it %s', async (_what, cancelled, status, said) => {
    await mountRow(status)

    expect(picture().text()).toContain(damText(said))
    expect(buttons()).toEqual({ cancel: cancelled === 'can be cancelled', refresh: false, remove: false })
    expect(overlay().exists()).toBe(false)
  })

  it('that is being sent: the picture says how far it is', async () => {
    const item = await mountRow(UploadQueueItemStatus.Uploading)
    expect(picture().text()).toContain('0%')

    item.progress.progressPercent = 41.2
    await flushPromises()

    expect(picture().text()).toContain('42%')
  })

  it('tells its queue which row to cancel: its position, the row itself and the queue', async () => {
    const item = await mountRow(UploadQueueItemStatus.Uploading)

    await cancelButton().trigger('click')

    const [[cancelled]] = row().emitted('cancelItem') as [[{ index: number; item: UploadQueueItem; queueKey: string }]]
    expect([cancelled.index, cancelled.queueKey]).toEqual([3, QUEUE])
    expect(cancelled.item.key).toBe(item.key)
    expect(cancelled.item.assetId).toBe('asset-1')
  })

  it('that is uploaded with its metadata: none of cancel, refresh and remove, also once it has waited', async () => {
    await mountRow(UploadQueueItemStatus.Uploaded, { canEditMetadata: true })
    expect(buttons()).toEqual({ cancel: false, refresh: false, remove: false })

    await waits.elapse()

    expect(buttons()).toEqual({ cancel: false, refresh: false, remove: false })
  })

  it.each([
    ['is drawn done', {}, true],
    ['is drawn without that when its dialog asks for none', { disableDoneAnimation: true }, false],
  ])('that is uploaded, with its picture: %s', async (_what, rowProps, done) => {
    await mountRow(
      UploadQueueItemStatus.Uploaded,
      {
        canEditMetadata: true,
        assetStatus: DamAssetStatus.WithFile,
        imagePreview: {
          url: PIXEL,
          width: 1,
          height: 1,
          requestedWidth: 1,
          requestedHeight: 1,
          title: '',
          type: 'image',
        },
      },
      rowProps
    )

    await vi.waitFor(() => expect(picture().find('img').attributes('src')).toBe(PIXEL))
    expect(picture().text().includes(damText('upload.done'))).toBe(done)
  })
})

describe('the "edit asset" button of a row', () => {
  it.each([
    ['waits its turn', UploadQueueItemStatus.Waiting],
    ['is being sent', UploadQueueItemStatus.Uploading],
    ['waits for the server', UploadQueueItemStatus.Processing],
    ['is uploaded, still without its metadata', UploadQueueItemStatus.Uploaded],
    ['has failed', UploadQueueItemStatus.Failed],
  ])('cannot be pressed while the row %s', async (_what, status) => {
    await mountRow(status)

    expect(editButton().element.disabled).toBe(true)
  })

  it('asks for the detail of the asset of the row once its metadata can be edited', async () => {
    const item = await mountRow(UploadQueueItemStatus.Processing)

    item.canEditMetadata = true
    await flushPromises()
    expect(editButton().element.disabled).toBe(false)
    await editButton().trigger('click')

    expect(row().emitted('showDetail')).toEqual([['asset-1']])
  })
})

describe('the lines between the picture and the form of a row', () => {
  it('name the file picked and say how large it is', async () => {
    await mountRow(UploadQueueItemStatus.Uploading, {
      displayTitle: 'photo.jpg',
      file: new File([new Uint8Array(3000)], 'photo.jpg', { type: 'image/jpeg' }),
    })

    expect(wrapper!.text()).toContain(`${damText('queueItem.displayTitle')}: photo.jpg`)
    expect(wrapper!.text()).toContain('(2.93 KB)')
  })

  it('are not there for a row that has no name of a file', async () => {
    await mountRow(UploadQueueItemStatus.Processing, { type: UploadQueueItemType.Asset })

    expect(wrapper!.text()).not.toContain(damText('queueItem.displayTitle'))
  })

  it.each([
    ['say so of a row whose file the DAM already has', true],
    ['say nothing of the kind of any other row', false],
  ])('%s', async (_what, isDuplicate) => {
    await mountRow(UploadQueueItemStatus.Uploaded, { canEditMetadata: true, isDuplicate })

    expect(wrapper!.text().includes(damText('asset.detail.info.status.duplicate'))).toBe(isDuplicate)
    expect(fields().length).toBeGreaterThan(0)
    expect(fields().some((field) => field.element.disabled)).toBe(false)
    expect(editButton().element.disabled).toBe(false)
  })
})

describe('what a row with an error says over its picture', () => {
  const error = (parts: Partial<UploadQueueItem['error']>): Partial<UploadQueueItem> => ({
    error: { hasError: true, message: '', assetFileFailReason: AssetFileFailReason.None, ...parts },
  })

  it.each<[string, Partial<UploadQueueItem['error']>, string, string[]]>([
    [
      'the message of the row, also when the server gave a reason as well',
      { message: 'The file is too large.', assetFileFailReason: AssetFileFailReason.InvalidSize },
      'The file is too large.',
      [damText('asset.assetFileFailReason.invalidSize'), damText('uploadErrors.unknownError')],
    ],
    [
      'the reason the server gave, when the row has no message',
      { assetFileFailReason: AssetFileFailReason.InvalidChecksum },
      damText('asset.assetFileFailReason.invalidChecksum'),
      [damText('uploadErrors.unknownError')],
    ],
    ['that the error is unknown, when the row has neither', {}, damText('uploadErrors.unknownError'), []],
  ])('%s', async (_what, parts, said, notSaid) => {
    await mountRow(UploadQueueItemStatus.Failed, error(parts))

    expect(overlay().text()).toContain(damText('queueItem.error'))
    expect(overlay().text()).toContain(said)
    notSaid.forEach((text) => expect(overlay().text()).not.toContain(text))
  })

  // A warning the queue writes on a row it keeps polling. The row has not failed and keeps its state.
  it('is said of a row that has not failed as well, over the picture that still says what the file waits for', async () => {
    await mountRow(UploadQueueItemStatus.Processing, error({ message: damText('uploadErrors.processingTooLong') }))

    expect(overlay().text()).toContain(damText('uploadErrors.processingTooLong'))
    expect(picture().text()).toContain(damText('upload.processing'))
    expect(buttons()).toEqual({ cancel: false, refresh: false, remove: false })
  })
})

describe('the form of a row', () => {
  it('cannot be filled until the metadata of the row can be edited', async () => {
    const item = await mountRow(UploadQueueItemStatus.Processing)
    expect(fields().length).toBe(2)
    expect(fields().every((field) => field.element.disabled)).toBe(true)
    expect(singleUseSwitch().element.disabled).toBe(true)

    item.canEditMetadata = true
    await flushPromises()

    expect(fields().some((field) => field.element.disabled)).toBe(false)
    expect(singleUseSwitch().element.disabled).toBe(false)
  })

  it('hands the queue what the user types, with the custom data the row already has', async () => {
    await mountRow(UploadQueueItemStatus.Uploaded, {
      canEditMetadata: true,
      customData: { description: 'from the server', headline: 'not on the form' },
    })

    const title = fields().find((field) => field.element.value === '')!
    await title.setValue('typed')

    expect(row().emitted('update:customData')!.at(-1)).toEqual([
      { description: 'from the server', headline: 'not on the form', title: 'typed' },
    ])
  })

  it('has the keywords and the authors of the DAM where the ext system has them switched on', async () => {
    await mountRow(UploadQueueItemStatus.Uploaded, { canEditMetadata: true, authorConflicts: ['author-9'] })

    const keywords = wrapper!.findComponent(KeywordRemoteAutocompleteWithCached)
    const authors = wrapper!.findComponent(AuthorRemoteAutocompleteWithCached)
    expect([keywords.props('queueId'), keywords.props('extSystem')]).toEqual([QUEUE, extSystem])
    expect([authors.props('queueId'), authors.props('extSystem')]).toEqual([QUEUE, extSystem])
    expect(authors.props('authorConflicts')).toEqual(['author-9'])
  })
})

describe('the single-use switch of a row', () => {
  it('is there unless the queue says the application has none', async () => {
    await mountRow(UploadQueueItemStatus.Uploaded, { canEditMetadata: true })

    expect(singleUseSwitch().exists()).toBe(true)
    expect(wrapper!.text()).toContain(damText('asset.model.mainFileSingleUse'))
  })

  it('is not there in an application that has none', async () => {
    await mountRow(UploadQueueItemStatus.Uploaded, { canEditMetadata: true }, { mainFileSingleUseEnabled: false })

    expect(singleUseSwitch().exists()).toBe(false)
    expect(wrapper!.text()).not.toContain(damText('asset.model.mainFileSingleUse'))
    expect(fields().length).toBe(2)
  })

  it('shows the value of the row and hands the queue the one the user sets', async () => {
    await mountRow(UploadQueueItemStatus.Uploaded, { canEditMetadata: true, mainFileSingleUse: true })
    expect(singleUseSwitch().element.checked).toBe(true)

    await singleUseSwitch().setValue(false)

    expect(row().emitted('update:mainFileSingleUse')).toEqual([[false]])
  })
})

describe('a row asks nothing of the DAM by itself', () => {
  it('in any of its states', async () => {
    await mountRow(UploadQueueItemStatus.Uploaded, { canEditMetadata: true })
    await waits.elapse()

    expect(dam.requests).toEqual([])
  })
})
