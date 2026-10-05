import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { defineComponent, h } from 'vue'
import ImageMassOperations from '@/domains/dam/imageWidget/components/ImageMassOperations.vue'
import { useImageStore } from '@/domains/dam/imageWidget/store/imageStore'

// The gallery's mass operations with DAM authors on: filling authors looks their names up first,
// and a failed lookup must be told, not dropped as an unhandled rejection with nothing filled.
const fetchAuthorListByIds = vi.hoisted(() => vi.fn())
const showErrorsDefault = vi.hoisted(() => vi.fn())
vi.mock('@/domains/dam/author/api/authorApi', () => ({
  ENTITY: 'author',
  fetchAuthorListByIds,
  useFetchAuthorList: vi.fn(),
  createAuthor: vi.fn(),
}))
vi.mock('@/domains/system/composables/alerts', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/domains/system/composables/alerts')>()
  return { ...original, useAlerts: () => ({ ...original.useAlerts(), showErrorsDefault }) }
})
vi.mock('@/domains/dam/composables/commonAdminCoreDamOptions', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useCommonAdminCoreDamOptions: () => ({
    damClient: () => ({}),
    sourceLabel: 'Source',
    descriptionValidation: { required: false },
    sourceValidation: { required: false },
  }),
}))
vi.mock('@/domains/dam/config/composables/damConfigState', () => ({
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

describe('ImageMassOperations of a read-only widget', () => {
  it('offers nothing, since the widget saves nothing', async () => {
    const wrapper = mountWithImages()
    useImageStore().readonly = true
    await flushPromises()
    expect(wrapper.findAll('button')).toHaveLength(0)
    wrapper.unmount()
  })
})

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

  it('writes nothing when the widget turned read-only while the authors loaded', async () => {
    let answer: (value: unknown) => void = () => undefined
    fetchAuthorListByIds.mockReturnValue(new Promise((resolve) => (answer = resolve)))
    const wrapper = mountWithImages()
    wrapper.findComponent(Authors).vm.$emit('update:modelValue', ['author-1'])
    await flushPromises()

    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Fill only empty')!
      .trigger('click')
    useImageStore().readonly = true
    answer([{ id: 'author-1', name: 'Jane Doe' }])
    await settle()

    expect(useImageStore().images[0]).toMatchObject({ damAuthors: [], texts: { source: '' } })
    wrapper.unmount()
  })
})
