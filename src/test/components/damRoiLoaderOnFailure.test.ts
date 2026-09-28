import { describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosInstance } from 'axios'
import { initCommonAdminCoreDamOptions } from '@/components/dam/assetSelect/composables/commonAdminCoreDamOptions'
import { useDamConfigStore } from '@/components/damImage/uploadQueue/composables/damConfigStore'
import { useImageRoiStore } from '@/components/damImage/uploadQueue/composables/imageRoiStore'
import { useAssetDetailStore } from '@/components/damImage/uploadQueue/composables/assetDetailStore'
import ACropper from '@/components/damImage/uploadQueue/cropper/ACropper.vue'
import DamAssetImageRoiSelect from '@/components/damImage/uploadQueue/components/DamAssetImageRoiSelect.vue'
import AssetDetailSidebarROI from '@/components/damImage/uploadQueue/components/AssetDetailSidebarROI.vue'
import { fetchImageFile } from '@/components/damImage/uploadQueue/api/damImageApi'

const updateRoi = vi.fn(async () => {
  throw new Error('500')
})
const roiListExecute = vi.fn(async () => {
  throw new Error('500')
})
vi.mock('@/components/damImage/uploadQueue/api/damImageRoiApi', () => ({
  ENTITY: 'imageRoi',
  updateRoi: () => updateRoi(),
  fetchRoi: vi.fn(),
  useFetchImageRoiList: () => ({ execute: () => roiListExecute() }),
}))
vi.mock('@/components/damImage/uploadQueue/api/damImageApi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchImageFile: vi.fn(),
}))

const imageFile = {
  id: 'image-1',
  _resourceName: 'imageFile',
  imageAttributes: { width: 800, height: 600 },
  links: { image_detail: { url: 'data:image/gif;base64,R0lGODlhAQABAAAAACw=' } },
} as never
const roi = { id: 'roi-1', pointX: 0, pointY: 0, percentageWidth: 0.5, percentageHeight: 0.5 } as never

const setup = () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  initCommonAdminCoreDamOptions({ configs: { default: { damClient: () => ({}) as AxiosInstance } } } as never)
  useDamConfigStore().damConfigExtSystem.set(1, { image: { roiWidth: 16, roiHeight: 9 } } as never)
  return { pinia, roiStore: useImageRoiStore() }
}

describe('ROI loaders on a failed request', () => {
  it('DamAssetImageRoiSelect hides its loader when saving the region fails', async () => {
    const { pinia, roiStore } = setup()
    roiStore.setImageFile(imageFile)
    roiStore.setRoi(roi)
    const wrapper = mount(DamAssetImageRoiSelect, { props: { extSystem: 1 }, global: { plugins: [pinia] } })

    wrapper.findComponent(ACropper).vm.$emit('commit', { x: 0.1, y: 0.1, width: 0.4, height: 0.3 })
    await flushPromises()

    expect(updateRoi).toHaveBeenCalledTimes(1)
    expect(roiStore.loader).toBe(false)
    wrapper.unmount()
  })

  it('DamAssetImageRoiSelect hides its loader when the reload after a save fails', async () => {
    const { pinia, roiStore } = setup()
    roiStore.setImageFile(imageFile)
    roiStore.setRoi(roi)
    updateRoi.mockResolvedValueOnce(undefined as never)
    vi.mocked(fetchImageFile).mockRejectedValueOnce(new Error('Network Error'))
    const rejections: unknown[] = []
    const onRejection = (event: PromiseRejectionEvent) => {
      rejections.push(event.reason)
      event.preventDefault()
    }
    window.addEventListener('unhandledrejection', onRejection)
    const wrapper = mount(DamAssetImageRoiSelect, { props: { extSystem: 1 }, global: { plugins: [pinia] } })

    wrapper.findComponent(ACropper).vm.$emit('commit', { x: 0.1, y: 0.1, width: 0.4, height: 0.3 })
    await flushPromises()
    expect(roiStore.loader).toBe(true)
    // The reload waits 2 s after the save.
    await vi.waitFor(() => expect(fetchImageFile).toHaveBeenCalledTimes(1), { timeout: 4000 })
    await flushPromises()

    expect(roiStore.loader).toBe(false)
    expect(rejections).toEqual([])
    window.removeEventListener('unhandledrejection', onRejection)
    wrapper.unmount()
  })

  it('AssetDetailSidebarROI hides its loader when loading the regions fails', async () => {
    const { pinia, roiStore } = setup()
    useAssetDetailStore().setAsset({ id: 'asset-1', mainFile: imageFile } as never)
    const wrapper = mount(AssetDetailSidebarROI, {
      props: { isActive: false, queueKey: 'q' },
      global: { plugins: [pinia] },
    })
    await flushPromises()

    expect(roiListExecute).toHaveBeenCalledTimes(1)
    expect(roiStore.loader).toBe(false)
    wrapper.unmount()
  })
})
