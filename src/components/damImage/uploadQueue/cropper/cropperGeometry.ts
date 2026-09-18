/**
 * The geometry behind `ACropper`: how big the canvas is, where the initial crop box lands, and how a
 * crop box is kept inside the image. cropper.js v1 did all of this internally and v2 does none of
 * it, so it has to live somewhere — and here, away from the DOM, it can be tested directly rather
 * than through a mounted component.
 */
import { getAdjustedSizes } from 'cropperjs2'

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
 * Which edge of the selection stays put while the other one moves. Resizing from the west handle
 * pins the east edge, resizing from the north-east corner pins the south-west one, and the side
 * handles grow symmetrically around the perpendicular centre — this mirrors how cropper.js v2
 * computes a resize, and it is what lets a clamped selection stop at the image border instead of
 * sliding along it.
 *
 * `fit` is the anchor-less case (a programmatic `setData`, a plain move, a re-fit after the
 * container changed): the box may be as large as the image allows anywhere, and is slid back into
 * view afterwards, which is what cropper.js v1's `limitCropBox` did.
 */
export type AnchorSide = 'start' | 'center' | 'end' | 'fit'

export type Anchor = [AnchorSide, AnchorSide]

/** Anchors per cropper.js action name. Anything missing is treated as a plain "fit it in" clamp. */
export const RESIZE_ANCHORS: Readonly<Record<string, Anchor>> = {
  'n-resize': ['center', 'end'],
  's-resize': ['center', 'start'],
  'e-resize': ['start', 'center'],
  'w-resize': ['end', 'center'],
  'ne-resize': ['start', 'end'],
  'nw-resize': ['end', 'end'],
  'se-resize': ['start', 'start'],
  'sw-resize': ['end', 'start'],
  // Drawing a brand new selection grows it away from the point the drag started at.
  select: ['start', 'start'],
}

export const isUsableAspectRatio = (aspectRatio: number): boolean => Number.isFinite(aspectRatio) && aspectRatio > 0

const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)

/**
 * The largest box of `aspectRatio` that fits inside `size`. With no usable ratio the size is
 * returned untouched, which is how a free-form crop behaves.
 */
export const fitAspectRatio = (size: Size, aspectRatio: number): Size => {
  if (!isUsableAspectRatio(aspectRatio)) return { width: size.width, height: size.height }
  return size.height * aspectRatio > size.width
    ? { width: size.width, height: size.width / aspectRatio }
    : { width: size.height * aspectRatio, height: size.height }
}

/**
 * The box the crop starts out as: cropper.js v1's `autoCropArea` applied to the aspect-fitted
 * image, centred. Because `fitAspectRatio` scales linearly this is the same rectangle whether it is
 * computed in natural pixels or in displayed ones — which is why the crop data a user sees does not
 * depend on how wide their window happens to be.
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
 * Grows a box to the given ratio, by calling the very function cropper.js' `$change` will call on
 * it. Doing it here first means a rectangle is already the shape the library will make it *before*
 * it is measured against the image: a crop that names a new height keeps its old width through the
 * clamp otherwise, and cropper.js then widens it to suit the ratio — straight past the image edge.
 *
 * The guard is not redundant. `getAdjustedSizes` has no notion of a free-form crop and answers a
 * `NaN` ratio with a `NaN` dimension.
 */
export const coverAspectRatio = (size: Size, aspectRatio: number): Size =>
  isUsableAspectRatio(aspectRatio)
    ? getAdjustedSizes({ width: size.width, height: size.height, aspectRatio }, 'cover')
    : { width: size.width, height: size.height }

/** How much room an axis has left once the anchored edge is held still. */
const availableAlong = (start: number, length: number, boundsStart: number, boundsLength: number, side: AnchorSide) => {
  const boundsEnd = boundsStart + boundsLength
  if (side === 'start') return Math.max(0, boundsEnd - Math.max(start, boundsStart))
  if (side === 'end') return Math.max(0, Math.min(start + length, boundsEnd) - boundsStart)
  // `center` and `fit` are both free to use the whole span; only where they land differs.
  return boundsLength
}

/** Where the axis ends up once its length is known and the anchored edge has to stay put. */
const placeAlong = (start: number, length: number, newLength: number, side: AnchorSide) => {
  if (side === 'end') return start + length - newLength
  if (side === 'center') return start + length / 2 - newLength / 2
  return start
}

/**
 * Keeps `rect` inside `bounds` the way cropper.js v1's `viewMode: 1` did: a selection that has
 * grown past an edge is shrunk rather than pushed, so the edge the user is not dragging stays where
 * they put it, and a selection that is merely out of position is slid back in whole.
 *
 * `anchor` says which edges the current gesture is holding still. Leaving it out (a programmatic
 * `setData`, the initial layout, a re-fit after a resize) caps the size at the bounds, keeps the
 * top-left corner it was given and slides the result into view — what v1's `limitCropBox` did.
 */
export const clampRectInside = (rect: Rect, bounds: Rect, aspectRatio: number, anchor?: Anchor): Rect => {
  const [anchorX, anchorY] = anchor ?? ['fit', 'fit']

  // Measure the rectangle cropper.js would end up with, not the one that was asked for. A rectangle
  // already in the right proportion — which is everything a drag produces — is untouched by this.
  const asked = { ...rect, ...coverAspectRatio(rect, aspectRatio) }

  const maxWidth = availableAlong(asked.x, asked.width, bounds.x, bounds.width, anchorX)
  const maxHeight = availableAlong(asked.y, asked.height, bounds.y, bounds.height, anchorY)

  let { width, height } = asked
  if (isUsableAspectRatio(aspectRatio)) {
    // Shrink both axes by the same factor, otherwise the crop silently changes shape at the border.
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
 * The box the cropper canvas takes. This is the frame, not the picture: cropper.js v1 let its
 * container fill the width it was given and then centred the image inside it, so a source narrower
 * than the container sat between two shaded margins rather than stretching to fill them. The height
 * comes from the image at its displayed size, which is its natural size unless that is wider than
 * the space available — v1 never enlarged a source either, its `<img>` being capped at `max-width`.
 *
 * The image is fitted into this box with `contain`, so image pixels and canvas pixels differ by one
 * uniform scale factor and an offset.
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
