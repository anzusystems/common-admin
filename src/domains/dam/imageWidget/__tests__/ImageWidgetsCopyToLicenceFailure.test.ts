import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { flushPromises, mount } from '@vue/test-utils'
import { type Component, defineComponent, h, shallowRef } from 'vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { answerDamNames, DAM_NAMES, damNameLookups } from '@/domains/dam/__tests__/support/damNames'
import {
  createFakeDam,
  damAssetWithFile,
  type FakeDam,
  type FakeDamRule,
} from '@/domains/dam/__tests__/support/fakeDam'
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useAlertsQueue } from '@/domains/system/composables/alertsQueue'
import { DamAssetType } from '@/domains/dam/types/Asset'

// A failed copy of picked assets to the widget's licence: each
// of the three copying widgets reports it once and adds nothing.
// A stopped copy reports nothing. The request and the alert are real, against a DAM that answers as told.
// A failed copy used to reach the alert as a bare axios error, which it let pass silently.

const connection = vi.hoisted(() => ({
  client: null as null | (() => unknown),
  copyToLicenceEnabled: undefined as boolean | undefined,
}))
vi.mock('@/domains/dam/imageWidget/composables/commonAdminImageOptions', () => ({
  useCommonAdminImageOptions: () => ({
    imageClient: () => ({}),
    previewDomain: 'https://img',
    imageWidth: 300,
    imageHeight: 200,
    imageApi: { fetchImage: vi.fn() },
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
    copyToLicenceEnabled: connection.copyToLicenceEnabled,
  }),
}))
// The ext system of the licence is known, as it is once the widget has its configuration: the copy is added to it.
vi.mock('@/domains/dam/config/composables/damConfigState', () => ({
  useDamConfigState: () => ({ getDamConfigExtSystem: () => ({}), getExtSystemByLicence: async () => 1 }),
}))

const COPY = /\/copy-to-licence$/
const MEDIA = /^\/adm\/v1\/cms\/asset\//

let dam: FakeDam
beforeEach(() => {
  dam = createFakeDam({ asset: '/adm/v1/asset', image: '/adm/v1/image' })
  connection.client = dam.client
  connection.copyToLicenceEnabled = undefined
  // What the image and media widget asks about a picked asset before it copies it.
  dam.reply((request) => (request.method === 'GET' && MEDIA.test(request.url) ? { status: 200, data: {} } : undefined))
  useAlertsQueue().value = []
  useUploadQueueDialog().uploadQueueDialog.value = null
})

const Picker = defineComponent({ emits: ['confirm'], setup: () => () => h('div') })

const widgets: Array<[string, Component, Record<string, unknown>]> = [
  ['the image widget', ImageWidgetInner, { modelValue: null }],
  ['the image and media widget', ImageMediaWidgetInner, { image: null, media: null }],
  ['the widget of several images', ImageWidgetMultipleInner, { modelValue: [] }],
]

const failures: Array<[string, FakeDamRule]> = [
  ['is answered with 500', () => ({ status: 500 })],
  [
    'never reaches the server',
    (request) => {
      throw new axios.AxiosError('Network Error', axios.AxiosError.ERR_NETWORK, request.config as never)
    },
  ],
]
const stopped: FakeDamRule = (request) => {
  throw new axios.CanceledError(undefined, undefined, request.config as never)
}

const pickedOf = (id: string, licence: number) => ({
  id,
  licence,
  mainFile: { id: `file-of-${id}` },
  attributes: { assetType: DamAssetType.Image },
  podcasts: [],
})

let mounted = 0
const pickWithCopy = async (
  widget: Component,
  props: Record<string, unknown>,
  copyAnswers: FakeDamRule,
  picked = [pickedOf('picked', 1)]
) => {
  dam.reply((request) => (request.method === 'PATCH' && COPY.test(request.url) ? copyAnswers(request) : undefined))
  const queueKey = `copy-fails-${++mounted}`
  const wrapper = mount(widget, {
    props: { queueKey, uploadLicence: 2, selectLicences: [1, 2], ...props } as never,
    global: {
      provide: {
        [ImageWidgetUploadConfigKey as symbol]: shallowRef({
          licence: 2,
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
  const store = useUploadQueuesStore()
  const added = vi.spyOn(store, 'addByCopyToLicence')
  wrapper.findComponent(Picker).vm.$emit('confirm', { type: 'asset', copyToLicence: 2, value: picked })
  await flushPromises()
  await flushPromises()

  const outcome = {
    copies: dam.sentTo('PATCH', COPY).length,
    alerts: useAlertsQueue().value.map((alert) => alert.color),
    added: added.mock.calls.length,
    rows: store.getQueueItems(queueKey).length,
    dialog: useUploadQueueDialog().uploadQueueDialog.value,
  }
  added.mockRestore()
  wrapper.unmount()
  return outcome
}

describe.each(widgets)('a copy to the licence asked by %s', (_, widget, props) => {
  it.each(failures)('that %s: one error is shown and nothing is added', async (_, copyAnswers) => {
    expect(await pickWithCopy(widget, props, copyAnswers)).toEqual({
      copies: 1,
      alerts: ['error'],
      added: 0,
      rows: 0,
      dialog: null,
    })
  })

  it('that was stopped: nothing is shown and nothing is added', async () => {
    expect(await pickWithCopy(widget, props, stopped)).toEqual({
      copies: 1,
      alerts: [],
      added: 0,
      rows: 0,
      dialog: null,
    })
  })

  // The copy path is the image endpoint's: the asset endpoint has none, and a copy asked there never succeeded.
  it('goes to the copy path of the image endpoint, and the copy is added', async () => {
    const outcome = await pickWithCopy(widget, props, (request) =>
      request.url === '/adm/v1/image/copy-to-licence'
        ? {
            status: 200,
            data: [
              {
                asset: 'picked',
                targetAsset: 'copy-of-picked',
                targetMainFile: 'file-of-copy-of-picked',
                targetAssetLicence: 2,
                result: 'copy',
                assetConflicts: [],
              },
            ],
          }
        : { status: 404 }
    )

    expect(dam.sentTo('PATCH', COPY).map((request) => request.url)).toEqual(['/adm/v1/image/copy-to-licence'])
    // A row of the queue, waiting for the server to process the copy.
    expect(outcome).toMatchObject({ copies: 1, alerts: [], added: 1, rows: 1 })
  })

  // A picker that still says to copy, where the application has turned the copy off: the widget does not ask for it.
  it('that the application has turned off: none is asked for, and nothing is added', async () => {
    connection.copyToLicenceEnabled = false

    const outcome = await pickWithCopy(widget, props, () => ({ status: 200, data: [] }))

    expect(outcome).toMatchObject({ copies: 0, added: 0, rows: 0 })
  })
})

// The switch on, an asset already in the licence of the upload: it is taken as it is, not copied into its own licence.
describe('an asset picked to be copied that is already in the licence of the upload', () => {
  const copies: FakeDamRule = (request) => ({
    status: 200,
    data: (dam.body(request) as Array<{ asset: string }>).map(({ asset }) => ({
      asset,
      targetAsset: `copy-of-${asset}`,
      targetMainFile: `file-of-copy-of-${asset}`,
      targetAssetLicence: 2,
      result: 'copy',
      assetConflicts: [],
    })),
  })
  const inTheDam = (id: string) =>
    dam.assets.set(
      id,
      damAssetWithFile(id, `file-of-${id}`, AssetFileProcessStatus.Processed, {
        licence: 2,
        authors: [`author-of-${id}`],
        metadata: { customData: { description: `of ${id}` }, authorSuggestions: {}, keywordSuggestions: {} },
      })
    )
  const imagesOfTheGallery = () =>
    useImageStore().images.map((image) => [image.assetId, image.position, image.texts.description, image.damAuthors])

  beforeEach(() => {
    inTheDam('already')
    // As the picker leaves its store: the licences it offered, the licence of the upload browsed.
    useAssetSelectStore().setSelectConfig([
      { licence: 1, extSystem: 1 } as never,
      { licence: 2, extSystem: 1 } as never,
    ])
    useAssetSelectStore().selectedLicenceId = 2
  })

  it.each<[string, Component, Record<string, unknown>]>([
    ['the image widget', ImageWidgetInner, { modelValue: null }],
    ['the image and media widget', ImageMediaWidgetInner, { image: null, media: null }],
  ])('is taken by %s as it is, and no copy is asked for', async (_, widget, props) => {
    answerDamNames(dam)
    const outcome = await pickWithCopy(widget, props, copies, [pickedOf('already', 2)])

    expect(outcome).toMatchObject({ copies: 0, added: 0, rows: 0 })
    await vi.waitFor(() =>
      expect(useImageMediaWidgetStore().detail).toMatchObject({ dam: { damId: 'file-of-already' } })
    )
  })

  it('is taken by the widget of several images as it is, and no copy is asked for', async () => {
    answerDamNames(dam)
    const outcome = await pickWithCopy(ImageWidgetMultipleInner, { modelValue: [] }, copies, [pickedOf('already', 2)])

    expect(outcome).toMatchObject({ copies: 0, added: 0, rows: 0 })
    expect(imagesOfTheGallery()).toEqual([['already', 1, 'of already', ['author-of-already']]])
  })

  // Picked in both licences: the gallery takes the one already in the licence of the upload as it is, at once, read
  // under that licence and its ext system (the licence browsed when confirming is another one, of another ext system),
  // and the copies once the dialog of the queue is used.
  describe('in the gallery, picked together with assets of another licence', () => {
    const confirmMixed = async (copyAnswers: FakeDamRule) => {
      dam.reply((request) => (request.method === 'PATCH' && COPY.test(request.url) ? copyAnswers(request) : undefined))
      // The names of authors only under the ext system of the licence of the upload; under another one, none.
      dam.reply((request) => {
        const match = request.method === 'GET' ? request.url.match(DAM_NAMES) : null
        if (!match) return undefined
        const ids = match[2] === '1' ? (new URLSearchParams(match[3]).get('id') ?? '').split(',') : []
        const found = ids.map((id) => ({ id, name: `Name of ${id}`, identifier: '', flags: { reviewed: true } }))
        return { status: 200, data: { data: found, totalCount: found.length } }
      })
      const queueKey = `copy-mixed-${++mounted}`
      const wrapper = mount(ImageWidgetMultipleInner, {
        props: { queueKey, uploadLicence: 2, selectLicences: [1, 2], modelValue: [] } as never,
        global: {
          provide: {
            [ImageWidgetUploadConfigKey as symbol]: shallowRef({
              licence: 2,
              extSystem: 1,
              licenceName: '',
              extSystemConfig: {},
            }),
          },
          stubs: {
            AAssetSelect: Picker,
            ASortableListEditor: true,
            ImageWidgetMultipleLimitDialog: true,
            AssetDetailDialog: true,
            UploadQueueDialog: true,
            AFileInput: true,
            AFileDropzone: true,
          },
        },
      })
      useAssetSelectStore().setSelectConfig([
        { licence: 1, extSystem: 7 } as never,
        { licence: 2, extSystem: 1 } as never,
      ])
      useAssetSelectStore().selectedLicenceId = 1
      wrapper.findComponent(Picker).vm.$emit('confirm', {
        type: 'asset',
        copyToLicence: 2,
        value: [pickedOf('a', 1), pickedOf('already', 2), pickedOf('c', 1)],
      })
      await flushPromises()
      await flushPromises()
      return { wrapper, queueKey }
    }
    const fromTheDialog = (assetId: string) => ({
      key: assetId,
      texts: { description: `copied ${assetId}`, source: '' },
      flags: { showSource: true, internal: false, overrideInternal: false },
      dam: { damId: `file-of-${assetId}`, regionPosition: 0, licenceId: 2, internal: false },
      position: 0,
      damAuthors: [],
      showDamAuthors: true,
      assetId,
    })
    const imagesWithSource = () =>
      useImageStore().images.map((image) => [
        image.assetId,
        image.position,
        image.texts.description,
        image.texts.source,
      ])
    const already = ['already', 1, 'of already', 'Name of author-of-already']

    it('takes the one already in the licence at once, read under it and its ext system, and the copies once the dialog is used', async () => {
      const { wrapper, queueKey } = await confirmMixed(copies)
      expect(dam.sentTo('PATCH', COPY).map((request) => dam.body(request))).toEqual([
        [
          { asset: 'a', targetAssetLicence: 2 },
          { asset: 'c', targetAssetLicence: 2 },
        ],
      ])
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBe(queueKey)
      expect(imagesWithSource()).toEqual([already])
      const authorLookups = damNameLookups(dam).filter((request) => request.url.match(DAM_NAMES)![1] === 'author')
      expect(authorLookups.length).toBeGreaterThan(0)
      expect(authorLookups.map((request) => request.url.match(DAM_NAMES)![2])).toEqual(authorLookups.map(() => '1'))

      // The dialog hands the copies in an order of its own; they come after it, as handed.
      wrapper
        .findComponent({ name: 'UploadQueueDialog' })
        .vm.$emit('apply', [fromTheDialog('copy-of-c'), fromTheDialog('copy-of-a')])
      await flushPromises()

      expect(imagesWithSource()).toEqual([
        already,
        ['copy-of-c', 2, 'copied copy-of-c', ''],
        ['copy-of-a', 3, 'copied copy-of-a', ''],
      ])
      wrapper.unmount()
    })

    it('keeps the one already in the licence when the dialog is closed without being used', async () => {
      const { wrapper } = await confirmMixed(copies)

      useUploadQueueDialog().uploadQueueDialog.value = null
      await flushPromises()

      expect(imagesWithSource()).toEqual([already])
      wrapper.unmount()
    })

    it.each<[string, FakeDamRule, string[]]>([
      ['fails', () => ({ status: 500 }), ['error']],
      [
        'is refused for all of them by an answer of 200',
        (request) => ({
          status: 200,
          data: (dam.body(request) as Array<{ asset: string }>).map(({ asset }) => ({
            asset,
            targetAsset: '',
            targetMainFile: '',
            targetAssetLicence: 2,
            result: 'notAllowed',
            assetConflicts: [],
          })),
        }),
        ['error'],
      ],
    ])('takes the one already in the licence when the copy %s, and opens no dialog', async (_, copyAnswers, alerts) => {
      const { wrapper } = await confirmMixed(copyAnswers)

      expect(useAlertsQueue().value.map((alert) => alert.color)).toEqual(alerts)
      expect(useUploadQueueDialog().uploadQueueDialog.value).toBeNull()
      expect(imagesWithSource()).toEqual([already])
      wrapper.unmount()
    })
  })
})
