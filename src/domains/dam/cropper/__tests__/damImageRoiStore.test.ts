import { afterEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, defineStore, type Pinia, setActivePinia } from 'pinia'
import { nextTick, ref } from 'vue'
import type { AxiosInstance } from 'axios'
// eslint-disable-next-line no-restricted-imports -- what an admin reaches is the public entry
import * as lib from '@/lib'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { useImageRoiStore } from '@/domains/dam/cropper/store/imageRoiStore'

// The image and the region of interest the cropper of the regions (`ADamAssetImageRoiSelect`) shows. The library's
// own panel of regions fills the store in its asset detail; admin-dam fills it from a panel of its own, beside that
// cropper, and defined the store again for it, under the same id: Pinia keeps one store per id, so whichever of the
// two definitions was used first made the store, and the other got it without its own members. The library's store
// has every member now, under an id of its own, and is exported for an admin to fill.

const MEMBERS = [
  'imageFile',
  'loader',
  'roi',
  'timestampCropper',
  'timestampRoiPreviews',
  'setImageFile',
  'setRoi',
  'showLoader',
  'hideLoader',
  'forceReloadRoiPreviews',
  'forceReloadCropper',
  'reset',
]

let pinia: Pinia
let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
})
const freshPinia = () => {
  pinia = createPinia()
  setActivePinia(pinia)
}

// A definition of an admin's own under the library's id, with admin-dam's members: what Pinia hands the other caller
// when the store is made by one definition and asked for by the other.
const useDefinitionOfAnAdmin = defineStore('commonAdminDamImageRoiStore', () => {
  const imageFile = ref<unknown>(null)
  const loader = ref(false)
  const roi = ref<unknown>(null)
  const timestampCropper = ref(Date.now())
  const timestampRoiPreviews = ref(Date.now())
  const noop = () => undefined
  return {
    imageFile,
    loader,
    roi,
    timestampCropper,
    timestampRoiPreviews,
    setImageFile: noop,
    setRoi: noop,
    showLoader: noop,
    hideLoader: noop,
    forceReloadRoiPreviews: noop,
    forceReloadCropper: noop,
    reset: noop,
  }
})

describe('the store of the region of interest', () => {
  it.each<[string, () => unknown, () => unknown]>([
    [
      'the library, through the export, then a definition of an admin',
      () => lib.useDamImageRoiStore(),
      () => useDefinitionOfAnAdmin(),
    ],
    [
      'a definition of an admin, then the library, through the export',
      () => useDefinitionOfAnAdmin(),
      () => lib.useDamImageRoiStore(),
    ],
  ])('has every member whichever definition makes it: %s', (_order, first, second) => {
    freshPinia()
    expect(pinia.state.value).not.toHaveProperty('commonAdminDamImageRoiStore')
    const made = first() as Record<string, unknown>
    const asked = second() as Record<string, unknown>

    expect(asked).toBe(made)
    expect(MEMBERS.filter((member) => !(member in asked))).toEqual([])
    expect(asked.timestampCropper).toBeTypeOf('number')
    expect(asked.forceReloadCropper).toBeTypeOf('function')
  })

  // Until admin-dam uses the export, it keeps its own definition under the old id: a store apart, which no longer
  // takes the place of the library's.
  it('is apart from a store an admin defines under the id the library used to have', () => {
    freshPinia()
    const useOwnOfAnAdmin = defineStore('damImageRoiStore', () => ({ ownOnly: ref(true) }))
    const own = useOwnOfAnAdmin()
    const library = useImageRoiStore()

    expect(library).not.toBe(own)
    expect(library.$id).toBe('commonAdminDamImageRoiStore')
    expect('ownOnly' in library).toBe(false)
    expect(library.forceReloadRoiPreviews).toBeTypeOf('function')
  })

  it('takes a new time for the cropper and the previews, and sets both anew with everything else on reset', () => {
    freshPinia()
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000)
    const store = useImageRoiStore()
    expect([store.timestampCropper, store.timestampRoiPreviews]).toEqual([1000, 1000])

    now.mockReturnValue(2000)
    store.forceReloadCropper()
    now.mockReturnValue(3000)
    store.forceReloadRoiPreviews()
    expect([store.timestampCropper, store.timestampRoiPreviews]).toEqual([2000, 3000])

    store.setImageFile({ id: 'image-1' } as never)
    store.setRoi({ id: 'roi-1' } as never)
    store.showLoader()
    now.mockReturnValue(4000)
    store.reset()
    expect([store.imageFile, store.roi, store.loader, store.timestampCropper, store.timestampRoiPreviews]).toEqual([
      null,
      null,
      false,
      4000,
      4000,
    ])
  })

  it('is what the cropper of the regions shows, as an admin writes it through the export', async () => {
    freshPinia()
    initCommonAdminCoreDamOptions({
      configs: {
        default: {
          damClient: () => ({}) as AxiosInstance,
          endPointImage: '/adm/v1/image',
          endPointRoi: '/adm/v1/roi',
        },
      },
    } as never)
    useDamConfigStore().damConfigExtSystem.set(1, { image: { roiWidth: 16, roiHeight: 9 } } as never)
    wrapper = mount(lib.ADamAssetImageRoiSelect, {
      props: { extSystem: 1, readonly: true },
      global: { plugins: [pinia] },
    })
    expect(wrapper.find('[data-cy="roi-readonly-image"]').exists()).toBe(false)

    const store = lib.useDamImageRoiStore()
    store.setImageFile({
      id: 'image-1',
      manipulatedAt: '2026-01-01T00:00:00.000Z',
      imageAttributes: { width: 800, height: 600 },
      links: { image_detail: { url: 'https://image.test/image-1/detail.jpg' } },
    } as never)
    store.hideLoader()
    await nextTick()

    expect(wrapper.find('[data-cy="roi-readonly-image"]').exists()).toBe(true)
    expect(wrapper.findComponent({ name: 'VImg' }).props('src')).toBe(
      'https://image.test/image-1/detail.jpg?manipulated=2026-01-01T00:00:00.000Z'
    )
  })
})
