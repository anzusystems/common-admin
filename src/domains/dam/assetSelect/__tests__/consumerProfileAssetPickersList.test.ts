import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h } from 'vue'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import {
  createFakeDam,
  damAssetWithFile,
  type FakeDam,
  type FakeDamRequest,
} from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import {
  damText,
  forgetAlerts,
  shownAlerts,
  signInToDam,
  signOutOfDam,
  uiText,
} from '@/domains/dam/__tests__/support/uploadUi'
import AAssetSelect from '@/domains/dam/assetSelect/components/AAssetSelect.vue'
import AAssetSelectMedia from '@/domains/dam/assetSelect/components/AAssetSelectMedia.vue'
import { useSidebar } from '@/domains/dam/assetSelect/composables/assetSelectFilterSidebar'
import { useAssetSelectActions } from '@/domains/dam/assetSelect/composables/assetSelectListActions'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { DamAssetStatus, DamAssetType, type DamAssetTypeType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { SORT_BY_SCORE_DATE } from '@/domains/filters/datatable/utils/datatableColumns'

// Covers the two asset pickers of the image widgets as admin-cms opens
// them: which tiles are drawn as picked after the list is read anew,
// the page used when the order or type changes, and the side panel when the custom field configuration cannot be read.
// The pickers, bar, tiles and filter are real. The DAM is a recording client.
// Stand-ins: pictures, table, side panel metadata, filter inputs.

const { endPoints, extSystem, licence } = cmsConfiguration
const STAND_INS = [
  'VImg',
  'AssetImagePreview',
  'AssetSelectListTable',
  'AssetMetadata',
  'AFilterString',
  'AFilterBooleanSelect',
  'AFilterTimeInterval',
  'DamKeywordFilterRemoteAutocomplete',
  'DamAuthorFilterRemoteAutocomplete',
  'DamUserFilterRemoteAutocomplete',
]
const PAGE = 25
const CUSTOM_FORM = /^\/adm\/v1\/asset-custom-form\/ext-system\/(\d+)\/type\/(\w+)\/element\?/
const PICKED = 'asset-list-tiles__item--selected'

let pinia: Pinia
let dam: FakeDam
let waits: LongWaits
let wrapper: VueWrapper | undefined
let pagesOf: Partial<Record<DamAssetTypeType, string[][]>>
let saysIfMoreFollows: boolean

const isListRequest = (request: FakeDamRequest) =>
  request.method === 'GET' && request.url.startsWith(`${endPoints.asset}/licence/${licence}/search?`)
const LIST = new RegExp(`^${endPoints.asset}/licence/${licence}/search\\?`)
const typeOf = (request: FakeDamRequest) => request.url.match(/type\]?=(\w+)/)?.[1] as DamAssetTypeType
const offsetOf = (request: FakeDamRequest) =>
  Number(new URL(request.url, 'https://dam.test').searchParams.get('offset'))
const ofType = (id: string) =>
  damAssetWithFile(id, `file-of-${id}`, AssetFileProcessStatus.Processed, {
    licence,
    texts: { displayTitle: id },
    attributes: {
      assetType: id.startsWith('video') ? DamAssetType.Video : DamAssetType.Image,
      assetStatus: DamAssetStatus.WithFile,
    },
  })

const listAnswer = (request: FakeDamRequest) => {
  const pages = pagesOf[typeOf(request)] ?? []
  const page = offsetOf(request) / PAGE
  const data = (pages[page] ?? []).map((id) => ofType(id))
  return {
    status: 200,
    data: saysIfMoreFollows
      ? { data, hasNextPage: page < pages.length - 1 }
      : { data, totalCount: pages.flat().length },
  }
}

/**
 * The paging of the asset lists is one per page. What an earlier case left in it must not leak into this one.
 */
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

const pickers: Array<[string, Component, Record<string, unknown>]> = [
  ['the picker of the image widget', AAssetSelect, { assetType: DamAssetType.Image }],
  ['the picker of the image and media widget', AAssetSelectMedia, {}],
]

describe('the list of the asset pickers of admin-cms', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    installConsumerProfile(cmsConfiguration, dam.client)
    answerDamNames(dam)
    pagesOf = {}
    saysIfMoreFollows = false
    dam.reply((request) => (isListRequest(request) ? listAnswer(request) : undefined))
    dam.reply((request) => {
      const one = request.method === 'GET' ? request.url.match(dam.routes.one) : null
      return one && /^(image|video)-/.test(one[1]!) ? { status: 200, data: ofType(one[1]!) } : undefined
    })
    waits = holdLongWaits()
    forgetAlerts()
    signInToDam(extSystem)
    pagingAsNew()
  })
  afterEach(async () => {
    wrapper?.unmount()
    wrapper = undefined
    useSidebar().closeSidebarRight()
    await damNamesAsked()
    waits.restore()
    signOutOfDam()
  })

  const mountPicker = async (component: Component, props: Record<string, unknown> = {}) => {
    const mounted: VueWrapper = mount(component, {
      attachTo: document.body,
      props: {
        modelValue: false,
        'onUpdate:modelValue': (value: boolean) => mounted.setProps({ modelValue: value }),
        minCount: 1,
        maxCount: 3,
        selectLicences: [licence],
        uploadLicence: licence,
        returnType: 'asset',
        ...props,
      } as never,
      global: {
        plugins: [pinia],
        stubs: Object.fromEntries(STAND_INS.map((name) => [name, true])),
      },
    })
    wrapper = mounted
    await flushPromises()
    return mounted
  }
  const listRequests = () => dam.requests.filter(isListRequest)
  const listed = async (times: number) => {
    await vi.waitFor(() => expect(listRequests()).toHaveLength(times))
    await vi.waitFor(() => expect(useAssetSelectStore(pinia).loader).toBe(false))
    await flushPromises()
  }
  const openPicker = async (component: Component, props: Record<string, unknown> = {}) => {
    const mounted = await mountPicker(component, props)
    await mounted.setProps({ modelValue: true })
    await listed(1)
    return mounted
  }
  // The dialog of the picker is drawn into the body.
  const picker = () => document.body.querySelector<HTMLElement>('.subject-select__card')!
  const tiles = () => Array.from(document.body.querySelectorAll<HTMLElement>('.asset-list-tiles__item'))
  const tilesDrawn = () =>
    tiles().map((tile) => [
      tile.querySelector('[data-cy="asset-tile-title"]')!.textContent!.trim(),
      tile.classList.contains(PICKED) && !!tile.querySelector('.asset-list-tiles__selected-triangle'),
    ])
  const tileOf = (id: string) =>
    tiles().find((tile) => tile.querySelector('[data-cy="asset-tile-title"]')!.textContent!.trim() === id)!
  const clickTile = async (id: string) => {
    tileOf(id).click()
    await flushPromises()
  }
  const buttonOfPicker = (text: string) =>
    Array.from(picker().querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === text
    )!
  const loadMoreButton = () => buttonOfPicker(uiText('common.button.loadMore'))
  const loadMore = async () => {
    const listedBefore = listRequests().length
    loadMoreButton().click()
    await listed(listedBefore + 1)
  }
  const pickAnotherOrder = () =>
    wrapper!.findComponent({ name: 'AssetSelectListBar' }).vm.$emit('sortByChange', {
      id: 2,
      titleT: 'common.system.datatable.ordering.oldest',
      sortBy: { key: SORT_BY_SCORE_DATE, order: 'asc' },
    })
  const sortAnew = async () => {
    const listedBefore = listRequests().length
    pickAnotherOrder()
    await listed(listedBefore + 1)
  }
  const searchAnew = async () => {
    const listedBefore = listRequests().length
    wrapper!.findComponent({ name: 'AFilterWrapperSubjectSelect' }).vm.$emit('submit')
    await listed(listedBefore + 1)
  }
  const typeButton = (type: 'image' | 'video') =>
    document.body.querySelector<HTMLButtonElement>(`[data-cy="button-${type}-types"]`)!
  const says = (selected: number, maxCount = 3) =>
    picker().textContent!.includes(
      uiText('common.assetSelect.meta.texts.pickRangeCount', { minCount: 1, maxCount, selected })
    )
  const confirm = async () => {
    buttonOfPicker(uiText('common.button.confirm')).click()
    await flushPromises()
  }
  const handedOver = (mounted: VueWrapper) =>
    (mounted.emitted('confirm') ?? []).map(([data]) =>
      (data as { value: Array<{ id: string }> }).value.map((asset) => asset.id)
    )
  const panel = () => document.body.querySelector<HTMLElement>('.subject-select__sidebar-right')!
  const panelLoads = () => !!panel().querySelector('.v-progress-circular')
  const panelShowsAnAsset = () => wrapper!.findComponent({ name: 'AssetMetadata' }).exists()

  // Picked assets are kept beside the list and outlive it. The
  // count under the list and what "confirm" hands over go by them.
  // A list read anew drew none of its tiles as picked. A click on a picked
  // asset's tile then only restored the mark, and a second click removed it.
  // At the full count no tile took a click, so nothing could be removed.
  describe('draws the tile of a picked asset as picked', () => {
    it.each<[string, Component, Record<string, unknown>, () => Promise<void>]>([
      [`${pickers[0]![0]}: after another order`, pickers[0]![1], pickers[0]![2], sortAnew],
      [`${pickers[0]![0]}: after a search`, pickers[0]![1], pickers[0]![2], searchAnew],
      [`${pickers[1]![0]}: after another order`, pickers[1]![1], pickers[1]![2], sortAnew],
    ])(
      '%s, and one click on it takes the asset out of what "confirm" hands over',
      async (_name, component, props, readAnew) => {
        pagesOf.image = [['image-1', 'image-2', 'image-3']]
        const mounted = await openPicker(component, props)
        await clickTile('image-1')
        await clickTile('image-3')
        expect(tilesDrawn()).toEqual([
          ['image-1', true],
          ['image-2', false],
          ['image-3', true],
        ])
        expect(says(2)).toBe(true)
        pagesOf.image = [['image-3', 'image-2', 'image-1']]

        await readAnew()

        expect(tilesDrawn()).toEqual([
          ['image-3', true],
          ['image-2', false],
          ['image-1', true],
        ])
        expect(says(2)).toBe(true)

        await clickTile('image-3')
        expect(tilesDrawn()).toEqual([
          ['image-3', false],
          ['image-2', false],
          ['image-1', true],
        ])
        expect(says(1)).toBe(true)

        await confirm()
        expect(handedOver(mounted)).toEqual([['image-1']])
      }
    )

    it('when a further page of a list read anew brings it', async () => {
      pagesOf.image = [['image-1', 'image-2']]
      await openPicker(AAssetSelect, { assetType: DamAssetType.Image })
      await clickTile('image-1')
      pagesOf.image = [['image-2'], ['image-1', 'image-3']]

      await sortAnew()
      expect(tilesDrawn()).toEqual([['image-2', false]])
      expect(says(1)).toBe(true)
      await loadMore()

      expect(tilesDrawn()).toEqual([
        ['image-2', false],
        ['image-1', true],
        ['image-3', false],
      ])
    })

    // A gallery picker takes up to a maximum count. At that count a tile that is not picked takes no click.
    it('at the full count too: a click takes it out, and another asset can be picked in its place', async () => {
      pagesOf.image = [['image-1', 'image-2', 'image-3']]
      const mounted = await openPicker(AAssetSelect, { assetType: DamAssetType.Image, maxCount: 2 })
      await clickTile('image-1')
      await clickTile('image-2')
      expect(says(2, 2)).toBe(true)

      await sortAnew()
      await clickTile('image-3')
      expect(tilesDrawn()).toEqual([
        ['image-1', true],
        ['image-2', true],
        ['image-3', false],
      ])

      await clickTile('image-1')
      expect(says(1, 2)).toBe(true)
      await clickTile('image-3')

      expect(tilesDrawn()).toEqual([
        ['image-1', false],
        ['image-2', true],
        ['image-3', true],
      ])
      expect(says(2, 2)).toBe(true)
      await confirm()
      expect(handedOver(mounted)).toEqual([['image-2', 'image-3']])
    })

    it('and no tile of a list read anew when nothing is picked', async () => {
      pagesOf.image = [['image-1', 'image-2']]
      await openPicker(AAssetSelect, { assetType: DamAssetType.Image })
      await clickTile('image-1')
      await clickTile('image-1')
      expect(says(0)).toBe(true)

      await sortAnew()

      expect(tilesDrawn()).toEqual([
        ['image-1', false],
        ['image-2', false],
      ])
    })
  })

  // "Load more" advances the paging, and a search or filter reset returns to the first page.
  // Changing the order, or the type in the picker with media, did not.
  // The list read anew started at the page the old one had reached,
  // missing its first assets, and a type with fewer assets showed none.
  describe('reads its list from the first page', () => {
    const isShown = (element: HTMLElement) => getComputedStyle(element).display !== 'none'
    const listIsRead = () => vi.waitFor(() => expect(useAssetSelectStore(pinia).loader).toBe(false))
    const openWithAFurtherPage = async (component: Component, props: Record<string, unknown> = {}) => {
      saysIfMoreFollows = true
      pagesOf.image = [['image-1', 'image-2'], ['image-3'], ['image-4']]
      const mounted = await mountPicker(component, props)
      await mounted.setProps({ modelValue: true })
      await vi.waitFor(() => expect(tilesDrawn().length).toBeGreaterThanOrEqual(2))
      await listIsRead()
      if (tilesDrawn().length < 3) loadMoreButton().click()
      await vi.waitFor(() => expect(tilesDrawn().length).toBeGreaterThanOrEqual(3))
      await listIsRead()
      await flushPromises()
      return mounted
    }

    it.each(pickers)('%s: in another order, after "load more"', async (_name, component, props) => {
      pagesOf.image = [['image-1', 'image-2'], ['image-3']]
      await openPicker(component, props)
      await loadMore()
      expect(tilesDrawn().map(([id]) => id)).toEqual(['image-1', 'image-2', 'image-3'])

      await sortAnew()

      expect(listRequests().map(offsetOf)).toEqual([0, PAGE, 0])
      expect(tilesDrawn().map(([id]) => id)).toEqual(['image-1', 'image-2'])
    })

    describe('the picker of the image and media widget, switched to another type', () => {
      beforeEach(() => {
        pagesOf.image = [['image-1', 'image-2'], ['image-3'], ['image-4']]
        pagesOf.video = [['video-1']]
      })
      const openOnImagesWithAFurtherPage = () => openWithAFurtherPage(AAssetSelectMedia)

      it('after "load more": the list of that type is asked for once, from its first page', async () => {
        await openOnImagesWithAFurtherPage()
        const before = listRequests().length

        typeButton('video').click()
        await vi.waitFor(() => expect(tilesDrawn()).toEqual([['video-1', false]]))
        await waits.settle(300)

        expect(
          listRequests()
            .slice(before)
            .map((request) => [typeOf(request), offsetOf(request)])
        ).toEqual([[DamAssetType.Video, 0]])
        expect(shownAlerts()).toEqual([])
      })

      // The rows go at the switch and "load more" under them comes into view.
      // Left there, it requests the page after the first of the new type before the first page was requested.
      it('offers no "load more" under the emptied list, and asks for the first page of that type first', async () => {
        pagesOf.video = [['video-1'], ['video-2']]
        await openOnImagesWithAFurtherPage()
        expect(isShown(loadMoreButton())).toBe(true)
        const lists = dam.hold('GET', LIST)

        typeButton('video').click()
        await flushPromises()
        expect(tilesDrawn()).toEqual([])
        expect(isShown(loadMoreButton())).toBe(false)

        await vi.waitFor(() => expect(lists.waiting.length).toBeGreaterThanOrEqual(1))
        expect([typeOf(lists.waiting[0]!.request), offsetOf(lists.waiting[0]!.request)]).toEqual([
          DamAssetType.Video,
          0,
        ])
        lists.waiting[0]!.release(listAnswer(lists.waiting[0]!.request))
        await vi.waitFor(() => expect(tilesDrawn()[0]).toEqual(['video-1', false]))
        await flushPromises()
        expect(isShown(loadMoreButton())).toBe(true)
      })

      // The request of the list left was cancelled only when the next one went out, after a pause.
      // An answer arriving within that pause put its rows into the list that had just been emptied.
      it.each<[string, boolean]>([
        ['a further page', true],
        ['the first page', false],
      ])(
        'gives up %s of the type left that is on its way: its rows do not come into the emptied list',
        async (_which, further) => {
          const mounted = await mountPicker(AAssetSelectMedia)
          const lists = further ? undefined : dam.hold('GET', LIST)
          await mounted.setProps({ modelValue: true })
          if (further) await listed(1)
          const held = lists ?? dam.hold('GET', LIST)
          if (further) loadMoreButton().click()
          await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
          expect(typeOf(held.waiting[0]!.request)).toBe(DamAssetType.Image)

          typeButton('video').click()
          await flushPromises()
          expect(tilesDrawn()).toEqual([])
          held.waiting
            .filter(({ request }) => typeOf(request) === DamAssetType.Image)
            .forEach((one) => one.release(listAnswer(one.request)))
          await waits.settle()
          expect(tilesDrawn()).toEqual([])

          await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
          expect([typeOf(held.waiting[0]!.request), offsetOf(held.waiting[0]!.request)]).toEqual([
            DamAssetType.Video,
            0,
          ])
          held.waiting[0]!.release(listAnswer(held.waiting[0]!.request))
          await vi.waitFor(() => expect(tilesDrawn()).toEqual([['video-1', false]]))
          expect(shownAlerts()).toEqual([])
        }
      )
    })

    // "Load more" is shown while the list says a further page follows,
    // and it loads that page itself when it scrolls into view.
    // That state outlived the list. A list that had just begun (new order, search,
    // picker reopened) showed the button before its first page was requested.
    // The button then asked for the page after the first, and the list began with its second page.
    describe('and offers no "load more" until the first page of a list that has just begun is asked for', () => {
      const image = { assetType: DamAssetType.Image }
      const submitSearch = () => wrapper!.findComponent({ name: 'AFilterWrapperSubjectSelect' }).vm.$emit('submit')

      it.each<[string, () => void]>([
        ['another order is picked', pickAnotherOrder],
        ['a search is submitted', submitSearch],
      ])(
        'once %s: the button only spins, a further page of the list left is no longer waited for, and the first page is asked for',
        async (_how, begin) => {
          await openWithAFurtherPage(AAssetSelect, image)
          expect(isShown(loadMoreButton())).toBe(true)
          const lists = dam.hold('GET', LIST)
          loadMoreButton().click()
          await vi.waitFor(() => expect(lists.waiting).toHaveLength(1))
          const before = listRequests().length
          const shownBefore = tilesDrawn()

          begin()
          await flushPromises()
          // The old list stays shown until the new one arrives. The loader
          // stays on meanwhile: the button spins and a press requests nothing.
          // Before the fix, the button and the loader disappeared until the new list was requested.
          expect(lists.waiting).toEqual([])
          expect([isShown(loadMoreButton()), loadMoreButton().classList.contains('v-btn--loading')]).toEqual([
            true,
            true,
          ])
          loadMoreButton().click()
          await flushPromises()
          expect(tilesDrawn()).toEqual(shownBefore)

          await vi.waitFor(() => expect(lists.waiting).toHaveLength(1))
          expect(listRequests().slice(before).map(offsetOf)).toEqual([0])
          lists.waiting[0]!.release(listAnswer(lists.waiting[0]!.request))
          await vi.waitFor(() => expect(tilesDrawn().map(([id]) => id)).toEqual(['image-1', 'image-2']))
          await flushPromises()
          expect(isShown(loadMoreButton())).toBe(true)
          expect(shownAlerts()).toEqual([])
        }
      )

      it('when the picker is opened again after a list that had a further page: its first page is asked for, once', async () => {
        const mounted = await openWithAFurtherPage(AAssetSelect, image)
        expect(isShown(loadMoreButton())).toBe(true)
        picker().querySelector<HTMLButtonElement>('[data-cy="button-close"]')!.click()
        await vi.waitFor(() => expect(document.body.querySelector('.subject-select__card')).toBeNull())
        const before = listRequests().length
        const lists = dam.hold('GET', LIST)

        await mounted.setProps({ modelValue: true })
        await flushPromises()
        expect(tilesDrawn()).toEqual([])
        expect(isShown(loadMoreButton())).toBe(false)

        await vi.waitFor(() => expect(lists.waiting.length).toBeGreaterThanOrEqual(1))
        await waits.settle(300)
        expect(listRequests().slice(before).map(offsetOf)).toEqual([0])
        lists.waiting[0]!.release(listAnswer(lists.waiting[0]!.request))
        await vi.waitFor(() => expect(tilesDrawn().map(([id]) => id)).toEqual(['image-1', 'image-2']))
        expect(shownAlerts()).toEqual([])
      })

      // The list request of a closed picker is cancelled.
      // Otherwise its answer reached the next picker opened, before that one had read its own list.
      it('when the picker is closed while its list is on its way: that request is given up, and the picker opened next shows only its own list', async () => {
        pagesOf.image = [['image-1', 'image-2']]
        const mounted = await mountPicker(AAssetSelect, image)
        const lists = dam.hold('GET', LIST)
        await mounted.setProps({ modelValue: true })
        await vi.waitFor(() => expect(lists.waiting).toHaveLength(1))

        picker().querySelector<HTMLButtonElement>('[data-cy="button-close"]')!.click()
        await vi.waitFor(() => expect(document.body.querySelector('.subject-select__card')).toBeNull())
        expect(lists.waiting).toEqual([])

        await mounted.setProps({ modelValue: true })
        await flushPromises()
        expect(tilesDrawn()).toEqual([])
        await vi.waitFor(() => expect(lists.waiting).toHaveLength(1))
        lists.waiting[0]!.release(listAnswer(lists.waiting[0]!.request))
        await vi.waitFor(() => expect(tilesDrawn().map(([id]) => id)).toEqual(['image-1', 'image-2']))
        expect(listRequests().map(offsetOf)).toEqual([0, 0])
        expect(shownAlerts()).toEqual([])
      })

      it('and reads the first page of that list also when a further page was asked for during the pause before it', async () => {
        pagesOf.image = [['image-1', 'image-2'], ['image-3']]
        await openPicker(AAssetSelect, image)
        const before = listRequests().length

        pickAnotherOrder()
        loadMoreButton().click()
        await vi.waitFor(() => expect(tilesDrawn().map(([id]) => id)).toEqual(['image-1', 'image-2']))
        await waits.settle(300)

        expect(listRequests().slice(before).map(offsetOf).at(-1)).toBe(0)
        expect(tilesDrawn().map(([id]) => id)).toEqual(['image-1', 'image-2'])
      })
    })
  })

  // The form the side panel shows an asset in is built from the custom field
  // configuration of the ext system, read when the picker first meets that ext system.
  // When none of the reads answered, the panel kept loading forever.
  describe('whose side panel cannot read the configuration of the custom fields', () => {
    const element = (property: string) => ({
      id: `element-${property}`,
      property,
      name: property,
      position: 1,
      attributes: {
        type: 'string',
        minValue: null,
        maxValue: 255,
        minCount: null,
        maxCount: null,
        required: false,
        searchable: false,
        readonly: false,
      },
    })
    const configurationIsRead = (answer: (type: string) => { status: number; data?: unknown }) => {
      useDamConfigStore(pinia).damConfigAssetCustomFormElements.delete(extSystem)
      dam.reply((request) => {
        const read = request.method === 'GET' ? request.url.match(CUSTOM_FORM) : null
        return read ? answer(read[2]!) : undefined
      })
    }
    const configurationReads = () => dam.requests.filter((request) => CUSTOM_FORM.test(request.url))
    const saysItFailed = () => panel().textContent!.includes(damText('error.loadingConfig'))

    it.each(pickers)(
      '%s says so in the panel, which no longer loads, and goes on picking',
      async (_name, component, props) => {
        configurationIsRead(() => ({ status: 500 }))
        pagesOf.image = [['image-1', 'image-2']]
        const mounted = await openPicker(component, props)
        await vi.waitFor(() => expect(configurationReads()).toHaveLength(4))
        await waits.settle()

        expect([saysItFailed(), panelLoads(), panelShowsAnAsset()]).toEqual([true, false, false])
        expect(shownAlerts()).toEqual([])

        await clickTile('image-2')
        await waits.settle()
        expect(tilesDrawn()).toEqual([
          ['image-1', false],
          ['image-2', true],
        ])
        expect([saysItFailed(), panelLoads(), panelShowsAnAsset()]).toEqual([true, false, false])

        await confirm()
        expect(handedOver(mounted)).toEqual([['image-2']])
      }
    )

    // An ext system may have no custom fields: its four reads each answer with an empty list.
    // That is a valid configuration, not a failure. The panel shows the asset without custom fields.
    it.each(pickers)(
      '%s shows the asset, and says nothing of the configuration, when the ext system has no custom field',
      async (_name, component, props) => {
        configurationIsRead(() => ({ status: 200, data: { data: [], totalCount: 0 } }))
        pagesOf.image = [['image-1']]
        await openPicker(component, props)
        await vi.waitFor(() => expect(configurationReads()).toHaveLength(4))
        await vi.waitFor(() => expect(panelLoads()).toBe(false))

        expect(saysItFailed()).toBe(false)
        expect(panel().textContent).toContain(uiText('common.assetSelect.meta.info.noAssetSelected'))

        await clickTile('image-1')
        await vi.waitFor(() => expect(panelShowsAnAsset()).toBe(true))
        expect([saysItFailed(), panelLoads()]).toEqual([false, false])
        expect(shownAlerts()).toEqual([])
      }
    )

    it.each(pickers)(
      '%s shows the asset as before when the configuration is read, also with a type of it missing',
      async (_name, component, props) => {
        configurationIsRead((type) =>
          type === DamAssetType.Document
            ? { status: 500 }
            : { status: 200, data: { data: [element('title')], totalCount: 1 } }
        )
        pagesOf.image = [['image-1']]
        await openPicker(component, props)
        await vi.waitFor(() => expect(configurationReads()).toHaveLength(4))
        await vi.waitFor(() => expect(panelLoads()).toBe(false))

        expect(saysItFailed()).toBe(false)
        expect(panel().textContent).toContain(uiText('common.assetSelect.meta.info.noAssetSelected'))

        await clickTile('image-1')
        await vi.waitFor(() => expect(panelShowsAnAsset()).toBe(true))
        expect([saysItFailed(), panelLoads()]).toEqual([false, false])
      }
    )
  })
})
