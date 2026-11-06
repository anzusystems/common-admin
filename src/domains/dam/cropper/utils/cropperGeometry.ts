/**
 * Geometry for `ACropper`: canvas size, initial crop box, and keeping the crop inside the image.
 * cropper.js v1 did this internally and v2 does not. Kept away from the DOM so it can be tested directly.
 */
import { getAdjustedSizes } from 'cropperjs'

export interface Size {
  width: number
  height: number
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Which edge of the selection stays fixed while the other moves. This mirrors how cropper.js v2
 * computes a resize, and lets a clamped selection stop at the image border instead of sliding.
 * `fit` is the case without an anchor (programmatic `setData`, a move, a re-fit after resize). The
 * box may be as large as the image allows and is slid back into view, like v1's `limitCropBox`.
 */
export type AnchorSide = 'start' | 'center' | 'end' | 'fit'

export type Anchor = [AnchorSide, AnchorSide]

/** Anchors per cropper.js action name. Missing actions get a plain "fit" clamp. */
export const RESIZE_ANCHORS: Readonly<Record<string, Anchor>> = {
  'n-resize': ['center', 'end'],
  's-resize': ['center', 'start'],
  'e-resize': ['start', 'center'],
  'w-resize': ['end', 'center'],
  'ne-resize': ['start', 'end'],
  'nw-resize': ['end', 'end'],
  'se-resize': ['start', 'start'],
  'sw-resize': ['end', 'start'],
  // A new selection grows away from the drag start point.
  select: ['start', 'start'],
}

export const isUsableAspectRatio = (aspectRatio: number): boolean => Number.isFinite(aspectRatio) && aspectRatio > 0

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

/**
 * The largest box of `aspectRatio` that fits in `size`. Without a
 * usable ratio the size is returned unchanged, as for a free-form crop.
 */
export const fitAspectRatio = (size: Size, aspectRatio: number): Size => {
  if (!isUsableAspectRatio(aspectRatio)) return { width: size.width, height: size.height }
  return size.height * aspectRatio > size.width
    ? { width: size.width, height: size.width / aspectRatio }
    : { width: size.height * aspectRatio, height: size.height }
}

/**
 * The initial crop: v1's `autoCropArea` applied to the aspect-fitted image, centred.
 * `fitAspectRatio` scales linearly, so the result is the same in natural
 * or displayed pixels. Crop data does not depend on window width.
 */
export const initialSelectionRect = (bounds: Size, aspectRatio: number, coverage: number): Rect => {
  const fitted = fitAspectRatio(bounds, aspectRatio)
  const width = fitted.width * coverage
  const height = fitted.height * coverage
  return {
    x: (bounds.width - width) / 2,
    y: (bounds.height - height) / 2,
    width,
    height,
  }
}

/**
 * Grows a box to the ratio with the same function cropper.js' `$change`
 * uses. The box then has its final shape before it is clamped to the image.
 * Otherwise a crop with a new height keeps its old width through
 * the clamp, and cropper.js widens it past the image edge.
 * The guard is needed: `getAdjustedSizes` returns `NaN` for a `NaN` ratio.
 */
export const coverAspectRatio = (size: Size, aspectRatio: number): Size =>
  isUsableAspectRatio(aspectRatio)
    ? getAdjustedSizes({ width: size.width, height: size.height, aspectRatio }, 'cover')
    : { width: size.width, height: size.height }

/** How much room an axis has while the anchored edge stays fixed. */
const availableAlong = (start: number, length: number, boundsStart: number, boundsLength: number, side: AnchorSide) => {
  const boundsEnd = boundsStart + boundsLength
  if (side === 'start') return Math.max(0, boundsEnd - Math.max(start, boundsStart))
  if (side === 'end') return Math.max(0, Math.min(start + length, boundsEnd) - boundsStart)
  // `center` and `fit` are both free to use the whole span; only where they land differs.
  return boundsLength
}

/** Where the axis starts once its length is known and the anchored edge stays fixed. */
const placeAlong = (start: number, length: number, newLength: number, side: AnchorSide) => {
  if (side === 'end') return start + length - newLength
  if (side === 'center') return start + length / 2 - newLength / 2
  return start
}

/**
 * Keeps `rect` inside `bounds` like v1's `viewMode: 1`. A selection past an edge is shrunk, not pushed,
 * so the edge not being dragged stays put. A selection only out of position is slid back whole.
 * `anchor` gives the edges the gesture holds fixed. Without it (programmatic
 * `setData`, initial layout, re-fit after resize) the size is capped at the bounds,
 * the top-left corner is kept and the result slid into view, like v1's `limitCropBox`.
 */
export const clampRectInside = (rect: Rect, bounds: Rect, aspectRatio: number, anchor?: Anchor): Rect => {
  const [anchorX, anchorY] = anchor ?? ['fit', 'fit']

  // Measure the rectangle cropper.js will produce, not the requested one. A
  // rectangle already in proportion, such as any drag result, is unchanged.
  const asked = { ...rect, ...coverAspectRatio(rect, aspectRatio) }

  const maxWidth = availableAlong(asked.x, asked.width, bounds.x, bounds.width, anchorX)
  const maxHeight = availableAlong(asked.y, asked.height, bounds.y, bounds.height, anchorY)

  let { width, height } = asked
  if (isUsableAspectRatio(aspectRatio)) {
    // Scale both axes by the same factor, or the crop changes shape at the border.
    const scale = Math.min(1, width > 0 ? maxWidth / width : 1, height > 0 ? maxHeight / height : 1)
    width *= scale
    height *= scale
  } else {
    width = Math.min(width, maxWidth)
    height = Math.min(height, maxHeight)
  }

  const x = placeAlong(asked.x, asked.width, width, anchorX)
  const y = placeAlong(asked.y, asked.height, height, anchorY)

  return {
    x: clamp(x, bounds.x, bounds.x + bounds.width - width),
    y: clamp(y, bounds.y, bounds.y + bounds.height - height),
    width,
    height,
  }
}

export const rectsAreClose = (a: Rect, b: Rect, epsilon = 0.01): boolean =>
  Math.abs(a.x - b.x) < epsilon &&
  Math.abs(a.y - b.y) < epsilon &&
  Math.abs(a.width - b.width) < epsilon &&
  Math.abs(a.height - b.height) < epsilon

/**
 * The canvas box. This is the frame, not the picture. Like v1, it fills the given width
 * and the image is centred inside, so a narrow source sits between shaded margins.
 * Height comes from the displayed image size: natural size, unless wider than the space. Sources are never enlarged.
 * The image is fitted with `contain`, so image and canvas pixels differ by one scale factor and an offset.
 */
export const canvasSizeFor = (natural: Size, availableWidth: number, minWidth: number, minHeight: number): Size => {
  const width = Math.max(availableWidth, minWidth)
  if (!(natural.width > 0) || !(natural.height > 0)) {
    return { width, height: minHeight }
  }
  const displayedWidth = Math.min(natural.width, availableWidth)
  const displayedHeight = (displayedWidth * natural.height) / natural.width
  return { width, height: Math.max(displayedHeight, minHeight) }
}
