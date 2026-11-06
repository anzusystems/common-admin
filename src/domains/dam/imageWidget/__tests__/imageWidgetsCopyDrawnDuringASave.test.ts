import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { type Component, defineComponent, h, ref, shallowRef } from 'vue'
import { matchedRouteKey } from 'vue-router'
import ImageMediaWidgetInner from '@/domains/dam/imageWidget/components/ImageMediaWidgetInner.vue'
import ImageWidgetInner from '@/domains/dam/imageWidget/components/ImageWidgetInner.vue'
import { useImageMediaWidgetStore } from '@/domains/dam/imageWidget/store/imageMediaWidgetStore'
import { ImageWidgetUploadConfigKey } from '@/domains/dam/imageWidget/utils/imageWidgetInkectionKeys'

// Guards a regression: a widget is taken away while its "edit metadata" save is on
// its way, and a copy is drawn elsewhere (the pin of a sidebar widget in admin-cms).
// The copy read the image before the save took effect, so its "edit metadata"
// offered old texts and its confirm saved them over the saved ones.
// The copy now takes the image as the save left it, with no extra
// request, and its dialog waits for a save still on its way.
// The image backend is a stand-in that keeps the texts saved last; a read
// answers with what it had when it was sent. The image dialog is a stand-in.

const server = vi.hoisted(() => ({
  texts: { description: '', source: '' },
  reads: 0,
  holdReads: false,
  heldReads: [] as Array<() => void>,
  saves: [] as Array<{ answer: () => void; fail: () => void }>,
  sent: [] as Array<{ texts: { description: string } }>,
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
        const now = { ...image, id, texts: { ...server.texts } }
        if (!server.holdReads) return Promise.resolve(now)
        return new Promise((resolve) => server.heldReads.push(() => resolve(now)))
      },
      updateImage: (_client: unknown, id: number, data: typeof image) => {
        server.sent.push(JSON.parse(JSON.stringify(data)))
        return new Promise((resolve, reject) =>
          server.saves.push({
            answer: () => {
              server.texts = { ...data.texts }
              resolve({ ...data, id })
            },
            fail: () => reject(new Error('the image was not saved')),
          })
        )
      },
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

const mounted: VueWrapper[] = []
beforeEach(() => {
  Object.assign(server, { texts: { ...before }, reads: 0, holdReads: false })
  server.sent.length = 0
})
afterEach(async () => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  server.heldReads.splice(0).forEach((answer) => answer())
  server.saves.splice(0).forEach((save) => save.answer())
  await flushPromises()
})

describe.each<[string, Component]>([
  ['ImageWidgetInner', ImageWidgetInner],
  ['ImageMediaWidgetInner', ImageMediaWidgetInner],
])('"edit metadata" of a copy of %s drawn while the save of its image is on its way', (_name, component) => {
  const isImageWidget = component === ImageWidgetInner

  const drawWidget = (view: object = theView) => {
    const model = ref<number | null>(7)
    const Parent = defineComponent({
      setup: () => () =>
        h(component as never, {
          queueKey: 'listingImage',
          uploadLicence: 1,
          selectLicences: [1],
          ...(isImageWidget
            ? { modelValue: model.value, 'onUpdate:modelValue': (value: number | null) => (model.value = value) }
            : { image: model.value, 'onUpdate:image': (value: number | null) => (model.value = value), media: null }),
        }),
    })
    const wrapper = mount(Parent, {
      attachTo: document.body,
      global: {
        provide: {
          [matchedRouteKey as symbol]: shallowRef({ instances: { default: view } }),
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
    // Found anew each time: once another widget is mounted with its own stand-ins, this one draws them anew.
    return { wrapper, dialog: () => wrapper.findComponent({ name: 'ImageDetailDialogMetadata' }) }
  }
  type Widget = ReturnType<typeof drawWidget>
  const mountWidget = async (view: object = theView) => {
    const widget = drawWidget(view)
    await flushPromises()
    return widget
  }

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
    const original = await mountWidget()
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
  const goes = (widget: Widget) => {
    mounted.splice(mounted.indexOf(widget.wrapper), 1)
    widget.wrapper.unmount()
  }
  const pinned = async (original: Widget) => {
    goes(original)
    const copy = drawWidget()
    await flushPromises()
    return copy
  }

  it('read by the copy before the save answered: shows the saved texts once it has, with no request more, and its confirm saves them', async () => {
    const copy = await pinned(await savedAndClosed())
    expect(server.reads).toBe(2)

    await saveAnswers()
    await editMetadata(copy)

    expect([isOpen(copy), loads(copy)]).toEqual([true, false])
    expect(shownTexts()).toEqual(after)
    expect(server.reads).toBe(2)

    copy.dialog().vm.$emit('confirm')
    await flushPromises()
    expect(server.sent.map((sent) => sent.texts)).toEqual([after, after])
    await saveAnswers()
  })

  it('read by the copy before the save took effect, answered after it: shows the saved texts', async () => {
    const original = await savedAndClosed()
    server.holdReads = true
    const copy = await pinned(original)
    await saveAnswers()
    server.heldReads.shift()!()
    await flushPromises()
    server.holdReads = false

    await editMetadata(copy)

    expect([isOpen(copy), loads(copy)]).toEqual([true, false])
    expect(shownTexts()).toEqual(after)
  })

  it('opened while the save is on its way: the dialog loads till the save answers, and then shows the saved texts', async () => {
    const copy = await pinned(await savedAndClosed())

    await editMetadata(copy)
    expect([isOpen(copy), loads(copy), shown()]).toEqual([true, true, null])

    await saveAnswers()
    expect([isOpen(copy), loads(copy)]).toEqual([true, false])
    expect(shownTexts()).toEqual(after)
  })

  it('opened while the save is on its way: the dialog loads till the save fails, and then shows the texts the copy read', async () => {
    const copy = await pinned(await savedAndClosed())

    await editMetadata(copy)
    expect([isOpen(copy), loads(copy), shown()]).toEqual([true, true, null])

    await saveAnswers('fail')
    expect([isOpen(copy), loads(copy)]).toEqual([true, false])
    expect(shownTexts()).toEqual(before)
  })

  it('closed while it loads: nothing opens when the save answers', async () => {
    const copy = await pinned(await savedAndClosed())
    await editMetadata(copy)
    expect(loads(copy)).toBe(true)
    copy.dialog().vm.$emit('close')
    await flushPromises()

    await saveAnswers()

    expect([isOpen(copy), loads(copy), shown()]).toEqual([false, false, null])
  })

  it('pinned after the save answered: the texts the copy read, with no request more', async () => {
    const original = await savedAndClosed()
    await saveAnswers()
    const copy = await pinned(original)

    await editMetadata(copy)

    expect([isOpen(copy), loads(copy)]).toEqual([true, false])
    expect(shownTexts()).toEqual(after)
    expect(server.reads).toBe(2)
  })

  // Guards a regression: the article is left while the save is on its way and
  // opened again (from the list, or by a status change that redraws the edit page).
  // The widget drawn there read the image before the save took effect.
  // It waited for nothing and took nothing, because the save belonged
  // to another page, and its confirm wrote the old texts back.
  it('of a widget drawn on the article opened again while the save is on its way: loads till it answers, then shows the saved texts', async () => {
    goes(await savedAndClosed())
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 20))
    const again = await mountWidget({})

    await editMetadata(again)
    expect([isOpen(again), loads(again), shown()]).toEqual([true, true, null])

    await saveAnswers()
    expect([isOpen(again), loads(again)]).toEqual([true, false])
    expect(shownTexts()).toEqual(after)
  })

  // Guards a regression: an opening of "edit metadata" closed while it waits must take its wait off the save.
  // Opened and closed repeatedly over a save that never answers, the waits piled up on the image note.
  it('closed while it waits, and opened again: the dialog loads once more, and shows the saved texts when the save answers', async () => {
    const copy = await pinned(await savedAndClosed())
    await editMetadata(copy)
    copy.dialog().vm.$emit('close')
    await flushPromises()
    await editMetadata(copy)
    expect([isOpen(copy), loads(copy)]).toEqual([true, true])

    await saveAnswers()

    expect([isOpen(copy), loads(copy)]).toEqual([true, false])
    expect(shownTexts()).toEqual(after)
  })

  // The wait is taken off the save when the opening ends, by close or by the widget going away.
  // Before, it stayed until the save answered, and repeated
  // open/close over a save that never answers piled the waits up.
  it.each<['closed' | 'gone']>([['closed'], ['gone']])(
    'that waits for the save, %s: lets its wait go at once, the save still on its way',
    async (how) => {
      const copy = await pinned(await savedAndClosed())
      const inner = copy.wrapper.findComponent(component).vm as unknown as { actionEditMeta: () => Promise<void> }
      const opening = inner.actionEditMeta()
      await flushPromises()
      expect(loads(copy)).toBe(true)

      if (how === 'closed') copy.dialog().vm.$emit('close')
      else goes(copy)
      const over = await Promise.race([
        opening.then(() => true),
        new Promise((resolve) => setTimeout(() => resolve(false), 30)),
      ])

      expect(over).toBe(true)
      expect(server.saves).toHaveLength(1)
    }
  )

  // No copy: the widget's own save is not waited for. Its answer closes the dialog.
  it('of the widget whose own save is on its way: opens at once with the image it holds, as before', async () => {
    const widget = await savedAndClosed()

    await editMetadata(widget)

    expect([isOpen(widget), loads(widget)]).toEqual([true, false])
    expect(shownTexts()).toEqual(before)
    await saveAnswers()
    expect(isOpen(widget)).toBe(false)
  })
})
