import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import ImageMassOperations from '@/components/damImage/uploadQueue/components/ImageMassOperations.vue'
import { useImageStore } from '@/components/damImage/uploadQueue/composables/imageStore'

// The gallery's mass operations with DAM authors on: filling authors looks their names up first,
// and a failed lookup must be told, not dropped as an unhandled rejection with nothing filled.
const fetchAuthorListByIds = vi.hoisted(() => vi.fn())
const showErrorsDefault = vi.hoisted(() => vi.fn())
vi.mock('@/components/damImage/uploadQueue/api/authorApi', () => ({
  ENTITY: 'author',
  fetchAuthorListByIds,
  useFetchAuthorList: vi.fn(),
  createAuthor: vi.fn(),
}))
vi.mock('@/composables/system/alerts', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/composables/system/alerts')>()
  return { ...original, useAlerts: () => ({ ...original.useAlerts(), showErrorsDefault }) }
})
vi.mock('@/components/dam/assetSelect/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({
    damClient: () => ({}),
    sourceLabel: 'Source',
    descriptionValidation: { required: false },
    sourceValidation: { required: false },
  }),
}))
vi.mock('@/components/damImage/uploadQueue/composables/damConfigState', () => ({
  useDamConfigState: () => ({ getDamConfigExtSystem: () => ({ image: { authors: { enabled: true } } }) }),
}))

const Authors = defineComponent({
  name: 'AuthorRemoteAutocompleteWithCached',
  emits: ['update:modelValue'],
  setup: () => () => h('div'),
})

const Scope = defineComponent({
  name: 'ASystemEntityScope',
  setup:
    (_props, { slots }) =>
    () =>
      h('div', slots.default?.()),
})

const rejections: unknown[] = []
const onRejection = (event: PromiseRejectionEvent) => {
  rejections.push(event.reason)
  event.preventDefault()
}
beforeEach(() => {
  rejections.length = 0
  window.addEventListener('unhandledrejection', onRejection)
})
afterEach(() => window.removeEventListener('unhandledrejection', onRejection))

const mountWithImages = () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  useImageStore().setImages([
    {
      key: 'k1',
      texts: { description: '', source: '' },
      flags: { showSource: true, internal: false, overrideInternal: false },
      dam: { damId: 'file-1', licenceId: 1, regionPosition: 0, internal: false },
      position: 1,
      damAuthors: [],
      showDamAuthors: true,
      assetId: 'asset-1',
    },
  ])
  return mount(ImageMassOperations, {
    global: {
      plugins: [pinia],
      stubs: { ASystemEntityScope: Scope, AuthorRemoteAutocompleteWithCached: Authors },
    },
  })
}

const settle = async () => {
  await flushPromises()
  await new Promise((resolve) => setTimeout(resolve, 20))
}

describe('ImageMassOperations with DAM authors', () => {
  it.each([['Fill only empty'], ['Replace all']])('"%s" reports a failed author lookup', async (label) => {
    const lookupFailed = new Error('Network Error')
    fetchAuthorListByIds.mockRejectedValue(lookupFailed)
    const wrapper = mountWithImages()
    wrapper.findComponent(Authors).vm.$emit('update:modelValue', ['author-1'])
    await flushPromises()

    await wrapper
      .findAll('button')
      .find((button) => button.text() === label)!
      .trigger('click')
    await settle()

    expect(fetchAuthorListByIds).toHaveBeenCalledWith(expect.anything(), expect.anything(), ['author-1'])
    expect(rejections).toEqual([])
    expect(showErrorsDefault).toHaveBeenCalledWith(lookupFailed)
    wrapper.unmount()
  })

  it('fills the authors and their names as the source when the lookup answers', async () => {
    fetchAuthorListByIds.mockResolvedValue([{ id: 'author-1', name: 'Jane Doe' }])
    const wrapper = mountWithImages()
    wrapper.findComponent(Authors).vm.$emit('update:modelValue', ['author-1'])
    await flushPromises()

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Fill only empty')!
      .trigger('click')
    await settle()

    expect(useImageStore().images[0]).toMatchObject({ damAuthors: ['author-1'], texts: { source: 'Jane Doe' } })
    expect(showErrorsDefault).not.toHaveBeenCalled()
    wrapper.unmount()
  })
})
