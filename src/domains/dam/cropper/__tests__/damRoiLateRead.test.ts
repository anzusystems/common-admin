import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosInstance } from 'axios'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { useImageRoiStore } from '@/domains/dam/cropper/store/imageRoiStore'
import ACropper from '@/domains/dam/cropper/components/ACropper.vue'
import DamAssetImageRoiSelect from '@/domains/dam/cropper/components/DamAssetImageRoiSelect.vue'
import { fetchImageFile } from '@/domains/dam/api/damImageApi'
import type { AssetFileImage } from '@/domains/dam/types/AssetFile'

// Two seconds after a region is saved, the cropper reads that region's file again to show it as the DAM redrew it.
// By then an admin may show another file (another slot of the asset), or the cropper may be gone.
// The read is for the saved file, and its answer goes into the store only while that file is shown.

vi.mock('@/domains/dam/api/damImageRoiApi', () => ({
  ENTITY: 'imageRoi',
  updateRoi: vi.fn(async () => undefined),
  fetchRoi: vi.fn(),
  useFetchImageRoiList: () => ({ execute: vi.fn(async () => []) }),
}))
vi.mock('@/domains/dam/api/damImageApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchImageFile: vi.fn(),
}))

const file = (id: string, manipulatedAt: string) =>
  ({
    id,
    _resourceName: 'imageFile',
    manipulatedAt,
    imageAttributes: { width: 800, height: 600 },
    links: { image_detail: { url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' } },
  }) as unknown as AssetFileImage
const roi = { id: 'roi-1', pointX: 0, pointY: 0, percentageWidth: 0.5, percentageHeight: 0.5 } as never
const pastTheWait = () => new Promise((resolve) => setTimeout(resolve, 2300))

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.mocked(fetchImageFile).mockReset()
})

const savedOnA = async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  initCommonAdminCoreDamOptions({ configs: { default: { damClient: () => ({}) as AxiosInstance } } } as never)
  useDamConfigStore().damConfigExtSystem.set(1, { image: { roiWidth: 16, roiHeight: 9 } } as never)
  const store = useImageRoiStore()
  store.setImageFile(file('file-a', 'before'))
  store.setRoi(roi)
  wrapper = mount(DamAssetImageRoiSelect, { props: { extSystem: 1 }, global: { plugins: [pinia] } })
  wrapper.findComponent(ACropper).vm.$emit('commit', { x: 0.1, y: 0.1, width: 0.4, height: 0.3 })
  await flushPromises()
  return store
}

describe('the read of the file after a region is saved', () => {
  it('puts the file as the DAM has redrawn it in the store, while it is still shown', async () => {
    vi.mocked(fetchImageFile).mockResolvedValue(file('file-a', 'redrawn'))
    const store = await savedOnA()

    await pastTheWait()
    await flushPromises()

    expect(vi.mocked(fetchImageFile).mock.calls.map((call) => call[2])).toEqual(['file-a'])
    expect(store.imageFile).toMatchObject({ id: 'file-a', manipulatedAt: 'redrawn' })
    expect(store.loader).toBe(false)
  })

  it('leaves the file of another slot shown when the read of the saved file answers after the switch', async () => {
    let answer!: (read: AssetFileImage) => void
    vi.mocked(fetchImageFile).mockImplementation(() => new Promise((resolve) => (answer = resolve)))
    const store = await savedOnA()
    await vi.waitFor(() => expect(fetchImageFile).toHaveBeenCalledTimes(1), { timeout: 4000 })

    store.setImageFile(file('file-b', 'of slot b'))
    answer(file('file-a', 'redrawn'))
    await flushPromises()

    expect(store.imageFile).toMatchObject({ id: 'file-b', manipulatedAt: 'of slot b' })
  })

  it('reads no file once another is shown when the two seconds are up', async () => {
    const store = await savedOnA()
    store.setImageFile(file('file-b', 'of slot b'))

    await pastTheWait()
    await flushPromises()

    expect(fetchImageFile).not.toHaveBeenCalled()
    expect(store.imageFile).toMatchObject({ id: 'file-b', manipulatedAt: 'of slot b' })
  })

  it('reads nothing once the cropper is gone', async () => {
    const store = await savedOnA()
    wrapper!.unmount()
    wrapper = undefined

    await pastTheWait()
    await flushPromises()

    expect(fetchImageFile).not.toHaveBeenCalled()
    expect(store.imageFile).toMatchObject({ id: 'file-a', manipulatedAt: 'before' })
  })

  // The cropper waits for the read after its save with a loader of its own. Something else
  // hiding the store loader meanwhile (the region panel does so when it ends its reload) must
  // not bring the cropper back, and no second save may start while the first read is in flight.
  // Previously the first read, answering last, could bring back the file as the DAM drew it before the second save.
  it('stays hidden until the read after its save answers, also when the loader of the store is hidden', async () => {
    let answer!: (read: AssetFileImage) => void
    vi.mocked(fetchImageFile).mockImplementation(() => new Promise((resolve) => (answer = resolve)))
    const store = await savedOnA()
    await vi.waitFor(() => expect(fetchImageFile).toHaveBeenCalledTimes(1), { timeout: 4000 })
    store.hideLoader()
    await flushPromises()

    expect(wrapper!.findComponent(ACropper).exists()).toBe(false)
    expect(wrapper!.findComponent({ name: 'VProgressCircular' }).exists()).toBe(true)
    answer(file('file-a', 'redrawn'))
    await flushPromises()

    expect(store.imageFile).toMatchObject({ id: 'file-a', manipulatedAt: 'redrawn' })
    expect(wrapper!.findComponent({ name: 'VProgressCircular' }).exists()).toBe(false)
    expect(wrapper!.findComponent(ACropper).exists()).toBe(true)
  })

  // admin-dam changes the slot so: the region goes and its loader turns
  // on at once, and the new slot's file arrives after it is read.
  // Until then the store still holds the file whose region was saved, which is no longer what is shown.
  it('reads nothing while another slot is being read: its region gone, its file not yet there', async () => {
    vi.mocked(fetchImageFile).mockResolvedValue(file('file-a', 'redrawn'))
    const store = await savedOnA()
    store.setRoi(null)
    store.showLoader()

    await pastTheWait()
    await flushPromises()

    expect(fetchImageFile).not.toHaveBeenCalled()
    expect(store.imageFile).toMatchObject({ id: 'file-a', manipulatedAt: 'before' })
    expect(store.loader).toBe(true)
  })

  // A rotation reads the same file again and puts it into the store as a new object. A read after the
  // save that answers after the rotation would bring back the file as it was before the rotation.
  it('keeps the file a rotation put in the store while the read after the save was on its way', async () => {
    let answer!: (read: AssetFileImage) => void
    vi.mocked(fetchImageFile).mockImplementation(() => new Promise((resolve) => (answer = resolve)))
    const store = await savedOnA()
    await vi.waitFor(() => expect(fetchImageFile).toHaveBeenCalledTimes(1), { timeout: 4000 })

    store.setImageFile(file('file-a', 'rotated'))
    answer(file('file-a', 'redrawn before the rotation'))
    await flushPromises()

    expect(store.imageFile).toMatchObject({ id: 'file-a', manipulatedAt: 'rotated' })
  })

  // Another file is put into the store without showing the loader: the
  // read after the save is skipped and the loader of the save goes away.
  // Before the fix, the loader stayed on over the other file until something else hid it.
  it('takes its loader away when another file is shown without a loader of its own', async () => {
    const store = await savedOnA()
    store.setImageFile(file('file-b', 'of slot b'))

    await pastTheWait()
    await flushPromises()

    expect(fetchImageFile).not.toHaveBeenCalled()
    expect(store.loader).toBe(false)
    expect(wrapper!.findComponent({ name: 'VProgressCircular' }).exists()).toBe(false)
  })

  it('leaves no loader on in the store when the cropper goes before the read after its save', async () => {
    const store = await savedOnA()
    wrapper!.unmount()
    wrapper = undefined

    await pastTheWait()
    await flushPromises()

    expect(store.loader).toBe(false)
  })
})
