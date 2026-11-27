import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import {
  cmsConfiguration,
  consumerProfiles,
  installConsumerProfile,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import {
  createFakeDam,
  damAssetWithFile,
  damImageLinks,
  type FakeDam,
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
import AssetDetailDialog from '@/domains/dam/assetDetail/components/AssetDetailDialog.vue'
import AssetDetailSidebarMetadata from '@/domains/dam/assetDetail/components/AssetDetailSidebarMetadata.vue'
import AssetDetailSidebarROI from '@/domains/dam/assetDetail/components/AssetDetailSidebarROI.vue'
import AssetImage from '@/domains/dam/assetDetail/components/AssetImage.vue'
import { AssetDetailTabImageWithRoi, useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { useDamCachedUsers } from '@/domains/dam/author/composables/cachedUsers'
import ACachedUserChip from '@/domains/cached/components/ACachedUserChip.vue'
import DamAssetImageRoiSelectLazy from '@/domains/dam/cropper/components/DamAssetImageRoiSelectLazy.vue'
import { type AssetDetailItemDto, DamAssetStatus, DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'
import {
  AssetFileFailReason,
  type AssetFileFailReasonType,
  type AssetFileImage,
  AssetFileProcessStatus,
  type AssetFileProcessStatusType,
} from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import type { DamUser } from '@/domains/dam/user/types/DamUser'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// The asset detail a widget opens, under both applications: heading, close button, sidebar toggle, left
// side (picture or region of interest editor, and who may edit it), tabs, asset and file state, file
// panel, save button (also for a detail opened from an upload queue), and reaction to the asset changing.
// Uses the real dialog, sidebar and store, opened as a widget opens it. The
// DAM is a recording client, and only the long upload waits leave real time.
// Stubbed: the picture (it would ask the image server), the cropper editor, the regions
// under the form (they ask the DAM), and the inputs that ask the DAM for names.

const QUEUE = 'asset-detail'
const TITLE = 'Harbour at dawn'
const COLOUR = '#3a6b8c'

let pinia: Pinia
let dam: FakeDam
let wrapper: VueWrapper | undefined
let closed = 0

const people = [
  { id: 7, fullName: 'Jana Created' },
  { id: 8, fullName: 'Peter Changed' },
]

const imageAttributes: AssetFileImage['imageAttributes'] = {
  ratioWidth: 16,
  ratioHeight: 9,
  width: 1600,
  height: 900,
  rotation: 0,
  mostDominantColor: COLOUR,
  animated: false,
}

const linksOf = (file: string) => {
  const links = damImageLinks(file)
  return Object.assign(links, { image_detail: { ...links.image_detail!, requestedWidth: 1280, requestedHeight: 720 } })
}

const image = (parts: Partial<AssetDetailItemDto> = {}, fileParts: Partial<AssetFileImage> = {}, number = 1) =>
  damAssetWithFile(
    `asset-${number}`,
    `file-${number}`,
    AssetFileProcessStatus.Processed,
    { texts: { displayTitle: TITLE }, ...parts },
    { links: linksOf(`file-${number}`), imageAttributes, ...fileParts }
  )

const other = (assetType: DamAssetTypeType, number = 1) =>
  damAssetWithFile(`asset-${number}`, `file-${number}`, AssetFileProcessStatus.Processed, {
    texts: { displayTitle: TITLE },
    attributes: { assetType, assetStatus: DamAssetStatus.WithFile },
  })

const fileIn = (status: AssetFileProcessStatusType, failReason: AssetFileFailReasonType = AssetFileFailReason.None) => {
  const asset = image()
  asset.mainFile!.fileAttributes = { ...asset.mainFile!.fileAttributes, status, failReason }
  return asset
}

describe.each(consumerProfiles)('the detail of an asset under the $name', (profile) => {
  const { endPoints, extSystem, licence } = profile
  const isCms = profile === cmsConfiguration

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    installConsumerProfile(profile, dam.client)
    forgetAlerts()
    closed = 0
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    signOutOfDam()
  })

  const detail = () => useAssetDetailStore(pinia)
  const open = async (asset: AssetDetailItemDto | null) => {
    detail().dialog = QUEUE
    detail().setAsset(asset)
    const Widget = defineComponent({
      setup: () => () =>
        detail().dialog === QUEUE
          ? h(AssetDetailDialog, { queueKey: QUEUE, extSystem, onClose: () => closed++ })
          : null,
    })
    wrapper = mount(Widget, {
      attachTo: document.body,
      global: {
        plugins: [pinia],
        stubs: {
          AssetImage: true,
          DamAssetImageRoiSelectLazy: true,
          AssetDetailSidebarROI: true,
          AFormRemoteAutocompleteWithCached: true,
        },
      },
    })
    await flushPromises()
  }
  // The dialog is drawn into the body.
  const card = () => document.body.querySelector<HTMLElement>('.dam-image-detail')
  const inDialog = <T extends Element>(selector: string) =>
    document.body.querySelector<T>(`.dam-image-detail ${selector}`)
  const allInDialog = <T extends Element>(selector: string) =>
    Array.from(document.body.querySelectorAll<T>(`.dam-image-detail ${selector}`))
  const named = (name: string) => inDialog<HTMLButtonElement>(`button[aria-label="${name}"]`)
  const toolbar = () => inDialog<HTMLElement>('.v-toolbar')!
  const leftPane = () => inDialog<HTMLElement>('.dam-image-detail__left')
  const sidebar = () => inDialog<HTMLElement>('.dam-image-detail__sidebar')!
  const tabs = () => [!!inDialog('[data-cy="button-meta"]'), !!inDialog('[data-cy="button-focus"]')]
  const selected = () =>
    ['button-meta', 'button-focus'].map(
      (name) => inDialog(`[data-cy="${name}"]`)?.classList.contains('v-tab--selected') ?? false
    )
  const picture = () => wrapper!.findComponent(AssetImage)
  const roiEditor = () => wrapper!.findComponent(DamAssetImageRoiSelectLazy)
  const regions = () => wrapper!.findComponent(AssetDetailSidebarROI)
  const panels = () => allInDialog<HTMLElement>('.v-expansion-panel-title').map((title) => title.textContent?.trim())
  const panel = (title: string) =>
    allInDialog<HTMLElement>('.v-expansion-panel').find(
      (one) => one.querySelector('.v-expansion-panel-title')?.textContent?.trim() === title
    )!
  const saves = () => dam.sentTo('PATCH', dam.routes.bulkMetadata)
  const showRegionTab = async () => {
    inDialog<HTMLElement>('[data-cy="button-focus"]')!.click()
    await flushPromises()
  }

  it('says the source system and the title of the asset in its heading', async () => {
    await open(image())

    expect(toolbar().textContent).toContain(`${damText('asset.detail.sourceSystem')}: ${TITLE}`)
  })

  it('shows a loader while the asset is read, and the asset once it is there', async () => {
    detail().loading = true
    await open(null)
    expect(card()).not.toBeNull()
    expect(inDialog('.v-progress-circular')).not.toBeNull()
    expect(leftPane()).toBeNull()

    detail().setAsset(image())
    detail().loading = false
    await flushPromises()

    expect(leftPane()).not.toBeNull()
    expect(toolbar().textContent).toContain(TITLE)
  })

  it.each([
    ['its close button', false],
    ['the close button of its loader', true],
  ])('closes by %s: the detail is cleared and the dialog goes', async (_what, loading) => {
    detail().loading = loading
    await open(image())

    named(uiText('common.button.close'))!.click()
    await flushPromises()

    expect(closed).toBe(1)
    expect([detail().asset, detail().dialog]).toEqual([null, null])
    expect(card()).toBeNull()
  })

  it('hides its sidebar by the toggle, and shows it again', async () => {
    await open(image())
    const toggle = () => named(damText('asset.detail.toggleInfo'))!
    const shown = () => [
      card()!.classList.contains('dam-image-detail--sidebar-active'),
      toggle().classList.contains('v-btn--active'),
    ]
    expect(shown()).toEqual([true, true])

    toggle().click()
    await flushPromises()
    expect(shown()).toEqual([false, false])

    toggle().click()
    await flushPromises()
    expect(shown()).toEqual([true, true])
  })

  describe('on its left', () => {
    if (isCms) {
      it('shows the picture of the detail of an image, until the tab of the region of interest puts the editor there', async () => {
        await open(image())

        expect(tabs()).toEqual([true, true])
        expect(roiEditor().exists()).toBe(false)
        expect(leftPane()!.querySelector('asset-image-stub')).not.toBeNull()
        // The detail uses the size the picture came out in, not the requested size.
        // The upload dialog uses the requested size.
        expect(picture().props()).toMatchObject({
          src: 'https://image.test/file-1/detail.jpg',
          width: 1600,
          height: 900,
          backgroundColor: COLOUR,
          assetType: DamAssetType.Image,
          assetStatus: DamAssetStatus.WithFile,
        })

        await showRegionTab()

        expect(roiEditor().exists()).toBe(true)
        expect(picture().exists()).toBe(false)
        expect(regions().props()).toMatchObject({ isActive: true, queueKey: QUEUE })
        expect(detail().activeTab).toBe(AssetDetailTabImageWithRoi.ROI)
      })

      it.each<[string, Partial<AssetFileImage>, Record<string, unknown>]>([
        [
          'on grey, an image whose file names no dominant colour',
          { imageAttributes: { ...imageAttributes, mostDominantColor: '' } },
          { src: 'https://image.test/file-1/detail.jpg', width: 1600, height: 900, backgroundColor: '#ccc' },
        ],
        [
          '356 by 200 on grey, an image without the picture of a detail',
          { links: {} },
          { src: '', width: 356, height: 200, backgroundColor: '#ccc' },
        ],
      ])('shows %s', async (_what, fileParts, shown) => {
        await open(image({}, fileParts))

        expect(picture().props()).toMatchObject(shown)
      })
    } else {
      it('has the editor of the region of interest of an image at once, and no tabs', async () => {
        await open(image())

        expect(tabs()).toEqual([false, false])
        expect(sidebar().querySelector('.sidebar-info--no-tabs')).not.toBeNull()
        expect(roiEditor().exists()).toBe(true)
        expect(picture().exists()).toBe(false)
        expect(regions().props()).toMatchObject({ isActive: true, queueKey: QUEUE })
      })
    }

    // Unlike the upload dialog, the detail draws no upload states and no ratio of its own (design 1.10, JS8).
    // Under admin-ugc an image has the editor there, a video has the picture.
    const pictured = () => (isCms ? image() : other(DamAssetType.Video))

    it('draws the picture without the states of an upload, without a ratio of its own and not covering its box', async () => {
      await open(pictured())

      expect(picture().props()).toMatchObject({
        aspectRatio: undefined,
        cover: false,
        showUploading: false,
        showProcessing: false,
        showWaiting: false,
        showDone: false,
        useComponent: true,
      })
    })

    // Nothing overlays the picture, so it is a direct flex item of the left side.
    // A wide picture shrinks to fit (design 1.10, JS9; 2.8, the frame).
    it('puts the picture straight into the whole of its left side', async () => {
      await open(pictured())

      const area = leftPane()!.querySelector('asset-image-stub')!.parentElement!
      const side = leftPane()!.getBoundingClientRect()
      const drawnIn = area.getBoundingClientRect()
      expect(getComputedStyle(area).display).toBe('flex')
      expect([drawnIn.width, drawnIn.height]).toEqual([side.width, side.height])
      expect([side.width, side.height].every((size) => size > 0)).toBe(true)
    })

    it.each([DamAssetType.Video, DamAssetType.Audio, DamAssetType.Document])(
      'shows a placeholder of 356 by 200 on grey for an asset of the kind %s, with no tab of the region of interest',
      async (assetType) => {
        await open(other(assetType))

        expect(tabs()).toEqual([true, false])
        expect(roiEditor().exists()).toBe(false)
        expect(picture().props()).toMatchObject({
          src: '',
          width: 356,
          height: 200,
          backgroundColor: '#ccc',
          assetType,
        })
      }
    )

    // Opening a detail does not set the tab in the store.
    // A left-over ROI tab must not stay for a non-image asset: its tabs have no such tab and choose the first.
    it('shows the picture of a video, also when the tab of the region of interest was left open', async () => {
      detail().activeTab = AssetDetailTabImageWithRoi.ROI
      await open(other(DamAssetType.Video))

      expect(tabs()).toEqual([true, false])
      expect(selected()).toEqual([true, false])
      expect(panels()).toContain(damText('asset.detail.info.metadata'))
      expect(roiEditor().exists()).toBe(false)
      expect(picture().props()).toMatchObject({ src: '', width: 356, height: 200, assetType: DamAssetType.Video })
    })

    if (isCms) {
      // Opening a detail leaves the tab as it was. The upload dialog sets the info tab instead.
      it('opens an image on the tab of the region of interest when that tab was left open: the editor, and no form', async () => {
        detail().activeTab = AssetDetailTabImageWithRoi.ROI
        await open(image())

        expect(selected()).toEqual([false, true])
        expect(roiEditor().exists()).toBe(true)
        expect(picture().exists()).toBe(false)
        expect(regions().props()).toMatchObject({ isActive: true, queueKey: QUEUE })
        expect(panels()).toEqual([])
      })
    }

    // The sidebar is keyed by the asset id, so it is drawn anew for each asset.
    // Its tabs choose the first again when the new asset has no ROI tab.
    it('shows the video and its form when the asset changes to a video while the region of interest is shown', async () => {
      await open(image())
      if (isCms) await showRegionTab()
      expect(roiEditor().exists()).toBe(true)

      detail().setAsset(other(DamAssetType.Video, 2))
      await flushPromises()

      expect(roiEditor().exists()).toBe(false)
      expect(picture().props()).toMatchObject({ src: '', width: 356, height: 200, assetType: DamAssetType.Video })
      expect(tabs()).toEqual([true, false])
      expect(selected()).toEqual([true, false])
      expect(panels()).toContain(damText('asset.detail.info.metadata'))
    })
  })

  it('draws its sidebar anew when the asset changes: a panel the user closed is open again', async () => {
    await open(image())
    const metadata = () => panel(damText('asset.detail.info.metadata'))
    metadata().querySelector<HTMLElement>('.v-expansion-panel-title')!.click()
    await flushPromises()
    expect(metadata().classList.contains('v-expansion-panel--active')).toBe(false)

    detail().setAsset(image({}, {}, 2))
    await flushPromises()

    expect(metadata().classList.contains('v-expansion-panel--active')).toBe(true)
  })

  describe('its save button', () => {
    const save = () => sidebar().querySelector<HTMLButtonElement>('[data-cy="button-save"]')!
    const savedWhileTurning = async (received: (request: FakeDamRequest) => void = () => undefined) => {
      const held = dam.hold('PATCH', dam.routes.bulkMetadata)
      save().click()
      await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
      await flushPromises()
      const turning = save().classList.contains('v-btn--loading')
      received(held.waiting[0]!.request)
      held.release()
      await vi.waitFor(() => expect(shownAlerts()).not.toEqual([]))
      await flushPromises()

      return { turning, stillTurning: save().classList.contains('v-btn--loading') }
    }

    it('is "Save" in the sidebar, turns while the DAM saves the asset, and says it is saved', async () => {
      await open(image())
      expect(save().textContent?.trim()).toBe(uiText('common.button.save'))

      expect(await savedWhileTurning()).toEqual({ turning: true, stillTurning: false })

      expect(saves().map((request) => request.url)).toEqual([`${endPoints.asset}/metadata-bulk-update`])
      expect(dam.body(saves()[0]!)).toMatchObject([{ id: 'asset-1' }])
      expect(shownAlerts()).toEqual([['success', alertText('common.alert.recordWas.updated')]])
    })

    // Finding 49 (F-C): the server may still fill in the metadata of such an asset from its file.
    // A save from here would overwrite that and mark the asset described. The detail is not re-read by itself.
    describe('of an asset whose file the server has not processed yet', () => {
      const blocked = () => sidebar().querySelector<HTMLElement>('[data-cy="save-blocked"]')
      const saveOfTheSidebar = async () => {
        const setup = (
          wrapper!.findComponent(AssetDetailSidebarMetadata).vm as unknown as {
            $: { setupState: { onSave: () => Promise<void> } }
          }
        ).$.setupState
        await setup.onSave()
        await flushPromises()
      }
      const described = (asset: AssetDetailItemDto) => {
        asset.flags = { ...asset.flags, described: true }
        return asset
      }

      it.each([AssetFileProcessStatus.Uploading, AssetFileProcessStatus.Uploaded, AssetFileProcessStatus.Stored])(
        'is off, with a word why, while the asset is not described and its file is %s',
        async (status) => {
          await open(fileIn(status))

          expect(save().disabled).toBe(true)
          expect(blocked()?.textContent?.trim()).toBe(damText('queueItem.stillUploadingOrProcessing'))
          await saveOfTheSidebar()
          expect(saves()).toEqual([])
          expect(shownAlerts()).toEqual([])
        }
      )

      // Calls the save directly to show that the save itself holds back, not only the button.
      it('is sent when asked for past its button, for an asset whose file is processed', async () => {
        await open(image())

        await saveOfTheSidebar()

        expect(saves()).toHaveLength(1)
      })

      it.each<[string, () => AssetDetailItemDto]>([
        ['whose file is processed', () => image()],
        ['whose file failed', () => fileIn(AssetFileProcessStatus.Failed, AssetFileFailReason.InvalidMimeType)],
        ['whose file is a duplicate', () => fileIn(AssetFileProcessStatus.Duplicate)],
        ['without a file', () => ({ ...image(), mainFile: null })],
        ['described already, its file still stored', () => described(fileIn(AssetFileProcessStatus.Stored))],
      ])('is on, without that word, for an asset %s', async (_what, asset) => {
        await open(asset())

        expect(save().disabled).toBe(false)
        expect(blocked()).toBeNull()
      })
    })

    describe('of a detail opened from the queue of an upload', () => {
      let waits: LongWaits

      beforeEach(() => {
        answerDamNames(dam)
        waits = holdLongWaits()
      })
      afterEach(() => {
        useUploadQueuesStore(pinia).stopUpload(QUEUE)
        waits.restore()
      })

      // Finding 49 (F-C) holds here too: a row has its form and "edit asset" from the metadata notification,
      // whatever its file state, and the detail reads the asset as the DAM has it by then.
      it('has its save off, with the word why, while the file of the row is still processed', async () => {
        const uploads = useUploadQueuesStore(pinia)
        await uploads.addByFiles(
          QUEUE,
          extSystem,
          licence,
          [new File([new Uint8Array(3000)], 'photo.jpg', { type: 'image/jpeg' })],
          'default'
        )
        const row = () => uploads.getQueueItems(QUEUE)[0]!
        await vi.waitFor(() => expect(row().status).toBe(UploadQueueItemStatus.Processing))

        detail().updateUploadStore = true
        await open(structuredClone(dam.assets.get(row().assetId!)!))

        expect(save().disabled).toBe(true)
        expect(sidebar().querySelector('[data-cy="save-blocked"]')?.textContent?.trim()).toBe(
          damText('queueItem.stillUploadingOrProcessing')
        )
      })

      it('writes what it saved back into the row of the queue', async () => {
        const uploads = useUploadQueuesStore(pinia)
        await uploads.addByFiles(
          QUEUE,
          extSystem,
          licence,
          [new File([new Uint8Array(3000)], 'photo.jpg', { type: 'image/jpeg' })],
          'default'
        )
        const row = () => uploads.getQueueItems(QUEUE)[0]!
        await vi.waitFor(() => expect(row().status).toBe(UploadQueueItemStatus.Processing))
        dam.fileBecomes(row().assetId!, AssetFileProcessStatus.Processed, {
          metadata: { customData: { description: 'from the server' }, authorSuggestions: {}, keywordSuggestions: {} },
        })
        await waits.elapse()
        await vi.waitFor(() => expect(row().status).toBe(UploadQueueItemStatus.Uploaded))
        expect(row().customData).toMatchObject({ description: 'from the server' })

        detail().updateUploadStore = true
        await open(structuredClone(dam.assets.get(row().assetId!)!))
        const description = allInDialog<HTMLInputElement | HTMLTextAreaElement>('input[type="text"], textarea').find(
          (field) => field.value === 'from the server'
        )!
        description.value = 'typed in the detail'
        description.dispatchEvent(new Event('input', { bubbles: true }))
        await flushPromises()

        const kept = await savedWhileTurning((request) => {
          const [sent] = dam.body(request) as Array<{ id: string; customData: Record<string, unknown> }>
          dam.assets.get(sent!.id)!.metadata.customData = sent!.customData
        })

        expect(kept).toEqual({ turning: true, stillTurning: false })
        expect(shownAlerts()).toEqual([['success', alertText('common.alert.recordWas.updated')]])
        const afterSave = dam.requests.slice(dam.requests.indexOf(saves()[0]!) + 1)
        expect(afterSave.map((request) => `${request.method} ${request.url}`)).toContain(
          `GET ${endPoints.asset}/${row().assetId}`
        )
        expect(row().customData).toMatchObject({ description: 'typed in the detail' })
        await damNamesAsked()
      })
    })
  })

  describe('the editor of the region of interest', () => {
    const shown = async () => {
      await open(image())
      if (isCms) await showRegionTab()
      return roiEditor()
    }

    if (isCms) {
      // The admin-cms endpoint (`/adm/v1/roi`) saves a region only for a user with the grant.
      // Without it the editor only shows the image.
      it.each([
        [
          'can be edited by a user of the DAM who may update regions of interest',
          ['dam_regionOfInterest_update'],
          false,
        ],
        ['only shows the image to a user of the DAM without that grant', ['dam_image_update'], true],
      ])('%s', async (_what, grants, readonly) => {
        signInToDam(extSystem, grants)

        expect((await shown()).props('readonly')).toBe(readonly)
      })

      it('only shows the image while no user of the DAM is loaded', async () => {
        expect((await shown()).props('readonly')).toBe(true)
      })
    } else {
      // The admin-ugc endpoint (`/ugc/v1/roi`) needs no grant, and the application has no DAM user.
      it('can be edited with no user of the DAM at all', async () => {
        expect((await shown()).props('readonly')).toBe(false)
      })
    }

    it('is handed the ext system of the detail', async () => {
      expect((await shown()).props('extSystem')).toBe(extSystem)
    })
  })

  it.each<[string, AssetDetailItemDto, string[]]>([
    ['nothing of a processed file of an asset with its file', image(), []],
    [
      'that the main file is a duplicate',
      fileIn(AssetFileProcessStatus.Duplicate),
      ['asset.detail.info.status.duplicate'],
    ],
    [
      'that processing the main file failed, and why',
      fileIn(AssetFileProcessStatus.Failed, AssetFileFailReason.InvalidMimeType),
      ['asset.detail.info.status.failed', 'asset.assetFileFailReason.invalidMimeType'],
    ],
    // Finding 62: as in the queue row, no chip when there is no reason.
    [
      'that processing the main file failed, and no reason where the DAM names none',
      fileIn(AssetFileProcessStatus.Failed, AssetFileFailReason.None),
      ['asset.detail.info.status.failed'],
    ],
    [
      'that the asset has no file',
      image({ attributes: { assetType: DamAssetType.Image, assetStatus: DamAssetStatus.Draft } }),
      ['asset.detail.info.status.draft'],
    ],
    [
      'that the asset will be deleted',
      image({ attributes: { assetType: DamAssetType.Image, assetStatus: DamAssetStatus.Deleting } }),
      ['asset.detail.info.status.deleting'],
    ],
  ])('says %s', async (_what, asset, keys) => {
    await open(asset)

    const said = Array.from(sidebar().querySelectorAll<HTMLElement>('.v-alert')).map((alert) =>
      alert.textContent!.replace(/\s+/g, ' ').trim()
    )
    expect(said).toEqual(keys.length === 0 ? [] : [keys.map((key) => damText(key)).join(' ')])
  })

  if (isCms) {
    it('has the panel of the file, with the users who created and changed the asset', async () => {
      const { addManualToCachedUsers } = useDamCachedUsers()
      people.forEach(({ id, fullName }) =>
        addManualToCachedUsers({
          id,
          email: '',
          avatar: { color: '', text: '' },
          person: { firstName: '', lastName: '', fullName },
        } as unknown as DamUser)
      )
      await open(image({ createdBy: 7, modifiedBy: 8 }))

      expect(panels()).toEqual([damText('asset.detail.info.metadata'), damText('asset.detail.info.file')])
      expect(sidebar().textContent).toContain('asset-1')
      expect(sidebar().textContent).toContain('file-1')
      const chips = wrapper!.findAllComponents(ACachedUserChip)
      expect(chips.map((chip) => chip.props('id'))).toEqual([7, 8])
      expect(chips.map((chip) => chip.text())).toEqual(people.map(({ fullName }) => expect.stringContaining(fullName)))
    })

    // The card breaks a long word anywhere. The file panel of the detail breaks only between words (design 1.10, JS29).
    it('breaks the texts of the panel of the file only between words, unlike those of the metadata', async () => {
      await open(image())

      const wrapOf = (title: string) =>
        getComputedStyle(panel(title).querySelector('.v-expansion-panel-text__wrapper')!).overflowWrap
      expect([wrapOf(damText('asset.detail.info.metadata')), wrapOf(damText('asset.detail.info.file'))]).toEqual([
        'break-word',
        'normal',
      ])
    })
  } else {
    it('has no panel of the file', async () => {
      await open(image())

      expect(panels()).toEqual([damText('asset.detail.info.metadata')])
      expect(wrapper!.findAllComponents(ACachedUserChip)).toHaveLength(0)
    })
  }
})
