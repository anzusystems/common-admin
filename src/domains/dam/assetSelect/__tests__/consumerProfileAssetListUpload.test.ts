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
import AAssetListInner from '@/domains/dam/assetSelect/components/AAssetListInner.vue'
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

// The list of assets with an upload of its own (the asset page of admin-ugc), under each of the two applications:
// where it lists from and who may see it, how it offers the upload, what the "save and apply" of its queue dialog
// does, and which filters it has. The real list with its real filter and its real queue dialog over the real queue;
// the DAM is a client that records its requests, and only the long waits are taken out of real time. Not mounted for
// real: the bar, the tiles and the table of the list, the metadata of the picked asset, the asset detail, the rows
// inside the queue dialog, and the inputs of the filter (each is named by a stand-in).

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
    /** The page hands the list its upload configuration (admin-ugc does, for its asset page). */
    upload?: boolean
    props?: Record<string, unknown>
    slots?: Record<string, (props: never) => unknown>
  }
  const mountList = async ({ upload = true, props = {}, slots = {} }: MountOptions = {}) => {
    wrapper = mount(AAssetListInner, {
      attachTo: document.body,
      props: {
        assetType: DamAssetType.Image,
        queueKey: QUEUE,
        selectConfigs: [uploadConfig()],
        // admin-ugc has no user of the DAM, and says so; admin-cms has one.
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
          ].map((name) => [name, true])
        ),
      },
    })
    await flushPromises()
  }
  /** The list has asked for its assets and has its answer. */
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

    // admin-ugc has no user of the DAM: its pages say so with `skip-current-user-check`. Left out, the list is
    // for nobody.
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
      // The page's own activator is in place of the button of the list.
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
      // The list has several roots: its file input is beside the first of them.
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

    // A list a page shows without an upload configuration (the picker inside a widget has its own upload).
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

      // Also when a queue of that key has its dialog open elsewhere.
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

  // The page has an entry of its own to the queue, which the list hands it through the slot: the asset page of
  // admin-ugc draws its button with it, and a dropzone over the whole window, which lies above the queue dialog.
  // A file handed over that way while the dialog saved was queued, began to upload, and went with the queue when
  // "save and apply" ended, its asset left in the DAM. The list takes none for as long as the dialog saves.
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
    /** The last file queued is uploaded, and the server has processed it. */
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
    /** The list on a page with an entry of its own, one file uploaded through it. Returns that entry. */
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

      // The save ends as before: the dialog closes, the queue is emptied, and nothing of the late file is left.
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

    // The close button empties the queue and takes the dialog away, also in the middle of a save. What the dialog
    // told of its save goes with it: that save may end only after the next dialog has begun a save of its own.
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

      // The dialog of the next file saves, and the save of the closed one ends meanwhile.
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

    // The dialog of another widget on the page, over a queue of its own, holds this list back from nothing.
    it('is queued while the dialog of another queue saves', async () => {
      const handOver = await oneUploaded()

      useUploadQueueDialog().uploadQueueDialogSaving.value = 'queue-of-another-widget'
      handOver('meanwhile.jpg')

      await vi.waitFor(() => expect(titles()).toEqual(['a.jpg', 'meanwhile.jpg']))
    })
  })

  describe('its filter', () => {
    // admin-ugc names the two filters its users get; admin-cms names none and gets them all.
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
