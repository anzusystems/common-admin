import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { type Component, defineComponent, h, shallowRef } from 'vue'
import { answerDamNames, damNameLookups } from '@/domains/dam/__tests__/support/damNames'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import ImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus, type AssetFileProcessStatusType } from '@/domains/dam/types/AssetFile'
import { useAlertsQueue } from '@/domains/system/composables/alertsQueue'

// The image of the CMS each of the three widgets makes of an asset picked in the library (IM2 to IM5 of the design),
// key by key: `damImageSites.test.ts` has the places outside the widgets. The real widgets over a picker that hands
// the pick over; the DAM is a client that records its requests. What the picker hands over and what the DAM then
// answers for the asset differ on purpose: the file and the internal flag are the picked ones, the texts are read.
// The licence of the picked assets is another one than the licence the widget uploads to.

const connection = vi.hoisted(() => ({
  client: null as null | (() => unknown),
  mapOfTheApplication: undefined as undefined | (() => { description: string; source: string }),
  /** The configuration of the ext system: whether it has the authors of the DAM for an image. */
  extSystemConfig: {} as Record<string, unknown>,
  /** The images the widgets created. */
  created: [] as unknown[],
  saved: (id: number) => ({
    id,
    texts: { description: 'Saved before', source: 'Peter' },
    flags: { showSource: false, internal: false, overrideInternal: false },
    dam: { damId: 'file-saved', licenceId: 2, regionPosition: 2, internal: false },
    position: 3,
  }),
}))
vi.mock('@/domains/dam/imageWidget/composables/commonAdminImageOptions', () => ({
  useCommonAdminImageOptions: () => ({
    imageClient: () => ({}),
    previewDomain: 'https://img',
    imageWidth: 300,
    imageHeight: 200,
    imageApi: {
      fetchImage: async (_client: unknown, id: number) => connection.saved(id),
      createImage: async (_client: unknown, image: object) => {
        connection.created.push(image)
        return { ...image, id: 501 }
      },
    },
  }),
}))
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({
    damClient: () => connection.client!(),
    endPointAsset: '/adm/v1/asset',
    endPointImage: '/adm/v1/image',
    endPointAuthor: '/adm/v1/author',
    showSourceEnabled: true,
    copyToLicenceEnabled: undefined,
    customAssetSelectMetadataToImageMap: connection.mapOfTheApplication,
  }),
}))
// The ext system of the licence is known. It offers no authors of the DAM in place of the source, but where a case
// says it has them.
vi.mock('@/domains/dam/config/composables/damConfigState', () => ({
  useDamConfigState: () => ({
    getDamConfigExtSystem: () => connection.extSystemConfig,
    getExtSystemByLicence: async () => 1,
  }),
}))

const MEDIA = /^\/adm\/v1\/cms\/asset\//
const UPLOAD_LICENCE = 2
const ASSET_LICENCE = 5

let dam: FakeDam
let wrapper: VueWrapper | undefined
let mounted = 0

beforeEach(() => {
  dam = createFakeDam({ asset: '/adm/v1/asset', image: '/adm/v1/image' })
  connection.client = dam.client
  connection.mapOfTheApplication = undefined
  connection.extSystemConfig = {}
  connection.created = []
  // What the image and media widget asks about a picked asset first.
  dam.reply((request) => (request.method === 'GET' && MEDIA.test(request.url) ? { status: 200, data: {} } : undefined))
  answerDamNames(dam)
  useAlertsQueue().value = []
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

const Picker = defineComponent({ emits: ['confirm'], setup: () => () => h('div') })

/** An image as the picker hands it over. */
const pickedAs = (id: string, mainFileInternal?: boolean | null) => ({
  id,
  licence: ASSET_LICENCE,
  mainFile: { id: `file-as-picked-${id}` },
  mainFileInternal,
  attributes: { assetType: DamAssetType.Image },
  podcasts: [],
})
/** The same asset as the DAM answers it: another file, never internal, its description untrimmed, two authors. */
const inTheDam = (id: string) =>
  dam.assets.set(
    id,
    damAssetWithFile(id, `file-in-the-dam-${id}`, AssetFileProcessStatus.Processed, {
      licence: ASSET_LICENCE,
      mainFileInternal: false,
      authors: [`author-1-of-${id}`, `author-2-of-${id}`],
      metadata: { customData: { description: `  Harbour of ${id} ` }, authorSuggestions: {}, keywordSuggestions: {} },
    })
  )
const sourceOf = (id: string) => `Name of author-1-of-${id}, Name of author-2-of-${id}`

const pick = async (
  widget: Component,
  props: Record<string, unknown>,
  ...picked: Array<ReturnType<typeof pickedAs>>
) => {
  // But for an asset a case has put into the DAM its own way.
  picked.filter(({ id }) => !dam.assets.has(id)).forEach(({ id }) => inTheDam(id))
  wrapper = mount(widget, {
    props: {
      queueKey: `sites-${++mounted}`,
      uploadLicence: UPLOAD_LICENCE,
      selectLicences: [ASSET_LICENCE, UPLOAD_LICENCE],
      ...props,
    } as never,
    global: {
      provide: {
        [ImageWidgetUploadConfigKey as symbol]: shallowRef({
          licence: UPLOAD_LICENCE,
          extSystem: 1,
          licenceName: '',
          extSystemConfig: {},
        }),
      },
      stubs: {
        AAssetSelect: Picker,
        AAssetSelectMedia: Picker,
        ASortableListEditor: true,
        ImageDetailDialogMetadata: true,
        ImageWidgetMultipleLimitDialog: true,
        AssetDetailDialog: true,
        UploadQueueDialog: true,
        UploadQueueDialogSingle: true,
        AFileInput: true,
        AFileInputDialog: true,
        AFileDropzone: true,
      },
    },
  })
  await flushPromises()
  // The asset of the detail is the page's: what an earlier case left there is not this one's.
  useAssetDetailStore().setAsset(null)
  // As the picker leaves its store: the licences it offered, the one of the picked assets browsed.
  useAssetSelectStore().setSelectConfig([
    { licence: ASSET_LICENCE, extSystem: 1 } as never,
    { licence: UPLOAD_LICENCE, extSystem: 1 } as never,
  ])
  useAssetSelectStore().selectedLicenceId = ASSET_LICENCE
  wrapper.findComponent(Picker).vm.$emit('confirm', { type: 'asset', value: picked })
  await flushPromises()
  await flushPromises()
  expect(useAlertsQueue().value).toEqual([])
}

describe.each<[string, Component, string]>([
  ['the image widget (IM2)', ImageWidgetInner, 'modelValue'],
  ['the image and media widget (IM3)', ImageMediaWidgetInner, 'image'],
])('the image %s makes of a picked asset', (_name, widget, model) => {
  const props = (image: number | null) => (model === 'image' ? { image, media: null } : { modelValue: image })

  it.each([
    ['is internal', true, true],
    ['is not', false, false],
    ['says nothing of it', null, false],
  ])(
    'has the picked file and licence, the texts read from the DAM, position 1 and no id: a file that %s',
    async (_what, mainFileInternal, internal) => {
      await pick(widget, props(null), pickedAs('a', mainFileInternal))

      expect(useImageMediaWidgetStore().detail).toStrictEqual({
        texts: { description: 'Harbour of a', source: sourceOf('a') },
        flags: { showSource: true, internal: false, overrideInternal: false },
        dam: { damId: 'file-as-picked-a', licenceId: ASSET_LICENCE, regionPosition: 0, internal },
        position: 1,
      })
    }
  )

  it('has the id of the image the widget holds', async () => {
    await pick(widget, props(55), pickedAs('a', true))

    expect(useImageMediaWidgetStore().detail).toStrictEqual({
      texts: { description: 'Harbour of a', source: sourceOf('a') },
      flags: { showSource: true, internal: false, overrideInternal: false },
      dam: { damId: 'file-as-picked-a', licenceId: ASSET_LICENCE, regionPosition: 0, internal: true },
      position: 1,
      id: 55,
    })
  })
})

// Both read the mapping of the application: the image and media widget did not (IM11, finding 45). What the
// mapping hands goes into the image as it is, also where it is no text, and the DAM is asked for no author.
describe.each<[string, Component, Record<string, unknown>]>([
  ['the image widget (IM2)', ImageWidgetInner, { modelValue: null }],
  ['the image and media widget (IM3)', ImageMediaWidgetInner, { image: null, media: null }],
])('the image %s makes of a picked asset by the mapping of the application', (_name, widget, props) => {
  it.each([
    ['its texts', { description: 'Mapped description', source: 'Mapped source' }],
    ['what it hands in place of a text', { description: null, source: undefined }],
  ])('has %s, as handed', async (_what, mapped) => {
    const mapping = vi.fn(() => mapped as never)
    connection.mapOfTheApplication = mapping

    await pick(widget, props, pickedAs('a', true))

    expect(useImageMediaWidgetStore().detail).toStrictEqual({
      texts: mapped,
      flags: { showSource: true, internal: false, overrideInternal: false },
      dam: { damId: 'file-as-picked-a', licenceId: ASSET_LICENCE, regionPosition: 0, internal: true },
      position: 1,
    })
    // Handed the asset as the DAM answers it, once.
    expect(mapping.mock.calls).toEqual([
      [expect.objectContaining({ id: 'a', authors: ['author-1-of-a', 'author-2-of-a'] })],
    ])
    expect(damNameLookups(dam)).toEqual([])
  })
})

describe('the images the widget of several images makes of picked assets', () => {
  const images = () => useImageStore().images

  it('have the picked files and licence, the texts read from the DAM and their authors, one position after another (IM5)', async () => {
    await pick(ImageWidgetMultipleInner, { modelValue: [] }, pickedAs('a', true), pickedAs('b'))

    expect(images()).toStrictEqual([
      {
        key: expect.any(String),
        texts: { description: 'Harbour of a', source: sourceOf('a') },
        flags: { showSource: true, internal: false, overrideInternal: false },
        dam: { damId: 'file-as-picked-a', licenceId: ASSET_LICENCE, regionPosition: 0, internal: true },
        position: 1,
        damAuthors: ['author-1-of-a', 'author-2-of-a'],
        showDamAuthors: false,
        assetId: 'a',
      },
      {
        key: expect.any(String),
        texts: { description: 'Harbour of b', source: sourceOf('b') },
        flags: { showSource: true, internal: false, overrideInternal: false },
        dam: { damId: 'file-as-picked-b', licenceId: ASSET_LICENCE, regionPosition: 0, internal: false },
        position: 2,
        damAuthors: ['author-1-of-b', 'author-2-of-b'],
        showDamAuthors: false,
        assetId: 'b',
      },
    ])
  })

  // The editor of the list asks for a way to make an empty row, and hides the button that would use it.
  it('has an empty image for the editor of the list, of no file (IM6)', async () => {
    await pick(ImageWidgetMultipleInner, { modelValue: [] })
    const factory = wrapper!.findComponent({ name: 'ASortableListEditor' }).props('factory') as () => unknown

    expect(factory()).toStrictEqual({
      key: expect.any(String),
      texts: { description: '', source: '' },
      flags: { showSource: true, internal: false, overrideInternal: false },
      dam: { damId: '', licenceId: 0, regionPosition: 0, internal: false },
      position: 0,
      damAuthors: [],
      showDamAuthors: false,
      assetId: undefined,
    })
    expect(images()).toEqual([])
  })

  // Unlike the image widget, the gallery makes an empty text of what the mapping hands in place of one.
  it.each([
    [
      'the texts the mapping of the application makes of the asset',
      { description: 'Mapped description', source: 'Mapped source' },
      { description: 'Mapped description', source: 'Mapped source' },
    ],
    [
      'empty texts where the mapping hands none',
      { description: null, source: undefined },
      { description: '', source: '' },
    ],
  ])('have %s, and no authors of the DAM (IM4)', async (_what, mapped, texts) => {
    connection.mapOfTheApplication = () => mapped as never

    await pick(ImageWidgetMultipleInner, { modelValue: [] }, pickedAs('a', true))

    expect(images()).toStrictEqual([
      {
        key: expect.any(String),
        texts,
        flags: { showSource: true, internal: false, overrideInternal: false },
        dam: { damId: 'file-as-picked-a', licenceId: ASSET_LICENCE, regionPosition: 0, internal: true },
        position: 1,
        damAuthors: [],
        showDamAuthors: false,
        assetId: 'a',
      },
    ])
  })
})

// Finding 49 (F-D): an ext system that has the authors of the DAM offers them to a picked asset that has none, and
// saves what is picked into the asset, which marks the asset described. Not while the server may yet fill in the
// metadata of the asset from its file: marked described, it would get none of that.
describe.each<[string, Component, Record<string, unknown>]>([
  ['the image widget', ImageWidgetInner, { modelValue: null }],
  ['the image and media widget', ImageMediaWidgetInner, { image: null, media: null }],
])('the authors of the DAM %s offers a picked asset that has none', (_name, widget, props) => {
  /** The asset in the DAM, without an author, its file in the given state. */
  const withoutAuthors = (status: AssetFileProcessStatusType, described = false) =>
    dam.assets.set(
      'a',
      damAssetWithFile('a', 'file-in-the-dam-a', status, {
        licence: ASSET_LICENCE,
        authors: [],
        flags: { described, visible: true },
        metadata: { customData: { description: 'Harbour of a' }, authorSuggestions: {}, keywordSuggestions: {} },
      })
    )
  const imageDialog = () => wrapper!.findComponent({ name: 'ImageDetailDialogMetadata' })
  const confirmImage = async () => {
    imageDialog().vm.$emit('confirm')
    await vi.waitFor(() => expect(connection.created).toHaveLength(1))
    await flushPromises()
  }
  const writesIntoTheAsset = () => dam.sentTo('PATCH', dam.routes.bulkMetadata).map((request) => dam.body(request))

  beforeEach(() => {
    connection.extSystemConfig = { [DamAssetType.Image]: { authors: { enabled: true } } }
  })

  it.each([AssetFileProcessStatus.Uploading, AssetFileProcessStatus.Uploaded, AssetFileProcessStatus.Stored])(
    'are not offered while the asset is not described and its file is %s, and nothing is written into the asset',
    async (status) => {
      withoutAuthors(status)

      await pick(widget, props, pickedAs('a'))

      expect(imageDialog().props('showDamAuthors')).toBe(false)
      expect(useAssetDetailStore().asset).toBeNull()
      await confirmImage()
      expect(writesIntoTheAsset()).toEqual([])
    }
  )

  it.each<[string, AssetFileProcessStatusType, boolean]>([
    ['its file is processed', AssetFileProcessStatus.Processed, false],
    ['it is described already, its file still stored', AssetFileProcessStatus.Stored, true],
  ])('are offered where %s, and the ones picked are saved into the asset', async (_what, status, described) => {
    withoutAuthors(status, described)

    await pick(widget, props, pickedAs('a'))

    expect(imageDialog().props('showDamAuthors')).toBe(true)
    // As the dialog of the image writes what the user picks: into the asset of the detail.
    useAssetDetailStore().asset!.authors = ['author-5']
    await confirmImage()
    expect(writesIntoTheAsset()).toEqual([[{ id: 'a', authors: ['author-5'], described: true }]])
  })
})
