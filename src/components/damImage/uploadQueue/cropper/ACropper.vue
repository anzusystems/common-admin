<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import { useResizeObserver } from '@vueuse/core'
import {
  CropperCanvas,
  CropperCrosshair,
  CropperGrid,
  CropperHandle,
  CropperImage,
  CropperSelection,
  CropperShade,
} from 'cropperjs2'
import {
  canvasSizeFor,
  clampRectInside,
  initialSelectionRect,
  isUsableAspectRatio,
  RESIZE_ANCHORS,
  rectsAreClose,
  type Rect,
  type Size,
} from '@/components/damImage/uploadQueue/cropper/cropperGeometry'
import type { CropRect } from '@/components/damImage/uploadQueue/cropper/cropperTypes'

/**
 * Image cropper built on cropper.js v2's custom elements, replacing the v1-based `ACropperjs`.
 *
 * It lives here, beside `DamAssetImageRoiSelect`, because that is the only thing that uses it and
 * nothing outside this library does. It is not exported: shaping it to one need rather than to a
 * general audience is what keeps it to its size.
 *
 * The crop is bound, not fetched: `v-model` carries it as fractions of the image, and `commit` says
 * the user has finished a gesture. There is no imperative surface — the one thing a host wants to do
 * with a cropper is know where the crop is, and a binding says that better than six methods did.
 *
 * The elements are assembled in script rather than in the template on purpose: a consumer of this
 * library does not configure `isCustomElement` in their own build, and setting element *properties*
 * instead of going through attribute strings avoids the coercion surprises (`NaN`, booleans,
 * fractional numbers) that come with the attribute round-trip.
 */

const props = withDefaults(
  defineProps<{
    src?: string
    /** The crop, as fractions of the image. Leave it null to start from the default box. */
    modelValue?: CropRect | null
    /** `NaN` (the default) leaves the crop free-form. */
    aspectRatio?: number
    containerStyle?: { [key: string]: string } | undefined
    /** Wash over everything outside the crop — the replacement for overriding `.cropper-modal`. */
    shadeColor?: string
  }>(),
  {
    src: '',
    modelValue: null,
    aspectRatio: NaN,
    containerStyle: undefined,
    shadeColor: 'rgba(0, 0, 0, 0.5)',
  }
)

const emit = defineEmits<{
  (event: 'update:modelValue', crop: CropRect): void
  /** The user has finished a gesture; the crop is worth saving. */
  (event: 'commit', crop: CropRect): void
  (event: 'ready'): void
}>()

/**
 * Settings the one caller never varies, kept as constants rather than as props nobody passes.
 * Each of them is behaviour, not preference: no checkerboard behind a photograph, the wheel left to
 * the page, pinch zoom kept for tablets, and the minimum canvas cropper.js' own stylesheet declares.
 */
const AUTO_CROP_AREA = 0.8
const MIN_CONTAINER_WIDTH = 200
const MIN_CONTAINER_HEIGHT = 100

// Matched to cropper.js v1's stylesheet so the two components are indistinguishable side by side.
const SELECTION_COLOR = 'rgba(51, 153, 255, 0.75)'
const FACE_COLOR = 'rgba(255, 255, 255, 0.1)'
const GRID_COLOR = 'rgba(238, 238, 238, 0.5)'
const CROSSHAIR_COLOR = 'rgba(238, 238, 238, 0.75)'
const RESIZE_ACTIONS = [
  'n-resize',
  'e-resize',
  's-resize',
  'w-resize',
  'ne-resize',
  'nw-resize',
  'se-resize',
  'sw-resize',
]

interface CropperParts {
  canvas: CropperCanvas
  image: CropperImage
  selection: CropperSelection
}

const hostEl = useTemplateRef<HTMLDivElement>('hostEl')
const loading = ref(true)

let parts: CropperParts | null = null
let natural: Size = { width: 0, height: 0 }
/** The action cropper.js is currently performing, so a clamp knows which edge to hold still. */
let currentAction: string | null = null
/** Guards the re-entrant `$change` a clamp performs from being clamped again. */
let clamping = false
/** Guards the half-applied transforms `$center` emits between its move and its scale. */
let centring = false
/** Invalidates an in-flight build when `src` changes or the component goes away mid-load. */
let buildToken = 0
/** The host box the current layout was computed for — not merely the last one observed. */
let laidOut: Size = { width: 0, height: 0 }
/** The last crop handed out, so a model written straight back is not mistaken for a new one. */
let lastEmitted: CropRect | null = null
/** Watches the ancestors that clip the host; their height is part of the room it has. */
let ancestorObserver: ResizeObserver | null = null

const create = <T extends HTMLElement>(name: string): T => document.createElement(name) as T

/** The image box in canvas coordinates. Read from layout so panning and zooming stay accounted for. */
const imageBounds = (): Rect => {
  if (!parts) return { x: 0, y: 0, width: 0, height: 0 }
  const canvasRect = parts.canvas.getBoundingClientRect()
  const imageRect = parts.image.getBoundingClientRect()
  return {
    x: imageRect.left - canvasRect.left,
    y: imageRect.top - canvasRect.top,
    width: imageRect.width,
    height: imageRect.height,
  }
}

/**
 * Where the crop is allowed to be: the image, but never outside the visible canvas. The two are the
 * same box until the image is zoomed past its frame, and then it is the frame that wins — cropper.js
 * v1 limited its crop box to the canvas and the container both, so a zoomed-in image never let the
 * crop wander off the part of it you could actually see.
 */
const constraintBounds = (): Rect => {
  if (!parts) return { x: 0, y: 0, width: 0, height: 0 }
  const image = imageBounds()
  const canvas = parts.canvas.getBoundingClientRect()
  const left = Math.max(image.x, 0)
  const top = Math.max(image.y, 0)
  const right = Math.min(image.x + image.width, canvas.width)
  const bottom = Math.min(image.y + image.height, canvas.height)
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
}

const selectionRect = (): Rect => {
  if (!parts) return { x: 0, y: 0, width: 0, height: 0 }
  const { x, y, width, height } = parts.selection
  return { x, y, width, height }
}

const applyRect = (rect: Rect) => {
  if (!parts) return
  clamping = true
  parts.selection.$change(rect.x, rect.y, rect.width, rect.height, props.aspectRatio, true)
  clamping = false
}

/**
 * Re-fits the image to the canvas. cropper.js only lets `$center` scale and move an image that is
 * marked scalable and translatable — it grants itself that permission while the image is still
 * loading, but not afterwards — so the flags are lifted for the call and put back straight after.
 */
const centerImage = () => {
  if (!parts) return
  const { image } = parts
  const { scalable, translatable } = image
  centring = true
  image.scalable = true
  image.translatable = true
  image.$center('contain')
  image.scalable = scalable
  image.translatable = translatable
  centring = false
}

/**
 * The crop a fresh picture starts with. Computed here rather than handed to cropper.js'
 * `initialCoverage`, whose deferred initialisation would land *after* a `ready` handler had already
 * positioned the crop. It is measured against the image rather than the canvas, which are the same
 * box for a source wider than its container and are not once the image sits centred between margins.
 */
const seedInitialCrop = () => {
  if (!parts) return
  const bounds = imageBounds()
  if (bounds.width <= 0 || bounds.height <= 0) return
  const initial = initialSelectionRect(bounds, props.aspectRatio, AUTO_CROP_AREA)
  applyRect({ ...initial, x: initial.x + bounds.x, y: initial.y + bounds.y })
}

/** Uses the bound crop if there is one, and the default box if there is not. */
const applyModelOrSeed = () => {
  const model = props.modelValue
  if (model && model.width > 0 && model.height > 0) applyCrop(model)
  else seedInitialCrop()
  emitCrop()
}

/** Pulls the selection back inside the image after something moved the image out from under it. */
const refit = () => {
  if (!parts || centring) return
  const current = selectionRect()
  if (current.width <= 0 || current.height <= 0) return
  const fitted = clampRectInside(current, constraintBounds(), props.aspectRatio)
  if (!rectsAreClose(current, fitted)) applyRect(fitted)
}

const onSelectionChange = (event: Event) => {
  if (clamping || !parts) return
  const detail = (event as CustomEvent<Rect>).detail
  if (!detail) return
  // cropper.js reverses the action when a grip is dragged through the opposite edge, and it records
  // that on the canvas just before emitting this event — one move ahead of the `action` event the
  // tracking below sees. Prefer its own answer, and fall back if a future version stops publishing it.
  const liveAction = (parts.canvas as unknown as { $action?: unknown }).$action
  const action = typeof liveAction === 'string' && liveAction ? liveAction : currentAction
  const anchor = action ? RESIZE_ANCHORS[action] : undefined
  const clamped = clampRectInside(detail, constraintBounds(), props.aspectRatio, anchor)
  if (rectsAreClose(detail, clamped)) return
  // Rejecting the change and re-issuing the clamped one is what keeps the crop sliding along the
  // border instead of freezing there; the shade reads `defaultPrevented` and follows the new values.
  event.preventDefault()
  applyRect(clamped)
}

const onActionStart = (event: Event) => {
  currentAction = (event as CustomEvent<{ action?: string }>).detail?.action ?? null
}

const onAction = (event: Event) => {
  const action = (event as CustomEvent<{ action?: string }>).detail?.action
  // cropper.js turns a fresh "select" drag into the matching corner resize once it knows the
  // direction, and reports the new action on the next move — follow it so the anchor stays right.
  if (action) currentAction = action
}

const onActionEnd = () => {
  currentAction = null
  emitCrop(true)
}

/**
 * The canvas must never see a wheel event: its own handler calls `preventDefault()` unconditionally,
 * which would swallow page scrolling over the picture the way cropper.js v1 never did. Pinching is
 * unaffected — that arrives as pointer events, and the picture stays scalable for it.
 */
const onWheelCapture = (event: WheelEvent) => {
  event.stopPropagation()
}

/**
 * cropper.js emits `transform` *before* it writes the new matrix to the element's style (it sets the
 * new transform to measure the result, puts the old one back, then emits and finally commits). Re-
 * fitting straight away would therefore measure the image as it was: after a zoom out the crop would
 * be judged against the larger, previous picture and left hanging over the edge of the new one.
 */
const onImageTransform = () => queueMicrotask(refit)

const teardown = () => {
  if (parts) {
    const { canvas, image, selection } = parts
    selection.removeEventListener('change', onSelectionChange)
    canvas.removeEventListener('actionstart', onActionStart)
    canvas.removeEventListener('action', onAction)
    canvas.removeEventListener('actionend', onActionEnd)
    image.removeEventListener('transform', onImageTransform)
  }
  // Every canvas, not just the one on `parts`: a build that was superseded while still waiting on
  // its image has already put one in the DOM and has nothing tracking it yet.
  hostEl.value?.querySelectorAll(CropperCanvas.$name).forEach((canvas) => {
    // Disconnecting a `cropper-image` drops its listeners but leaves its request running, and the
    // `$ready()` promise waiting on it keeps this component reachable until the server answers.
    canvas.querySelectorAll<CropperImage>(CropperImage.$name).forEach((image) => {
      if (image.$image) image.$image.src = ''
    })
    canvas.remove()
  })
  ancestorObserver?.disconnect()
  ancestorObserver = null
  parts = null
  natural = { width: 0, height: 0 }
  laidOut = { width: 0, height: 0 }
  currentAction = null
}

/**
 * How much of the host's height will actually be shown.
 *
 * The host's own `max-height` is the usual answer, and the one `DamAssetImageRoiSelect` relies on.
 * Ancestors count too when they clip with `overflow: hidden` — what they cut off cannot be scrolled
 * back into view, so it is no more reachable than the host's own overflow. An ancestor that
 * scrolls is left alone: there the rest of the picture is a scroll away, not gone.
 */
const clippingAncestorsOf = (host: HTMLElement): HTMLElement[] => {
  const found: HTMLElement[] = []
  let ancestor = host.parentElement
  while (ancestor && ancestor !== document.body && ancestor !== document.documentElement) {
    const { overflowY } = window.getComputedStyle(ancestor)
    if (overflowY === 'hidden' || overflowY === 'clip') found.push(ancestor)
    ancestor = ancestor.parentElement
  }
  return found
}

const visibleHeightOf = (host: HTMLElement): number => {
  let available = host.clientHeight
  const hostTop = host.getBoundingClientRect().top

  clippingAncestorsOf(host).forEach((ancestor) => {
    const rect = ancestor.getBoundingClientRect()
    // From wherever the host starts being visible down to where the ancestor stops showing anything.
    // Taking the ancestor's own top into account matters when the host begins above it: what is
    // scrolled or positioned off the top is just as unreachable as what falls off the bottom.
    const room = rect.bottom - Math.max(rect.top, hostTop)
    if (room > 0) available = Math.min(available, room)
  })

  return available
}

/**
 * Sizes the canvas to the room the host actually gives it, in two passes because the second answer
 * depends on the first: the height a picture wants follows from its width, but a frame with a
 * `max-height` only reveals how much of that it will show once something is in it.
 *
 * cropper.js v1 did the same dance with its `<img>`, and the point of it is that its cropper never
 * overflowed: a tall picture in a short frame was scaled down to fit rather than cut off at the
 * bottom, where the part of the crop hidden by `overflow: hidden` could not be reached again.
 */
const sizeCanvas = (canvas: CropperCanvas, host: HTMLElement, availableWidth: number): Size => {
  const size = canvasSizeFor(natural, availableWidth, MIN_CONTAINER_WIDTH, MIN_CONTAINER_HEIGHT)
  canvas.style.width = `${size.width}px`
  canvas.style.height = `${size.height}px`

  const visibleHeight = visibleHeightOf(host)
  if (visibleHeight > 0 && visibleHeight < size.height) {
    size.height = Math.max(visibleHeight, MIN_CONTAINER_HEIGHT)
    canvas.style.height = `${size.height}px`
  }
  return size
}

const buildSelectionChildren = (selection: CropperSelection) => {
  const grid = create<CropperGrid>(CropperGrid.$name)
  grid.rows = 3
  grid.columns = 3
  grid.covered = true
  grid.themeColor = GRID_COLOR
  grid.setAttribute('role', 'grid')
  selection.appendChild(grid)

  const crosshair = create<CropperCrosshair>(CropperCrosshair.$name)
  crosshair.centered = true
  crosshair.themeColor = CROSSHAIR_COLOR
  selection.appendChild(crosshair)

  const face = create<CropperHandle>(CropperHandle.$name)
  face.action = 'move'
  face.themeColor = FACE_COLOR
  selection.appendChild(face)

  RESIZE_ACTIONS.forEach((action) => {
    const handle = create<CropperHandle>(CropperHandle.$name)
    handle.action = action
    handle.themeColor = SELECTION_COLOR
    selection.appendChild(handle)
  })
}

const build = async () => {
  const token = ++buildToken
  teardown()
  loading.value = true

  const host = hostEl.value
  if (!host || !props.src) {
    // Nothing to wait for: leaving the spinner up would make an empty cropper look like a stuck one.
    loading.value = false
    return
  }

  const canvas = create<CropperCanvas>(CropperCanvas.$name)
  canvas.background = false
  canvas.themeColor = SELECTION_COLOR
  canvas.style.display = 'block'
  sizeCanvas(canvas, host, host.clientWidth)

  const image = create<CropperImage>(CropperImage.$name)
  image.alt = ''
  image.initialFit = 'contain'
  image.rotatable = false
  image.skewable = false
  image.translatable = false
  image.scalable = true
  image.src = props.src

  const shade = create<CropperShade>(CropperShade.$name)
  shade.themeColor = props.shadeColor
  // Kept out of the way until the first crop box exists, or it would flash across the whole canvas.
  shade.hidden = true

  const selectHandle = create<CropperHandle>(CropperHandle.$name)
  selectHandle.action = 'select'
  selectHandle.plain = true

  const selection = create<CropperSelection>(CropperSelection.$name)
  selection.themeColor = SELECTION_COLOR
  selection.movable = true
  selection.resizable = true
  selection.outlined = true
  // Keep sub-pixel values: rounding to whole canvas pixels would drift the natural-pixel crop data
  // that callers persist, and cropper.js v1 did not round either.
  selection.precise = true
  selection.aspectRatio = props.aspectRatio
  buildSelectionChildren(selection)

  // Listeners go on before anything is connected, so the action in flight is already known by the
  // time the elements' own handlers react to it.
  canvas.addEventListener('actionstart', onActionStart)
  canvas.addEventListener('action', onAction)
  canvas.addEventListener('actionend', onActionEnd)
  image.addEventListener('transform', onImageTransform)
  selection.addEventListener('change', onSelectionChange)

  canvas.append(image, shade, selectHandle, selection)
  // The whole tree is attached in one move on purpose: each element wires itself up to its siblings
  // when it connects, and the shade in particular goes looking for the selection. Appending the
  // children one at a time leaves it looking at an empty canvas, and it never follows the crop.
  host.appendChild(canvas)
  // Second pass, now that there is something in the host for its own constraints to act on.
  sizeCanvas(canvas, host, host.clientWidth)

  let loaded: HTMLImageElement
  try {
    // The element runs the one request there is; its promise carries the picture that arrived.
    loaded = await image.$ready()
  } catch {
    // Mirrors cropper.js v1, which simply never became ready on a broken source.
    canvas.remove()
    if (token === buildToken) loading.value = false
    return
  }
  if (token !== buildToken) {
    canvas.remove()
    return
  }

  parts = { canvas, image, selection }
  // Only now is the picture's own size known, so the canvas gets its real dimensions here rather
  // than from a second request made ahead of time purely to measure it.
  natural = { width: loaded.naturalWidth, height: loaded.naturalHeight }
  sizeCanvas(canvas, host, host.clientWidth)

  // A prop that changed while the picture was loading found the watchers with no elements to write
  // to. Re-reading the two that can vary closes that window; it is idempotent otherwise.
  shade.themeColor = props.shadeColor
  selection.aspectRatio = props.aspectRatio

  centerImage()

  laidOut = hostBox(host)
  observeAncestors(host)
  applyModelOrSeed()

  loading.value = false
  emit('ready')
}

/** Where the crop sits, as fractions of the image. */
const currentCrop = (): CropRect | null => {
  if (!parts) return null
  const bounds = imageBounds()
  if (bounds.width <= 0 || bounds.height <= 0) return null
  const rect = selectionRect()
  return {
    x: (rect.x - bounds.x) / bounds.width,
    y: (rect.y - bounds.y) / bounds.height,
    width: rect.width / bounds.width,
    height: rect.height / bounds.height,
  }
}

/** Puts a crop given in fractions onto the canvas, clamped to the picture. */
const applyCrop = (crop: CropRect) => {
  const bounds = imageBounds()
  if (!parts || bounds.width <= 0 || bounds.height <= 0) return
  applyRect(
    clampRectInside(
      {
        x: bounds.x + crop.x * bounds.width,
        y: bounds.y + crop.y * bounds.height,
        width: crop.width * bounds.width,
        height: crop.height * bounds.height,
      },
      constraintBounds(),
      props.aspectRatio
    )
  )
}

const cropsAreClose = (a: CropRect | null, b: CropRect | null): boolean =>
  a !== null &&
  b !== null &&
  Math.abs(a.x - b.x) < 0.0005 &&
  Math.abs(a.y - b.y) < 0.0005 &&
  Math.abs(a.width - b.width) < 0.0005 &&
  Math.abs(a.height - b.height) < 0.0005

/**
 * Hands the crop back up. Also called after the component itself has adjusted one — a stored region
 * rarely matches the configured ratio, and the binding should say where the crop really is rather
 * than where it was asked to be.
 */
const emitCrop = (alsoCommit = false) => {
  const crop = currentCrop()
  if (!crop) return
  if (alsoCommit || !cropsAreClose(crop, lastEmitted)) {
    lastEmitted = crop
    emit('update:modelValue', crop)
  }
  if (alsoCommit) emit('commit', crop)
}

/** The room the host has: its width, and the height that will actually be shown. */
const hostBox = (host: HTMLElement): Size => ({ width: host.clientWidth, height: visibleHeightOf(host) })

/** Re-fit the image to the new container while keeping the crop the user already chose. */
const relayout = () => {
  const host = hostEl.value
  if (!parts || !host) return
  // A crop of no size means the last layout had none either — fall back to the bound one, which is
  // what a cropper built inside a closed panel has been holding all along.
  const wanted = currentCrop() ?? props.modelValue

  const size = sizeCanvas(parts.canvas, host, host.clientWidth)
  laidOut = hostBox(host)
  // Re-read the ancestors as well: a cropper can be moved between frames, and the one clipping it
  // now is the one whose height matters.
  observeAncestors(host)
  centerImage()
  if (size.width <= 0 || size.height <= 0) return

  if (wanted && wanted.width > 0) applyCrop(wanted)
  else applyModelOrSeed()
  emitCrop()
}

const onHostBoxChanged = () => {
  const host = hostEl.value
  if (!host) return
  const box = hostBox(host)
  if (box.width <= 0 || box.height <= 0) return
  // Compared against the box the current layout was built for, so a size seen while the cropper was
  // still loading cannot be mistaken for one that has already been laid out.
  if (box.width === laidOut.width && box.height === laidOut.height) return
  if (!parts) return
  // Deferred a frame: resizing the canvas from inside the observer's own callback is what makes
  // Chromium report an undelivered-notification loop.
  requestAnimationFrame(() => relayout())
}

// Height counts as much as width: the DAM sizes the cropper with `calc(100vh - 160px)`, so a
// shorter window shrinks the frame without touching its width.
useResizeObserver(hostEl, onHostBoxChanged)

/** An ancestor that clips can change how much it shows without the host's own box moving at all. */
const observeAncestors = (host: HTMLElement) => {
  ancestorObserver?.disconnect()
  const ancestors = clippingAncestorsOf(host)
  if (ancestors.length === 0) {
    ancestorObserver = null
    return
  }
  ancestorObserver = new ResizeObserver(onHostBoxChanged)
  ancestors.forEach((ancestor) => ancestorObserver?.observe(ancestor))
}

watch(
  () => props.src,
  () => {
    build()
  }
)

watch(
  () => props.modelValue,
  (model) => {
    // Ignore the echo of what this component just handed up, or the two would write to each other
    // for as long as the parent keeps binding it back.
    if (!parts || !model || cropsAreClose(model, lastEmitted)) return
    applyCrop(model)
    emitCrop()
  },
  { deep: true }
)

watch(
  () => props.shadeColor,
  (shadeColor) => {
    const shade = parts?.canvas.querySelector<CropperShade>(CropperShade.$name)
    if (shade) shade.themeColor = shadeColor
  }
)

watch(
  () => props.aspectRatio,
  (aspectRatio) => {
    if (!parts) return
    parts.selection.aspectRatio = aspectRatio
    if (!isUsableAspectRatio(aspectRatio)) return
    const current = selectionRect()
    applyRect(clampRectInside({ ...current, height: current.width / aspectRatio }, constraintBounds(), aspectRatio))
  }
)

onMounted(() => {
  build()
})

onBeforeUnmount(() => {
  buildToken += 1
  teardown()
})
</script>

<template>
  <div class="a-cropper d-flex flex-column">
    <div
      v-if="loading"
      class="d-flex w-100 align-center justify-center"
    >
      <VProgressCircular
        class="position-absolute"
        indeterminate
      />
    </div>

    <div
      ref="hostEl"
      class="a-cropper__container"
      :style="containerStyle"
      @wheel.capture="onWheelCapture"
    />
  </div>
</template>

<style lang="scss">
// `cropper-crosshair` sizes itself in `em`, so without a size of its own the centre marker would
// grow and shrink with whatever font the surrounding admin happens to use. 7px is the plus sign
// cropper.js v1 drew through `.cropper-center`.
.a-cropper cropper-crosshair {
  font-size: 7px;
}

// cropper.js v1 drew a `.cropper-line` along each edge of the crop box: a 5px band of the selection
// colour at a tenth opacity, sitting 3px outside the border and 2px inside it. It is what made the
// thin outline read as a grabbable edge, so it is drawn here too — as a pair of shadows rather than
// four elements, which keeps it independent of how the v2 grips happen to be sized.
.a-cropper cropper-selection[outlined] {
  box-shadow:
    inset 0 0 0 2px rgb(51 153 255 / 10%),
    0 0 0 3px rgb(51 153 255 / 10%);
}
</style>
