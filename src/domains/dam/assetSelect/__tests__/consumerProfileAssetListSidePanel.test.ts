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

// Covers the asset page list of admin-ugc and its side panel: the asset
// shown after a detail closes, late click answers, the marked table row,
// the page used when the order changes, and the panel when the custom field configuration cannot be read.
// The list, tiles, table, queue dialog and detail dialog are real. The DAM is a recording client.
// Stand-ins: list bar, pictures, side panel metadata, detail dialog frame, filter inputs.

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
let handed: { onFileInput: (files: File[]) => void } | undefined
let pages: string[][] | undefined
let saysIfMoreFollows: boolean

const photo = (name: string) => new File([new Uint8Array(3000)], name, { type: 'image/jpeg' })
const isListRequest = (request: FakeDamRequest) =>
  request.method === 'GET' && request.url.startsWith(`${endPoints.asset}/licence/${licence}/search?`)
const offsetOf = (request: FakeDamRequest) =>
  Number(new URL(request.url, 'https://dam.test').searchParams.get('offset'))
const inTheList = (id: string, title = `Title of ${id}`) =>
  damAssetWithFile(id, `file-of-${id}`, AssetFileProcessStatus.Processed, { licence, texts: { displayTitle: title } })

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

/** The paging of the asset lists is one per page. What an earlier case left in it must not leak into this one. */
const pagingAsNew = () => {
  let paging!: ReturnType<typeof useAssetSelectActions>['pagination']
  const probe = mount(
    defineComponent({ setup: () => ((paging = useAssetSelectActions('default').pagination), () => h('div')) }),
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
  const listed = async (times: number) => {
    await vi.waitFor(() => expect(listRequests()).toHaveLength(times))
    await vi.waitFor(() => expect(useAssetSelectStore(pinia).loader).toBe(false))
    await flushPromises()
  }
  /**
   * `real`: parts drawn for real that a stand-in would otherwise replace.
   * `read`: whether to wait until the list has made its first request and has the answer.
   */
  const mountList = async (real: string[] = [], props: Record<string, unknown> = {}, read = true) => {
    wrapper = mount(AAssetListInner, {
      attachTo: document.body,
      props: {
        assetType: DamAssetType.Image,
        queueKey: QUEUE,
        selectConfigs: [uploadConfig()],
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
  const firstTileClicked = async () => {
    await tiles()[0]!.trigger('click')
    await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
    await flushPromises()
    expect(tilesDrawn()).toEqual([
      ['First in the list', true],
      ['Second in the list', false],
    ])
  }
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
  const editInPanel = async () => {
    wrapper!.findComponent({ name: 'AssetMetadata' }).vm.$emit('editInDam')
    await flushPromises()
    expect(detail().dialog).toBe(QUEUE)
  }
  const closeDetail = () => wrapper!.findComponent({ name: 'AssetDetailDialogFrame' }).vm.$emit('close')
  // The queue dialog is drawn into the body.
  const queueDialog = () => document.body.querySelector<HTMLElement>('.overlay--sidebar')
  const editAssetOfRow = () =>
    Array.from(queueDialog()!.querySelectorAll<HTMLButtonElement>('.dam-upload-queue__item button')).find(
      (button) => button.textContent?.trim() === damText('image.button.editAsset')
    )!
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
  const detailOfTheRowOpened = async () => {
    editAssetOfRow().click()
    await vi.waitFor(() => expect([detail().dialog, detail().asset?.id]).toEqual([QUEUE, 'asset-1']))
    await flushPromises()
  }
  const failed = ['error', alertText('common.alert.unknownError')]

  // The side panel keeps showing the asset of a clicked tile when a list read anew no longer has it.
  // The detail empties the panel as it closes, and the list re-read the asset only by its active tile.
  // Over such a list there is no active tile, so the panel said no asset was picked.
  describe('shows the asset of a clicked tile again once a detail has closed over a list that no longer has it', () => {
    it('as it is by then, after the detail "edit" of the panel opened', async () => {
      await mountList()
      await firstTileClicked()
      await sortAnew(['asset-51'])
      expect(tilesDrawn()).toEqual([['Second in the list', false]])
      expect([detail().asset?.id, panelShowsAnAsset()]).toEqual(['asset-50', true])
      await editInPanel()
      dam.assets.set('asset-50', inTheList('asset-50', 'Saved in the detail'))

      closeDetail()
      await vi.waitFor(() => expect(detail().asset?.texts.displayTitle).toBe('Saved in the detail'))
      await flushPromises()

      expect([detail().dialog, panelLoads(), panelShowsAnAsset()]).toEqual([null, false, true])
      expect(readsOf('asset-50')).toBe(2)
      expect(tilesDrawn()).toEqual([['Second in the list', false]])
      expect(shownAlerts()).toEqual([])

      await sortAnew(['asset-51', 'asset-50'])
      expect(tilesDrawn()).toEqual([
        ['Second in the list', false],
        ['Saved in the detail', true],
      ])
    })

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

    // A failed click read left its tile marked while the panel showed the previous asset.
    // The detail opened from the panel showed that previous asset,
    // so closing it must read the asset of the tile clicked.
    it('after a click whose read failed: the tile of the asset the panel shows is marked, and that asset is read', async () => {
      await mountList()
      await firstTileClicked()
      dam.reply((request) =>
        request.method === 'GET' && readOf('asset-51').test(request.url) ? { status: 500 } : undefined
      )
      await tiles()[1]!.trigger('click')
      await vi.waitFor(() => expect(shownAlerts()).toEqual([failed]))
      await flushPromises()
      expect([detail().asset?.id, panelShowsAnAsset()]).toEqual(['asset-50', true])
      expect(tilesDrawn()).toEqual([
        ['First in the list', true],
        ['Second in the list', false],
      ])

      await editInPanel()
      closeDetail()
      await vi.waitFor(() => expect(readsOf('asset-50')).toBe(2))
      await vi.waitFor(() => expect(detail().asset?.id).toBe('asset-50'))
      await flushPromises()

      expect(readsOf('asset-51')).toBe(1)
      expect(tilesDrawn()).toEqual([
        ['First in the list', true],
        ['Second in the list', false],
      ])
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

  // The answer of a tile click was written into the detail store
  // whenever it arrived, if no later click had asked for another asset.
  // That store is shared by the page. If the answer arrived while a queue row detail was
  // open, the tile asset replaced the row asset and its save went to the wrong asset.
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

  // Tiles frame the tile whose asset the side panel shows.
  // The table marked only picked rows, and the asset page list
  // picks none, so its table showed nothing for the panel asset.
  describe('drawn as a table', () => {
    const rows = () => wrapper!.findAll('tr.a-datatable__row')
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

  // "Load more" advances the paging and a search resets it to the first page. Changing the order did not reset it.
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

  // After "save and apply" of an upload, the list was re-read from the page "load more" had reached,
  // so the uploaded asset, first in the list, was missing.
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

  // The paging is shared by the page and outlived the list.
  // Mounted again after a list that had a further page, the list drew "load more" under its empty list,
  // and the button requested the second page before the first.
  it('asks for its first page, once, when it is mounted again after a list that had a further page', async () => {
    const isShown = (element: HTMLElement) => getComputedStyle(element).display !== 'none'
    const loadMoreButton = () =>
      wrapper!.findAll('button').find((button) => button.text() === uiText('common.button.loadMore'))!.element
    saysIfMoreFollows = true
    pages = [['asset-50', 'asset-51'], ['asset-52']]
    // Every list request is held. The first page is released,
    // and a further page, requested automatically when "load more" comes into view, stays pending.
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

  // The side panel form is drawn from the custom field configuration
  // of the ext system, read when the list meets that ext system.
  // When none of the reads answered, the panel loaded forever.
  describe('whose side panel cannot read the configuration of the custom fields', () => {
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

    // A page with several licences can switch to another ext system
    // while the configuration of the first is still loading.
    // The result of that read must not affect the ext system listed by then.
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

    // An ext system may have no custom fields: all four reads answer with an empty list.
    // That is a valid configuration, and the panel shows the asset in a form without custom fields.
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
