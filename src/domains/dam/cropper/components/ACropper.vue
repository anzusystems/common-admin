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
} from 'cropperjs'
import {
  canvasSizeFor,
  clampRectInside,
  initialSelectionRect,
  isUsableAspectRatio,
  RESIZE_ANCHORS,
  rectsAreClose,
  type Rect,
  type Size,
} from '@/domains/dam/cropper/utils/cropperGeometry'
import type { CropRect } from '@/domains/dam/cropper/utils/cropperTypes'

/**
 * Image cropper built on cropper.js v2 custom elements. Replaces the v1-based `ACropperjs`.
 * Not exported. Its only user is `DamAssetImageRoiSelect`, and it is shaped to that one need.
 * The crop is bound via `v-model` as fractions of the image.
 * `commit` signals that a gesture ended. There is no imperative API.
 * Elements are built in script, not the template. Consumers do not configure `isCustomElement`,
 * and setting properties avoids attribute coercion issues (`NaN`, booleans, fractions).
 */

const props = withDefaults(
  defineProps<{
    src?: string
    /** The crop as fractions of the image. Null starts from the default box. */
    modelValue?: CropRect | null
    /** `NaN` (the default) leaves the crop free-form. */
    aspectRatio?: number
    containerStyle?: { [key: string]: string } | undefined
    /** Colour over everything outside the crop. Replaces overriding `.cropper-modal`. */
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
  /** The user finished a gesture. The crop is worth saving. */
  (event: 'commit', crop: CropRect): void
  (event: 'ready'): void
}>()

// cropper.js registers its elements as a side effect of its entry module. Our `sideEffects`
// setting lets the consumer's bundler drop that module, so register them here.
// `$define` is a no-op for an already registered element.
for (const element of [
  CropperCanvas,
  CropperCrosshair,
  CropperGrid,
  CropperHandle,
  CropperImage,
  CropperSelection,
  CropperShade,
]) {
  element.$define()
}

/**
 * Settings the only caller never varies. Each is behaviour: no checkerboard behind a photo, wheel left
 * to the page, pinch zoom kept for tablets, and the minimum canvas size from cropper.js' stylesheet.
 */
const AUTO_CROP_AREA = 0.8
const MIN_CONTAINER_WIDTH = 200
const MIN_CONTAINER_HEIGHT = 100

// Matches cropper.js v1's stylesheet so both components look the same.
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
/** The action cropper.js is performing, so a clamp knows which edge to hold still. */
let currentAction: string | null = null
/** Guards the re-entrant `$change` a clamp performs from being clamped again. */
let clamping = false
/** Ignores the half-applied transforms `$center` emits between its move and its scale. */
let centring = false
/** Invalidates an in-flight build when `src` changes or the component goes away mid-load. */
let buildToken = 0
/** The host box the current layout was computed for, not the last one observed. */
let laidOut: Size = { width: 0, height: 0 }
/** The last emitted crop, so a model written straight back is not treated as new. */
let lastEmitted: CropRect | null = null
/** Watches ancestors that clip the host. Their height limits the available room. */
let ancestorObserver: ResizeObserver | null = null

const create = <T extends HTMLElement>(name: string): T => document.createElement(name) as T

/** The image box in canvas coordinates. Read from layout so panning and zooming are included. */
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
 * Where the crop may be: the image, but never outside the visible canvas.
 * They differ only when the image is zoomed past its frame. Then the frame wins, as in cropper.js v1.
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
 * Re-fits the image to the canvas.
 * `$center` only scales and moves an image marked scalable and translatable. cropper.js allows
 * this itself only while loading, so the flags are set for the call and restored after.
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
 * The initial crop of a new picture. Not using cropper.js' `initialCoverage`,
 * because its deferred init runs after a `ready` handler has positioned the crop.
 * Measured against the image, not the canvas. They differ when the image is centred between margins.
 */
const seedInitialCrop = () => {
  if (!parts) return
  const bounds = imageBounds()
  if (bounds.width <= 0 || bounds.height <= 0) return
  const initial = initialSelectionRect(bounds, props.aspectRatio, AUTO_CROP_AREA)
  applyRect({ ...initial, x: initial.x + bounds.x, y: initial.y + bounds.y })
}

const applyModelOrSeed = () => {
  const model = props.modelValue
  if (model && model.width > 0 && model.height > 0) applyCrop(model)
  else seedInitialCrop()
  emitCrop()
}

/** Pulls the selection back inside the image after the image moved. */
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
  // cropper.js reverses the action when a grip is dragged past the opposite edge. It records
  // this on the canvas before emitting this event, one move ahead of the `action` event.
  // Prefer that value, and fall back in case a future version stops setting it.
  const liveAction = (parts.canvas as unknown as { $action?: unknown }).$action
  const action = typeof liveAction === 'string' && liveAction ? liveAction : currentAction
  const anchor = action ? RESIZE_ANCHORS[action] : undefined
  const clamped = clampRectInside(detail, constraintBounds(), props.aspectRatio, anchor)
  if (rectsAreClose(detail, clamped)) return
  // Rejecting the change and applying the clamped one keeps the crop sliding along the border instead of freezing.
  // The shade reads `defaultPrevented` and follows the new values.
  event.preventDefault()
  applyRect(clamped)
}

const onActionStart = (event: Event) => {
  currentAction = (event as CustomEvent<{ action?: string }>).detail?.action ?? null
}

const onAction = (event: Event) => {
  const action = (event as CustomEvent<{ action?: string }>).detail?.action
  // cropper.js turns a new "select" drag into a corner resize once the direction is known.
  // It reports the new action on the next move. Follow it so the anchor stays correct.
  if (action) currentAction = action
}

const onActionEnd = () => {
  currentAction = null
  emitCrop(true)
}

/**
 * The canvas must never see a wheel event. Its handler always calls
 * `preventDefault()`, which would block page scrolling over the picture.
 * Pinch zoom still works because it arrives as pointer events.
 */
const onWheelCapture = (event: WheelEvent) => {
  event.stopPropagation()
}

/**
 * cropper.js emits `transform` before it writes the new matrix to the element style.
 * Re-fitting at once would measure the old image. After a zoom out the crop would hang over the edge of the new one.
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
  // Every canvas, not only the one on `parts`. A superseded build still waiting
  // on its image has already added one to the DOM, and nothing tracks it.
  hostEl.value?.querySelectorAll(CropperCanvas.$name).forEach((canvas) => {
    // Disconnecting a `cropper-image` drops its listeners but keeps its request running.
    // The pending `$ready()` promise keeps this component alive until the server answers.
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
 * How much of the host's height is actually shown.
 * Usually the host's own `max-height`, which `DamAssetImageRoiSelect` relies on. Ancestors
 * with `overflow: hidden` count too, because what they cut off cannot be scrolled into view.
 * Scrolling ancestors are ignored. There the rest is reachable by scrolling.
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
    // From where the host becomes visible to where the ancestor stops showing content.
    // The ancestor's top matters when the host starts above it.
    // Content off the top is as unreachable as content off the bottom.
    const room = rect.bottom - Math.max(rect.top, hostTop)
    if (room > 0) available = Math.min(available, room)
  })

  return available
}

/**
 * Sizes the canvas to the room the host gives it, in two passes.
 * The picture's height follows from its width, but a frame with
 * `max-height` only shows how much it reveals once it has content.
 * This keeps a tall picture in a short frame scaled to fit, as in v1. A
 * part cut off by `overflow: hidden` could not be reached by the crop.
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
    // Nothing to load. A visible spinner would make an empty cropper look stuck.
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
  // Hidden until the first crop box exists, or it would flash across the whole canvas.
  shade.hidden = true

  const selectHandle = create<CropperHandle>(CropperHandle.$name)
  selectHandle.action = 'select'
  selectHandle.plain = true

  const selection = create<CropperSelection>(CropperSelection.$name)
  selection.themeColor = SELECTION_COLOR
  selection.movable = true
  selection.resizable = true
  selection.outlined = true
  // Keep sub-pixel values. Rounding would drift the natural-pixel crop data that callers persist.
  selection.precise = true
  selection.aspectRatio = props.aspectRatio
  buildSelectionChildren(selection)

  // Listeners are added before anything is connected, so the current
  // action is known before the elements' own handlers react.
  canvas.addEventListener('actionstart', onActionStart)
  canvas.addEventListener('action', onAction)
  canvas.addEventListener('actionend', onActionEnd)
  image.addEventListener('transform', onImageTransform)
  selection.addEventListener('change', onSelectionChange)

  canvas.append(image, shade, selectHandle, selection)
  // Attach the whole tree at once. Each element links to its
  // siblings on connect, and the shade looks for the selection.
  // Appending children one by one leaves the shade on an empty canvas, and it never follows the crop.
  host.appendChild(canvas)
  // Second pass, now that the host has content for its constraints to act on.
  sizeCanvas(canvas, host, host.clientWidth)

  let loaded: HTMLImageElement
  try {
    // The element makes the only request. Its promise returns the loaded picture.
    loaded = await image.$ready()
  } catch {
    // Matches cropper.js v1, which never became ready on a broken source.
    canvas.remove()
    if (token === buildToken) loading.value = false
    return
  }
  if (token !== buildToken) {
    canvas.remove()
    return
  }

  parts = { canvas, image, selection }
  // The natural size is known only now. Sizing here avoids a separate request just to measure the image.
  natural = { width: loaded.naturalWidth, height: loaded.naturalHeight }
  sizeCanvas(canvas, host, host.clientWidth)

  // A prop changed during loading found no elements for the watchers to
  // update. Re-apply the two variable props. This is idempotent otherwise.
  shade.themeColor = props.shadeColor
  selection.aspectRatio = props.aspectRatio

  centerImage()

  laidOut = hostBox(host)
  observeAncestors(host)
  applyModelOrSeed()

  loading.value = false
  emit('ready')
}

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

/** Applies a crop given in fractions to the canvas, clamped to the picture. */
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
 * Emits the crop. Also called after the component adjusts the crop itself. A stored region
 * rarely matches the configured ratio, and the binding should show the actual crop.
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

/** The host's room: its width and the height that is actually shown. */
const hostBox = (host: HTMLElement): Size => ({ width: host.clientWidth, height: visibleHeightOf(host) })

/** Re-fits the image to the new container and keeps the user's crop. */
const relayout = () => {
  const host = hostEl.value
  if (!parts || !host) return
  // No crop means the last layout had no size. Fall back to the bound
  // crop, which a cropper built inside a closed panel has held all along.
  const wanted = currentCrop() ?? props.modelValue

  const size = sizeCanvas(parts.canvas, host, host.clientWidth)
  laidOut = hostBox(host)
  // Re-read the ancestors too. A cropper can move between frames,
  // and the current clipping ancestor is the one that matters.
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
  // Compare with the box the current layout was built for, so a
  // size seen during loading is not treated as already laid out.
  if (box.width === laidOut.width && box.height === laidOut.height) return
  if (!parts) return
  // Deferred a frame. Resizing the canvas inside the observer
  // callback makes Chromium report an undelivered-notification loop.
  requestAnimationFrame(() => relayout())
}

// Height matters as much as width. The DAM sizes the cropper with `calc(100vh
// - 160px)`, so a shorter window shrinks the frame without changing its width.
useResizeObserver(hostEl, onHostBoxChanged)

/** A clipping ancestor can change how much it shows without the host box changing. */
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
    // Ignore the echo of the crop just emitted. Otherwise parent and component would keep writing to each other.
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
// Full width even as a flex item, such as in the asset detail dialog. The canvas is sized from the
// host's width, and a shrink-wrapped root has none to give, so every picture got the 200px minimum.
.a-cropper {
  width: 100%;
}

// `cropper-crosshair` is sized in `em`. Without its own size the centre marker would scale with the admin's font.
// 7px matches the plus sign of v1's `.cropper-center`.
.a-cropper cropper-crosshair {
  font-size: 7px;
}

// Recreates v1's `.cropper-line` on each crop edge: a 5px band of the selection colour at 10%
// opacity, 3px outside and 2px inside the border. It makes the outline read as a grabbable edge.
// Drawn as two shadows, so it does not depend on the v2 grip sizes.
.a-cropper cropper-selection[outlined] {
  box-shadow:
    inset 0 0 0 2px rgb(51 153 255 / 10%),
    0 0 0 3px rgb(51 153 255 / 10%);
}
</style>
