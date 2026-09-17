import { mount, type VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import ACropperjs from '@/components/ACropperjs.vue'
import ACropper from '@/components/damImage/uploadQueue/cropper/ACropper.vue'
import { LANDSCAPE_IMAGE, type CropperFixture } from '@/test/fixtures/cropperImages'

/**
 * Shared harness for the two cropper components.
 *
 * `ACropperjs` (cropper.js v1) and `ACropper` (cropper.js v2) are built out of completely different
 * DOM — one a tree of divs with `cropper-*` classes, the other a set of custom elements — but they
 * are supposed to behave identically. The adapters below name the few places where the markup
 * differs, so one suite can drive both and any divergence shows up as a failing assertion rather
 * than as something a reviewer has to spot by eye.
 */

/**
 * A crop in source pixels. The two components no longer speak the same units — `ACropperjs` reports
 * source pixels, `ACropper` fractions — so the harness converts and every assertion downstream keeps
 * comparing the one number that means the same thing to both.
 */
export interface CropperData {
  x: number
  y: number
  width: number
  height: number
}

export interface CropperApi {
  getData: () => CropperData
  setData: (data: Partial<CropperData>) => Promise<void>
  /**
   * The crop as fractions of the picture, measured straight off the page. Unlike `getData` this
   * needs no knowledge of which file is loaded, so it is the one to use when the source changes.
   */
  getCrop: () => CropperData
  /** The picture's displayed size, in CSS pixels. */
  displaySize: () => { width: number; height: number }
}

export interface CropperAdapter {
  name: string
  component: Component
  /** The element that moves the whole crop box. */
  face: string
  /** The bottom-right resize grip. */
  seHandle: string
  /** The north (top-centre) resize grip. */
  nHandle: string
  /** The west (left-centre) resize grip. */
  wHandle: string
  /** The north-east (top-right) corner grip. */
  neHandle: string
  /** The surface that starts a brand new crop box when dragged. */
  drawSurface: string
  /** The element whose box equals the displayed image. */
  imageBox: string
  /** The crop box itself. */
  cropBox: string
  /** True once the cropper has torn itself down. */
  isDestroyed: (host: HTMLElement) => boolean
  /** `ACropper` no longer takes the v1 option props; only the old component is given them. */
  legacy: boolean
}

export const V1_ADAPTER: CropperAdapter = {
  name: 'ACropperjs (cropper.js v1)',
  component: ACropperjs,
  face: '.cropper-face',
  seHandle: '.cropper-point.point-se',
  nHandle: '.cropper-point.point-n',
  wHandle: '.cropper-point.point-w',
  neHandle: '.cropper-point.point-ne',
  drawSurface: '.cropper-drag-box',
  imageBox: '.cropper-canvas',
  cropBox: '.cropper-crop-box',
  isDestroyed: (host) => host.querySelector('.cropper-container') === null,
  legacy: true,
}

export const V2_ADAPTER: CropperAdapter = {
  name: 'ACropper (cropper.js v2)',
  component: ACropper,
  face: 'cropper-handle[action="move"]',
  seHandle: 'cropper-handle[action="se-resize"]',
  nHandle: 'cropper-handle[action="n-resize"]',
  wHandle: 'cropper-handle[action="w-resize"]',
  neHandle: 'cropper-handle[action="ne-resize"]',
  drawSurface: 'cropper-handle[action="select"]',
  imageBox: 'cropper-image',
  cropBox: 'cropper-selection',
  isDestroyed: (host) => host.querySelector('cropper-canvas') === null,
  legacy: false,
}

export const ADAPTERS = [V1_ADAPTER, V2_ADAPTER]

export interface MountOptions {
  adapter: CropperAdapter
  fixture?: CropperFixture
  hostWidth?: number
  props?: Record<string, unknown>
  /** Where the host goes. Defaults to the document body; pass a frame to test clipping. */
  parent?: HTMLElement
}

export interface MountedCropper {
  wrapper: VueWrapper
  host: HTMLElement
  api: CropperApi
  readyCalls: () => number
  cropendCalls: () => number
  find: (selector: string) => HTMLElement
  destroy: () => void
}

const READY_TIMEOUT = 5000

/**
 * Mounts a cropper and resolves once it reports itself ready, so nothing downstream has to guess at
 * a sleep duration. Both components call the `ready` prop exactly once per source image.
 */
export const mountCropper = async (options: MountOptions): Promise<MountedCropper> => {
  const { adapter, fixture = LANDSCAPE_IMAGE, hostWidth = 640, props = {}, parent } = options

  const host = document.createElement('div')
  host.style.width = `${hostWidth}px`
  ;(parent ?? document.body).appendChild(host)

  let readyCalls = 0
  let cropendCalls = 0
  let resolveReady: (() => void) | null = null
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve
  })
  const onReady = () => {
    readyCalls += 1
    resolveReady?.()
    ;(props.ready as (() => void) | undefined)?.()
  }
  const onCommit = () => {
    cropendCalls += 1
    ;(props.cropend as (() => void) | undefined)?.()
  }

  // The old component still wants its option props; the new one has none of them and would put an
  // unknown prop straight onto the root element as an attribute.
  const legacyProps = adapter.legacy
    ? { checkCrossOrigin: false, background: false, responsive: true, zoomOnWheel: false, viewMode: 1 }
    : {}
  const passThrough = { ...props }
  delete passThrough.ready
  delete passThrough.cropend

  const wrapper = mount(adapter.component, {
    attachTo: host,
    props: {
      src: fixture.src,
      aspectRatio: 16 / 9,
      ...legacyProps,
      ...passThrough,
      ...(adapter.legacy ? { ready: onReady, cropend: onCommit } : { onReady, onCommit }),
    },
  })

  await Promise.race([
    ready,
    new Promise<void>((_, reject) => setTimeout(() => reject(new Error('cropper never became ready')), READY_TIMEOUT)),
  ])
  // One frame for the initial crop box to be laid out before anything measures it.
  await nextFrame()

  const find = (selector: string) => {
    const element = host.querySelector(selector)
    if (!element) throw new Error(`${adapter.name}: no element matched "${selector}"`)
    return element as HTMLElement
  }

  const displaySize = () => {
    const rect = find(adapter.imageBox).getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }

  /** Reads the crop off the page, in source pixels, for whichever component this is. */
  const getData = (): CropperData => {
    if (adapter.legacy) {
      const { x, y, width, height } = (wrapper.vm as unknown as { getData: () => CropperData }).getData()
      return { x, y, width, height }
    }
    const canvas = find('cropper-canvas').getBoundingClientRect()
    const picture = find('cropper-image').getBoundingClientRect()
    const selection = find('cropper-selection') as HTMLElement & {
      x: number
      y: number
      width: number
      height: number
    }
    if (picture.width <= 0) return { x: 0, y: 0, width: 0, height: 0 }
    const scale = picture.width / fixture.naturalWidth
    return {
      x: (selection.x - (picture.left - canvas.left)) / scale,
      y: (selection.y - (picture.top - canvas.top)) / scale,
      width: selection.width / scale,
      height: selection.height / scale,
    }
  }

  const setData = async (data: Partial<CropperData>) => {
    if (adapter.legacy) {
      ;(wrapper.vm as unknown as { setData: (d: Partial<CropperData>) => void }).setData(data)
      await nextFrame()
      return
    }
    const current = getData()
    await wrapper.setProps({
      modelValue: {
        x: (data.x ?? current.x) / fixture.naturalWidth,
        y: (data.y ?? current.y) / fixture.naturalHeight,
        width: (data.width ?? current.width) / fixture.naturalWidth,
        height: (data.height ?? current.height) / fixture.naturalHeight,
      },
    })
    await nextFrame()
    await nextFrame()
  }

  const getCrop = (): CropperData => {
    const picture = find(adapter.imageBox).getBoundingClientRect()
    const box = find(adapter.cropBox).getBoundingClientRect()
    if (picture.width <= 0 || picture.height <= 0) return { x: 0, y: 0, width: 0, height: 0 }
    return {
      x: (box.left - picture.left) / picture.width,
      y: (box.top - picture.top) / picture.height,
      width: box.width / picture.width,
      height: box.height / picture.height,
    }
  }

  return {
    wrapper,
    host,
    api: { getData, setData, getCrop, displaySize },
    readyCalls: () => readyCalls,
    cropendCalls: () => cropendCalls,
    find,
    destroy: () => {
      wrapper.unmount()
      host.remove()
    },
  }
}

export const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

export interface Point {
  x: number
  y: number
}

const pointerInit = (point: Point, pointerType: 'mouse' | 'touch' = 'mouse'): PointerEventInit => ({
  bubbles: true,
  cancelable: true,
  composed: true,
  pointerId: 1,
  pointerType,
  isPrimary: true,
  button: 0,
  buttons: 1,
  clientX: point.x,
  clientY: point.y,
})

/**
 * Drives a real pointer gesture. Both cropper versions start an action from a `pointerdown` on the
 * grip itself and then track `pointermove`/`pointerup` on the document, so the moves are dispatched
 * there rather than at the element under the cursor.
 */
export const drag = async (
  element: HTMLElement,
  from: Point,
  to: Point,
  steps = 4,
  pointerType: 'mouse' | 'touch' = 'mouse'
) => {
  element.dispatchEvent(new PointerEvent('pointerdown', pointerInit(from, pointerType)))
  for (let step = 1; step <= steps; step++) {
    const point = {
      x: from.x + ((to.x - from.x) * step) / steps,
      y: from.y + ((to.y - from.y) * step) / steps,
    }
    document.dispatchEvent(new PointerEvent('pointermove', { ...pointerInit(point, pointerType), buttons: 1 }))
  }
  document.dispatchEvent(new PointerEvent('pointerup', { ...pointerInit(to, pointerType), buttons: 0 }))
  await nextFrame()
}

/**
 * A two-finger pinch centred on the element. Both versions read this through pointer events, and it
 * is the one gesture that zooms the picture rather than changing the crop.
 */
export const pinch = async (element: HTMLElement, spread: number, steps = 6) => {
  const rect = element.getBoundingClientRect()
  const x = rect.left + rect.width / 2
  const y = rect.top + rect.height / 2
  const start = 40

  element.dispatchEvent(new PointerEvent('pointerdown', pointerInit({ x: x - start, y }, 'touch')))
  element.dispatchEvent(new PointerEvent('pointerdown', { ...pointerInit({ x: x + start, y }, 'touch'), pointerId: 2 }))
  // Dispatched on the element rather than the document: cropper.js reads `event.target` to work out
  // what is under the finger, and a real browser reports the element, not the document.
  for (let step = 1; step <= steps; step++) {
    const offset = start + (spread * step) / steps
    element.dispatchEvent(new PointerEvent('pointermove', pointerInit({ x: x - offset, y }, 'touch')))
    element.dispatchEvent(
      new PointerEvent('pointermove', { ...pointerInit({ x: x + offset, y }, 'touch'), pointerId: 2 })
    )
    await nextFrame()
  }
  const end = start + spread
  element.dispatchEvent(new PointerEvent('pointerup', { ...pointerInit({ x: x - end, y }, 'touch'), buttons: 0 }))
  element.dispatchEvent(
    new PointerEvent('pointerup', { ...pointerInit({ x: x + end, y }, 'touch'), buttons: 0, pointerId: 2 })
  )
  await wait(200)
}

/** The centre of an element, in client coordinates — the natural place to grab it. */
export const centerOf = (element: HTMLElement): Point => {
  const rect = element.getBoundingClientRect()
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
}

/** Displayed pixels per source pixel, measured off the page. */
export const scaleOf = (cropper: { api: CropperApi }, fixture: CropperFixture = LANDSCAPE_IMAGE): number =>
  cropper.api.displaySize().width / fixture.naturalWidth
