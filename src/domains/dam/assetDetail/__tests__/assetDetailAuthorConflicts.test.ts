import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, DAM_NAMES, damNameLookups, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { damText, forgetAlerts } from '@/domains/dam/__tests__/support/uploadUi'
import AssetDetailDialog from '@/domains/dam/assetDetail/components/AssetDetailDialog.vue'
import AssetMetadata from '@/domains/dam/assetDetail/components/AssetMetadata.vue'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import AuthorRemoteAutocompleteCachedAuthorChipConflicts from '@/domains/dam/author/components/AuthorRemoteAutocompleteCachedAuthorChipConflicts.vue'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageDetailDialogMetadata from '@/domains/dam/imageWidget/components/ImageDetailDialogMetadata.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { type AssetDetailItemDto, type AssetMetadataSuggestions, DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import type { DocId } from '@/shared/types/common'

// Finding 160: the DAM leaves the authors of a name read from the file as suggestions when several of its authors have
// that name, and the card of a row of the queue offers them under the authors as "author conflicts". The detail of an
// asset offers them too, from the asset it shows; the side panels, read-only, and the dialog of an image do not. The
// real detail with its real sidebar over the real store of the detail, opened as its hosts open it, beside the real
// metadata of a side panel or the real dialog of an image; the DAM is a client that records its requests and knows
// every author asked for. Not mounted for real: the picture, the editor of the region of interest with its regions,
// and the inner inputs that ask the DAM for names to offer. Under admin-cms only: admin-ugc has no authors.

const profile = cmsConfiguration
const { endPoints, extSystem, licence } = profile
const QUEUE = 'author-conflicts'

let pinia: Pinia
let dam: FakeDam
let wrapper: VueWrapper | undefined
// The caches of names are one for the file: each case has authors of its own, which no case before has asked for.
let round = 0
let a: DocId, b: DocId, c: DocId

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  installConsumerProfile(profile, dam.client)
  answerDamNames(dam)
  forgetAlerts()
  round++
  a = `author-${round}-a`
  b = `author-${round}-b`
  c = `author-${round}-c`
})
afterEach(async () => {
  wrapper?.unmount()
  wrapper = undefined
  await damNamesAsked()
  useImageMediaWidgetStore(pinia).setDetail(null)
})

const detail = () => useAssetDetailStore(pinia)
/** An image as the DAM answers it before it is saved: with the authors it found by the names in its file. */
const asset = (authorSuggestions: AssetMetadataSuggestions, authors: DocId[] = [], number = 1): AssetDetailItemDto =>
  damAssetWithFile(`asset-${number}`, `file-${number}`, AssetFileProcessStatus.Processed, {
    licence,
    texts: { displayTitle: 'Harbour at dawn' },
    authors,
    metadata: { authorSuggestions, keywordSuggestions: {}, customData: {} },
  })
/** Two DAM authors of one name, one of another, and a name the DAM has no author of. */
const suggested = () => ({ 'Jana Nová': [a, b], 'Peter Malý': [c], Nikto: [] })

/**
 * The page with the host of the detail, which draws it while the store names its queue. `panel`: beside it the
 * metadata of a side panel of the asset of the store, read-only as every side panel draws it. `imageDialog`: beside
 * it the dialog of an image that offers the authors of the DAM, as after an upload.
 */
const mountPage = async ({ panel = false, imageDialog = false } = {}) => {
  if (imageDialog) {
    useImageMediaWidgetStore(pinia).setDetail({
      texts: { description: 'listing', source: '' },
      flags: { showSource: true, internal: false, overrideInternal: false },
      dam: { damId: 'file-1', licenceId: licence, regionPosition: 0, internal: false },
      position: 1,
    } as never)
  }
  const Page = defineComponent({
    setup: () => () => [
      panel ? h('div', { class: 'side-panel' }, [h(AssetMetadata, { extSystem, readonly: true })]) : null,
      imageDialog
        ? h(ImageDetailDialogMetadata, {
            modelValue: true,
            saving: false,
            loading: false,
            showDamAuthors: true,
            damAuthors: [],
            type: DamAssetType.Image,
          })
        : null,
      detail().dialog === QUEUE ? h(AssetDetailDialog, { queueKey: QUEUE, extSystem }) : null,
    ],
  })
  wrapper = mount(Page, {
    attachTo: document.body,
    global: {
      plugins: [pinia],
      stubs: {
        AssetImage: true,
        DamAssetImageRoiSelectLazy: true,
        AssetDetailSidebarROI: true,
        AFormRemoteAutocompleteWithCached: true,
        AImageWidgetSimple: true,
      },
    },
  })
  await flushPromises()
}
/** The detail opened over the asset of the store, which it does not read: as "edit" of the side panel of the list. */
const openOverTheStore = async (shown: AssetDetailItemDto, page: Parameters<typeof mountPage>[0] = {}) => {
  detail().setAsset(shown)
  detail().dialog = QUEUE
  await mountPage(page)
  await namesShown()
}
/** What is drawn now has had the names it asked for. */
const namesShown = async () => {
  await flushPromises()
  await damNamesAsked()
  await flushPromises()
}

// The detail, the panel and the dialog of the image are drawn into the body.
const detailCard = () => document.body.querySelector<HTMLElement>('.dam-image-detail')
const sidePanel = () => document.body.querySelector<HTMLElement>('.side-panel')
const imageDialogCard = () =>
  Array.from(document.body.querySelectorAll<HTMLElement>('.v-overlay--active .v-card')).find((card) =>
    card.querySelector('.v-toolbar')?.textContent?.includes(damText('image.meta.edit'))
  )
const chipsIn = (root: HTMLElement | null | undefined) =>
  wrapper!
    .findAllComponents(AuthorRemoteAutocompleteCachedAuthorChipConflicts)
    .map((conflict) => conflict.find('.v-chip').element as HTMLElement)
    .filter((chip) => !!root?.contains(chip))
/** The conflicts offered in `root`, as their chips say them. */
const offeredIn = (root: HTMLElement | null | undefined) => chipsIn(root).map((chip) => chip.textContent?.trim())
const spinningIn = (root: HTMLElement | null | undefined) =>
  chipsIn(root).some((chip) => !!chip.querySelector('.v-progress-circular'))
const headingIn = (root: HTMLElement | null | undefined) => !!root?.textContent?.includes(damText('author.conflicts'))
const lookupsOf = (ids: DocId[]) =>
  damNameLookups(dam).filter((request) => {
    const asked = new URLSearchParams(request.url.match(DAM_NAMES)![3]).get('id')?.split(',') ?? []
    return ids.some((id) => asked.includes(id))
  })

describe('the author conflicts of the detail of an asset', () => {
  it('are offered for a name the DAM has several authors of, each by its name, under their heading', async () => {
    await openOverTheStore(asset(suggested()))

    expect(headingIn(detailCard())).toBe(true)
    expect(offeredIn(detailCard())).toEqual([`Name of ${a}`, `Name of ${b}`])
    expect(spinningIn(detailCard())).toBe(false)
  })

  it('are offered in a detail opened by a read, as "edit asset" of a widget and a row of the queue open it', async () => {
    await mountPage()

    await detail().open(QUEUE, async () => asset(suggested()))
    await namesShown()

    expect(offeredIn(detailCard())).toEqual([`Name of ${a}`, `Name of ${b}`])
  })

  it('leave out an author the asset has already', async () => {
    await openOverTheStore(asset(suggested(), [b]))

    expect(offeredIn(detailCard())).toEqual([`Name of ${a}`])
  })

  it('give the asset the author pressed, and offer it no more', async () => {
    await openOverTheStore(asset(suggested()))
    const pressed = wrapper!
      .findAllComponents(AuthorRemoteAutocompleteCachedAuthorChipConflicts)
      .find((conflict) => conflict.props('id') === a)!
    await pressed.find('.v-chip__close').trigger('click')
    await flushPromises()

    expect(detail().asset!.authors).toEqual([a])
    expect(detail().metadataAreTouched).toBe(true)
    expect(offeredIn(detailCard())).toEqual([`Name of ${b}`])
  })

  it('follow the asset the detail shows, and are none for an asset without', async () => {
    await openOverTheStore(asset(suggested()))

    detail().setAsset(asset({ 'Eva Malá': [c, a] }, [], 2))
    await namesShown()
    expect(offeredIn(detailCard())).toEqual([`Name of ${c}`, `Name of ${a}`])

    detail().setAsset(asset({}, [], 3))
    await flushPromises()
    expect([offeredIn(detailCard()), headingIn(detailCard())]).toEqual([[], false])
  })

  it('say only their ids, and stop turning, when the DAM does not give their names', async () => {
    dam.reply((request) => (DAM_NAMES.test(request.url) ? { status: 500 } : undefined))

    await openOverTheStore(asset(suggested()))

    expect(offeredIn(detailCard())).toEqual([`#${a}`, `#${b}`])
    expect(spinningIn(detailCard())).toBe(false)
  })

  // Suggestions stored on the asset before the authors of its ext system were switched off stay on it.
  it('are not offered, nor their names asked for, where the ext system has the authors off', async () => {
    const extSystems = useDamConfigStore(pinia).damConfigExtSystem
    const config = extSystems.get(extSystem)!
    extSystems.set(extSystem, { ...config, image: { ...config.image!, authors: { enabled: false, required: false } } })

    await openOverTheStore(asset(suggested()))

    expect(detailCard()).not.toBeNull()
    expect(wrapper!.findAllComponents(AuthorRemoteAutocompleteWithCached)).toHaveLength(0)
    expect([offeredIn(detailCard()), headingIn(detailCard())]).toEqual([[], false])
    expect(lookupsOf([a, b])).toEqual([])
  })
})

describe('the author conflicts of the asset of the detail elsewhere', () => {
  it('are not offered in a side panel, which does not ask the DAM for their names either', async () => {
    detail().setAsset(asset(suggested()))
    await mountPage({ panel: true })
    await namesShown()

    expect(sidePanel()!.textContent).toContain(damText('asset.model.authors'))
    expect([offeredIn(sidePanel()), headingIn(sidePanel())]).toEqual([[], false])
    expect(lookupsOf([a, b])).toEqual([])
  })

  it('are not offered in the side panel the detail is opened over, while the detail offers them', async () => {
    await openOverTheStore(asset(suggested()), { panel: true })

    expect(offeredIn(sidePanel())).toEqual([])
    expect(offeredIn(detailCard())).toEqual([`Name of ${a}`, `Name of ${b}`])
  })

  it('are not offered in the dialog of an image, while the detail of that asset offers them', async () => {
    await openOverTheStore(asset(suggested()), { imageDialog: true })

    // Its input of the authors of the DAM is there, a stand-in for the inner input.
    expect(imageDialogCard()!.querySelector('a-form-remote-autocomplete-with-cached-stub')).not.toBeNull()
    expect([offeredIn(imageDialogCard()), headingIn(imageDialogCard())]).toEqual([[], false])
    expect(offeredIn(detailCard())).toEqual([`Name of ${a}`, `Name of ${b}`])
  })
})
