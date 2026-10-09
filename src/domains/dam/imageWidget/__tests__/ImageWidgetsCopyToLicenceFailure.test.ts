import { beforeEach, describe, expect, it, vi } from 'vitest'
import axios from 'axios'
import { flushPromises, mount } from '@vue/test-utils'
import { type Component, defineComponent, h, shallowRef } from 'vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { createFakeDam, type FakeDam, type FakeDamRule } from '@/domains/dam/__tests__/support/fakeDam'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useAlertsQueue } from '@/domains/system/composables/alertsQueue'
import { DamAssetType } from '@/domains/dam/types/Asset'

// A copy of picked assets to the licence of a widget that fails: each of the three widgets that copy says so
// once and adds nothing, and a copy that was stopped says nothing. The request is the real one, against a DAM
// that answers as told, and the alert is the real one: a failed copy used to reach it as the bare error of axios,
// which it let pass without a word.

const connection = vi.hoisted(() => ({ client: null as null | (() => unknown) }))
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
    endPointAuthor: '/adm/v1/author',
    showSourceEnabled: true,
  }),
}))
vi.mock('@/domains/dam/config/composables/damConfigState', () => ({
  useDamConfigState: () => ({ getDamConfigExtSystem: () => undefined, getExtSystemByLicence: async () => 1 }),
}))

const COPY = /\/copy-to-licence$/
const MEDIA = /^\/adm\/v1\/cms\/asset\//

let dam: FakeDam
beforeEach(() => {
  dam = createFakeDam({ asset: '/adm/v1/asset', image: '/adm/v1/image' })
  connection.client = dam.client
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

let mounted = 0
const pickWithCopy = async (widget: Component, props: Record<string, unknown>, copyAnswers: FakeDamRule) => {
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
  wrapper.findComponent(Picker).vm.$emit('confirm', {
    type: 'asset',
    copyToLicence: 2,
    value: [
      {
        id: 'picked',
        licence: 1,
        mainFile: { id: 'file-of-picked' },
        attributes: { assetType: DamAssetType.Image },
        podcasts: [],
      },
    ],
  })
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
})
