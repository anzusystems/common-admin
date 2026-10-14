import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { page } from 'vitest/browser'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { defineComponent, h, shallowRef } from 'vue'
import { installConsumerProfile, ugcConfiguration } from '@/domains/dam/__tests__/support/consumerProfiles'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import {
  createFakeDam,
  damAssetWithFile,
  type FakeDam,
  type FakeDamRequest,
} from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import {
  alertText,
  damText,
  forgetAlerts,
  shownAlerts,
  signOutOfDam,
  uiText,
} from '@/domains/dam/__tests__/support/uploadUi'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import AAssetListInner from '@/domains/dam/assetSelect/components/AAssetListInner.vue'
import { useSidebar } from '@/domains/dam/assetSelect/composables/assetSelectFilterSidebar'
import {
  AssetSelectGridView,
  AssetSelectGridViewDefault,
  useGridView,
} from '@/domains/dam/assetSelect/composables/assetSelectGridView'
import { useAssetSelectActions } from '@/domains/dam/assetSelect/composables/assetSelectListActions'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { UploadQueueItemStatus } from '@/domains/dam/types/UploadQueue'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { SORT_BY_SCORE_DATE } from '@/domains/filters/datatable/utils/datatableColumns'

// The list of assets of the asset page of admin-ugc and its side panel: the asset the panel shows once a detail has
// closed, whose answer a click on a tile may write, which row of the table is marked, from which page a list in
// another order is read, and what the panel says when the configuration of the custom fields cannot be read. The real
// list with its real tiles or table, its real queue dialog and the real dialog of the asset detail; the DAM is a
// client that records its requests, and only the long waits are taken out of real time. Not drawn: the bar of the
// list, the pictures, the metadata of the asset of the side panel, what the dialog of the detail frames, and the
// inputs of the filter (each is named by a stand-in).

const profile = ugcConfiguration
const { endPoints, extSystem, licence } = profile
const QUEUE = 'asset-page'
const PAGE = 25
const STAND_INS = [
  'AssetSelectListBar',
  'AssetMetadata',
  'AssetDetailDialogFrame',
  'AssetImagePreview',
  'AssetImage',
  'AssetImageMetaIcons',
  'AssetQueueSelectedSidebar',
  'AFileDropzone',
  'AFormRemoteAutocompleteWithCached',
  'AFilterString',
  'AFilterBooleanSelect',
  'AFilterTimeInterval',
  'DamKeywordFilterRemoteAutocomplete',
  'DamAuthorFilterRemoteAutocomplete',
  'DamUserFilterRemoteAutocomplete',
]
const CUSTOM_FORM = /^\/adm\/v1\/asset-custom-form\/ext-system\/(\d+)\/type\/(\w+)\/element\?/
const ACTIVE_TILE = 'asset-list-tiles__item--active'
const ACTIVE_ROW = 'asset-list-table__item--active'
const { Processing, Uploaded } = UploadQueueItemStatus

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let socket: DamSocket
let wrapper: VueWrapper | undefined
/** The page's entry of the upload, handed to its slot by the list. */
let handed: { onFileInput: (files: File[]) => void } | undefined
/** What the list answers its reads with from now on, page by page, in place of its two assets. */
let pages: string[][] | undefined
/** Whether a list says if a further page follows, as the DAM does, or how many assets there are. */
let saysIfMoreFollows: boolean

const photo = (name: string) => new File([new Uint8Array(3000)], name, { type: 'image/jpeg' })
const isListRequest = (request: FakeDamRequest) =>
  request.method === 'GET' && request.url.startsWith(`${endPoints.asset}/licence/${licence}/search?`)
const offsetOf = (request: FakeDamRequest) =>
  Number(new URL(request.url, 'https://dam.test').searchParams.get('offset'))
const inTheList = (id: string, title = `Title of ${id}`) =>
  damAssetWithFile(id, `file-of-${id}`, AssetFileProcessStatus.Processed, { licence, texts: { displayTitle: title } })

/** What the DAM answers a list request with: the page asked for. */
const listAnswer = (request: FakeDamRequest) => {
  const page = offsetOf(request) / PAGE
  const listed = pages ? (pages[page] ?? []) : ['asset-50', 'asset-51']
  const all = pages ? pages.flat() : listed
  const data = listed.map((id) => dam.assets.get(id) ?? inTheList(id))
  return {
    status: 200,
    data: saysIfMoreFollows
      ? { data, hasNextPage: !!pages && page < pages.length - 1 }
      : { data, totalCount: all.length },
  }
}

/** The paging of the asset lists is one for the page: what an earlier case left of it is not this one's. */
const pagingAsNew = () => {
  let paging!: ReturnType<typeof useAssetSelectActions>['pagination']
  const probe = mount(
    defineComponent({ setup: () => ((paging = useAssetSelectActions().pagination), () => h('div')) }),
    { global: { plugins: [pinia] } }
  )
  paging.value = {
    ...paging.value,
    page: 1,
    hasNextPage: null,
    totalCount: 0,
    sortBy: { key: SORT_BY_SCORE_DATE, order: 'desc' },
  }
  probe.unmount()
}

describe('the asset list of the asset page of admin-ugc and its side panel', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    installConsumerProfile(profile, dam.client)
    dam.assets.set('asset-50', inTheList('asset-50', 'First in the list'))
    dam.assets.set('asset-51', inTheList('asset-51', 'Second in the list'))
    pages = undefined
    saysIfMoreFollows = false
    dam.reply((request) => (isListRequest(request) ? listAnswer(request) : undefined))
    waits = holdLongWaits()
    socket = stubDamSocket()
    handed = undefined
    forgetAlerts()
    pagingAsNew()
  })
  afterEach(async () => {
    wrapper?.unmount()
    wrapper = undefined
    useSidebar().closeSidebarRight()
    useGridView().setGridView(AssetSelectGridViewDefault)
    useUploadQueueDialog().uploadQueueDialog.value = null
    useUploadQueueDialog().uploadQueueDialogSaving.value = null
    useUploadQueuesStore(pinia).stopUpload(QUEUE)
    waits.restore()
    socket.restore()
    useDamNotificationsEventBus().reset()
    signOutOfDam()
    await page.viewport(414, 896)
  })

  const detail = () => useAssetDetailStore(pinia)
  const queue = () => useUploadQueuesStore(pinia)
  const uploadConfig = () => ({
    licence,
    extSystem,
    licenceName: 'own',
    extSystemConfig: useDamConfigStore(pinia).damConfigExtSystem.get(extSystem)!,
  })
  const listRequests = () => dam.requests.filter(isListRequest)
  /** The list has asked for its assets so many times, and has the last answer. */
  const listed = async (times: number) => {
    await vi.waitFor(() => expect(listRequests()).toHaveLength(times))
    await vi.waitFor(() => expect(useAssetSelectStore(pinia).loader).toBe(false))
    await flushPromises()
  }
  /**
   * The list on a page with an upload entry of its own, as the asset page has it, over the two assets of the licence;
   * its side panel is open. `real`: what is drawn for real of what a stand-in names otherwise. `read`: whether to
   * wait until the list has asked once and has its answer.
   */
  const mountList = async (real: string[] = [], props: Record<string, unknown> = {}, read = true) => {
    wrapper = mount(AAssetListInner, {
      attachTo: document.body,
      props: {
        assetType: DamAssetType.Image,
        queueKey: QUEUE,
        selectConfigs: [uploadConfig()],
        // admin-ugc has no user of the DAM, and says so.
        skipCurrentUserCheck: true,
        ...props,
      },
      slots: {
        'upload-activator': (slotProps: never) => {
          handed = slotProps
          return h('button')
        },
      } as never,
      global: {
        plugins: [pinia],
        provide: { [ImageWidgetUploadConfigKey as symbol]: shallowRef(uploadConfig()) },
        stubs: Object.fromEntries(
          [...STAND_INS, 'AssetSelectListTable'].filter((name) => !real.includes(name)).map((name) => [name, true])
        ),
      },
    })
    await flushPromises()
    if (read) await listed(1)
    useSidebar().openSidebarRight()
    await flushPromises()
  }
  const readOf = (asset: string) => new RegExp(`^${endPoints.asset}/${asset}$`)
  const readsOf = (asset: string) => dam.sentTo('GET', readOf(asset)).length
  const tiles = () => wrapper!.findAll('.asset-list-tiles__item')
  /** The assets of the tiles, and which of the tiles is drawn as the active one. */
  const tilesDrawn = () =>
    tiles().map((tile) => [tile.find('[data-cy="asset-tile-title"]').text(), tile.classes(ACTIVE_TILE)])
  // The side panel is a column of a wide window, and a dialog of a narrow one.
  const panel = () =>
    document.body.querySelector<HTMLElement>('.subject-select__sidebar-right') ??
    Array.from(document.body.querySelectorAll<HTMLElement>('.v-overlay--active .v-card')).find((card) =>
      card.textContent?.includes(uiText('common.assetSelect.meta.info.toggle'))
    )
  const panelLoads = () => !!panel()?.querySelector('.v-progress-circular')
  const panelShowsAnAsset = () => wrapper!.findComponent({ name: 'AssetMetadata' }).exists()
  /** The first tile is clicked, and the side panel shows its asset. */
  const firstTileClicked = async () => {
    await tiles()[0]!.trigger('click')
    await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
    await flushPromises()
    expect(tilesDrawn()).toEqual([
      ['First in the list', true],
      ['Second in the list', false],
    ])
  }
  /** The user picks another order in the bar of the list, and the list has its answer: these assets from now on. */
  const sortAnew = async (...then: string[][]) => {
    if (then.length > 0) pages = then
    const listedBefore = listRequests().length
    wrapper!.findComponent({ name: 'AssetSelectListBar' }).vm.$emit('sortByChange', {
      id: 2,
      titleT: 'common.system.datatable.ordering.oldest',
      sortBy: { key: SORT_BY_SCORE_DATE, order: 'asc' },
    })
    await listed(listedBefore + 1)
  }
  const loadMore = async () => {
    const listedBefore = listRequests().length
    wrapper!
      .findAll('button')
      .find((button) => button.text() === uiText('common.button.loadMore'))!
      .element.click()
    await listed(listedBefore + 1)
  }
  /** "Edit" of the side panel: the detail of the asset the panel shows. */
  const editInPanel = async () => {
    wrapper!.findComponent({ name: 'AssetMetadata' }).vm.$emit('editInDam')
    await flushPromises()
    expect(detail().dialog).toBe(QUEUE)
  }
  /** The detail is closed with its own button: the real dialog, of which only what it frames is not drawn. */
  const closeDetail = () => wrapper!.findComponent({ name: 'AssetDetailDialogFrame' }).vm.$emit('close')
  // The queue dialog is drawn into the body.
  const queueDialog = () => document.body.querySelector<HTMLElement>('.overlay--sidebar')
  const editAssetOfRow = () =>
    Array.from(queueDialog()!.querySelectorAll<HTMLButtonElement>('.dam-upload-queue__item button')).find(
      (button) => button.textContent?.trim() === damText('image.button.editAsset')
    )!
  /** A file is uploaded through the page's entry: its row of the queue is `asset-1`, with its form. */
  const oneUploaded = async () => {
    handed!.onFileInput([photo('a.jpg')])
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
  /** "Edit asset" of the row of the queue: its detail shows the uploaded asset. */
  const detailOfTheRowOpened = async () => {
    editAssetOfRow().click()
    await vi.waitFor(() => expect([detail().dialog, detail().asset?.id]).toEqual([QUEUE, 'asset-1']))
    await flushPromises()
  }
  const failed = ['error', alertText('common.alert.unknownError')]

  // The side panel goes on showing the asset of a clicked tile when a list read anew no longer has it, with "edit"
  // beside it. The detail empties the panel as it closes, and the list read the asset again only by its active tile:
  // over such a list there is none, so the panel was left saying that no asset is picked, though it was that asset
  // that had just been edited.
  describe('shows the asset of a clicked tile again once a detail has closed over a list that no longer has it', () => {
    it('as it is by then, after the detail "edit" of the panel opened', async () => {
      await mountList()
      await firstTileClicked()
      await sortAnew(['asset-51'])
      expect(tilesDrawn()).toEqual([['Second in the list', false]])
      expect([detail().asset?.id, panelShowsAnAsset()]).toEqual(['asset-50', true])
      await editInPanel()
      // As a save of the detail leaves it in the DAM.
      dam.assets.set('asset-50', inTheList('asset-50', 'Saved in the detail'))

      closeDetail()
      await vi.waitFor(() => expect(detail().asset?.texts.displayTitle).toBe('Saved in the detail'))
      await flushPromises()

      expect([detail().dialog, panelLoads(), panelShowsAnAsset()]).toEqual([null, false, true])
      expect(readsOf('asset-50')).toBe(2)
      expect(tilesDrawn()).toEqual([['Second in the list', false]])
      expect(shownAlerts()).toEqual([])

      // Its tile is the active one again in a list that brings it back.
      await sortAnew(['asset-51', 'asset-50'])
      expect(tilesDrawn()).toEqual([
        ['Second in the list', false],
        ['Saved in the detail', true],
      ])
    })

    // The detail of a row of the queue empties the panel as well: closed, the panel shows what it showed before.
    it('after the detail of a row of the queue', async () => {
      await mountList()
      await firstTileClicked()
      await sortAnew(['asset-51'])
      await oneUploaded()
      await detailOfTheRowOpened()

      closeDetail()
      await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
      await flushPromises()

      expect([detail().dialog, panelLoads(), panelShowsAnAsset()]).toEqual([null, false, true])
      expect(readsOf('asset-50')).toBe(2)
      expect(shownAlerts()).toEqual([])
    })

    it("or says that the read failed, and stays empty: no tile is that asset's in a list read later", async () => {
      await mountList()
      await firstTileClicked()
      await sortAnew(['asset-51'])
      await editInPanel()
      dam.reply((request) =>
        request.method === 'GET' && readOf('asset-50').test(request.url) ? { status: 500 } : undefined
      )

      closeDetail()
      await vi.waitFor(() => expect(shownAlerts()).toEqual([failed]))
      await flushPromises()
      expect([detail().asset, panelLoads(), panelShowsAnAsset()]).toEqual([null, false, false])

      await sortAnew(['asset-51', 'asset-50'])
      expect(tilesDrawn()).toEqual([
        ['Second in the list', false],
        ['First in the list', false],
      ])
      expect(panelShowsAnAsset()).toBe(false)
      expect(shownAlerts()).toEqual([failed])
    })

    it('but reads nothing when no tile was clicked: the panel stays empty', async () => {
      await mountList()
      await oneUploaded()
      await detailOfTheRowOpened()
      const before = dam.requests.length

      closeDetail()
      await waits.settle()

      expect([detail().dialog, detail().asset, panelLoads(), panelShowsAnAsset()]).toEqual([null, null, false, false])
      expect(dam.requests.slice(before)).toEqual([])
    })
  })

  // The answer of a click on a tile was written into the store of the detail whenever it came, as long as no later
  // click had asked for another asset. That store is the page's, and the detail of a row of the queue shows its asset:
  // an answer that came once that detail was open put the asset of the tile into it, and its save went into that asset.
  describe('takes the answer of a clicked tile that comes once the detail of a row of the queue is open', () => {
    it.each<[string, boolean]>([
      ['shows its asset', false],
      ['is still on its loader', true],
    ])('not into that detail, which %s: it keeps the asset of the row', async (_state, onItsLoader) => {
      await mountList()
      const ofTheClick = dam.hold('GET', readOf('asset-50'))
      await tiles()[0]!.trigger('click')
      await vi.waitFor(() => expect(ofTheClick.waiting).toHaveLength(1))
      await oneUploaded()
      const ofTheRow = dam.hold('GET', readOf('asset-1'))
      editAssetOfRow().click()
      await vi.waitFor(() => expect(ofTheRow.waiting).toHaveLength(1))
      if (!onItsLoader) {
        ofTheRow.release()
        await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-1'))
      }

      ofTheClick.release()
      await waits.settle()
      expect([detail().dialog, detail().asset?.id ?? null, detail().loading]).toEqual(
        onItsLoader ? [QUEUE, null, true] : [QUEUE, 'asset-1', false]
      )
      ofTheRow.release()
      await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-1'))
      await waits.settle()
      expect([detail().dialog, detail().asset?.id, detail().loading]).toEqual([QUEUE, 'asset-1', false])

      // Closed, the detail has the list read the asset of its active tile: the panel shows the clicked asset.
      closeDetail()
      await vi.waitFor(() => expect(ofTheClick.waiting).toHaveLength(1))
      ofTheClick.release()
      await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
      await flushPromises()
      expect([detail().dialog, panelLoads(), panelShowsAnAsset()]).toEqual([null, false, true])
      expect(tilesDrawn()).toEqual([
        ['First in the list', true],
        ['Second in the list', false],
      ])
      expect(shownAlerts()).toEqual([])
    })

    // The list goes on remembering the clicked asset while that detail is open, also over a list without its tile:
    // the close of the detail has it read.
    it('and shows the clicked asset once that detail has closed, also over a list that no longer has its tile', async () => {
      await mountList()
      const ofTheClick = dam.hold('GET', readOf('asset-50'))
      await tiles()[0]!.trigger('click')
      await vi.waitFor(() => expect(ofTheClick.waiting).toHaveLength(1))
      await sortAnew(['asset-51'])
      await oneUploaded()
      const ofTheRow = dam.hold('GET', readOf('asset-1'))
      editAssetOfRow().click()
      await vi.waitFor(() => expect(ofTheRow.waiting).toHaveLength(1))

      ofTheClick.release()
      await waits.settle()
      expect([detail().dialog, detail().asset, detail().loading]).toEqual([QUEUE, null, true])
      ofTheRow.release()
      await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-1'))

      closeDetail()
      await vi.waitFor(() => expect(ofTheClick.waiting).toHaveLength(1))
      ofTheClick.release()
      await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
      await flushPromises()
      expect([panelLoads(), panelShowsAnAsset()]).toEqual([false, true])

      await sortAnew(['asset-51', 'asset-50'])
      expect(tilesDrawn()).toEqual([
        ['Second in the list', false],
        ['First in the list', true],
      ])
      expect(shownAlerts()).toEqual([])
    })
  })

  // The tiles frame the one whose asset the side panel shows. The table marked only the rows that are picked, and
  // the list of the asset page picks none: its table showed nothing of the asset of the panel.
  describe('drawn as a table', () => {
    const rows = () => wrapper!.findAll('tr.a-datatable__row')
    /** The assets of the rows, and which of the rows is drawn as the active one: framed, as the active tile is. */
    const rowsDrawn = () =>
      rows().map((row) => {
        const style = getComputedStyle(row.element)
        return [
          row.findAll('td')[2]!.text(),
          row.classes(ACTIVE_ROW) && style.outlineStyle === 'solid' && style.outlineColor === 'rgb(0, 0, 255)',
        ]
      })

    it('marks the row of the asset its side panel shows, and the mark goes with that asset through a list read anew', async () => {
      useGridView().setGridView(AssetSelectGridView.Table)
      await mountList(['AssetSelectListTable'])
      expect(rowsDrawn()).toEqual([
        ['First in the list', false],
        ['Second in the list', false],
      ])

      await rows()[0]!.trigger('click')
      await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
      await flushPromises()
      expect(rowsDrawn()).toEqual([
        ['First in the list', true],
        ['Second in the list', false],
      ])

      await sortAnew(['asset-51', 'asset-50'])
      expect(rowsDrawn()).toEqual([
        ['Second in the list', false],
        ['First in the list', true],
      ])

      await rows()[0]!.trigger('click')
      await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-51'))
      await flushPromises()
      expect(rowsDrawn()).toEqual([
        ['Second in the list', true],
        ['First in the list', false],
      ])
    })
  })

  // "Load more" moves the paging of the list on, and a search puts it back to the first page; another order did not.
  it('reads the list in another order from its first page, after "load more"', async () => {
    pages = [['asset-50', 'asset-51'], ['asset-52']]
    await mountList()
    await loadMore()
    expect(tilesDrawn().map(([title]) => title)).toEqual([
      'First in the list',
      'Second in the list',
      'Title of asset-52',
    ])

    await sortAnew()

    expect(listRequests().map(offsetOf)).toEqual([0, PAGE, 0])
    expect(tilesDrawn().map(([title]) => title)).toEqual(['First in the list', 'Second in the list'])
  })

  // The list of the asset page reads its assets again once "save and apply" of its upload has saved: from the page
  // "load more" had reached, so the uploaded asset, the first of the list, was not in it.
  it('reads the list from its first page once an upload is applied, after "load more"', async () => {
    pages = [['asset-50', 'asset-51'], ['asset-52']]
    await mountList()
    await loadMore()
    await oneUploaded()

    Array.from(queueDialog()!.querySelectorAll<HTMLButtonElement>('.v-toolbar button'))
      .find((button) =>
        [damText('upload.saveAndApply'), damText('upload.apply')].includes(button.textContent?.trim() ?? '')
      )!
      .click()
    await listed(3)

    expect(listRequests().map(offsetOf)).toEqual([0, PAGE, 0])
    expect(tilesDrawn().map(([title]) => title)).toEqual(['First in the list', 'Second in the list'])
    expect(queueDialog()).toBeNull()
  })

  // The paging of the list is one for the page, and outlived the list: mounted again (the user is back on the asset
  // page) after a list that said a further page follows, the list drew "load more" under its empty list at once,
  // and the button asked for the page after the first before the first had been asked for.
  it('asks for its first page, once, when it is mounted again after a list that had a further page', async () => {
    const isShown = (element: HTMLElement) => getComputedStyle(element).display !== 'none'
    const loadMoreButton = () =>
      wrapper!.findAll('button').find((button) => button.text() === uiText('common.button.loadMore'))!.element
    // As the DAM answers a list: with whether a further page follows.
    saysIfMoreFollows = true
    pages = [['asset-50', 'asset-51'], ['asset-52']]
    // Whatever the list asks for waits: its first page is let answer, and a further page, if the list asks for one by
    // itself as "load more" comes into view, stays on its way.
    const lists = dam.hold('GET', new RegExp(`^${endPoints.asset}/licence/${licence}/search\\?`))
    await mountList([], {}, false)
    await vi.waitFor(() => expect(lists.waiting).toHaveLength(1))
    lists.waiting[0]!.release(listAnswer(lists.waiting[0]!.request))
    await vi.waitFor(() => expect(tiles()).toHaveLength(2))
    await flushPromises()
    expect(isShown(loadMoreButton())).toBe(true)

    wrapper!.unmount()
    const before = listRequests().length
    await mountList([], {}, false)
    expect(tiles()).toHaveLength(0)
    expect(isShown(loadMoreButton())).toBe(false)

    await vi.waitFor(() => expect(listRequests().length).toBeGreaterThan(before))
    await waits.settle(300)
    expect(listRequests().slice(before).map(offsetOf)).toEqual([0])
  })

  // The form the side panel shows an asset in is drawn from the configuration of the custom fields of the ext system,
  // read when the list meets that ext system. When none of its reads answered, the panel went on loading for good.
  describe('whose side panel cannot read the configuration of the custom fields', () => {
    /** Nobody has read the configuration of the ext system yet, and the DAM answers none of its reads. */
    const configurationIsNotRead = () => {
      useDamConfigStore(pinia).damConfigAssetCustomFormElements.delete(extSystem)
      dam.reply((request) => (request.method === 'GET' && CUSTOM_FORM.test(request.url) ? { status: 500 } : undefined))
    }
    const configurationReads = () => dam.requests.filter((request) => CUSTOM_FORM.test(request.url))
    const saysItFailed = () => !!panel()?.textContent?.includes(damText('error.loadingConfig'))

    it.each<[string, number]>([
      ['a dialog of a narrow window', 414],
      ['a column of a wide window', 1400],
    ])('says so in the panel, %s, which no longer loads, and goes on showing the clicked tile', async (_as, width) => {
      await page.viewport(width, 896)
      configurationIsNotRead()
      await mountList()
      await vi.waitFor(() => expect(configurationReads()).toHaveLength(4))
      await waits.settle()

      expect([saysItFailed(), panelLoads(), panelShowsAnAsset()]).toEqual([true, false, false])

      await tiles()[0]!.trigger('click')
      await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
      await flushPromises()
      expect(tilesDrawn()).toEqual([
        ['First in the list', true],
        ['Second in the list', false],
      ])
      expect([saysItFailed(), panelLoads(), panelShowsAnAsset()]).toEqual([true, false, false])
    })

    // The list of a page with several licences can be switched to one of another ext system while the configuration
    // of the first is still being read: what that read answers says nothing of the ext system listed by then.
    it('says nothing of a read that fails for an ext system the list has left since', async () => {
      const OTHER = { licence: 200005, extSystem: 9 }
      const config = useDamConfigStore(pinia)
      config.damConfigExtSystem.set(OTHER.extSystem, config.damConfigExtSystem.get(extSystem)!)
      config.damConfigAssetCustomFormElements.set(
        OTHER.extSystem,
        config.damConfigAssetCustomFormElements.get(extSystem)!
      )
      config.damConfigAssetCustomFormElements.delete(extSystem)
      dam.reply((request) =>
        request.url.startsWith(`${endPoints.asset}/licence/${OTHER.licence}/search?`)
          ? { status: 200, data: { data: [], totalCount: 0 } }
          : undefined
      )
      const reads = dam.hold('GET', CUSTOM_FORM)
      await mountList([], {
        selectConfigs: [uploadConfig(), { ...uploadConfig(), ...OTHER, licenceName: 'other' }],
      })
      await vi.waitFor(() => expect(reads.waiting).toHaveLength(4))
      expect(panelLoads()).toBe(true)

      useAssetSelectStore(pinia).selectedLicenceId = OTHER.licence
      await flushPromises()
      expect([saysItFailed(), panelLoads()]).toEqual([false, false])
      reads.release({ status: 500 })
      await waits.settle()

      expect([saysItFailed(), panelLoads()]).toEqual([false, false])
    })

    // An ext system may have no custom field at all: each of its four reads answers with an empty list. That is its
    // configuration: the panel shows the asset in its form, which has no custom field then. The form itself is drawn
    // for real here.
    it('shows the asset in its form, without custom fields, when the ext system has none', async () => {
      useDamConfigStore(pinia).damConfigAssetCustomFormElements.delete(extSystem)
      dam.reply((request) =>
        request.method === 'GET' && CUSTOM_FORM.test(request.url)
          ? { status: 200, data: { data: [], totalCount: 0 } }
          : undefined
      )
      await mountList(['AssetMetadata'])
      await vi.waitFor(() => expect(configurationReads()).toHaveLength(4))
      await vi.waitFor(() => expect(panelLoads()).toBe(false))
      expect(saysItFailed()).toBe(false)

      await tiles()[0]!.trigger('click')
      await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
      await flushPromises()

      expect([saysItFailed(), panelLoads(), panelShowsAnAsset()]).toEqual([false, false, true])
      expect(panel()!.textContent).toContain(damText('asset.detail.info.metadata'))
      expect(panel()!.querySelectorAll('.v-expansion-panel-text .v-row')).toHaveLength(0)
      expect(useDamConfigStore(pinia).damConfigAssetCustomFormElements.get(extSystem)).toEqual({
        image: [],
        audio: [],
        video: [],
        document: [],
      })
      expect(shownAlerts()).toEqual([])
    })

    it('shows the asset as before when the configuration is there', async () => {
      await mountList()
      expect([saysItFailed(), panelLoads(), panelShowsAnAsset()]).toEqual([false, false, false])
      expect(configurationReads()).toEqual([])

      await firstTileClicked()

      expect([saysItFailed(), panelLoads(), panelShowsAnAsset()]).toEqual([false, false, true])
    })
  })
})
