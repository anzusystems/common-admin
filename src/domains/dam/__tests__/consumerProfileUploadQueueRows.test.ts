import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import {
  cmsConfiguration,
  consumerProfiles,
  installConsumerProfile,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames } from '@/domains/dam/__tests__/support/damNames'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import { createFakeDam, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { alertText, damText, forgetAlerts, shownAlerts, uiText } from '@/domains/dam/__tests__/support/uploadUi'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import { DamNotificationName, useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import KeywordRemoteAutocompleteWithCached from '@/domains/dam/keyword/components/KeywordRemoteAutocompleteWithCached.vue'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import UploadQueueEditable from '@/domains/dam/uploadQueue/components/UploadQueueEditable.vue'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

const QUEUE = 'rows-queue'

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let socket: DamSocket
let wrapper: VueWrapper | undefined

const photo = (name: string) => new File([new Uint8Array(3000)], name, { type: 'image/jpeg' })
const fromTheServer = {
  metadata: { customData: { description: 'from the server' }, authorSuggestions: {}, keywordSuggestions: {} },
}

describe.each(consumerProfiles)('the rows of an upload queue under the $name', (profile) => {
  const { endPoints, extSystem, licence, foreignPrefix } = profile
  const isCms = profile === cmsConfiguration

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    installConsumerProfile(profile, dam.client)
    // The keyword and author inputs show names, which the page caches ask the DAM for.
    answerDamNames(dam)
    waits = holdLongWaits()
    socket = stubDamSocket()
    forgetAlerts()
    if (profile.notifications) {
      initDamNotifications().openConnection()
      socket.accept()
    }
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    useUploadQueuesStore(pinia).stopUpload(QUEUE)
    destroyDamNotifications()
    waits.restore()
    socket.restore()
    useDamNotificationsEventBus().reset()
  })

  const queue = () => useUploadQueuesStore(pinia)
  const mountList = async (props: Record<string, unknown> = {}) => {
    wrapper = mount(UploadQueueEditable, {
      attachTo: document.body,
      props: { queueKey: QUEUE, extSystem, massOperations: false, ...props },
      global: {
        plugins: [pinia],
        // The picture would ask the image server and the keyword and author inputs would ask the DAM for names.
        // The mass operations are a separate form (`uploadQueueMassOperationsSidebar`).
        stubs: { AssetImage: true, AFormRemoteAutocompleteWithCached: true, AssetQueueSelectedSidebar: true },
      },
    })
    await flushPromises()
  }
  const pick = async (...names: string[]) => {
    await queue().addByFiles(QUEUE, extSystem, licence, names.map(photo), 'default')
    await flushPromises()
    return queue().getQueueItems(QUEUE)
  }
  const oneProcessing = async () => {
    await mountList()
    const [item] = await pick('photo.jpg')
    await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Processing))
    await flushPromises()
    return item
  }
  const rows = () => wrapper!.findAll('.dam-upload-queue__item')
  const titles = () =>
    queue()
      .getQueueItems(QUEUE)
      .map((item) => item.displayTitle)
  const cancelOf = (index: number) =>
    rows()[index].find<HTMLButtonElement>(`button[aria-label="${uiText('common.button.cancel')}"]`)
  const refreshOf = (index: number) =>
    rows()[index].find<HTMLButtonElement>(`button[aria-label="${uiText('common.button.refresh')}"]`)
  const removeOf = (index: number) => rows()[index].find('[data-cy="button-delete"]')
  const editOf = (index: number) =>
    rows()
      [index].findAll('button')
      .find((button) => button.text() === uiText('common.damImage.image.button.editAsset'))!
  // A growing text field has a hidden twin that measures it. The twin is not a field the user types into.
  const fieldsOf = (index: number) =>
    rows()
      [index].findAll<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], textarea')
      .filter((field) => field.attributes('aria-hidden') !== 'true')
  const starts = () => dam.sentTo('POST', dam.routes.start)
  const toForeignPrefix = () => dam.requests.filter((request) => request.url.startsWith(foreignPrefix))

  describe('cancel', () => {
    it('on a row being sent: its request is cancelled, the row leaves the queue and the next file is sent', async () => {
      const chunks = dam.hold('POST', dam.routes.chunk)
      await mountList()
      await pick('a.jpg', 'b.jpg', 'c.jpg')
      await vi.waitFor(() => expect(chunks.waiting).toHaveLength(2))
      await flushPromises()
      expect(rows()).toHaveLength(3)
      const firstChunk = dam.sentTo('POST', dam.routes.chunk).find((request) => dam.chunkOf(request) === 'a.jpg')!
      // Two files are sent side by side, so the test cannot assume which one the DAM named first.
      const cancelledFile = queue().getQueueItems(QUEUE)[0].fileId

      await cancelOf(0).trigger('click')
      await vi.waitFor(() => expect(starts()).toHaveLength(3))
      await flushPromises()

      expect((firstChunk.config.signal as AbortSignal).aborted).toBe(true)
      expect(titles()).toEqual(['b.jpg', 'c.jpg'])
      expect(rows()).toHaveLength(2)
      expect([queue().getQueueTotalCount(QUEUE), queue().getQueueProcessedCount(QUEUE)]).toEqual([2, 0])
      chunks.release()
      await vi.waitFor(() => expect(dam.sentTo('PATCH', dam.routes.finish)).toHaveLength(2))
      expect(cancelledFile).not.toBeNull()
      expect(dam.sentTo('PATCH', dam.routes.finish).map((request) => request.url)).not.toContain(
        `${endPoints.image}/${cancelledFile}/uploaded`
      )
    })

    it('on a row that waits its turn: the row leaves the queue and its file is never sent', async () => {
      const chunks = dam.hold('POST', dam.routes.chunk)
      await mountList()
      await pick('a.jpg', 'b.jpg', 'c.jpg')
      await vi.waitFor(() => expect(chunks.waiting).toHaveLength(2))
      await flushPromises()

      await cancelOf(2).trigger('click')
      await flushPromises()

      expect(titles()).toEqual(['a.jpg', 'b.jpg'])
      expect(rows()).toHaveLength(2)
      chunks.release()
      await vi.waitFor(() => expect(dam.sentTo('PATCH', dam.routes.finish)).toHaveLength(2))
      expect(starts()).toHaveLength(2)
    })
  })

  describe('remove', () => {
    it('takes a failed row out of the queue once the user confirms, and not before', async () => {
      dam.reply((request) =>
        request.method === 'POST' &&
        dam.routes.start.test(request.url) &&
        (dam.body(request) as { size: number }).size === 3001
          ? { status: 503 }
          : undefined
      )
      const chunks = dam.hold('POST', dam.routes.chunk)
      await mountList()
      await queue().addByFiles(
        QUEUE,
        extSystem,
        licence,
        [new File([new Uint8Array(3001)], 'a.jpg', { type: 'image/jpeg' }), photo('b.jpg')],
        'default'
      )
      const [failed] = queue().getQueueItems(QUEUE)
      await vi.waitFor(() => expect(failed.status).toBe(UploadQueueItemStatus.Failed))
      await vi.waitFor(() => expect(chunks.waiting).toHaveLength(1))
      await flushPromises()
      expect([removeOf(0).exists(), removeOf(1).exists()]).toEqual([true, false])

      await removeOf(0).trigger('click')
      await flushPromises()
      const question = document.body.querySelector<HTMLElement>('[data-cy="delete-panel"]')!
      expect(question.textContent).toContain(damText('queueItem.removeFromQueue'))
      expect(titles()).toEqual(['a.jpg', 'b.jpg'])

      question.querySelector<HTMLElement>('[data-cy="button-confirm-delete"]')!.click()
      await flushPromises()

      expect(titles()).toEqual(['b.jpg'])
      expect(rows()).toHaveLength(1)
      expect(chunks.waiting).toHaveLength(1)
      expect((chunks.waiting[0]!.request.config.signal as AbortSignal).aborted).toBe(false)
    })
  })

  describe('"edit asset"', () => {
    it('hands the dialog the asset of the row, once the row has its metadata', async () => {
      await oneProcessing()
      expect(editOf(0).element.disabled).toBe(true)

      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
      await waits.elapse()
      await vi.waitFor(() => expect(editOf(0).element.disabled).toBe(false))
      await editOf(0).trigger('click')

      expect(wrapper!.emitted('showDetail')).toEqual([['asset-1']])
    })
  })

  describe('refresh', () => {
    it('is offered on a row the server has kept waiting, asks the DAM of the application, and settles the row', async () => {
      const item = await oneProcessing()
      expect(refreshOf(0).exists()).toBe(false)

      await waits.elapse()
      await vi.waitFor(() => expect(refreshOf(0).exists()).toBe(true))
      expect(item.status).toBe(UploadQueueItemStatus.Processing)

      const readsBefore = dam.assetReads().length
      await refreshOf(0).trigger('click')
      await vi.waitFor(() =>
        expect(shownAlerts()).toEqual([['warning', alertText('common.damImage.queueItem.stillUploadingOrProcessing')]])
      )
      await flushPromises()
      expect(dam.assetReads().length).toBeGreaterThan(readsBefore)
      expect(item.status).toBe(UploadQueueItemStatus.Processing)
      expect(refreshOf(0).element.disabled).toBe(false)

      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
      await refreshOf(0).trigger('click')
      await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
      await flushPromises()

      expect(item.customData).toEqual({ description: 'from the server' })
      expect(fieldsOf(0).map((field) => field.element.value)).toContain('from the server')
      expect(fieldsOf(0).some((field) => field.element.disabled)).toBe(false)
      expect([refreshOf(0).exists(), removeOf(0).exists()]).toEqual([false, false])
      expect(dam.assetReads().every((read) => read.url.startsWith(`${endPoints.asset}/`))).toBe(true)
      expect(dam.assetReads().every((read) => read.url.includes('asset-1'))).toBe(true)
      expect(toForeignPrefix().filter((request) => !/\/(author|keyword)\//.test(request.url))).toEqual([])
      expect(shownAlerts()).toHaveLength(1)
    })

    it('cannot be pressed again while its read is on its way', async () => {
      const item = await oneProcessing()
      await waits.elapse()
      await vi.waitFor(() => expect(refreshOf(0).exists()).toBe(true))
      const reads = dam.hold('GET', dam.routes.one)

      await refreshOf(0).trigger('click')
      await vi.waitFor(() => expect(reads.waiting).toHaveLength(1))
      await flushPromises()
      expect(refreshOf(0).element.disabled).toBe(true)

      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
      reads.release()
      await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
    })

    // Only an application with the notification socket has such a row.
    // Its file notification settles the row, and the metadata is left to a separate notification that can be lost.
    if (profile.notifications) {
      it('is offered on an uploaded row whose metadata never came, and loads it from the DAM of the application', async () => {
        const item = await oneProcessing()
        dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
        socket.deliver(DamNotificationName.AssetFileProcessed, { asset: 'asset-1', id: 'file-1' })
        await vi.waitFor(() => expect(item.status).toBe(UploadQueueItemStatus.Uploaded))
        await flushPromises()
        expect([item.canEditMetadata, refreshOf(0).exists()]).toEqual([false, false])
        expect(fieldsOf(0).every((field) => field.element.disabled)).toBe(true)

        await waits.elapse()
        await vi.waitFor(() => expect(refreshOf(0).exists()).toBe(true))
        const readsBefore = dam.assetReads().length
        await refreshOf(0).trigger('click')
        await vi.waitFor(() => expect(item.canEditMetadata).toBe(true))
        await flushPromises()

        expect(dam.assetReads().length).toBeGreaterThan(readsBefore)
        expect(dam.assetReads().every((read) => read.url.startsWith('/adm/v1/asset/'))).toBe(true)
        expect(fieldsOf(0).map((field) => field.element.value)).toContain('from the server')
        expect(fieldsOf(0).some((field) => field.element.disabled)).toBe(false)
        expect(refreshOf(0).exists()).toBe(false)
        expect(shownAlerts()).toEqual([])
      })
    }
  })

  describe('the form of a row', () => {
    it('has the fields of the application: its custom fields, and keywords, authors and the switch only where it has them', async () => {
      await oneProcessing()

      const row = rows()[0]
      const labels = row.findAll('.v-field .v-label, .v-switch .v-label').map((label) => label.text())
      expect(new Set(labels)).toEqual(
        new Set(isCms ? ['title', 'description', damText('asset.model.mainFileSingleUse')] : ['description', 'author'])
      )
      expect(fieldsOf(0)).toHaveLength(2)
      expect(row.findComponent(KeywordRemoteAutocompleteWithCached).exists()).toBe(isCms)
      expect(row.findComponent(AuthorRemoteAutocompleteWithCached).exists()).toBe(isCms)
      expect(row.find('.v-switch').exists()).toBe(isCms)
    })

    it('writes what the user types into the row of the queue, where the save reads it', async () => {
      const item = await oneProcessing()
      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, fromTheServer)
      await waits.elapse()
      await vi.waitFor(() => expect(item.canEditMetadata).toBe(true))
      await flushPromises()

      const described = fieldsOf(0).find((field) => field.element.value === 'from the server')!
      await described.setValue('typed by the user')

      expect(item.customData).toEqual({ description: 'typed by the user' })
    })
  })

  describe('the mass operations', () => {
    it('are drawn beside the rows, and not beside an empty queue', async () => {
      dam.hold('POST', dam.routes.chunk)
      await mountList()
      expect(wrapper!.find('.asset-queue-editable__sidebar').exists()).toBe(false)

      await pick('a.jpg')

      expect(wrapper!.find('.asset-queue-editable__sidebar').exists()).toBe(true)
      const sidebar = wrapper!.findComponent({ name: 'AssetQueueSelectedSidebar' })
      expect([sidebar.props('queueKey'), sidebar.props('extSystem')]).toEqual([QUEUE, extSystem])
    })

    it('have their room only while the dialog has them switched on', async () => {
      await mountList()
      expect(wrapper!.find('.asset-queue-editable').classes()).not.toContain('asset-queue-editable--sidebar-active')

      await wrapper!.setProps({ massOperations: true })

      expect(wrapper!.find('.asset-queue-editable').classes()).toContain('asset-queue-editable--sidebar-active')
    })
  })
})
