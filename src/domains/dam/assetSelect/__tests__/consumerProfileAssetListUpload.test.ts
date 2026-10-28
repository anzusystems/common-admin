import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { h, shallowRef } from 'vue'
import {
  cmsConfiguration,
  consumerProfiles,
  installConsumerProfile,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import {
  createFakeDam,
  damAssetWithFile,
  type FakeDam,
  type FakeDamAnswer,
  type FakeDamRequest,
} from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import {
  alertText,
  damText,
  forgetAlerts,
  shownAlerts,
  signInToDam,
  signOutOfDam,
  uiText,
} from '@/domains/dam/__tests__/support/uploadUi'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import AAssetListInner from '@/domains/dam/assetSelect/components/AAssetListInner.vue'
import { useSidebar } from '@/domains/dam/assetSelect/composables/assetSelectFilterSidebar'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import { destroyDamNotifications, initDamNotifications } from '@/domains/dam/composables/damNotifications'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import UploadQueueDialog from '@/domains/dam/uploadQueue/components/UploadQueueDialog.vue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// Covers the list with its own upload (admin-ugc asset page)
// under both applications: where it lists from, who may see it,
// how the upload is offered, what "save and apply" does, and which filters it has.
// The list, filter and queue dialog are real. The DAM is a recording client.
// Stand-ins: bar, tiles, table, picked asset metadata, asset detail, queue rows, filter inputs.
// The side panel and detail tests mount tiles, rows and the detail dialog for real.

const QUEUE = 'asset-page'
const FILTER_INPUTS = [
  'AFilterString',
  'AFilterBooleanSelect',
  'AFilterTimeInterval',
  'DamKeywordFilterRemoteAutocomplete',
  'DamAuthorFilterRemoteAutocomplete',
  'DamUserFilterRemoteAutocomplete',
]

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let socket: DamSocket
let wrapper: VueWrapper | undefined

const photo = (name = 'photo.jpg') => new File([new Uint8Array(3000)], name, { type: 'image/jpeg' })

describe.each(consumerProfiles)('the asset list with an upload under the $name', (profile) => {
  const { endPoints, extSystem, licence, foreignPrefix } = profile
  const isCms = profile === cmsConfiguration
  const isListRequest = (request: FakeDamRequest) =>
    request.method === 'GET' && request.url.startsWith(`${endPoints.asset}/licence/${licence}/search?`)
  const listRequests = () => dam.requests.filter(isListRequest)

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    installConsumerProfile(profile, dam.client)
    dam.reply((request) => (isListRequest(request) ? { status: 200, data: { data: [], totalCount: 0 } } : undefined))
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
    useUploadQueueDialog().uploadQueueDialog.value = null
    useUploadQueueDialog().uploadQueueDialogSaving.value = null
    useUploadQueuesStore(pinia).stopUpload(QUEUE)
    destroyDamNotifications()
    waits.restore()
    socket.restore()
    useDamNotificationsEventBus().reset()
    signOutOfDam()
  })

  const queue = () => useUploadQueuesStore(pinia)
  const uploadConfig = () => ({
    licence,
    extSystem,
    licenceName: 'own',
    extSystemConfig: useDamConfigStore(pinia).damConfigExtSystem.get(extSystem)!,
  })
  interface MountOptions {
    upload?: boolean
    props?: Record<string, unknown>
    slots?: Record<string, (props: never) => unknown>
    real?: string[]
    standIns?: string[]
  }
  const mountList = async ({ upload = true, props = {}, slots = {}, real = [], standIns = [] }: MountOptions = {}) => {
    wrapper = mount(AAssetListInner, {
      attachTo: document.body,
      props: {
        assetType: DamAssetType.Image,
        queueKey: QUEUE,
        selectConfigs: [uploadConfig()],
        skipCurrentUserCheck: !isCms,
        ...props,
      },
      slots: slots as never,
      global: {
        plugins: [pinia],
        provide: upload ? { [ImageWidgetUploadConfigKey as symbol]: shallowRef(uploadConfig()) } : {},
        stubs: Object.fromEntries(
          [
            'AssetSelectListBar',
            'AssetSelectListTiles',
            'AssetSelectListTable',
            'AssetMetadata',
            'AssetDetailDialog',
            'UploadQueueEditable',
            ...FILTER_INPUTS,
            ...standIns,
          ]
            .filter((name) => !real.includes(name))
            .map((name) => [name, true])
        ),
      },
    })
    await flushPromises()
  }
  const listed = async (times = 1) => {
    await vi.waitFor(() => expect(listRequests()).toHaveLength(times))
    await vi.waitFor(() => expect(useAssetSelectStore(pinia).loader).toBe(false))
  }
  const toForeignPrefix = () => dam.requests.filter((request) => request.url.startsWith(foreignPrefix))
  // The queue dialog is drawn into the body.
  const queueDialog = () => document.body.querySelector<HTMLElement>('.overlay--sidebar')
  const saveAndApply = () =>
    Array.from(queueDialog()!.querySelectorAll<HTMLButtonElement>('.v-toolbar button')).find((button) =>
      [damText('upload.saveAndApply'), damText('upload.apply')].includes(button.textContent?.trim() ?? '')
    )!
  const notAllowed = ['error', alertText('common.assetSelect.error.unallowedLicence')]

  describe('the assets it lists', () => {
    it('come from the DAM of the application, for the licence it is given', async () => {
      if (isCms) signInToDam(extSystem)
      await mountList()
      await listed()

      expect(toForeignPrefix()).toEqual([])
      expect(dam.unanswered).toEqual([])
      expect(shownAlerts()).toEqual([])
      expect(useAssetSelectStore(pinia).selectedLicenceId).toBe(licence)
    })

    // admin-ugc has no DAM user, so its pages pass
    // `skip-current-user-check`. Without it the list is empty for everyone.
    it('are asked for only by a user of the DAM the licence is allowed to, unless the page says to skip the check', async () => {
      await mountList({ props: { skipCurrentUserCheck: false } })
      await waits.settle(400)

      expect(shownAlerts()).toEqual([notAllowed])
      expect(listRequests()).toEqual([])

      wrapper!.unmount()
      forgetAlerts()
      await mountList({ props: { skipCurrentUserCheck: true } })
      await listed()
      expect(shownAlerts()).toEqual([])
    })
  })

  describe('the upload it offers', () => {
    it('is handed to the slot of the page: what to call with the picked files, and the types and sizes the ext system takes', async () => {
      if (isCms) signInToDam(extSystem)
      const chunks = dam.hold('POST', dam.routes.chunk)
      let handed: { onFileInput: (files: File[]) => void; uploadAccept: string; uploadSizes: Record<string, number> }
      await mountList({
        slots: {
          'upload-activator': (slotProps: never) => {
            handed = slotProps
            return h('button', { class: 'upload-of-the-page' })
          },
        },
      })
      await listed()

      expect(wrapper!.find('.upload-of-the-page').exists()).toBe(true)
      expect(handed!.uploadAccept).toBe('image/jpeg,image/png,image/webp,image/gif,image/avif')
      expect(handed!.uploadSizes).toEqual({
        'image/jpeg': 20971520,
        'image/png': 20971520,
        'image/webp': 20971520,
        'image/gif': 20971520,
        'image/avif': 20971520,
      })
      expect(wrapper!.findAll('button').map((button) => button.text())).not.toContain(uiText('common.button.upload'))

      handed!.onFileInput([photo('a.jpg'), photo('b.jpg')])
      await vi.waitFor(() => expect(chunks.waiting).toHaveLength(2))
      await flushPromises()

      expect(queue().getQueueItems(QUEUE)).toMatchObject([
        { displayTitle: 'a.jpg', licenceId: licence },
        { displayTitle: 'b.jpg', licenceId: licence },
      ])
      expect(dam.sentTo('POST', dam.routes.start).map((request) => request.url)).toEqual([
        `${endPoints.image}/licence/${licence}`,
        `${endPoints.image}/licence/${licence}`,
      ])
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
      expect(wrapper!.findComponent(UploadQueueDialog).exists()).toBe(true)
      expect(queueDialog()!.textContent).toContain(damText('upload.title'))
    })

    it('is a button of the list when the page gives it no slot, and its file input queues the same way', async () => {
      if (isCms) signInToDam(extSystem)
      dam.hold('POST', dam.routes.chunk)
      await mountList()
      await listed()

      expect(wrapper!.findAll('button').map((button) => button.text())).toContain(uiText('common.button.upload'))
      // The list has several root elements, so its file input is next to the first of them.
      const input = (wrapper!.element as Element).parentElement!.querySelector<HTMLInputElement>('input[type="file"]')!
      expect(input.accept).toBe('image/jpeg,image/png,image/webp,image/gif,image/avif')
      const dataTransfer = new DataTransfer()
      dataTransfer.items.add(photo())
      input.files = dataTransfer.files
      input.dispatchEvent(new Event('change', { bubbles: true }))
      await vi.waitFor(() => expect(queue().getQueueItems(QUEUE)).toHaveLength(1))

      expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(QUEUE)
    })

    it('takes no files that are not there: nothing is queued and no dialog opens', async () => {
      if (isCms) signInToDam(extSystem)
      let handed: { onFileInput: (files: File[]) => void }
      await mountList({
        slots: {
          'upload-activator': (slotProps: never) => {
            handed = slotProps
            return h('button')
          },
        },
      })
      await listed()

      handed!.onFileInput([])
      await flushPromises()

      expect(queue().getQueueItems(QUEUE)).toEqual([])
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
      expect(queueDialog()).toBeNull()
    })

    it('is not offered, and no queue dialog is drawn, when the page hands the list no upload configuration', async () => {
      if (isCms) signInToDam(extSystem)
      let slotDrawn = false
      await mountList({
        upload: false,
        slots: {
          'upload-activator': () => {
            slotDrawn = true
            return h('button')
          },
        },
      })
      await listed()

      expect(slotDrawn).toBe(false)
      expect(wrapper!.findAll('button').map((button) => button.text())).not.toContain(uiText('common.button.upload'))

      useUploadQueueDialog().uploadQueueDialog.value = QUEUE
      await flushPromises()
      expect(wrapper!.findComponent(UploadQueueDialog).exists()).toBe(false)
    })
  })

  describe('"save and apply" of its queue dialog', () => {
    it('saves the metadata, closes the dialog, empties the queue and reads the list again', async () => {
      if (isCms) signInToDam(extSystem)
      let handed: { onFileInput: (files: File[]) => void }
      await mountList({
        slots: {
          'upload-activator': (slotProps: never) => {
            handed = slotProps
            return h('button')
          },
        },
      })
      await listed()
      handed!.onFileInput([photo()])
      const item = () => queue().getQueueItems(QUEUE)[0]
      await vi.waitFor(() => expect(item()?.status).toBe(UploadQueueItemStatus.Processing))
      dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, {
        metadata: { customData: { description: 'from the server' }, authorSuggestions: {}, keywordSuggestions: {} },
      })
      await waits.elapse()
      await vi.waitFor(() => expect(item().status).toBe(UploadQueueItemStatus.Uploaded))
      await flushPromises()

      saveAndApply().click()
      await listed(2)
      await flushPromises()

      expect(dam.sentTo('PATCH', dam.routes.bulkMetadata).map((request) => request.url)).toEqual([
        `${endPoints.asset}/metadata-bulk-update`,
      ])
      expect(queueDialog()).toBeNull()
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
      expect(queue().getQueueItems(QUEUE)).toEqual([])
      expect(toForeignPrefix()).toEqual([])
    })
  })

  // The page can have its own entry to the queue, handed over through the slot.
  // The admin-ugc asset page draws a button and a window-wide dropzone that lies above the queue dialog.
  // A file handed over while the dialog saved was queued, began uploading, and
  // left with the queue when "save and apply" ended, leaving its asset in the DAM.
  // The list therefore takes no files while the dialog saves.
  describe('a file the page hands over while the queue dialog saves', () => {
    const { Processing, Uploaded } = UploadQueueItemStatus
    const rows = () => queue().getQueueItems(QUEUE)
    const titles = () => rows().map((row) => row.displayTitle)
    const uploadsStarted = () => dam.sentTo('POST', dam.routes.start).length
    const saving = () => useUploadQueueDialog().uploadQueueDialogSaving.value
    const save = () =>
      Array.from(queueDialog()!.querySelectorAll<HTMLButtonElement>('.v-toolbar button')).find((button) =>
        button.querySelector('.mdi-content-save')
      )!
    const uploaded = async () => {
      const last = () => rows().at(-1)
      await vi.waitFor(() => expect(last()?.status).toBe(Processing))
      dam.fileBecomes(last()!.assetId!, AssetFileProcessStatus.Processed, {
        metadata: { customData: { description: 'from the server' }, authorSuggestions: {}, keywordSuggestions: {} },
      })
      await waits.elapse()
      await vi.waitFor(() => expect(last()!.status).toBe(Uploaded))
      await flushPromises()
    }
    const oneUploaded = async () => {
      if (isCms) signInToDam(extSystem)
      let handed: { onFileInput: (files: File[]) => void }
      await mountList({
        slots: {
          'upload-activator': (slotProps: never) => {
            handed = slotProps
            return h('button')
          },
        },
      })
      await listed()
      handed!.onFileInput([photo('a.jpg')])
      await uploaded()
      return (name: string) => handed.onFileInput([photo(name)])
    }

    it('is not queued, and no upload starts, while "save and apply" runs', async () => {
      const handOver = await oneUploaded()
      const held = dam.hold('PATCH', dam.routes.bulkMetadata)

      saveAndApply().click()
      await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
      handOver('late.jpg')
      await waits.settle()

      expect(titles()).toEqual(['a.jpg'])
      expect(uploadsStarted()).toBe(1)

      held.release()
      await listed(2)
      await flushPromises()
      expect([queueDialog(), rows(), uploadsStarted()]).toEqual([null, [], 1])
    })

    it.each<[string, () => HTMLButtonElement, FakeDamAnswer | undefined]>([
      ['"save" that went through', () => save(), undefined],
      ['"save and apply" the DAM refused', () => saveAndApply(), { status: 500 }],
    ])(
      'is not queued while it runs, and is again after %s: the dialog is still open',
      async (_name, pressed, answer) => {
        const handOver = await oneUploaded()
        const held = dam.hold('PATCH', dam.routes.bulkMetadata)

        pressed().click()
        await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
        handOver('late.jpg')
        await waits.settle()
        expect(titles()).toEqual(['a.jpg'])

        held.release(answer)
        await vi.waitFor(() => expect(saving()).toBeNull())
        handOver('after.jpg')
        await vi.waitFor(() => expect(titles()).toEqual(['a.jpg', 'after.jpg']))
        expect(queueDialog()).not.toBeNull()
      }
    )

    // The close button empties the queue and removes the dialog, also during a save.
    // The save result of the closed dialog must be dropped, because
    // it can end after the next dialog has started its own save.
    it('is queued again once the dialog was closed in the middle of its save, whose end changes nothing', async () => {
      const handOver = await oneUploaded()
      const held = dam.hold('PATCH', dam.routes.bulkMetadata)
      saveAndApply().click()
      await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
      expect(saving()).toBe(QUEUE)
      const [saveOfTheClosedDialog] = held.waiting

      queueDialog()!.querySelector<HTMLButtonElement>('[data-cy="button-close"]')!.click()
      await flushPromises()
      expect([queueDialog(), rows(), saving()]).toEqual([null, [], null])

      handOver('next.jpg')
      await uploaded()
      expect(titles()).toEqual(['next.jpg'])

      save().click()
      await vi.waitFor(() => expect(held.waiting).toHaveLength(2))
      saveOfTheClosedDialog!.release()
      await waits.settle()
      expect(saving()).toBe(QUEUE)
      handOver('late.jpg')
      await waits.settle()
      expect(titles()).toEqual(['next.jpg'])

      held.release()
      await vi.waitFor(() => expect(saving()).toBeNull())
    })

    it('is queued while the dialog of another queue saves', async () => {
      const handOver = await oneUploaded()

      useUploadQueueDialog().uploadQueueDialogSaving.value = 'queue-of-another-widget'
      handOver('meanwhile.jpg')

      await vi.waitFor(() => expect(titles()).toEqual(['a.jpg', 'meanwhile.jpg']))
    })
  })

  // The side panel shows the asset picked by a click, and the asset detail uses the same page-wide store.
  // A closing detail makes the list re-read the panel asset.
  // A queue row detail closes by itself when its asset cannot be read, so
  // that re-read can still be pending when "edit asset" is pressed again.
  // Written whenever it answered, the panel asset replaced the row asset in the detail, and the row save wrote into it.
  if (!isCms) {
    describe('the asset of its side panel, read again when a detail has closed', () => {
      const { Processing, Uploaded } = UploadQueueItemStatus
      const detail = () => useAssetDetailStore(pinia)
      const picked = (title: string) =>
        damAssetWithFile('asset-50', 'file-50', AssetFileProcessStatus.Processed, {
          licence,
          texts: { displayTitle: title },
        })
      const readOf = (asset: string) => new RegExp(`^${endPoints.asset}/${asset}$`)
      const readsOf = (asset: string) => dam.sentTo('GET', readOf(asset)).length
      const closeDetail = () => wrapper!.findComponent({ name: 'AssetDetailDialogFrame' }).vm.$emit('close')
      const editAssetOfRow = () =>
        Array.from(queueDialog()!.querySelectorAll<HTMLButtonElement>('.dam-upload-queue__item button')).find(
          (button) => button.textContent?.trim() === damText('image.button.editAsset')
        )!
      const WITH_TILES_AND_DETAIL = {
        real: ['AssetSelectListTiles', 'AssetDetailDialog', 'UploadQueueEditable'],
        standIns: [
          'AssetDetailDialogFrame',
          'AssetImagePreview',
          'AssetImage',
          'AssetQueueSelectedSidebar',
          'AFileDropzone',
          'AFormRemoteAutocompleteWithCached',
        ],
      }
      const tiles = () => wrapper!.findAll('.asset-list-tiles__item')
      // The side panel is a column of a wide window, and a dialog of a narrow one.
      const panel = () =>
        document.body.querySelector<HTMLElement>('.subject-select__sidebar-right') ??
        Array.from(document.body.querySelectorAll<HTMLElement>('.v-overlay--active .v-card')).find((card) =>
          card.textContent?.includes(uiText('common.assetSelect.meta.info.toggle'))
        )
      const panelLoads = () => !!panel()?.querySelector('.v-progress-circular')
      const panelShowsAnAsset = () => wrapper!.findComponent({ name: 'AssetMetadata' }).exists()
      const mountWithTwoAssets = async (slots: MountOptions['slots'] = {}) => {
        dam.assets.set('asset-50', picked('First in the list'))
        dam.assets.set(
          'asset-51',
          damAssetWithFile('asset-51', 'file-51', AssetFileProcessStatus.Processed, {
            licence,
            texts: { displayTitle: 'Second in the list' },
          })
        )
        dam.reply((request) =>
          isListRequest(request)
            ? { status: 200, data: { data: [dam.assets.get('asset-50'), dam.assets.get('asset-51')], totalCount: 2 } }
            : undefined
        )
        const listedBefore = listRequests().length
        await mountList({ ...WITH_TILES_AND_DETAIL, slots })
        await listed(listedBefore + 1)
        useSidebar().openSidebarRight()
        await flushPromises()
        expect(tiles()).toHaveLength(2)
      }

      afterEach(() => useSidebar().closeSidebarRight())

      const mountWithPickedAsset = async () => {
        dam.assets.set('asset-50', picked('Picked in the list'))
        dam.reply((request) =>
          isListRequest(request)
            ? { status: 200, data: { data: [dam.assets.get('asset-50')], totalCount: 1 } }
            : undefined
        )
        let handed: { onFileInput: (files: File[]) => void }
        await mountList({
          ...WITH_TILES_AND_DETAIL,
          slots: {
            'upload-activator': (slotProps: never) => {
              handed = slotProps
              return h('button')
            },
          },
        })
        await listed()
        await wrapper!.find('.asset-list-tiles__item').trigger('click')
        await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
        await flushPromises()
        expect(readsOf('asset-50')).toBe(1)
        return (name: string) => handed.onFileInput([photo(name)])
      }
      const oneUploaded = async (handOver: (name: string) => void) => {
        handOver('a.jpg')
        const row = () => queue().getQueueItems(QUEUE)[0]
        await vi.waitFor(() => expect(row()?.status).toBe(Processing))
        dam.fileBecomes('asset-1', AssetFileProcessStatus.Processed, {
          texts: { displayTitle: 'Uploaded' },
          metadata: { customData: { description: 'from the server' }, authorSuggestions: {}, keywordSuggestions: {} },
        })
        await waits.elapse()
        await vi.waitFor(() => expect(row()!.status).toBe(Uploaded))
        await flushPromises()
      }

      it('shows the picked asset as it is by then, once the detail opened from the side panel is closed by its button', async () => {
        await mountWithPickedAsset()
        useSidebar().openSidebarRight()
        await flushPromises()

        wrapper!.findComponent({ name: 'AssetMetadata' }).vm.$emit('editInDam')
        await flushPromises()
        expect([detail().dialog, detail().asset?.id]).toEqual([QUEUE, 'asset-50'])
        dam.assets.set('asset-50', picked('Saved in the detail'))
        const before = dam.requests.length

        closeDetail()
        await vi.waitFor(() => expect(detail().asset?.texts.displayTitle).toBe('Saved in the detail'))
        await flushPromises()

        expect([detail().dialog, detail().asset?.id, detail().loading]).toEqual([null, 'asset-50', false])
        expect(dam.requests.slice(before).map((request) => `${request.method} ${request.url}`)).toEqual([
          `GET ${endPoints.asset}/asset-50`,
        ])
        expect(shownAlerts()).toEqual([])
      })

      it.each<[string, boolean]>([
        ['first', true],
        ['last', false],
      ])(
        'leaves the detail of a row of the queue, opened again while that read is on its way, the asset of the row: the answer for the side panel comes %s',
        async (_when, panelFirst) => {
          await oneUploaded(await mountWithPickedAsset())
          const answerAgain = dam.reply((request) =>
            request.method === 'GET' && readOf('asset-1').test(request.url) ? { status: 500 } : undefined
          )
          const panel = dam.hold('GET', readOf('asset-50'))

          editAssetOfRow().click()
          await vi.waitFor(() => expect(shownAlerts()).toHaveLength(1))
          await vi.waitFor(() => expect(panel.waiting).toHaveLength(1))
          expect([detail().dialog, detail().asset]).toEqual([null, null])
          const readForThePanel = panel.waiting[0]!

          answerAgain()
          const row = dam.hold('GET', readOf('asset-1'))
          editAssetOfRow().click()
          await vi.waitFor(() => expect(row.waiting).toHaveLength(1))

          if (panelFirst) {
            readForThePanel.release()
            await waits.settle()
            expect([detail().dialog, detail().asset, detail().loading]).toEqual([QUEUE, null, true])
            row.release()
          } else {
            row.release()
            await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-1'))
            readForThePanel.release()
          }
          await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-1'))
          await waits.settle()

          expect([detail().dialog, detail().asset?.id, detail().loading]).toEqual([QUEUE, 'asset-1', false])
          expect(shownAlerts()).toHaveLength(1)

          closeDetail()
          await vi.waitFor(() => expect(panel.waiting).toHaveLength(1))
          panel.release()
          await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
          expect([detail().dialog, readsOf('asset-50')]).toEqual([null, 3])
        }
      )

      // The re-read after a close and the read of a tile click each
      // wrote on answer and each turned the panel loading off.
      // After closing one asset detail and clicking another tile at once, the panel
      // showed the detail asset beside the other tile if its answer came last,
      // and stopped loading at the first answer.
      it.each<[string, boolean]>([
        ['first', true],
        ['last', false],
      ])(
        'shows the asset of a tile clicked since the detail closed, when the answer of the read after the close comes %s',
        async (_when, closedFirst) => {
          await mountWithTwoAssets()
          await tiles()[0]!.trigger('click')
          await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
          await flushPromises()
          wrapper!.findComponent({ name: 'AssetMetadata' }).vm.$emit('editInDam')
          await flushPromises()
          expect([detail().dialog, detail().asset?.id]).toEqual([QUEUE, 'asset-50'])
          const afterClose = dam.hold('GET', readOf('asset-50'))
          const afterClick = dam.hold('GET', readOf('asset-51'))

          closeDetail()
          await vi.waitFor(() => expect(afterClose.waiting).toHaveLength(1))
          await tiles()[1]!.trigger('click')
          await vi.waitFor(() => expect(afterClick.waiting).toHaveLength(1))
          expect([detail().asset, panelLoads()]).toEqual([null, true])

          if (closedFirst) {
            afterClose.release()
            await waits.settle()
            expect([detail().asset, panelLoads(), panelShowsAnAsset()]).toEqual([null, true, false])
            afterClick.release()
          } else {
            afterClick.release()
            await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-51'))
            await flushPromises()
            expect([panelLoads(), panelShowsAnAsset()]).toEqual([false, true])
            afterClose.release()
          }
          await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-51'))
          await waits.settle()

          expect([detail().dialog, detail().asset?.id, panelLoads(), panelShowsAnAsset()]).toEqual([
            null,
            'asset-51',
            false,
            true,
          ])
          expect(useAssetSelectStore(pinia).assetListItems.map((item) => item.active)).toEqual([false, true])
          expect(shownAlerts()).toEqual([])
        }
      )

      // The list empties its selection and the detail store when
      // it goes away, but a tile click read may still be pending.
      // Its answer was written into the store anyway, and the panel of the next list kept loading until it came.
      it('gives up the read of a click when the list goes away: mounted again, its side panel loads nothing and shows no asset', async () => {
        await mountWithTwoAssets()
        const held = dam.hold('GET', readOf('asset-50'))
        await tiles()[0]!.trigger('click')
        await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
        expect(panelLoads()).toBe(true)

        wrapper!.unmount()
        await mountWithTwoAssets()

        expect([detail().asset, panelLoads(), panelShowsAnAsset()]).toEqual([null, false, false])
        held.release()
        await waits.settle()

        expect([detail().asset, panelLoads(), panelShowsAnAsset()]).toEqual([null, false, false])
        expect(useAssetSelectStore(pinia).assetListItems.map((item) => item.active)).toEqual([false, false])
        expect(shownAlerts()).toEqual([])
      })

      // The detail store is shared by the page. A list that went
      // away with its side panel detail open left its key there.
      // The next list (user back on the page) drew that detail at once, with no asset and no way to close it.
      it('closes the detail of its side panel when it goes away: mounted again, it draws none', async () => {
        await mountWithTwoAssets()
        await tiles()[0]!.trigger('click')
        await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
        await flushPromises()
        wrapper!.findComponent({ name: 'AssetMetadata' }).vm.$emit('editInDam')
        await flushPromises()
        expect(wrapper!.findComponent({ name: 'AssetDetailDialogFrame' }).exists()).toBe(true)

        wrapper!.unmount()
        expect(detail().dialog).toBeNull()
        await mountWithTwoAssets()

        expect([detail().dialog, detail().asset]).toEqual([null, null])
        expect(wrapper!.findComponent({ name: 'AssetDetailDialogFrame' }).exists()).toBe(false)
      })

      // The read after the close reported its failure whenever it came,
      // also after a tile clicked since had asked for another asset, which showed an error next to the wrong asset.
      it('says nothing of the read after the close that failed, once a tile clicked since has asked for another asset', async () => {
        await mountWithTwoAssets()
        await tiles()[0]!.trigger('click')
        await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
        await flushPromises()
        wrapper!.findComponent({ name: 'AssetMetadata' }).vm.$emit('editInDam')
        await flushPromises()
        const afterClose = dam.hold('GET', readOf('asset-50'))
        const afterClick = dam.hold('GET', readOf('asset-51'))

        closeDetail()
        await vi.waitFor(() => expect(afterClose.waiting).toHaveLength(1))
        await tiles()[1]!.trigger('click')
        await vi.waitFor(() => expect(afterClick.waiting).toHaveLength(1))
        afterClose.release({ status: 500 })
        await waits.settle()

        expect(shownAlerts()).toEqual([])
        expect([detail().asset, panelLoads()]).toEqual([null, true])
        afterClick.release()
        await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-51'))
        await flushPromises()
        expect([panelLoads(), panelShowsAnAsset()]).toEqual([false, true])
        expect(shownAlerts()).toEqual([])
      })

      it('says that the read after the close failed, while no other asset has been asked for since', async () => {
        await mountWithTwoAssets()
        await tiles()[0]!.trigger('click')
        await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
        await flushPromises()
        wrapper!.findComponent({ name: 'AssetMetadata' }).vm.$emit('editInDam')
        await flushPromises()
        const afterClose = dam.hold('GET', readOf('asset-50'))

        closeDetail()
        await vi.waitFor(() => expect(afterClose.waiting).toHaveLength(1))
        afterClose.release({ status: 500 })

        await vi.waitFor(() => expect(shownAlerts()).toEqual([['error', alertText('common.alert.unknownError')]]))
        expect([detail().asset, panelLoads(), panelShowsAnAsset()]).toEqual([null, false, false])
      })

      // The list remembered the place of its active tile, not the asset.
      // Read anew (search, order, applied upload), it marked no tile, and the tile now at
      // that place could not become active by a click, though the panel showed its asset.
      // "Edit" and closing the detail then left the panel empty,
      // because the read after the close goes by the active tile.
      describe('and the tile of that asset, once the list has been read anew', () => {
        const ACTIVE = 'asset-list-tiles__item--active'
        const inTheList = (id: string) =>
          damAssetWithFile(id, `file-of-${id}`, AssetFileProcessStatus.Processed, {
            licence,
            texts: { displayTitle: `Title of ${id}` },
          })
        const nextListsAre = (...lists: string[][]) =>
          dam.reply((request) => {
            if (!isListRequest(request)) return undefined
            const next = lists.shift()
            return next
              ? { status: 200, data: { data: next.map((id) => dam.assets.get(id) ?? inTheList(id)), totalCount: 3 } }
              : undefined
          })
        const tilesDrawn = () =>
          tiles().map((tile) => [tile.find('[data-cy="asset-tile-title"]').text(), tile.classes(ACTIVE)])
        const first = ['First in the list', false]
        const second = ['Second in the list', false]
        const active = ([title]: Array<string | boolean>) => [title, true]
        const sortAnew = async () => {
          const listedBefore = listRequests().length
          wrapper!.findComponent({ name: 'AssetSelectListBar' }).vm.$emit('sortByChange', {
            id: 2,
            titleT: 'common.system.datatable.ordering.oldest',
            sortBy: { key: 'createdAt', order: 'asc' },
          })
          await listed(listedBefore + 1)
          await flushPromises()
        }
        const searchAnew = async () => {
          const listedBefore = listRequests().length
          wrapper!.findComponent({ name: 'AFilterWrapper' }).vm.$emit('submit')
          await listed(listedBefore + 1)
          await flushPromises()
        }
        const loadMore = async () => {
          const listedBefore = listRequests().length
          wrapper!
            .findAll('button')
            .find((button) => button.text() === uiText('common.button.loadMore'))!
            .element.click()
          await listed(listedBefore + 1)
          await flushPromises()
        }
        const firstTileClicked = async () => {
          await mountWithTwoAssets()
          await tiles()[0]!.trigger('click')
          await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
          await flushPromises()
          expect(tilesDrawn()).toEqual([active(first), second])
        }

        it.each<[string, () => Promise<void>]>([
          ['another order', sortAnew],
          ['a search', searchAnew],
        ])(
          'is the active one at the place it has after %s, and the side panel goes on showing its asset',
          async (_how, readAnew) => {
            await firstTileClicked()
            nextListsAre(['asset-51', 'asset-50'])

            await readAnew()

            expect(tilesDrawn()).toEqual([second, active(first)])
            expect([detail().asset?.id, panelShowsAnAsset()]).toEqual(['asset-50', true])
            expect(readsOf('asset-50')).toBe(1)
          }
        )

        it('gives way to the tile at the place it had, when that one is clicked', async () => {
          await firstTileClicked()
          nextListsAre(['asset-51', 'asset-50'])
          await sortAnew()

          await tiles()[0]!.trigger('click')
          await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-51'))
          await flushPromises()

          expect(tilesDrawn()).toEqual([active(second), first])
          expect(panelShowsAnAsset()).toBe(true)
        })

        it('is read into the side panel again when the detail "edit" of the panel opened has closed', async () => {
          await firstTileClicked()
          nextListsAre(['asset-51', 'asset-50'])
          await sortAnew()
          wrapper!.findComponent({ name: 'AssetMetadata' }).vm.$emit('editInDam')
          await flushPromises()
          expect([detail().dialog, detail().asset?.id]).toEqual([QUEUE, 'asset-50'])
          dam.assets.set('asset-50', picked('Saved in the detail'))

          closeDetail()
          await vi.waitFor(() => expect(detail().asset?.texts.displayTitle).toBe('Saved in the detail'))
          await flushPromises()

          expect([detail().dialog, panelLoads(), panelShowsAnAsset()]).toEqual([null, false, true])
          expect(readsOf('asset-50')).toBe(2)
          expect(tilesDrawn()).toEqual([second, active(first)])
          expect(shownAlerts()).toEqual([])
        })

        it('is not there when the list no longer has its asset: no tile is the active one, and the one clicked next is', async () => {
          await firstTileClicked()
          nextListsAre(['asset-51'])

          await sortAnew()
          expect(tilesDrawn()).toEqual([second])
          expect(detail().asset?.id).toBe('asset-50')

          await tiles()[0]!.trigger('click')
          await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-51'))
          expect(tilesDrawn()).toEqual([active(second)])
        })

        it('is the active one again once a further page of the list brings its asset, and stays so through the pages after it', async () => {
          await firstTileClicked()
          nextListsAre(['asset-51'], ['asset-50'], ['asset-52'])
          await sortAnew()
          expect(tilesDrawn()).toEqual([second])

          await loadMore()
          expect(tilesDrawn()).toEqual([second, active(first)])

          await loadMore()
          expect(tilesDrawn()).toEqual([second, active(first), ['Title of asset-52', false]])
          expect(detail().asset?.id).toBe('asset-50')

          await tiles()[0]!.trigger('click')
          await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-51'))
          expect(tilesDrawn()).toEqual([active(second), first, ['Title of asset-52', false]])
        })

        it('stays where it is when a further page of the list is added below it', async () => {
          await firstTileClicked()
          nextListsAre(['asset-52'])

          await loadMore()

          expect(tilesDrawn()).toEqual([active(first), second, ['Title of asset-52', false]])
        })

        it('is the active one again when a list read later brings its asset back, the side panel having shown it all along', async () => {
          await firstTileClicked()
          nextListsAre(['asset-51'], ['asset-51', 'asset-50'])
          await sortAnew()
          expect(tilesDrawn()).toEqual([second])

          await searchAnew()

          expect(tilesDrawn()).toEqual([second, active(first)])
          expect([detail().asset?.id, panelShowsAnAsset()]).toEqual(['asset-50', true])
        })

        it('stays the active one through a detail opened and closed, and is found again in the list read after', async () => {
          await firstTileClicked()
          wrapper!.findComponent({ name: 'AssetMetadata' }).vm.$emit('editInDam')
          await flushPromises()
          closeDetail()
          await vi.waitFor(() => expect(readsOf('asset-50')).toBe(2))
          await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
          nextListsAre(['asset-51', 'asset-50'])

          await sortAnew()

          expect(tilesDrawn()).toEqual([second, active(first)])
          expect(panelShowsAnAsset()).toBe(true)
        })

        // Over a list without the asset, "edit" of the panel and closing the detail used
        // to leave the panel empty, because the list read by its active tile and had none.
        // It now reads the asset by which the tile is found, so the panel
        // shows the asset again and a list that brings it back marks its tile.
        it.each<[string, string[], () => Promise<void>]>([
          ['a list read later', ['asset-51', 'asset-50'], sortAnew],
          ['a further page', ['asset-50'], loadMore],
        ])(
          'is the active one when %s brings its asset back, the side panel having read that asset again once a detail closed over a list without it',
          async (_how, back, readOn) => {
            await firstTileClicked()
            nextListsAre(['asset-51'], back)
            await sortAnew()
            expect(tilesDrawn()).toEqual([second])
            wrapper!.findComponent({ name: 'AssetMetadata' }).vm.$emit('editInDam')
            await flushPromises()
            expect([detail().dialog, detail().asset?.id]).toEqual([QUEUE, 'asset-50'])

            closeDetail()
            await vi.waitFor(() => expect(readsOf('asset-50')).toBe(2))
            await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
            await flushPromises()
            expect([detail().dialog, panelLoads(), panelShowsAnAsset()]).toEqual([null, false, true])
            expect(tilesDrawn()).toEqual([second])

            await readOn()
            expect(tilesDrawn()).toEqual([second, active(first)])
            expect([detail().asset?.id, panelShowsAnAsset()]).toEqual(['asset-50', true])
            expect(readsOf('asset-50')).toBe(2)
          }
        )

        // A detail closes over a list without the asset while an earlier read for the side panel is still pending.
        // The close reads the asset again, and that read is the latest one.
        // Whatever the reads answer, the panel and a later list agree: both show the asset or neither does.
        describe('while a read for the side panel is still on its way when that detail closes', () => {
          let handed: { onFileInput: (files: File[]) => void }
          const mountOnAPageWithUpload = () =>
            mountWithTwoAssets({
              'upload-activator': (slotProps: never) => {
                handed = slotProps
                return h('button')
              },
            })
          const listWithoutItThenADetailOfTheQueueClosed = async () => {
            nextListsAre(['asset-51'], ['asset-51', 'asset-50'])
            await sortAnew()
            expect(tilesDrawn()).toEqual([second])
            await oneUploaded((name) => handed.onFileInput([photo(name)]))
            editAssetOfRow().click()
            await vi.waitFor(() => expect([detail().dialog, detail().asset?.id]).toEqual([QUEUE, 'asset-1']))
            await flushPromises()
            closeDetail()
            await waits.settle()
            expect([detail().dialog, detail().asset]).toEqual([null, null])
          }

          it.each<[string, FakeDamAnswer | undefined, boolean]>([
            ['answer: the panel shows its asset, and its tile is the active one in a list read later', undefined, true],
            ['fail: the panel stays empty, and no tile is the active one in a list read later', { status: 500 }, false],
          ])('the read of a clicked tile, and the read after that close: both then %s', async (_how, answer, shown) => {
            await mountOnAPageWithUpload()
            const ofTheClick = dam.hold('GET', readOf('asset-50'))
            await tiles()[0]!.trigger('click')
            await vi.waitFor(() => expect(ofTheClick.waiting).toHaveLength(1))

            await listWithoutItThenADetailOfTheQueueClosed()
            expect(panelLoads()).toBe(true)
            expect(ofTheClick.waiting).toHaveLength(2)
            ofTheClick.release(answer)
            await vi.waitFor(() => expect(panelLoads()).toBe(false))
            await flushPromises()
            expect([detail().asset?.id ?? null, panelShowsAnAsset()]).toEqual(
              shown ? ['asset-50', true] : [null, false]
            )

            await sortAnew()
            expect(tilesDrawn()).toEqual(shown ? [second, active(first)] : [second, first])
            expect(panelShowsAnAsset()).toBe(shown)
            expect(shownAlerts()).toHaveLength(shown ? 0 : 1)
          })

          // The earlier read is ignored once a detail has been opened since it began.
          // The close of that detail reads the asset again, and the panel shows that answer.
          it('the read after an earlier close, whose answer is not taken: the read after the later close shows the asset, and its tile is the active one in a list read later', async () => {
            await mountOnAPageWithUpload()
            await tiles()[0]!.trigger('click')
            await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
            await flushPromises()
            wrapper!.findComponent({ name: 'AssetMetadata' }).vm.$emit('editInDam')
            await flushPromises()
            const afterTheClose = dam.hold('GET', readOf('asset-50'))
            closeDetail()
            await vi.waitFor(() => expect(afterTheClose.waiting).toHaveLength(1))

            await listWithoutItThenADetailOfTheQueueClosed()
            expect(panelLoads()).toBe(true)
            expect(afterTheClose.waiting).toHaveLength(2)
            const [afterTheEarlierClose, afterTheLaterClose] = afterTheClose.waiting
            afterTheEarlierClose!.release()
            await waits.settle()
            expect([detail().asset, panelLoads(), panelShowsAnAsset()]).toEqual([null, true, false])
            afterTheLaterClose!.release()
            await vi.waitFor(() => expect(panelLoads()).toBe(false))
            await flushPromises()
            expect([detail().asset?.id, panelShowsAnAsset()]).toEqual(['asset-50', true])

            await sortAnew()
            expect(tilesDrawn()).toEqual([second, active(first)])
            expect(panelShowsAnAsset()).toBe(true)
            expect(shownAlerts()).toEqual([])
          })
        })

        // A tile whose read failed was marked beside a panel that does
        // not show its asset, and was found again in a later list.
        // The mark must follow the asset the panel shows, which is none here.
        it('is not the active one, nor in a list read later, when the read of its click failed', async () => {
          await mountWithTwoAssets()
          dam.reply((request) =>
            request.method === 'GET' && readOf('asset-50').test(request.url) ? { status: 500 } : undefined
          )
          await tiles()[0]!.trigger('click')
          await vi.waitFor(() => expect(shownAlerts()).toHaveLength(1))
          await flushPromises()
          expect(tilesDrawn()).toEqual([first, second])
          expect([detail().asset, panelLoads()]).toEqual([null, false])
          nextListsAre(['asset-51', 'asset-50'])

          await sortAnew()

          expect(tilesDrawn()).toEqual([second, first])
        })

        // The mark ends with the tile: once a list no longer has the asset, the panel shows none and no tile is marked.
        // Whether the asset was forgotten depended on which came first, the failure or the list.
        // When the failure came first, a later list marked its tile beside the empty panel.
        it.each<[string, boolean]>([
          ['the read of its click', false],
          ['the read after the close of a detail', true],
        ])(
          'is not the active one in a list read later when %s failed, and a list without its asset came after that',
          async (_which, afterAClose) => {
            await mountWithTwoAssets()
            const fail = () =>
              dam.reply((request) =>
                request.method === 'GET' && readOf('asset-50').test(request.url) ? { status: 500 } : undefined
              )
            if (!afterAClose) fail()
            await tiles()[0]!.trigger('click')
            if (afterAClose) {
              await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
              await flushPromises()
              wrapper!.findComponent({ name: 'AssetMetadata' }).vm.$emit('editInDam')
              await flushPromises()
              fail()
              closeDetail()
            }
            await vi.waitFor(() => expect(shownAlerts()).toHaveLength(1))
            await flushPromises()
            expect(tilesDrawn()).toEqual([afterAClose ? active(first) : first, second])
            expect([detail().asset, panelLoads()]).toEqual([null, false])
            nextListsAre(['asset-51'], ['asset-51', 'asset-50'])

            await sortAnew()
            expect(tilesDrawn()).toEqual([second])
            await sortAnew()

            expect(tilesDrawn()).toEqual([second, first])
            expect([detail().asset, panelShowsAnAsset()]).toEqual([null, false])
            expect(shownAlerts()).toHaveLength(1)
          }
        )
      })
    })
  }

  describe('its filter', () => {
    it('has the inputs the application asks for: all of them, or the ones it names', async () => {
      if (isCms) signInToDam(extSystem)
      await mountList()
      await listed()
      wrapper!.findComponent({ name: 'AFilterAdvancedButton' }).vm.$emit('advancedFilter')
      await flushPromises()

      const inputs = FILTER_INPUTS.flatMap((name) =>
        wrapper!.findAllComponents({ name }).map((input) => input.props('name') ?? input.props('nameFrom'))
      )
      expect(inputs.sort()).toEqual(
        isCms
          ? [
              'assetAndMainFileIds',
              'authorIds',
              'createdAtFrom',
              'createdByIds',
              'described',
              'generatedBySystem',
              'keywordIds',
              'text',
              'visible',
            ]
          : ['createdAtFrom', 'text']
      )
    })
  })
})
