import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h, shallowRef } from 'vue'
import {
  cmsConfiguration,
  type ConsumerProfile,
  installConsumerProfile,
  ugcConfiguration,
} from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { type DamSocket, stubDamSocket } from '@/domains/dam/__tests__/support/damSocket'
import {
  createFakeDam,
  damAssetWithFile,
  type FakeDam,
  type FakeDamRequest,
} from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { forgetAlerts, shownAlerts, signInToDam, signOutOfDam, uiText } from '@/domains/dam/__tests__/support/uploadUi'
import AAssetListInner from '@/domains/dam/assetSelect/components/AAssetListInner.vue'
import AAssetSelect from '@/domains/dam/assetSelect/components/AAssetSelect.vue'
import AAssetSelectMedia from '@/domains/dam/assetSelect/components/AAssetSelectMedia.vue'
import { useSidebar } from '@/domains/dam/assetSelect/composables/assetSelectFilterSidebar'
import { useAssetSelectActions } from '@/domains/dam/assetSelect/composables/assetSelectListActions'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { SORT_BY_SCORE_DATE } from '@/domains/filters/datatable/utils/datatableColumns'
// Not applied by importing it: each case puts it in the page, and takes it out.
import libraryStyle from '@/styles/main.scss?inline'

// "Load more" asks for the further page by itself when it comes into view. Its
// directive tells it again each time the list redraws while the button is in view.
// A further page that failed while the button was in view used to be requested
// again at once, with an error each time, until the button was scrolled away.
// Real lists, tiles and button are used. The DAM is a recording client that answers from a list of pages.
// The library style lays the list out. Pictures, table, side panel metadata and filter inputs are not drawn.

const PAGE = 25
const STAND_INS = [
  'VImg',
  'AssetImagePreview',
  'AssetImage',
  'AssetImageMetaIcons',
  'AssetSelectListTable',
  'AssetMetadata',
  'AssetQueueSelectedSidebar',
  'AFileDropzone',
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
let style: HTMLStyleElement
let wrapper: VueWrapper | undefined
let pages: string[][]
let furtherPagesFail: boolean

const offsetOf = (request: FakeDamRequest) =>
  Number(new URL(request.url, 'https://dam.test').searchParams.get('offset'))
const ids = (prefix: string, count: number) => Array.from({ length: count }, (_, index) => `${prefix}-${index + 1}`)

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

type Lists = Array<[string, ConsumerProfile, Component | 'list', Record<string, unknown>]>
const lists: Lists = [
  ['the picker of the image widget of admin-cms', cmsConfiguration, AAssetSelect, { assetType: DamAssetType.Image }],
  ['the picker of the image and media widget of admin-cms', cmsConfiguration, AAssetSelectMedia, {}],
  ['the asset list of admin-ugc', ugcConfiguration, 'list', {}],
]

describe.each(lists)('"load more" under %s', (_name, profile, component, props) => {
  const { endPoints, extSystem, licence } = profile
  const isListRequest = (request: FakeDamRequest) =>
    request.method === 'GET' && request.url.startsWith(`${endPoints.asset}/licence/${licence}/search?`)
  const listed = (id: string) =>
    damAssetWithFile(id, `file-of-${id}`, AssetFileProcessStatus.Processed, { licence, texts: { displayTitle: id } })

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    dam = createFakeDam(endPoints)
    installConsumerProfile(profile, dam.client)
    answerDamNames(dam)
    pages = [['image-1', 'image-2'], ['image-3']]
    furtherPagesFail = true
    dam.reply((request) => {
      if (!isListRequest(request)) return undefined
      const page = offsetOf(request) / PAGE
      if (page > 0 && furtherPagesFail) return { status: 500 }
      return {
        status: 200,
        data: { data: (pages[page] ?? []).map(listed), hasNextPage: page < pages.length - 1 },
      }
    })
    waits = holdLongWaits()
    socket = stubDamSocket()
    forgetAlerts()
    if (component !== 'list') signInToDam(extSystem)
    pagingAsNew()
    style = document.createElement('style')
    style.textContent = libraryStyle
    document.head.append(style)
  })
  afterEach(async () => {
    wrapper?.unmount()
    wrapper = undefined
    style.remove()
    useSidebar().closeSidebarRight()
    await damNamesAsked()
    waits.restore()
    socket.restore()
    useDamNotificationsEventBus().reset()
    signOutOfDam()
  })

  const uploadConfig = () => ({
    licence,
    extSystem,
    licenceName: 'own',
    extSystemConfig: useDamConfigStore(pinia).damConfigExtSystem.get(extSystem)!,
  })
  const listRequests = () => dam.requests.filter(isListRequest)
  const furtherPageRequests = () => listRequests().filter((request) => offsetOf(request) > 0)
  const listIsRead = () => vi.waitFor(() => expect(useAssetSelectStore(pinia).loader).toBe(false))
  const open = async (scrollToTheButton = true) => {
    if (component === 'list') {
      wrapper = mount(AAssetListInner, {
        attachTo: document.body,
        props: {
          assetType: DamAssetType.Image,
          queueKey: 'asset-page',
          selectConfigs: [uploadConfig()],
          skipCurrentUserCheck: true,
        },
        global: {
          plugins: [pinia],
          provide: { [ImageWidgetUploadConfigKey as symbol]: shallowRef(uploadConfig()) },
          stubs: Object.fromEntries([...STAND_INS, 'AssetSelectListBar'].map((name) => [name, true])),
        },
      })
    } else {
      const mounted: VueWrapper = mount(component, {
        attachTo: document.body,
        props: {
          modelValue: false,
          'onUpdate:modelValue': (value: boolean) => mounted.setProps({ modelValue: value }),
          minCount: 1,
          maxCount: 1,
          selectLicences: [licence],
          uploadLicence: licence,
          returnType: 'asset',
          ...props,
        } as never,
        global: {
          plugins: [pinia],
          // The real transition is needed. The fullscreen dialog style targets the content right under the overlay.
          // A transition stand-in sat between them, so the picker was laid out off the window.
          stubs: { ...Object.fromEntries(STAND_INS.map((name) => [name, true])), transition: false },
        },
      })
      wrapper = mounted
      await flushPromises()
      await mounted.setProps({ modelValue: true })
    }
    await vi.waitFor(() => expect(tiles().length).toBeGreaterThanOrEqual(pages[0]!.length))
    await listIsRead()
    await flushPromises()
    if (scrollToTheButton) loadMoreButton().scrollIntoView({ block: 'end' })
  }
  const tiles = () => Array.from(document.body.querySelectorAll<HTMLElement>('.asset-list-tiles__item'))
  const tilesDrawn = () =>
    tiles().map((tile) => tile.querySelector('[data-cy="asset-tile-title"]')!.textContent!.trim())
  const loadMoreButton = () =>
    Array.from(document.body.querySelectorAll<HTMLElement>('.v-btn')).find(
      (button) => button.textContent?.trim() === uiText('common.button.loadMore')
    )!
  const isShown = (element: HTMLElement) => getComputedStyle(element).display !== 'none'
  const inView = (element: HTMLElement) => {
    const { top, bottom } = element.getBoundingClientRect()
    return bottom > 0 && top < window.innerHeight
  }
  const errors = () => shownAlerts().filter(([color]) => color === 'error')
  const furtherPageFailed = async (times: number) => {
    await vi.waitFor(() => expect(furtherPageRequests()).toHaveLength(times))
    await listIsRead()
    // Long enough for the old bug to repeat the request many times.
    await waits.settle(600)
  }

  it('that fails while the button is in view is asked for once, with one error, and the button asks again only when pressed', async () => {
    await open()
    await furtherPageFailed(1)

    expect(furtherPageRequests().map(offsetOf)).toEqual([PAGE])
    expect(errors()).toHaveLength(1)
    expect(tilesDrawn()).toEqual(['image-1', 'image-2'])
    expect([isShown(loadMoreButton()), inView(loadMoreButton())]).toEqual([true, true])

    loadMoreButton().click()
    await furtherPageFailed(2)
    expect(furtherPageRequests().map(offsetOf)).toEqual([PAGE, PAGE])
    expect(errors()).toHaveLength(2)

    furtherPagesFail = false
    pages = [...pages, ['image-4']]
    loadMoreButton().click()
    await vi.waitFor(() => expect(tilesDrawn()).toEqual(['image-1', 'image-2', 'image-3', 'image-4']))
    await listIsRead()
    await waits.settle(300)
    expect(furtherPageRequests().map(offsetOf)).toEqual([PAGE, PAGE, PAGE, 2 * PAGE])
    expect(errors()).toHaveLength(2)
    expect(isShown(loadMoreButton())).toBe(false)
  })

  if (component === AAssetSelect) {
    // The button asks as it comes into view. One that left the view after the failure asks again when it comes back.
    it('asks again by itself once the button has left the view and comes back into it', async () => {
      pages = [ids('image', PAGE), ['image-26']]
      await open(false)
      expect(inView(loadMoreButton())).toBe(false)
      expect(furtherPageRequests()).toEqual([])

      loadMoreButton().scrollIntoView()
      await furtherPageFailed(1)
      expect(errors()).toHaveLength(1)

      tiles()[0]!.scrollIntoView()
      await waits.settle(300)
      expect(inView(loadMoreButton())).toBe(false)
      expect(furtherPageRequests()).toHaveLength(1)

      furtherPagesFail = false
      loadMoreButton().scrollIntoView()
      await vi.waitFor(() => expect(tilesDrawn()).toHaveLength(PAGE + 1))
      expect(furtherPageRequests().map(offsetOf)).toEqual([PAGE, PAGE])
      expect(errors()).toHaveLength(1)
    })

    it('goes on asking by itself for each further page that comes, as long as the button is in view', async () => {
      furtherPagesFail = false
      pages = [['image-1', 'image-2'], ['image-3'], ['image-4']]
      await open()

      await vi.waitFor(() => expect(tilesDrawn()).toEqual(['image-1', 'image-2', 'image-3', 'image-4']))
      await listIsRead()
      await waits.settle(300)
      expect(listRequests().map(offsetOf)).toEqual([0, PAGE, 2 * PAGE])
      expect(errors()).toEqual([])
    })

    it('asks by itself for the further page of a list read anew after a failure', async () => {
      await open()
      await furtherPageFailed(1)
      const before = listRequests().length

      furtherPagesFail = false
      wrapper!.findComponent({ name: 'AssetSelectListBar' }).vm.$emit('sortByChange', {
        id: 2,
        titleT: 'common.system.datatable.ordering.oldest',
        sortBy: { key: SORT_BY_SCORE_DATE, order: 'asc' },
      })

      await vi.waitFor(() => expect(tilesDrawn()).toEqual(['image-1', 'image-2', 'image-3']))
      await listIsRead()
      expect(listRequests().slice(before).map(offsetOf)).toEqual([0, PAGE])
      expect(errors()).toHaveLength(1)
    })

    // Closing the picker removes its button. Reopened, the button is drawn
    // hidden under a list with no page yet, which clears what the failure left.
    it('asks by itself for the further page of the picker opened again after a failure', async () => {
      await open()
      await furtherPageFailed(1)
      document.body.querySelector<HTMLButtonElement>('.subject-select__card [data-cy="button-close"]')!.click()
      await vi.waitFor(() => expect(document.body.querySelector('.subject-select__card')).toBeNull())
      const before = listRequests().length

      furtherPagesFail = false
      await wrapper!.setProps({ modelValue: true })

      await vi.waitFor(() => expect(tilesDrawn()).toEqual(['image-1', 'image-2', 'image-3']))
      await listIsRead()
      expect(listRequests().slice(before).map(offsetOf)).toEqual([0, PAGE])
      expect(errors()).toHaveLength(1)
    })
  }
})
