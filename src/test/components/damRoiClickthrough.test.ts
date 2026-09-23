import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { AxiosInstance } from 'axios'
import { centerOf, drag, wait } from '@/test/support/cropperHarness'
import {
  LANDSCAPE_IMAGE_URL,
  PORTRAIT_IMAGE_URL,
  SMALL_IMAGE_URL,
  WIDE_IMAGE_URL,
  type CropperFixture,
} from '@/test/fixtures/cropperImages'
import type { RegionOfInterest } from '@/types/coreDam/Roi'

/**
 * A walk through the region-of-interest editor the way a person uses it, in a real browser.
 *
 * `DamAssetImageRoiSelect` is mounted whole — real stores, real ROI maths, real cropper — with the
 * mocking stopping at the HTTP boundary. The phases below follow how the editor is actually met:
 * it loads, it draws the stored region, it is dragged about, the frame around it changes shape.
 *
 * Crop *geometry* (moving, every resize grip, drawing a new box) is covered in
 * `cropperContract.test.ts`, which runs the same assertions against the old component too. What is
 * here instead is everything that only shows up once the editor is assembled: the loader, the
 * stored region being applied on ready, re-rendering the same zone over and over, and the saves
 * that each finished gesture sends.
 */

const savedRegions: RegionOfInterest[] = []
let currentImageFile: unknown = null

const updateRoi = vi.fn((_client: unknown, _endpoint: string, _id: string, region: RegionOfInterest) => {
  savedRegions.unshift({ ...region })
  return Promise.resolve(region)
})
const fetchImageFile = vi.fn(() => Promise.resolve(currentImageFile))

vi.mock('@/components/damImage/uploadQueue/api/damImageRoiApi', () => ({
  updateRoi: (client: unknown, endpoint: string, id: string, region: RegionOfInterest) =>
    updateRoi(client, endpoint, id, region),
}))

vi.mock('@/components/damImage/uploadQueue/api/damImageApi', () => ({
  fetchImageFile: () => fetchImageFile(),
}))

const EXT_SYSTEM = 1

const makeImageFile = (fixture: CropperFixture, manipulatedAt: string) =>
  ({
    id: 'image-1',
    asset: 'asset-1',
    manipulatedAt,
    _resourceName: 'imageFile',
    imageAttributes: { width: fixture.naturalWidth, height: fixture.naturalHeight },
    links: {
      image_detail: {
        url: fixture.src,
        width: fixture.naturalWidth,
        height: fixture.naturalHeight,
        requestedWidth: fixture.naturalWidth,
        requestedHeight: fixture.naturalHeight,
        title: 'detail',
        type: 'image',
      },
    },
  }) as never

const makeRoi = (): RegionOfInterest =>
  ({
    id: 'roi-1',
    title: 'default',
    position: 0,
    image: 'image-1',
    pointX: 0,
    pointY: 0,
    percentageWidth: 0.6,
    percentageHeight: 0.6,
    links: { image_roi_example: [] },
  }) as unknown as RegionOfInterest

interface Editor {
  wrapper: VueWrapper
  frame: HTMLElement
  /** Puts a fresh picture in the store, which re-keys the editor and rebuilds it. */
  reload: () => void
  /** Waits out the loader the editor shows while it saves and reloads. */
  settle: () => Promise<void>
  hasCropper: () => boolean
  hasSpinner: () => boolean
  canvasCount: () => number
  /** The crop in source pixels, measured off the page rather than asked of the component. */
  crop: () => [number, number, number, number]
  ratio: () => number
  cropInsideImage: () => boolean
  pictureFitsFrame: () => boolean
  pictureSize: () => [number, number]
  find: (selector: string) => HTMLElement
  destroy: () => void
}

const FACE = 'cropper-handle[action="move"]'

const mountEditor = async (
  options: {
    fixture?: CropperFixture
    roiWidth?: number
    roiHeight?: number
    frameWidth?: number
    frameMaxHeight?: number
  } = {}
): Promise<Editor> => {
  const {
    fixture = LANDSCAPE_IMAGE_URL,
    roiWidth = 16,
    roiHeight = 9,
    frameWidth = 860,
    frameMaxHeight = 600,
  } = options

  savedRegions.length = 0
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
  useDamConfigStore().damConfigExtSystem.set(EXT_SYSTEM, { image: { roiWidth, roiHeight } } as never)

  const { useImageRoiStore } = await import('@/components/damImage/uploadQueue/composables/imageRoiStore')
  const roiStore = useImageRoiStore()

  const load = () => {
    currentImageFile = makeImageFile(fixture, new Date().toISOString())
    roiStore.setImageFile(currentImageFile as never)
    roiStore.setRoi(makeRoi())
    roiStore.hideLoader()
  }
  load()

  const frame = document.createElement('div')
  frame.style.cssText = `width: ${frameWidth}px; max-height: ${frameMaxHeight}px; overflow: hidden;`
  document.body.appendChild(frame)

  const DamAssetImageRoiSelect = (
    await import('@/components/damImage/uploadQueue/components/DamAssetImageRoiSelect.vue')
  ).default

  const wrapper = mount(DamAssetImageRoiSelect, {
    attachTo: frame,
    props: { extSystem: EXT_SYSTEM },
    global: { plugins: [pinia] },
  })

  const find = (selector: string) => {
    const element = frame.querySelector(selector)
    if (!element) throw new Error(`no element matched "${selector}"`)
    return element as HTMLElement
  }

  const settle = async () => {
    // A finished gesture saves, and saving puts the editor back into its loading state a tick later.
    // Give that a moment to start before waiting for it to finish, or this returns on the cropper
    // that is about to be taken away.
    await wait(200)
    const deadline = Date.now() + 8000
    while (!frame.querySelector('cropper-canvas')) {
      if (Date.now() > deadline) throw new Error('the editor never came back')
      await wait(40)
    }
    await wait(150)
  }

  const crop = (): [number, number, number, number] => {
    const canvas = find('cropper-canvas').getBoundingClientRect()
    const picture = find('cropper-image').getBoundingClientRect()
    const selection = find('cropper-selection') as HTMLElement & {
      x: number
      y: number
      width: number
      height: number
    }
    const scale = picture.width / fixture.naturalWidth
    return [
      Math.round((selection.x - (picture.left - canvas.left)) / scale),
      Math.round((selection.y - (picture.top - canvas.top)) / scale),
      Math.round(selection.width / scale),
      Math.round(selection.height / scale),
    ]
  }

  await settle()

  return {
    wrapper,
    frame,
    reload: load,
    settle,
    hasCropper: () => frame.querySelector('cropper-canvas') !== null,
    hasSpinner: () => frame.querySelector('.v-progress-circular') !== null,
    canvasCount: () => frame.querySelectorAll('cropper-canvas').length,
    crop,
    ratio: () => {
      const selection = find('cropper-selection') as HTMLElement & { width: number; height: number }
      return selection.width / selection.height
    },
    cropInsideImage: () => {
      const [x, y, width, height] = crop()
      return x >= -1 && y >= -1 && x + width <= fixture.naturalWidth + 1 && y + height <= fixture.naturalHeight + 1
    },
    pictureFitsFrame: () => {
      const picture = find('cropper-image').getBoundingClientRect()
      return picture.height <= frame.getBoundingClientRect().height + 1
    },
    pictureSize: () => {
      const picture = find('cropper-image').getBoundingClientRect()
      return [Math.round(picture.width), Math.round(picture.height)]
    },
    find,
    destroy: () => {
      wrapper.unmount()
      frame.remove()
    },
  }
}

beforeEach(() => {
  savedRegions.length = 0
})

describe('DAM region editor — loading', () => {
  it('shows its loader, and no cropper, while it is loading', async () => {
    const editor = await mountEditor()
    const { useImageRoiStore } = await import('@/components/damImage/uploadQueue/composables/imageRoiStore')
    useImageRoiStore().showLoader()
    await wait(80)

    expect(editor.hasSpinner()).toBe(true)
    expect(editor.hasCropper()).toBe(false)

    useImageRoiStore().hideLoader()
    await editor.settle()
    expect(editor.hasSpinner()).toBe(false)
    expect(editor.hasCropper()).toBe(true)
    editor.destroy()
  })

  // The stored region is 60% × 60%, which a 16:9 crop cannot be — the ratio wins and it becomes the
  // widest 16:9 box with that height. Getting the default 80% box instead would mean the region
  // never reached the cropper.
  it('draws the stored region, not the default crop', async () => {
    const editor = await mountEditor()
    expect(editor.crop()).toEqual([0, 0, 640, 360])
    expect(editor.ratio()).toBeCloseTo(16 / 9, 2)
    expect(editor.cropInsideImage()).toBe(true)
    editor.destroy()
  })

  it('saves nothing until something is dragged', async () => {
    const editor = await mountEditor()
    await wait(200)
    expect(savedRegions.length).toBe(0)
    editor.destroy()
  })

  it('draws the same zone on every one of five reloads', async () => {
    const editor = await mountEditor()
    for (let n = 0; n < 5; n++) {
      editor.reload()
      await editor.settle()
      expect(editor.crop()).toEqual([0, 0, 640, 360])
      expect(editor.canvasCount()).toBe(1)
    }
    expect(savedRegions.length).toBe(0)
    editor.destroy()
  })

  it('leaves one cropper behind after six reloads in a row with no pause', async () => {
    const editor = await mountEditor()
    for (let n = 0; n < 6; n++) editor.reload()
    await editor.settle()

    expect(editor.canvasCount()).toBe(1)
    expect(editor.crop()).toEqual([0, 0, 640, 360])
    editor.destroy()
  })
})

describe('DAM region editor — what gets applied', () => {
  it('leaves the zone alone when the crop box is clicked but not moved', async () => {
    const editor = await mountEditor()
    const before = editor.crop()
    const face = editor.find(FACE)
    const point = centerOf(face)
    await drag(face, point, point, 1)
    await editor.settle()

    expect(editor.crop()).toEqual(before)
    editor.destroy()
  })

  // Both cropper versions end a gesture on pointer-up whether or not anything moved, so a click
  // does save — it just saves the region that was already there.
  it('saves the unchanged region when the crop box is merely clicked', async () => {
    const editor = await mountEditor()
    const face = editor.find(FACE)
    const point = centerOf(face)
    await drag(face, point, point, 1)
    await editor.settle()

    expect(savedRegions.length).toBe(1)
    expect(savedRegions[0]?.pointX).toBe(0)
    expect(savedRegions[0]?.pointY).toBe(0)
    expect(savedRegions[0]?.percentageWidth).toBeCloseTo(0.8, 2)
    editor.destroy()
  })

  it('leaves the zone where it was when a drag is taken out and brought back', async () => {
    const editor = await mountEditor()
    const before = editor.crop()
    const face = editor.find(FACE)
    const point = centerOf(face)

    face.dispatchEvent(new PointerEvent('pointerdown', pointerInit(point)))
    document.dispatchEvent(new PointerEvent('pointermove', pointerInit({ x: point.x + 90, y: point.y + 60 })))
    document.dispatchEvent(new PointerEvent('pointermove', pointerInit(point)))
    document.dispatchEvent(new PointerEvent('pointerup', { ...pointerInit(point), buttons: 0 }))
    await editor.settle()

    expect(editor.crop()).toEqual(before)
    editor.destroy()
  })

  it('ignores a gesture that starts outside the cropper', async () => {
    const editor = await mountEditor()
    const before = editor.crop()
    const outside = editor.frame.getBoundingClientRect()
    const start = { x: outside.right + 60, y: outside.top + 20 }

    document.body.dispatchEvent(new PointerEvent('pointerdown', pointerInit(start)))
    document.dispatchEvent(new PointerEvent('pointermove', pointerInit({ x: start.x - 200, y: start.y + 120 })))
    document.dispatchEvent(new PointerEvent('pointerup', { ...pointerInit(start), buttons: 0 }))
    await wait(300)

    expect(editor.crop()).toEqual(before)
    expect(savedRegions.length).toBe(0)
    editor.destroy()
  })

  it('moves the zone and saves it when the crop box is really dragged', async () => {
    const editor = await mountEditor()
    const before = editor.crop()
    const face = editor.find(FACE)
    const point = centerOf(face)
    await drag(face, point, { x: point.x + 120, y: point.y + 60 }, 6)
    await editor.settle()

    const after = editor.crop()
    expect(after).not.toEqual(before)
    expect(after[2]).toBe(before[2])
    expect(after[3]).toBe(before[3])
    expect(editor.cropInsideImage()).toBe(true)
    expect(savedRegions.length).toBe(1)
    expect(savedRegions[0]?.pointX).toBeGreaterThan(0)
    editor.destroy()
  })

  it('throws an unsaved change away when the picture is reloaded', async () => {
    const editor = await mountEditor()
    const before = editor.crop()
    const face = editor.find(FACE)
    const point = centerOf(face)
    await drag(face, point, { x: point.x + 120, y: point.y + 60 }, 6)
    await editor.settle()
    expect(editor.crop()).not.toEqual(before)

    editor.reload()
    await editor.settle()
    expect(editor.crop()).toEqual(before)
    editor.destroy()
  })

  it('never saves a region that runs off the picture', async () => {
    const editor = await mountEditor()
    const face = editor.find(FACE)
    const point = centerOf(face)
    await drag(face, point, { x: point.x + 900, y: point.y + 900 }, 8)
    await editor.settle()

    const saved = savedRegions[0]
    expect(saved).toBeDefined()
    expect(saved!.pointX).toBeGreaterThanOrEqual(0)
    expect(saved!.pointY).toBeGreaterThanOrEqual(0)
    expect(saved!.pointX + saved!.percentageWidth * LANDSCAPE_IMAGE_URL.naturalWidth).toBeLessThanOrEqual(
      LANDSCAPE_IMAGE_URL.naturalWidth + 1
    )
    expect(saved!.pointY + saved!.percentageHeight * LANDSCAPE_IMAGE_URL.naturalHeight).toBeLessThanOrEqual(
      LANDSCAPE_IMAGE_URL.naturalHeight + 1
    )
    editor.destroy()
  })
})

describe('DAM region editor — the frame around it', () => {
  it('keeps a tall picture inside a short frame', async () => {
    const editor = await mountEditor({
      fixture: PORTRAIT_IMAGE_URL,
      roiWidth: 1,
      roiHeight: 1,
      frameMaxHeight: 300,
    })
    expect(editor.pictureFitsFrame()).toBe(true)
    expect(editor.pictureSize()[1]).toBeLessThanOrEqual(301)
    editor.destroy()
  })

  it('still lets the crop reach the bottom of a tall picture', async () => {
    const editor = await mountEditor({
      fixture: PORTRAIT_IMAGE_URL,
      roiWidth: 1,
      roiHeight: 1,
      frameMaxHeight: 300,
    })
    const face = editor.find(FACE)
    const point = centerOf(face)
    await drag(face, point, { x: point.x, y: point.y + 900 }, 8)
    await editor.settle()

    const [, y, , height] = editor.crop()
    expect(y + height).toBeCloseTo(PORTRAIT_IMAGE_URL.naturalHeight, -1)
    editor.destroy()
  })

  it('re-fits and keeps the crop when the frame gets shorter', async () => {
    const editor = await mountEditor({ fixture: PORTRAIT_IMAGE_URL, roiWidth: 1, roiHeight: 1 })
    const before = editor.crop()

    editor.frame.style.maxHeight = '260px'
    await wait(500)

    expect(editor.pictureFitsFrame()).toBe(true)
    expect(editor.crop()).toEqual(before)
    expect(editor.cropInsideImage()).toBe(true)
    editor.destroy()
  })

  it('re-fits and keeps the crop when the frame gets narrower', async () => {
    const editor = await mountEditor()
    const before = editor.crop()

    editor.frame.style.width = '520px'
    await wait(500)

    expect(editor.crop()).toEqual(before)
    expect(editor.cropInsideImage()).toBe(true)
    editor.destroy()
  })
})

describe('DAM region editor — every picture and ratio', () => {
  const pictures = [
    ['landscape', LANDSCAPE_IMAGE_URL],
    ['portrait', PORTRAIT_IMAGE_URL],
    ['small', SMALL_IMAGE_URL],
    ['wide', WIDE_IMAGE_URL],
  ] as const
  const ratios = [
    ['16:9', 16, 9],
    ['square', 1, 1],
    ['3:4', 3, 4],
  ] as const

  pictures.forEach(([pictureName, fixture]) => {
    ratios.forEach(([ratioName, roiWidth, roiHeight]) => {
      it(`draws a usable crop for ${pictureName} at ${ratioName}`, async () => {
        const editor = await mountEditor({ fixture, roiWidth, roiHeight, frameMaxHeight: 420 })
        expect(editor.canvasCount()).toBe(1)
        expect(editor.cropInsideImage()).toBe(true)
        expect(editor.pictureFitsFrame()).toBe(true)
        expect(editor.ratio()).toBeCloseTo(roiWidth / roiHeight, 1)
        editor.destroy()
      })
    })
  })
})

const pointerInit = (point: { x: number; y: number }): PointerEventInit => ({
  bubbles: true,
  cancelable: true,
  composed: true,
  pointerId: 1,
  pointerType: 'mouse',
  isPrimary: true,
  button: 0,
  buttons: 1,
  clientX: point.x,
  clientY: point.y,
})
