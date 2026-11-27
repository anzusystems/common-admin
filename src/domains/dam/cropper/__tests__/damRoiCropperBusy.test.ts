import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, type Pinia, setActivePinia } from 'pinia'
import type { AxiosInstance } from 'axios'
import { initCommonAdminCoreDamOptions } from '@/domains/dam/composables/commonAdminCoreDamOptions'
import { useDamConfigStore } from '@/domains/dam/config/store/damConfigStore'
import { useImageRoiStore } from '@/domains/dam/cropper/store/imageRoiStore'
import { useAssetDetailStore } from '@/domains/dam/assetDetail/store/assetDetailStore'
import { useAssetDetailSidebarActionbar } from '@/domains/dam/assetDetail/composables/assetDetailSidebarActionbar'
import ACropper from '@/domains/dam/cropper/components/ACropper.vue'
import DamAssetImageRoiSelect from '@/domains/dam/cropper/components/DamAssetImageRoiSelect.vue'
import AssetDetailSidebarROI from '@/domains/dam/assetDetail/components/AssetDetailSidebarROI.vue'
import { updateRoi } from '@/domains/dam/api/damImageRoiApi'
import { fetchImageFile } from '@/domains/dam/api/damImageApi'
import type { AssetFileImage } from '@/domains/dam/types/AssetFile'

// A region saved in the cropper is redrawn by the DAM, and the cropper reads the file again two seconds after the save.
// From the save until that read ends, the region panel beside it offers no "refresh"
// (`cropperBusy` of the store, set only by the cropper). Otherwise its read, sent
// before the redraw, replaced the cropper's and both kept the old drawing.
// The region previews are redrawn after the cropper's read (`timestampRoiPreviews`).

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

const QUEUE = 'cropper-busy'
const file = (manipulatedAt: string) =>
  ({
    id: 'file-a',
    _resourceName: 'imageFile',
    manipulatedAt,
    imageAttributes: { width: 800, height: 600 },
    links: { image_detail: { url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' } },
  }) as unknown as AssetFileImage
const roi = { id: 'roi-1', pointX: 0, pointY: 0, percentageWidth: 0.5, percentageHeight: 0.5, links: {} } as never
const pastTheWait = () => new Promise((resolve) => setTimeout(resolve, 2300))

let wrappers: VueWrapper[] = []
let target: HTMLElement | undefined
afterEach(() => {
  wrappers.forEach((wrapper) => wrapper.unmount())
  wrappers = []
  target?.remove()
  target = undefined
  useAssetDetailSidebarActionbar(QUEUE).unMounted()
  vi.mocked(fetchImageFile).mockReset()
  vi.mocked(updateRoi).mockReset()
  vi.restoreAllMocks()
})

const setup = () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  initCommonAdminCoreDamOptions({ configs: { default: { damClient: () => ({}) as AxiosInstance } } } as never)
  useDamConfigStore().damConfigExtSystem.set(1, { image: { roiWidth: 16, roiHeight: 9 } } as never)
  vi.mocked(updateRoi).mockResolvedValue(undefined as never)
  vi.mocked(fetchImageFile).mockResolvedValue(file('redrawn'))
  return pinia
}
const mountCropper = async (pinia: Pinia) => {
  const store = useImageRoiStore()
  if (!store.imageFile) store.setImageFile(file('before'))
  store.setRoi(roi)
  const cropper = mount(DamAssetImageRoiSelect, { props: { extSystem: 1 }, global: { plugins: [pinia] } })
  wrappers.push(cropper)
  await flushPromises()
  return cropper
}
const commit = async (cropper: VueWrapper) => {
  cropper.findComponent(ACropper).vm.$emit('commit', { x: 0.1, y: 0.1, width: 0.4, height: 0.3 })
  await flushPromises()
}

describe('the save of a region in the cropper, with the panel of the regions beside it', () => {
  const withPanel = async () => {
    const pinia = setup()
    useAssetDetailStore().setAsset({ id: 'asset-1', mainFile: file('before') } as never)
    target = document.createElement('div')
    target.className = useAssetDetailSidebarActionbar(QUEUE).divClassName.value
    document.body.append(target)
    useAssetDetailSidebarActionbar(QUEUE).mounted()
    wrappers.push(
      mount(AssetDetailSidebarROI, { props: { isActive: true, queueKey: QUEUE }, global: { plugins: [pinia] } })
    )
    await flushPromises()
    const cropper = await mountCropper(pinia)
    return cropper
  }
  const refreshOffered = () => target!.querySelectorAll('button').length > 0

  it('offers no "refresh" from the save till the read after it is over', async () => {
    const cropper = await withPanel()
    expect(refreshOffered()).toBe(true)

    await commit(cropper)
    expect(refreshOffered()).toBe(false)
    await vi.waitFor(() => expect(fetchImageFile).toHaveBeenCalledTimes(1), { timeout: 4000 })
    await flushPromises()

    expect(useImageRoiStore().loader).toBe(false)
    expect(refreshOffered()).toBe(true)
  })
})

describe('the busy flag and the previews of the cropper', () => {
  it('draws the previews of the regions anew once the redrawn file is read', async () => {
    const cropper = await mountCropper(setup())
    const store = useImageRoiStore()
    const before = store.timestampRoiPreviews

    await commit(cropper)
    expect(store.cropperBusy).toBe(true)
    await pastTheWait()
    await flushPromises()

    expect(store.imageFile).toMatchObject({ manipulatedAt: 'redrawn' })
    expect(store.timestampRoiPreviews).toBeGreaterThan(before)
    expect(store.cropperBusy).toBe(false)
  })

  it('is not busy once the save fails', async () => {
    const cropper = await mountCropper(setup())
    vi.mocked(updateRoi).mockRejectedValueOnce(new Error('500'))

    await commit(cropper)

    expect(useImageRoiStore().cropperBusy).toBe(false)
  })

  it('is not busy once the read after the save fails, and draws no previews anew', async () => {
    const cropper = await mountCropper(setup())
    vi.mocked(fetchImageFile).mockRejectedValueOnce(new Error('Network Error'))
    const store = useImageRoiStore()
    const before = store.timestampRoiPreviews

    await commit(cropper)
    await pastTheWait()
    await flushPromises()

    expect(store.cropperBusy).toBe(false)
    expect(store.timestampRoiPreviews).toBe(before)
  })

  it('is not busy once the cropper goes while it waits for the redraw', async () => {
    const cropper = await mountCropper(setup())
    await commit(cropper)
    expect(useImageRoiStore().cropperBusy).toBe(true)

    cropper.unmount()
    wrappers = []

    expect(useImageRoiStore().cropperBusy).toBe(false)
  })

  // If the cropper is gone before its save answers, the answer
  // sets no timer for a read that would find the cropper gone.
  it('waits for no redraw once gone while its save was on its way', async () => {
    let saved!: () => void
    const pinia = setup()
    vi.mocked(updateRoi).mockImplementation(() => new Promise((resolve) => (saved = () => resolve(undefined as never))))
    const cropper = await mountCropper(pinia)
    await commit(cropper)
    cropper.unmount()
    wrappers = []
    const timers = vi.spyOn(window, 'setTimeout')

    saved()
    await flushPromises()

    expect(timers.mock.calls.filter(([, delay]) => delay === 2000)).toEqual([])
    expect(useImageRoiStore().cropperBusy).toBe(false)
  })

  // The cropper stays usable during a save, so a gesture can end while one is on its way. Its crop waits for that
  // save: two saves on their way at once could reach the DAM in either order and leave the older region stored.
  // Of the crops committed meanwhile only the latest is sent. The cropper is busy till the read after the last save.
  it.each<[string, boolean]>([
    ['fails', true],
    ['succeeds', false],
  ])('sends the latest crop committed during a save once that save %s', async (_what, firstFails) => {
    const saves: Array<{ pointX: number; resolve: () => void; reject: () => void }> = []
    const pinia = setup()
    vi.mocked(updateRoi).mockImplementation(
      (_client, _endPoint, _id, region) =>
        new Promise((resolve, reject) =>
          saves.push({
            pointX: region.pointX,
            resolve: () => resolve(undefined as never),
            reject: () => reject(new Error('500')),
          })
        )
    )
    const cropper = await mountCropper(pinia)
    const store = useImageRoiStore()
    const shown = cropper.findComponent(ACropper)
    shown.vm.$emit('commit', { x: 0.1, y: 0.1, width: 0.4, height: 0.3 })
    shown.vm.$emit('commit', { x: 0.2, y: 0.2, width: 0.4, height: 0.3 })
    shown.vm.$emit('commit', { x: 0.3, y: 0.2, width: 0.4, height: 0.3 })
    await flushPromises()
    expect(saves).toHaveLength(1)
    expect(cropper.findComponent(ACropper).vm.$.uid).toBe(shown.vm.$.uid)

    if (firstFails) saves[0]!.reject()
    else saves[0]!.resolve()
    await flushPromises()
    expect(saves.map((save) => save.pointX)).toEqual([80, 240])
    expect(store.cropperBusy).toBe(true)

    saves[1]!.resolve()
    await flushPromises()
    expect(store.cropperBusy).toBe(true)
    await pastTheWait()
    await flushPromises()
    expect(fetchImageFile).toHaveBeenCalledTimes(1)
    expect(store.cropperBusy).toBe(false)
  })

  // A rotation during the save turns the picture the waiting crop was drawn on.
  it('drops a crop committed during a save once a rotation has replaced the picture', async () => {
    let saved!: () => void
    const pinia = setup()
    vi.mocked(updateRoi).mockImplementation(() => new Promise((resolve) => (saved = () => resolve(undefined as never))))
    const cropper = await mountCropper(pinia)
    await commit(cropper)
    await commit(cropper)
    useImageRoiStore().setImageFile(file('rotated'))

    saved()
    await flushPromises()
    await pastTheWait()
    await flushPromises()

    expect(updateRoi).toHaveBeenCalledTimes(1)
    expect(fetchImageFile).not.toHaveBeenCalled()
    expect(useImageRoiStore().cropperBusy).toBe(false)
  })
})
