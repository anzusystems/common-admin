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

// Two seconds after a region is saved the cropper reads the file of that region again, to show it as the DAM has
// redrawn it. By then an admin may show another file (another slot of the asset), or the cropper may be gone: the
// read is for the file whose region was saved, and only while that file is shown is its answer put in the store.

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
/** Past the two seconds the read waits after a save. */
const pastTheWait = () => new Promise((resolve) => setTimeout(resolve, 2300))

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.mocked(fetchImageFile).mockReset()
})

/** The cropper of file A with its region, the region just saved. */
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

  // Another slot is picked while the read of the saved file is on its way: the answer comes, the other file stays.
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

  // Another slot is picked before the two seconds are up: its admin reads its file, and nothing reads it again.
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

  // The region is saved again while the read after the first save is on its way: the cropper, hidden by the loader of
  // that save, is back once something else hides the loader (the panel beside it ends its reload of the regions so).
  // The first read answers last, with the file as the DAM drew it before the second save: the second read's stays.
  it('keeps the file read after the latest of two saves when the read of the first answers after it', async () => {
    const answers: Array<(read: AssetFileImage) => void> = []
    vi.mocked(fetchImageFile).mockImplementation(() => new Promise((resolve) => answers.push(resolve)))
    const store = await savedOnA()
    await vi.waitFor(() => expect(answers).toHaveLength(1), { timeout: 4000 })
    store.hideLoader()
    await flushPromises()

    wrapper!.findComponent(ACropper).vm.$emit('commit', { x: 0.2, y: 0.2, width: 0.4, height: 0.3 })
    await vi.waitFor(() => expect(answers).toHaveLength(2), { timeout: 4000 })
    answers[1]!(file('file-a', 'after the second save'))
    await flushPromises()
    answers[0]!(file('file-a', 'after the first save'))
    await flushPromises()

    expect(store.imageFile).toMatchObject({ id: 'file-a', manipulatedAt: 'after the second save' })
    expect(store.loader).toBe(false)
  })

  // admin-dam changes the slot so: the region goes and its loader is on at once, the file of the new slot comes once
  // read. Until then the file whose region was saved is still in the store, and no longer what is shown.
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

  // A rotation reads the same file again and puts it in the store as a new object: a read after the save that answers
  // after it brings the file as it was before the rotation.
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
})
