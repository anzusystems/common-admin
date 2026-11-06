import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { type Component, defineComponent, h, ref, shallowRef } from 'vue'
import { matchedRouteKey } from 'vue-router'
import { holdLongWaits, type LongWaits } from '@/domains/dam/__tests__/support/longWaits'
import { alertText, forgetAlerts, shownAlerts } from '@/domains/dam/__tests__/support/uploadUi'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'

// Guards a regression: a widget is taken away while its "edit metadata" save is on
// its way, and a copy is drawn elsewhere (the pin of a sidebar widget in admin-cms).
// "Edit metadata" of the copy waits for that save, and it loaded until the editor closed it if the save never answered.
// A copy that draws the form in the page (`expandMetadata`) did not wait at all.
// It showed the texts read before the save took effect, and the host's confirm saved them over the saved ones.
// The image backend keeps the texts saved last; a read answers with
// what it had when it was sent. The image dialog is a stand-in.

const server = vi.hoisted(() => ({
  texts: { description: '', source: '' },
  reads: 0,
  saves: [] as Array<{ answer: () => void; fail: () => void }>,
}))

vi.mock('@/domains/dam/imageWidget/composables/commonAdminImageOptions', () => ({
  useCommonAdminImageOptions: () => ({
    imageClient: () => ({}),
    previewDomain: 'https://img',
    imageWidth: 300,
    imageHeight: 200,
    imageApi: {
      fetchImage: (_client: unknown, id: number) => {
        server.reads++
        return Promise.resolve({ ...image, id, texts: { ...server.texts } })
      },
      updateImage: (_client: unknown, id: number, data: typeof image) =>
        new Promise((resolve, reject) =>
          server.saves.push({
            answer: () => {
              server.texts = { ...data.texts }
              resolve({ ...data, id })
            },
            fail: () => reject(new Error('the image was not saved')),
          })
        ),
    },
  }),
}))
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({ damClient: () => ({}), endPointAsset: '/asset' }),
}))
vi.mock('@/domains/dam/config/composables/damConfigState', () => ({
  useDamConfigState: () => ({ getDamConfigExtSystem: () => undefined, getExtSystemByLicence: async () => 1 }),
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

const theView = {}

let waits: LongWaits
const mounted: VueWrapper[] = []
beforeEach(() => {
  Object.assign(server, { texts: { ...before }, reads: 0 })
  waits = holdLongWaits()
  forgetAlerts()
})
afterEach(async () => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  server.saves.splice(0).forEach((save) => save.answer())
  await flushPromises()
  waits.restore()
})

describe.each<[string, Component]>([
  ['ImageWidgetInner', ImageWidgetInner],
  ['ImageMediaWidgetInner', ImageMediaWidgetInner],
])('a copy of %s drawn while the save of its image is on its way', (_name, component) => {
  const isImageWidget = component === ImageWidgetInner

  const drawWidget = (expandMetadata = false) => {
    const model = ref<number | null>(7)
    const Parent = defineComponent({
      setup: () => () =>
        h(component as never, {
          queueKey: 'listingImage',
          uploadLicence: 1,
          selectLicences: [1],
          expandMetadata,
          ...(isImageWidget
            ? { modelValue: model.value, 'onUpdate:modelValue': (value: number | null) => (model.value = value) }
            : { image: model.value, 'onUpdate:image': (value: number | null) => (model.value = value), media: null }),
        }),
    })
    const wrapper = mount(Parent, {
      attachTo: document.body,
      global: {
        provide: {
          [matchedRouteKey as symbol]: shallowRef({ instances: { default: theView } }),
          [ImageWidgetUploadConfigKey as symbol]: shallowRef({
            licence: 1,
            extSystem: 1,
            licenceName: '',
            extSystemConfig: {},
          }),
        },
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
  const shown = () => useImageMediaWidgetStore().detail
  const shownTexts = () => (shown() as typeof image | null)?.texts
  const saveAnswers = async (how: 'answer' | 'fail' = 'answer') => {
    server.saves.shift()![how]()
    await flushPromises()
    await flushPromises()
  }
  const savedAndClosed = async () => {
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
    return original
  }
  const pinned = async (original: Widget, expandMetadata = false) => {
    mounted.splice(mounted.indexOf(original.wrapper), 1)
    original.wrapper.unmount()
    const copy = drawWidget(expandMetadata)
    await flushPromises()
    return copy
  }
  const timedOutSaid = [['error', alertText('error.apiTimedOut.message')]]

  it('"edit metadata" opened while the save is on its way: once the wait runs out, the dialog closes and says the request timed out', async () => {
    const copy = await pinned(await savedAndClosed())
    await editMetadata(copy)
    expect([isOpen(copy), loads(copy)]).toEqual([true, true])

    expect(await waits.elapse()).toBe(true)

    expect([isOpen(copy), loads(copy), shown()]).toEqual([false, false, null])
    expect(shownAlerts()).toEqual(timedOutSaid)
    await saveAnswers()
    expect([isOpen(copy), shown()]).toEqual([false, null])
  })

  it('with the form in the page: loads till the save answers, and then shows the saved texts', async () => {
    const copy = await pinned(await savedAndClosed(), true)
    expect(server.reads).toBe(2)
    expect([loads(copy), shown()]).toEqual([true, null])

    await saveAnswers()

    expect(loads(copy)).toBe(false)
    expect(shownTexts()).toEqual(after)
    expect(server.reads).toBe(2)
    expect(shownAlerts()).toEqual([])
  })

  it('with the form in the page: loads till the save fails, and then shows the texts it read', async () => {
    const copy = await pinned(await savedAndClosed(), true)

    await saveAnswers('fail')

    expect(loads(copy)).toBe(false)
    expect(shownTexts()).toEqual(before)
  })

  it('with the form in the page: once the wait runs out, shows the texts it read and says the request timed out', async () => {
    const copy = await pinned(await savedAndClosed(), true)

    expect(await waits.elapse()).toBe(true)

    expect(loads(copy)).toBe(false)
    expect(shownTexts()).toEqual(before)
    expect(shownAlerts()).toEqual(timedOutSaid)
  })

  it('with the form in the page, drawn after the save answered: shows the saved texts at once', async () => {
    const original = await savedAndClosed()
    await saveAnswers()
    const copy = await pinned(original, true)

    expect(loads(copy)).toBe(false)
    expect(shownTexts()).toEqual(after)
    expect(await waits.elapse()).toBe(false)
  })
})
