import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosInstance } from 'axios'
import { LANDSCAPE_IMAGE_URL as LANDSCAPE_IMAGE } from '@/test/fixtures/cropperImages'
import { centerOf, drag, nextFrame, wait } from '@/test/support/cropperHarness'

/**
 * The cropper in the place it actually ships: the DAM's region-of-interest editor.
 *
 * This is the wiring `ACropperjs` used to carry and `ACropper` now does — a stored region is pushed
 * into the cropper once it reports ready, and dragging the crop box saves a new one. Mocking stops
 * at the HTTP boundary, so the geometry, the `ready`/`cropend` callbacks and the ROI maths are all
 * the real thing.
 */

const updateRoi = vi.fn()
const fetchImageFile = vi.fn()

vi.mock('@/components/damImage/uploadQueue/api/damImageRoiApi', () => ({
  updateRoi: (...args: unknown[]) => updateRoi(...args),
}))

vi.mock('@/components/damImage/uploadQueue/api/damImageApi', () => ({
  fetchImageFile: (...args: unknown[]) => fetchImageFile(...args),
}))

const EXT_SYSTEM = 1
const ROI_WIDTH = 16
const ROI_HEIGHT = 9

const imageFile = () =>
  ({
    id: 'image-1',
    asset: 'asset-1',
    manipulatedAt: '2026-01-01T00:00:00.000Z',
    _resourceName: 'imageFile',
    imageAttributes: { width: LANDSCAPE_IMAGE.naturalWidth, height: LANDSCAPE_IMAGE.naturalHeight },
    links: {
      image_detail: {
        url: LANDSCAPE_IMAGE.src,
        width: LANDSCAPE_IMAGE.naturalWidth,
        height: LANDSCAPE_IMAGE.naturalHeight,
        requestedWidth: LANDSCAPE_IMAGE.naturalWidth,
        requestedHeight: LANDSCAPE_IMAGE.naturalHeight,
        title: 'detail',
        type: 'image',
      },
    },
  }) as never

const roi = () =>
  ({
    id: 'roi-1',
    title: 'default',
    position: 0,
    image: 'image-1',
    pointX: 120,
    pointY: 90,
    percentageWidth: 0.4,
    percentageHeight: 0.3,
    links: { image_roi_example: [] },
  }) as never

const mountRoiSelect = async () => {
  // A pinia of this test's own, installed on the mount as well: the shared setup registers one
  // globally, and the stores seeded here have to be the very ones the component resolves.
  const pinia = createPinia()
  setActivePinia(pinia)

  const { initCommonAdminCoreDamOptions } =
    await import('@/components/dam/assetSelect/composables/commonAdminCoreDamOptions')
  initCommonAdminCoreDamOptions({
    configs: {
      default: {
        damClient: () => ({}) as AxiosInstance,
        endPointImage: '/adm/v1/image',
        endPointRoi: '/adm/v1/roi',
      },
    },
  } as never)

  const { useDamConfigStore } = await import('@/components/damImage/uploadQueue/composables/damConfigStore')
  const configStore = useDamConfigStore()
  configStore.damConfigExtSystem.set(EXT_SYSTEM, {
    image: { roiWidth: ROI_WIDTH, roiHeight: ROI_HEIGHT },
  } as never)

  const { useImageRoiStore } = await import('@/components/damImage/uploadQueue/composables/imageRoiStore')
  const roiStore = useImageRoiStore()
  roiStore.setImageFile(imageFile())
  roiStore.setRoi(roi())
  roiStore.hideLoader()

  const DamAssetImageRoiSelect = (
    await import('@/components/damImage/uploadQueue/components/DamAssetImageRoiSelect.vue')
  ).default

  const host = document.createElement('div')
  host.style.width = '640px'
  document.body.appendChild(host)

  const wrapper = mount(DamAssetImageRoiSelect, {
    attachTo: host,
    props: { extSystem: EXT_SYSTEM },
    global: { plugins: [pinia] },
  })

  // The cropper loads its image before it is ready; poll rather than guess at a delay.
  const deadline = Date.now() + 5000
  while (!host.querySelector('cropper-selection')) {
    if (Date.now() > deadline) throw new Error('the ROI cropper never rendered')
    await wait(30)
  }
  await wait(120)

  return { wrapper, host, roiStore, destroy: () => (wrapper.unmount(), host.remove()) }
}

describe('DamAssetImageRoiSelect', () => {
  it('renders the new cropper, not the deprecated one', async () => {
    const view = await mountRoiSelect()
    expect(view.host.querySelector('cropper-canvas')).not.toBeNull()
    expect(view.host.querySelector('.cropper-container')).toBeNull()
    view.destroy()
  })

  it('shows the stored region rather than the default crop', async () => {
    const view = await mountRoiSelect()
    const selection = view.host.querySelector('cropper-selection') as HTMLElement & {
      x: number
      y: number
      width: number
      height: number
    }
    const canvas = view.host.querySelector('cropper-canvas') as HTMLElement
    const scale = canvas.getBoundingClientRect().width / LANDSCAPE_IMAGE.naturalWidth

    // pointX 120, pointY 90, 40% x 30% of an 800x600 image.
    expect(selection.x).toBeCloseTo(120 * scale, 0)
    expect(selection.y).toBeCloseTo(90 * scale, 0)
    expect(selection.width).toBeCloseTo(0.4 * LANDSCAPE_IMAGE.naturalWidth * scale, 0)
    expect(selection.height).toBeCloseTo(0.3 * LANDSCAPE_IMAGE.naturalHeight * scale, 0)
    view.destroy()
  })

  it('locks the crop to the ratio the ext system configures', async () => {
    const view = await mountRoiSelect()
    const selection = view.host.querySelector('cropper-selection') as HTMLElement & {
      width: number
      height: number
    }
    expect(selection.width / selection.height).toBeCloseTo(ROI_WIDTH / ROI_HEIGHT, 1)
    view.destroy()
  })

  it('uses the admin grey for the area outside the region', async () => {
    const view = await mountRoiSelect()
    const shade = view.host.querySelector('cropper-shade') as HTMLElement
    expect(getComputedStyle(shade).getPropertyValue('--theme-color').replace(/\s+/g, '')).toBe('rgba(241,244,246,0.5)')
    view.destroy()
  })

  it('saves the region once the user finishes dragging the crop box', async () => {
    const view = await mountRoiSelect()
    // Read before the drag: saving puts the view back into its loading state, which takes the
    // cropper out of the DOM again.
    const scale =
      (view.host.querySelector('cropper-canvas') as HTMLElement).getBoundingClientRect().width /
      LANDSCAPE_IMAGE.naturalWidth
    const face = view.host.querySelector('cropper-handle[action="move"]') as HTMLElement
    const from = centerOf(face)
    await drag(face, from, { x: from.x - 60, y: from.y + 30 })
    await nextFrame()

    expect(updateRoi).toHaveBeenCalledTimes(1)
    const saved = updateRoi.mock.calls[0]?.[3] as { pointX: number; pointY: number; percentageWidth: number }
    // `cropToRegion` stores the anchor as whole source pixels, so allow the rounding.
    expect(Math.abs(saved.pointX - (120 - 60 / scale))).toBeLessThanOrEqual(1)
    expect(Math.abs(saved.pointY - (90 + 30 / scale))).toBeLessThanOrEqual(1)
    expect(saved.percentageWidth).toBeCloseTo(0.4, 2)
    view.destroy()
  })

  it('never saves a region that runs off the image', async () => {
    const view = await mountRoiSelect()
    const face = view.host.querySelector('cropper-handle[action="move"]') as HTMLElement
    const from = centerOf(face)
    await drag(face, from, { x: from.x - 900, y: from.y - 900 })
    await nextFrame()

    const saved = updateRoi.mock.calls.at(-1)?.[3] as {
      pointX: number
      pointY: number
      percentageWidth: number
      percentageHeight: number
    }
    expect(saved.pointX).toBe(0)
    expect(saved.pointY).toBe(0)
    expect(saved.percentageWidth * LANDSCAPE_IMAGE.naturalWidth).toBeLessThanOrEqual(LANDSCAPE_IMAGE.naturalWidth + 1)
    expect(saved.percentageHeight * LANDSCAPE_IMAGE.naturalHeight).toBeLessThanOrEqual(
      LANDSCAPE_IMAGE.naturalHeight + 1
    )
    view.destroy()
  })

  it('does not save anything until the user touches the crop box', async () => {
    const view = await mountRoiSelect()
    await wait(200)
    expect(updateRoi).not.toHaveBeenCalled()
    view.destroy()
  })
})
