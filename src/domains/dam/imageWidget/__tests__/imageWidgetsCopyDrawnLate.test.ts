import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { type Component, defineComponent, h, ref } from 'vue'
import AImageMediaWidget from '@/domains/dam/imageWidget/components/AImageMediaWidget.vue'
import AImageWidget from '@/domains/dam/imageWidget/components/AImageWidget.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'

// Guards a regression: a copy of a widget is pinned while its image save is on its
// way, and drawn only after the licence configuration is read from the network.
// A select licence whose read failed is not kept, so every drawn widget reads it again.
// The note of the saves of that image was dropped while the save was still running.
// The copy then neither waited for the save nor took its result, and its
// "edit metadata" offered the old texts, whose confirm saved them back.
// The image backend keeps the texts saved last; a read answers with
// what it had when it was sent. The image dialog is a stand-in.

const server = vi.hoisted(() => ({
  texts: { description: '', source: '' },
  saves: [] as Array<() => void>,
  configReads: [] as Array<() => void>,
  holdConfigReads: false,
}))

vi.mock('@/domains/dam/imageWidget/composables/commonAdminImageOptions', () => ({
  useCommonAdminImageOptions: () => ({
    imageClient: () => ({}),
    previewDomain: 'https://img',
    imageWidth: 300,
    imageHeight: 200,
    imageApi: {
      fetchImage: (_client: unknown, id: number) => Promise.resolve({ ...image, id, texts: { ...server.texts } }),
      updateImage: (_client: unknown, id: number, data: typeof image) =>
        new Promise((resolve) =>
          server.saves.push(() => {
            server.texts = { ...data.texts }
            resolve({ ...data, id })
          })
        ),
    },
  }),
}))
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointAsset: '/asset' }),
}))
// The upload licence is known; the library licences are read when the case lets them.
vi.mock('@/domains/dam/config/composables/damConfigState', () => ({
  useDamConfigState: () => ({
    getOrLoadDamConfigExtSystemByLicence: async () => ({
      extSystem: 1,
      licence: 1,
      licenceName: '',
      extSystemConfig: {},
    }),
    getOrLoadDamConfigExtSystemByLicences: () =>
      server.holdConfigReads
        ? new Promise((resolve) => server.configReads.push(() => resolve([])))
        : Promise.resolve([]),
    getDamConfigAssetCustomFormElements: () => [],
    loadDamConfigAssetCustomFormElements: async () => undefined,
    loadDamPrvConfig: async () => undefined,
    getDamConfigExtSystem: () => undefined,
    getExtSystemByLicence: async () => 1,
  }),
}))
vi.mock('@/domains/dam/config/utils/damFilterUserAllowedUploadConfigs', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isImageWidgetUploadConfigAllowed: () => true,
}))

const before = { description: 'before', source: 'Agency' }
const after = { description: 'after', source: 'Agency, edited' }
const image = {
  id: 7,
  texts: before,
  flags: { showSource: true, internal: false, overrideInternal: false },
  dam: { damId: 'file-7', licenceId: 1, regionPosition: 0, internal: false },
  position: 1,
}

const mounted: VueWrapper[] = []
beforeEach(() => {
  Object.assign(server, { texts: { ...before }, holdConfigReads: false })
})
afterEach(async () => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  server.configReads.splice(0).forEach((answer) => answer())
  server.saves.splice(0).forEach((answer) => answer())
  await flushPromises()
})

describe.each<[string, Component]>([
  ['AImageWidget', AImageWidget],
  ['AImageMediaWidget', AImageMediaWidget],
])('"edit metadata" of a copy of %s drawn once its configuration is read', (_name, component) => {
  const isImageWidget = component === AImageWidget

  const drawWidget = () => {
    const model = ref<number | null>(7)
    const Parent = defineComponent({
      setup: () => () =>
        h(component as never, {
          queueKey: 'listingImage',
          uploadLicence: 1,
          selectLicences: [1, 2],
          ...(isImageWidget
            ? { modelValue: model.value, 'onUpdate:modelValue': (value: number | null) => (model.value = value) }
            : { image: model.value, 'onUpdate:image': (value: number | null) => (model.value = value), media: null }),
        }),
    })
    const wrapper = mount(Parent, {
      attachTo: document.body,
      global: {
        stubs: {
          ImageDetailDialogMetadata: true,
          AAssetSelect: true,
          AAssetSelectMedia: true,
          AssetDetailDialog: true,
          UploadQueueDialogSingle: true,
          AFileInputDialog: true,
          AFileDropzone: true,
        },
      },
    })
    mounted.push(wrapper)
    return { wrapper, dialog: () => wrapper.findComponent({ name: 'ImageDetailDialogMetadata' }) }
  }
  type Widget = ReturnType<typeof drawWidget>

  const editMetadata = async (widget: Widget) => {
    widget.wrapper.findComponent({ name: 'VMenu' }).vm.$emit('update:modelValue', true)
    await flushPromises()
    const item = widget.wrapper
      .findAllComponents({ name: 'VListItem' })
      .find((one) => one.text().includes('Edit image'))!
    await item.trigger('click')
    await flushPromises()
  }
  const isOpen = (widget: Widget) => widget.dialog().props('modelValue') as boolean
  const loads = (widget: Widget) => widget.dialog().props('loading') as boolean
  const shownTexts = () => (useImageMediaWidgetStore().detail as typeof image | null)?.texts
  const saveAnswers = async () => {
    server.saves.shift()!()
    await flushPromises()
    await flushPromises()
  }
  const pinnedWhileTheConfigIsRead = async () => {
    const original = drawWidget()
    await flushPromises()
    useImageMediaWidgetStore().setDetail({ ...structuredClone(image), texts: { ...after } })
    original.dialog().vm.$emit('update:modelValue', true)
    await flushPromises()
    original.dialog().vm.$emit('confirm')
    await flushPromises()
    expect(server.saves).toHaveLength(1)
    original.dialog().vm.$emit('close')
    await flushPromises()
    server.holdConfigReads = true
    mounted.splice(mounted.indexOf(original.wrapper), 1)
    original.wrapper.unmount()
    const copy = drawWidget()
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(copy.dialog().exists()).toBe(false)
    server.configReads.shift()!()
    await flushPromises()
    expect(copy.dialog().exists()).toBe(true)
    return copy
  }

  it('opened while the save is still on its way: loads till it answers, and then shows the saved texts', async () => {
    const copy = await pinnedWhileTheConfigIsRead()

    await editMetadata(copy)
    expect([isOpen(copy), loads(copy)]).toEqual([true, true])

    await saveAnswers()
    expect([isOpen(copy), loads(copy)]).toEqual([true, false])
    expect(shownTexts()).toEqual(after)
  })

  it('opened once the save has answered, after the copy read the image: shows the saved texts', async () => {
    const copy = await pinnedWhileTheConfigIsRead()
    await saveAnswers()

    await editMetadata(copy)

    expect([isOpen(copy), loads(copy)]).toEqual([true, false])
    expect(shownTexts()).toEqual(after)
  })
})
