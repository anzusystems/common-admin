import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import { defineComponent, h, shallowRef } from 'vue'
import { type ConsumerImageApi, installConsumerImageApi } from '@/domains/dam/__tests__/support/consumerImageApi'
import { cmsConfiguration, installConsumerProfile } from '@/domains/dam/__tests__/support/consumerProfiles'
import { answerDamNames, DAM_NAMES, damNameLookups, damNamesAsked } from '@/domains/dam/__tests__/support/damNames'
import { createFakeDam, damAssetWithFile, type FakeDam } from '@/domains/dam/__tests__/support/fakeDam'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import {
  alertText,
  forgetAlerts,
  shownAlerts,
  signInToDam,
  signOutOfDam,
  uiText,
} from '@/domains/dam/__tests__/support/uploadUi'
import { updateAssetMetadata } from '@/domains/dam/api/damAssetApi'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import AuthorRemoteAutocompleteWithCached from '@/domains/dam/author/components/AuthorRemoteAutocompleteWithCached.vue'
import { useCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamNotificationsEventBus } from '@/domains/dam/composables/damNotificationsEventBus'
import { useExtSystemIdForCached } from '@/domains/dam/composables/extSystemIdForCached'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import ImageWidgetMultipleInner from '@/domains/dam/imageWidget/components/ImageWidgetMultipleInner.vue'
import ImageWidgetMultipleItem from '@/domains/dam/imageWidget/components/ImageWidgetMultipleItem.vue'
import { useImageMassOperations } from '@/domains/dam/imageWidget/composables/useImageMassOperations'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'
import { AssetFileProcessStatus } from '@/domains/dam/types/AssetFile'
import type { ImageAware } from '@/domains/dam/types/ImageAware'
import { useUploadQueueDialog } from '@/domains/dam/uploadQueue/composables/useUploadQueueDialog'
import { useAlertsQueue } from '@/domains/system/composables/alertsQueue'
import type { DocId } from '@/shared/types/common'

// Gallery save with DAM authors picked in a row (admin-cms only).
// The DAM replaces an asset's authors with what the widget sends.
// Authors given elsewhere since the row came used to be overwritten.
// Now each asset with a pick is read again right before the write.
// If it now has authors, nothing is written. Its rows take them, the user is told and saves again.
// A row takes their names as its source only if the source is empty or was
// written by "fill empty". The same applies when the "edit asset" detail closes.

const QUEUE = 'gallery'
const Picker = defineComponent({ name: 'AAssetSelect', emits: ['confirm'], setup: () => () => h('div') })
// Stand-in for the sortable list: draws only the rows and ignores commits.
const Editor = defineComponent({
  name: 'ASortableListEditor',
  setup: (_, { slots, expose }) => {
    expose({ commit: () => undefined, cancelReorderMode: () => undefined })
    return () => h('div', slots['view-body']?.())
  },
})

const profile = cmsConfiguration
const { endPoints, extSystem, licence } = profile
const SEARCH = new RegExp(
  `^${endPoints.asset.replace(/\//g, '\\/')}\\/licence\\/(\\d+)\\/search\\?assetAndMainFileIds=([^&]*)`
)

let pinia: Pinia
let dam: FakeDam
let imageApi: ConsumerImageApi
let waits: LongWaits
let widget: VueWrapper | undefined

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  dam = createFakeDam(endPoints)
  imageApi = installConsumerImageApi(profile, installConsumerProfile(profile, dam.client))
  answerDamNames(dam)
  dam.reply((request) => {
    const match = request.method === 'GET' ? request.url.match(SEARCH) : null
    if (!match) return undefined
    const files = match[2]!.split(',')
    const found = [...dam.assets.values()].filter((asset) => asset.mainFile && files.includes(asset.mainFile.id))
    return { status: 200, data: { data: found, totalCount: found.length } }
  })
  waits = holdLongWaits()
  forgetAlerts()
  signInToDam(extSystem)
})
afterEach(async () => {
  widget?.unmount()
  widget = undefined
  useUploadQueueDialog().uploadQueueDialog.value = null
  await damNamesAsked()
  waits.restore()
  useDamNotificationsEventBus().reset()
  signOutOfDam()
})

const images = () => useImageStore(pinia).images
const mountWidget = async (modelValue: number[]) => {
  const mounted: VueWrapper = mount(ImageWidgetMultipleInner, {
    attachTo: document.body,
    props: {
      modelValue,
      queueKey: QUEUE,
      uploadLicence: licence,
      selectLicences: [licence],
      'onUpdate:modelValue': (value: number[]) => mounted.setProps({ modelValue: value }),
    } as never,
    global: {
      plugins: [pinia],
      provide: {
        [ImageWidgetUploadConfigKey as symbol]: shallowRef({
          licence,
          extSystem,
          licenceName: '',
          extSystemConfig: useDamConfigStore(pinia).damConfigExtSystem.get(extSystem)!,
        }),
      },
      stubs: {
        ASortableListEditor: Editor,
        AAssetSelect: Picker,
        AssetDetailDialogFrame: true,
        AImageWidgetSimple: true,
        AssetImage: true,
        AssetQueueSelectedSidebar: true,
        AFileDropzone: true,
        AFormRemoteAutocompleteWithCached: true,
      },
    },
  })
  widget = mounted
  await flushPromises()
  return mounted
}
const withImages = async (ids: number[], sources: Record<number, string> = {}) => {
  ids.forEach((id, index) => {
    const image: ImageAware = {
      id,
      texts: { description: `image ${id}`, source: sources[id] ?? `source ${id}` },
      dam: { damId: `file-${id}`, licenceId: licence, regionPosition: 0, internal: false },
      flags: { showSource: true, internal: false, overrideInternal: false },
      position: index + 1,
    }
    imageApi.has(image)
    dam.assets.set(
      `asset-${id}`,
      damAssetWithFile(`asset-${id}`, `file-${id}`, AssetFileProcessStatus.Processed, { licence })
    )
  })
  const mounted = await mountWidget(ids)
  await vi.waitFor(() => expect(images()).toHaveLength(ids.length))
  await damNamesAsked()
  await flushPromises()
  return mounted
}
const givenAuthorsElsewhere = (id: DocId, authors: DocId[]) =>
  dam.assets.set(id, { ...structuredClone(dam.assets.get(id)!), authors })
const rows = () => widget!.findAllComponents(ImageWidgetMultipleItem)
const pickInRow = async (row: number, authors: DocId[]) => {
  rows()[row]!.findComponent(AuthorRemoteAutocompleteWithCached).vm.$emit('update:modelValue', authors)
  await flushPromises()
  // The cache lookups of the picked authors must be done by now, so the next held lookup is the one of the save.
  await damNamesAsked()
}
const fillEmptyAuthors = async (authors: DocId[]) => {
  await useImageMassOperations('default').replaceEmptyAuthors(authors)
  await flushPromises()
}
const save = () => (widget!.vm as unknown as { saveImages: () => Promise<boolean> }).saveImages()
// A growing text field has a hidden twin that measures it.
const textsOf = (root: Element) =>
  Array.from(root.querySelectorAll<HTMLTextAreaElement>('textarea'))
    .filter((field) => field.getAttribute('aria-hidden') !== 'true')
    .map((field) => field.value)
const metadataWrites = () =>
  dam.sentTo('PATCH', dam.routes.bulkMetadata).map((request) => dam.body(request) as Array<{ id: DocId }>)
const rereadsOf = (asset: DocId) =>
  dam.sentTo('GET', dam.routes.one).filter((request) => request.url === `${endPoints.asset}/${asset}`)
const namesAskedOf = (ids: string) =>
  damNameLookups(dam)
    .map((request) => request.url.match(DAM_NAMES)!)
    .filter((match) => match[1] === 'author' && new URLSearchParams(match[3]).get('id') === ids).length
const holdNamesOf = (author: DocId) => {
  const held = dam.hold('GET', new RegExp(`^/adm/v1/author/ext-system/\\d+/search\\?.*id=${author}$`))
  return {
    waiting: held.waiting,
    release: () =>
      held.release({
        status: 200,
        data: {
          data: [{ id: author, name: `Name of ${author}`, identifier: '', flags: { reviewed: true } }],
          totalCount: 1,
        },
      }),
  }
}
const calls = () => imageApi.calls.map(([call]) => call)
const sourcesSaved = () => {
  const [, sent] = imageApi.calls.at(-1) as ['bulkUpdateImages', ImageAware[]]
  return sent.map((image) => [image.id, image.texts.source])
}
const asRows = () =>
  images().map((image) => [image.id, image.assetId, image.damAuthors, image.showDamAuthors, image.texts.source])
const givenMeanwhileSaid = [['warning', alertText('common.damImage.image.meta.galleryAuthorsGivenMeanwhile')]]

describe('the save of the widget of several images, with authors of the DAM picked in a row', () => {
  it.each<[string, string, string]>([
    ['their names as its source, which was empty', '', 'Name of author-3'],
    ['the source its image has, which stays', 'typed by hand', 'typed by hand'],
  ])(
    'writes nothing once the asset of the row was given authors since: the row takes them, with %s, and the next save writes the images',
    async (_what, source, shown) => {
      await withImages([12], { 12: source })
      await pickInRow(0, ['author-5'])
      givenAuthorsElsewhere('asset-12', ['author-3'])

      expect(await save()).toBe(false)
      await flushPromises()

      expect(rereadsOf('asset-12')).toHaveLength(1)
      expect(metadataWrites()).toEqual([])
      expect(calls()).toEqual(['fetchImageListByIds'])
      expect(shownAlerts()).toEqual(givenMeanwhileSaid)
      expect(uiText('common.damImage.image.meta.galleryAuthorsGivenMeanwhile')).toBe(
        'The assets of some images have been given authors in the Media Library in the meantime. Images without a ' +
          'source of their own now have their names; the authors you picked were not saved, and nothing was saved. ' +
          'Check and save again.'
      )
      expect(useAlertsQueue().value.at(-1)!.timeout).toBe(-1)
      expect(asRows()).toEqual([[12, 'asset-12', ['author-3'], false, shown]])
      expect(textsOf(rows()[0]!.element)).toEqual(['image 12', shown])

      expect(await save()).toBe(true)
      expect(metadataWrites()).toEqual([])
      expect(sourcesSaved()).toEqual([[12, shown]])
      expect(dam.assets.get('asset-12')!.authors).toEqual(['author-3'])
      expect(shownAlerts()).toEqual(givenMeanwhileSaid)
    }
  )

  it('writes nothing of another asset either, and writes the pick of that one with the next save', async () => {
    await withImages([12, 13], { 12: '', 13: '' })
    await pickInRow(0, ['author-5'])
    await pickInRow(1, ['author-6'])
    givenAuthorsElsewhere('asset-12', ['author-3'])

    expect(await save()).toBe(false)
    await flushPromises()

    expect(metadataWrites()).toEqual([])
    expect(calls()).toEqual(['fetchImageListByIds'])
    expect(asRows()).toEqual([
      [12, 'asset-12', ['author-3'], false, 'Name of author-3'],
      [13, 'asset-13', ['author-6'], true, ''],
    ])

    expect(await save()).toBe(true)
    expect(metadataWrites()).toEqual([[{ id: 'asset-13', authors: ['author-6'] }]])
    expect(sourcesSaved()).toEqual([
      [12, 'Name of author-3'],
      [13, 'Name of author-6'],
    ])
    expect([rereadsOf('asset-12'), rereadsOf('asset-13')].map((reads) => reads.length)).toEqual([1, 2])
  })

  it('writes nothing over the authors an asset was given since of what "fill empty" picked in its row, and gives the row their names', async () => {
    await withImages([12, 13], { 12: 'source 12', 13: '' })
    await fillEmptyAuthors(['author-7'])
    expect(asRows()).toEqual([
      [12, 'asset-12', ['author-7'], true, 'Name of author-7'],
      [13, 'asset-13', ['author-7'], true, 'Name of author-7'],
    ])
    givenAuthorsElsewhere('asset-12', ['author-3'])

    expect(await save()).toBe(false)
    await flushPromises()

    expect(metadataWrites()).toEqual([])
    expect(shownAlerts()).toEqual(givenMeanwhileSaid)
    expect(asRows()).toEqual([
      [12, 'asset-12', ['author-3'], false, 'Name of author-3'],
      [13, 'asset-13', ['author-7'], true, 'Name of author-7'],
    ])

    expect(await save()).toBe(true)
    expect(metadataWrites()).toEqual([[{ id: 'asset-13', authors: ['author-7'] }]])
    expect(dam.assets.get('asset-12')!.authors).toEqual(['author-3'])
  })

  it.each<[string, () => Promise<void>]>([
    [
      '"replace everywhere" of the source of the mass operations',
      async () => {
        useImageMassOperations('default').replaceEmptySource('Name of author-7', true)
        await flushPromises()
      },
    ],
    [
      'the source field of the row, while the page draws no pick of the authors',
      async () => {
        const WITHOUT_AUTHORS = 7
        const config = useDamConfigStore(pinia)
        const own = config.damConfigExtSystem.get(extSystem)!
        config.damConfigExtSystem.set(WITHOUT_AUTHORS, {
          ...own,
          image: { ...own.image!, authors: { enabled: false, required: false } },
        })
        useExtSystemIdForCached().cachedExtSystemId.value = WITHOUT_AUTHORS
        await flushPromises()
        const row = rows()[0]!.element as Element
        const source = Array.from(row.querySelectorAll<HTMLTextAreaElement>('textarea')).filter(
          (field) => field.getAttribute('aria-hidden') !== 'true'
        )[1]!
        for (const text of ['Name of author-', 'Name of author-7']) {
          source.value = text
          source.dispatchEvent(new Event('input', { bubbles: true }))
          await flushPromises()
        }
        useExtSystemIdForCached().cachedExtSystemId.value = extSystem
        await flushPromises()
      },
    ],
  ])(
    'keeps the source given by %s once the asset turns out to have authors, though its text is what "fill empty" wrote',
    async (_by, giveSource) => {
      await withImages([12], { 12: '' })
      await fillEmptyAuthors(['author-7'])
      await giveSource()
      expect(asRows()).toEqual([[12, 'asset-12', ['author-7'], true, 'Name of author-7']])
      givenAuthorsElsewhere('asset-12', ['author-3'])

      expect(await save()).toBe(false)
      await flushPromises()

      expect(metadataWrites()).toEqual([])
      expect(asRows()).toEqual([[12, 'asset-12', ['author-3'], false, 'Name of author-7']])
    }
  )

  it('reads the asset again after the names of the picked authors: given authors meanwhile, it writes nothing', async () => {
    await withImages([12], { 12: '' })
    await pickInRow(0, ['author-5'])
    const names = holdNamesOf('author-5')
    const saved = save()
    await vi.waitFor(() => expect(names.waiting).toHaveLength(1))
    expect(rereadsOf('asset-12')).toEqual([])

    givenAuthorsElsewhere('asset-12', ['author-3'])
    names.release()

    expect(await saved).toBe(false)
    expect(rereadsOf('asset-12')).toHaveLength(1)
    expect(metadataWrites()).toEqual([])
    expect(calls()).toEqual(['fetchImageListByIds'])
    expect(asRows()).toEqual([[12, 'asset-12', ['author-3'], false, 'Name of author-3']])
  })

  it('writes nothing when the asset cannot be read again: that is said, and the next save writes the pick', async () => {
    await withImages([12], { 12: '' })
    await pickInRow(0, ['author-5'])
    const answerAgain = dam.reply((request) =>
      request.method === 'GET' && request.url === `${endPoints.asset}/asset-12` ? { status: 500 } : undefined
    )

    expect(await save()).toBe(false)
    await flushPromises()

    expect(shownAlerts()).toEqual([['error', alertText('common.alert.unknownError')]])
    expect(metadataWrites()).toEqual([])
    expect(calls()).toEqual(['fetchImageListByIds'])
    expect(asRows()).toEqual([[12, 'asset-12', ['author-5'], true, '']])

    answerAgain()
    expect(await save()).toBe(true)
    expect(metadataWrites()).toEqual([[{ id: 'asset-12', authors: ['author-5'] }]])
    expect(sourcesSaved()).toEqual([[12, 'Name of author-5']])
  })

  it.each<[string, boolean, boolean]>([
    ['is gone, and the DAM has authors', true, true],
    ['is gone, and the DAM has none', true, false],
    ['has turned read-only, and the DAM has authors', false, true],
    ['has turned read-only, and the DAM has none', false, false],
  ])('writes nothing and says nothing when the widget %s by the time the asset is read', async (_what, gone, given) => {
    const mounted = await withImages([12], { 12: '' })
    await pickInRow(0, ['author-5'])
    if (given) givenAuthorsElsewhere('asset-12', ['author-3'])
    const held = dam.hold('GET', dam.routes.one)
    const saved = save()
    await vi.waitFor(() => expect(held.waiting).toHaveLength(1))

    if (gone) {
      mounted.unmount()
      widget = undefined
    } else {
      await mounted.setProps({ readonly: true })
    }
    held.release()

    expect(await saved).toBe(false)
    await waits.settle()
    expect(metadataWrites()).toEqual([])
    expect(calls()).toEqual(['fetchImageListByIds'])
    expect(shownAlerts()).toEqual([])
    expect(asRows()).toEqual([[12, 'asset-12', ['author-5'], true, '']])
  })

  it('writes nothing, and asks for nothing more, when the widget is gone while the names of the picked authors are read', async () => {
    const mounted = await withImages([12], { 12: '' })
    await pickInRow(0, ['author-5'])
    const names = holdNamesOf('author-5')
    const saved = save()
    await vi.waitFor(() => expect(names.waiting).toHaveLength(1))

    mounted.unmount()
    widget = undefined
    names.release()

    expect(await saved).toBe(false)
    await waits.settle()
    expect(rereadsOf('asset-12')).toEqual([])
    expect(metadataWrites()).toEqual([])
    expect(calls()).toEqual(['fetchImageListByIds'])
    expect(shownAlerts()).toEqual([])
  })
})

describe('the detail of the asset of a row of the widget of several images, once it has closed', () => {
  const detail = () => useAssetDetailStore(pinia)
  const damKeepsAuthors = () =>
    dam.reply((request) => {
      if (request.method !== 'PATCH' || !dam.routes.bulkMetadata.test(request.url)) return undefined
      for (const sent of dam.body(request) as Array<{ id: DocId; authors?: DocId[] }>) {
        if (dam.assets.has(sent.id) && sent.authors) givenAuthorsElsewhere(sent.id, [...sent.authors])
      }
      return undefined
    })
  const editAssetOf = async (row: number) => {
    const asset = images()[row]!.assetId!
    const { editAssetLabel } = useCommonAdminCoreDamOptions('default')
    await rows()
      [row]!.findAll('button')
      .find((button) => button.text() === editAssetLabel)!
      .trigger('click')
    await vi.waitFor(() => expect(detail().asset?.id).toBe(asset))
    await flushPromises()
  }
  /**
   * The detail form is not drawn here. This sends what its save sends, with the authors the user picks.
   */
  const saveInDetail = async (authors: DocId[]) => {
    const { damClient, endPointAsset } = useCommonAdminCoreDamOptions('default')
    detail().asset!.authors = authors
    await updateAssetMetadata(damClient, endPointAsset, detail().asset!, extSystem, detail().mainFileSingleUse)
    await flushPromises()
  }
  const closeDetail = async () => {
    widget!.findComponent({ name: 'AssetDetailDialogFrame' }).vm.$emit('close')
    await flushPromises()
  }

  it.each<[string, string, boolean]>([
    ['an image without a source', '', false],
    ['a source "fill empty" wrote over the one of its image', 'source 12', true],
  ])('gives the row the names of the authors as its source, for %s', async (_what, source, filled) => {
    await withImages([12], { 12: source })
    damKeepsAuthors()
    if (filled) await fillEmptyAuthors(['author-7'])
    await editAssetOf(0)
    await saveInDetail(['author-9'])

    await closeDetail()
    await vi.waitFor(() => expect(images()[0]!.showDamAuthors).toBe(false))
    await flushPromises()

    expect(asRows()).toEqual([[12, 'asset-12', ['author-9'], false, 'Name of author-9']])
    expect(textsOf(rows()[0]!.element)).toEqual(['image 12', 'Name of author-9'])
    expect(await save()).toBe(true)
    expect(metadataWrites()).toHaveLength(1)
    expect(sourcesSaved()).toEqual([[12, 'Name of author-9']])
  })

  it('writes nothing, and asks for nothing more, when the widget is gone while its save waits for that read', async () => {
    const mounted = await withImages([12], { 12: '' })
    damKeepsAuthors()
    await pickInRow(0, ['author-7'])
    await editAssetOf(0)
    await saveInDetail([])
    const held = dam.hold('GET', dam.routes.one)
    await closeDetail()
    await vi.waitFor(() => expect(held.waiting).toHaveLength(1))
    const lookups = namesAskedOf('author-7')
    const saved = save()
    await waits.settle()

    mounted.unmount()
    widget = undefined
    held.release()
    await waits.settle()
    held.release()

    expect(await saved).toBe(false)
    await waits.settle()
    expect(rereadsOf('asset-12')).toHaveLength(1)
    expect(namesAskedOf('author-7')).toBe(lookups)
    expect(metadataWrites()).toHaveLength(1)
    expect(calls()).toEqual(['fetchImageListByIds'])
  })
})

describe('the marks of the sources "fill empty" wrote', () => {
  it('go with their rows: a row removed, or no more among the rows set, has none when it comes again', async () => {
    await withImages([12, 13, 14], { 12: '', 13: '', 14: '' })
    await fillEmptyAuthors(['author-7'])
    const store = useImageStore(pinia)
    const [removed, replaced, kept] = [...images()]
    expect([removed, replaced, kept].map((row) => store.hasSourceOfPick(row!))).toEqual([true, true, true])

    store.removeImageByIndex(0)
    store.setImages([kept!])
    store.addImages([removed!, replaced!])

    expect([removed, replaced, kept].map((row) => store.hasSourceOfPick(row!))).toEqual([false, false, true])
  })
})
