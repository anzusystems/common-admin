import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { type Component, defineComponent, h, shallowRef } from 'vue'
import { defaultApiErrorLogger, setApiErrorLogger } from '@/domains/api/utils/apiErrors'
import { type ConsumerImageApi, installConsumerImageApi } from '@/domains/dam/__tests__/support/consumerImageApi'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import {
  createFakeDam,
  damAssetWithFile,
  type FakeDam,
  type FakeDamAnswer,
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
import { useAssetSelectStore } from '@/domains/dam/assetSelect/store/assetSelectStore'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { DamAssetType } from '@/domains/dam/types/Asset'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useUploadQueuesStore } from '@/domains/dam/uploadQueue/store/uploadQueuesStore'

// An asset picked in the library that has no author: the dialog of the image offers the authors of the DAM in
// place of a source, and "confirm" saves what the user picks into the asset before it saves the image. What goes to
// the DAM then, and what the widget says and does when the DAM refuses it. Under admin-cms, whose ext system has
// the authors of the DAM (admin-ugc has none), for each of the two widgets of one image. The real widgets with their
// real dialog of the image; the DAM and the backend of the images are clients that record their requests. Not
// mounted for real: the asset picker (a stand-in answers as it does), the pictures, the asset detail, the upload
// dialog, and the inputs that ask the DAM for names to offer.

const { endPoints, extSystem, licence } = cmsConfiguration
const QUEUE = 'lead-image'
const MEDIA = /^\/adm\/v1\/cms\/asset\//
const Picker = defineComponent({ name: 'AAssetSelect', emits: ['confirm'], setup: () => () => h('div') })

let pinia: Pinia
let dam: FakeDam
let imageApi: ConsumerImageApi
let waits: LongWaits
let widget: VueWrapper | undefined

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  imageApi = installConsumerImageApi(cmsConfiguration, installConsumerProfile(cmsConfiguration, dam.client))
  answerDamNames(dam)
  // What the image and media widget asks about a picked asset first: here, it is no media.
  dam.reply((request) => (request.method === 'GET' && MEDIA.test(request.url) ? { status: 200, data: {} } : undefined))
  dam.assets.set(
    'asset-9',
    damAssetWithFile('asset-9', 'file-of-asset-9', AssetFileProcessStatus.Processed, {
      licence,
      authors: [],
      metadata: { customData: { description: 'a picked image' }, authorSuggestions: {}, keywordSuggestions: {} },
    })
  )
  waits = holdLongWaits()
  forgetAlerts()
  setApiErrorLogger(null)
  signInToDam(extSystem)
})
afterEach(async () => {
  widget?.unmount()
  widget = undefined
  useUploadQueuesStore(pinia).stopUpload(QUEUE)
  useUploadQueueDialog().uploadQueueDialog.value = null
  await damNamesAsked()
  waits.restore()
  useDamNotificationsEventBus().reset()
  setApiErrorLogger(defaultApiErrorLogger)
  signOutOfDam()
})

const widgets: Array<[string, Component, Record<string, unknown>]> = [
  ['the image widget', ImageWidgetInner, { modelValue: null }],
  ['the image and media widget', ImageMediaWidgetInner, { image: null, media: null }],
]

describe.each(widgets)('the authors of the DAM picked in the dialog of an image of %s', (_name, component, own) => {
  const uploadConfig = () => ({
    licence,
    extSystem,
    licenceName: 'cms',
    extSystemConfig: useDamConfigStore(pinia).damConfigExtSystem.get(extSystem)!,
  })
  // The dialog of the image is drawn into the body.
  const imageDialog = () =>
    Array.from(document.body.querySelectorAll<HTMLElement>('.v-overlay--active .v-card')).find((card) =>
      card.textContent?.includes(damText('image.meta.edit'))
    )
  const confirmButton = () =>
    Array.from(imageDialog()!.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent?.trim() === uiText('common.button.confirm')
    )!
  const saves = () => dam.sentTo('PATCH', dam.routes.bulkMetadata)
  /** The DAM answers the save of the authors so. */
  const answerSaves = (answer: FakeDamAnswer) =>
    dam.reply((request) =>
      request.method === 'PATCH' && dam.routes.bulkMetadata.test(request.url) ? answer : undefined
    )
  /** The asset without an author is picked, the dialog of the image offers the authors, and the user picks one. */
  const authorPicked = async () => {
    const mounted: VueWrapper = mount(component, {
      attachTo: document.body,
      props: { queueKey: QUEUE, uploadLicence: licence, selectLicences: [licence], ...own } as never,
      global: {
        plugins: [pinia],
        provide: { [ImageWidgetUploadConfigKey as symbol]: shallowRef(uploadConfig()) },
        stubs: {
          AAssetSelect: Picker,
          AAssetSelectMedia: Picker,
          VImg: true,
          AImageWidgetSimple: true,
          AssetDetailDialog: true,
          UploadQueueDialogSingle: true,
          AFormRemoteAutocompleteWithCached: true,
        },
      },
    })
    widget = mounted
    await flushPromises()
    // As the picker leaves it once it has been opened.
    useAssetSelectStore(pinia).setSelectConfig([uploadConfig()])
    mounted.findComponent(Picker).vm.$emit('confirm', {
      type: 'asset',
      value: [
        {
          id: 'asset-9',
          licence,
          mainFile: { id: 'file-of-asset-9' },
          mainFileInternal: false,
          attributes: { assetType: DamAssetType.Image },
          podcasts: [],
        },
      ],
    })
    await vi.waitFor(() => expect(mounted.findComponent(AuthorRemoteAutocompleteWithCached).exists()).toBe(true))
    mounted.findComponent(AuthorRemoteAutocompleteWithCached).vm.$emit('update:modelValue', ['author-5'])
    await flushPromises()
    return mounted
  }
  /** "Confirm" is pressed, the DAM has been asked, and the button spins no more. */
  const confirmed = async () => {
    confirmButton().click()
    await vi.waitFor(() => expect(saves()).toHaveLength(1))
    await vi.waitFor(() => expect(confirmButton().classList.contains('v-btn--loading')).toBe(false))
    await flushPromises()
  }
  const refusal = (key: string) => ({
    status: 422,
    data: { contextId: 'context', error: 'validation_failed', fields: { [key]: ['error_field_empty'] } },
  })
  /** The one alert of a refusal by validation: its heading, and the field each of its lines names. */
  const refusalSaid = () => {
    expect(shownAlerts()).toHaveLength(1)
    const [[colour, text]] = shownAlerts() as Array<[string, string]>
    const [heading, ...lines] = text.split('\n')

    return { colour, heading, fields: lines.map((line) => line.split(': ')[0]) }
  }
  const nothingIsSaved = () => {
    expect(imageApi.calls).toEqual([])
    expect(widget!.emitted('afterMetadataSaveSuccess')).toBeUndefined()
    // The dialog stays, with the authors to pick, for the user to try again.
    expect(imageDialog()).toBeDefined()
    expect(widget!.findComponent(AuthorRemoteAutocompleteWithCached).exists()).toBe(true)
    expect(confirmButton().disabled).toBe(false)
  }

  it('are saved into the asset, the id and the authors alone, before the image is, with their names as its source', async () => {
    const mounted = await authorPicked()
    /** Whether the image had been written when the DAM got the authors. */
    let imageWrittenFirst: boolean | undefined
    dam.reply((request) => {
      if (request.method === 'PATCH' && dam.routes.bulkMetadata.test(request.url)) {
        imageWrittenFirst = imageApi.calls.length > 0
      }
      return undefined
    })

    confirmButton().click()
    await vi.waitFor(() => expect(mounted.emitted('afterMetadataSaveSuccess')).toHaveLength(1))

    expect(saves().map((request) => `${request.method} ${request.url}`)).toEqual([
      `PATCH ${endPoints.asset}/metadata-bulk-update`,
    ])
    expect(saves()[0].data).toBe('[{"id":"asset-9","authors":["author-5"],"described":true}]')
    expect(imageWrittenFirst).toBe(false)
    expect(imageApi.calls[0]).toMatchObject(['createImage', { texts: { source: 'Name of author-5' } }])
    expect(shownAlerts().filter(([colour]) => colour === 'error')).toEqual([])
  })

  // Nothing reads what the DAM answers the save of the authors with.
  it('are saved, and the image after them, also when the DAM answers with 200 and no list', async () => {
    answerSaves({ status: 200, data: {} })
    const mounted = await authorPicked()

    confirmButton().click()
    await vi.waitFor(() => expect(mounted.emitted('afterMetadataSaveSuccess')).toHaveLength(1))

    expect(imageApi.calls.map(([call]) => call)).toEqual(['createImage'])
    expect(shownAlerts().filter(([colour]) => colour === 'error')).toEqual([])
  })

  // Said once, by the name the forms give the field: the save used to say a refusal itself (as a system error,
  // "authors" being no custom field) and have the widget say it again, by the key of the request.
  it.each([
    ['the authors by their name', '[0].authors', alertText('common.damImage.asset.model.authors')],
    ['a custom field by the name its form gives it', '[0].customData.description', 'Description of the image'],
  ])('refused by validation: says once which field the DAM refuses, and saves no image: %s', async (_w, key, name) => {
    const elements = useDamConfigStore(pinia).damConfigAssetCustomFormElements.get(extSystem)![DamAssetType.Image]
    elements.find((element) => element.property === 'description')!.name = 'Description of the image'
    answerSaves(refusal(key))
    await authorPicked()

    await confirmed()

    expect(refusalSaid()).toEqual({
      colour: 'error',
      heading: alertText('common.alert.fixApiValidationErrors'),
      fields: [name],
    })
    nothingIsSaved()
  })

  // The save threw while it looked for the name of the field, and its promise was never settled: "confirm" spun
  // for good, and the dialog could only be closed.
  it('refused by validation while no custom form of the ext system is loaded: says so once, and "confirm" is free again', async () => {
    answerSaves(refusal('[0].authors'))
    await authorPicked()
    useDamConfigStore(pinia).damConfigAssetCustomFormElements.delete(extSystem)

    await confirmed()

    expect(refusalSaid().fields).toEqual([alertText('common.damImage.asset.model.authors')])
    nothingIsSaved()
  })

  it.each<[string, FakeDamAnswer, string]>([
    ['the user may not, when the DAM forbids them', { status: 403 }, 'common.alert.forbiddenError'],
    ['the save failed, when the DAM answers with 500', { status: 500 }, 'common.alert.unknownError'],
    ['the save failed, when the DAM answers with 204', { status: 204 }, 'common.alert.unknownError'],
  ])('says once that %s, and saves no image', async (_what, answer, alert) => {
    answerSaves(answer)
    await authorPicked()

    await confirmed()

    expect(shownAlerts()).toEqual([['error', alertText(alert)]])
    nothingIsSaved()
  })
})
