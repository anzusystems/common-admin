import { describe, expect, it } from 'vitest'
import { getAdjustedSizes } from 'cropperjs2'
import {
  canvasSizeFor,
  clampRectInside,
  coverAspectRatio,
  fitAspectRatio,
  initialSelectionRect,
  isUsableAspectRatio,
  rectsAreClose,
  RESIZE_ANCHORS,
  type Rect,
} from '@/components/damImage/uploadQueue/cropper/cropperGeometry'

/**
 * The arithmetic `ACropper` is built on. It is tested here rather than only through a mounted
 * component because these are the rules that decide where a crop box may sit — and a rounding
 * mistake in them shows up as a region of interest saved a few pixels off, which nobody notices
 * until the published image is wrong.
 */

const IMAGE: Rect = { x: 0, y: 0, width: 800, height: 600 }
const AR_16_9 = 16 / 9

describe('isUsableAspectRatio', () => {
  it('accepts a positive finite ratio', () => {
    expect(isUsableAspectRatio(AR_16_9)).toBe(true)
    expect(isUsableAspectRatio(1)).toBe(true)
    expect(isUsableAspectRatio(0.01)).toBe(true)
  })

  it('rejects the values that stand for "free-form"', () => {
    expect(isUsableAspectRatio(NaN)).toBe(false)
    expect(isUsableAspectRatio(0)).toBe(false)
    expect(isUsableAspectRatio(-2)).toBe(false)
    expect(isUsableAspectRatio(Infinity)).toBe(false)
  })
})

describe('fitAspectRatio', () => {
  it('limits the height when the box is relatively too tall', () => {
    expect(fitAspectRatio({ width: 800, height: 600 }, AR_16_9)).toEqual({ width: 800, height: 450 })
  })

  it('limits the width when the box is relatively too wide', () => {
    expect(fitAspectRatio({ width: 1200, height: 400 }, 1)).toEqual({ width: 400, height: 400 })
  })

  it('returns a square box untouched for a square ratio', () => {
    expect(fitAspectRatio({ width: 300, height: 300 }, 1)).toEqual({ width: 300, height: 300 })
  })

  it('leaves the box alone when there is no usable ratio', () => {
    expect(fitAspectRatio({ width: 800, height: 600 }, NaN)).toEqual({ width: 800, height: 600 })
  })

  it('scales linearly, so the fitted box does not depend on the units used', () => {
    const large = fitAspectRatio({ width: 800, height: 600 }, AR_16_9)
    const half = fitAspectRatio({ width: 400, height: 300 }, AR_16_9)
    expect(half.width * 2).toBeCloseTo(large.width, 6)
    expect(half.height * 2).toBeCloseTo(large.height, 6)
  })
})

describe('coverAspectRatio', () => {
  it('grows the height when the box is relatively too wide', () => {
    expect(coverAspectRatio({ width: 800, height: 100 }, 1)).toEqual({ width: 800, height: 800 })
  })

  it('grows the width when the box is relatively too tall', () => {
    expect(coverAspectRatio({ width: 100, height: 800 }, 1)).toEqual({ width: 800, height: 800 })
  })

  it('leaves a box that is already in proportion alone', () => {
    expect(coverAspectRatio({ width: 640, height: 360 }, AR_16_9)).toEqual({ width: 640, height: 360 })
  })

  it('is idempotent', () => {
    const once = coverAspectRatio({ width: 640, height: 600 }, AR_16_9)
    expect(coverAspectRatio(once, AR_16_9)).toEqual(once)
  })

  it('leaves the box alone when there is no usable ratio', () => {
    expect(coverAspectRatio({ width: 640, height: 600 }, NaN)).toEqual({ width: 640, height: 600 })
  })

  // This is the shape cropper.js v2's own `$change` imposes; anything that measures a rectangle
  // against the image has to measure the grown one or the clamp is applied to the wrong box.
  it('matches what cropper.js does to a height-only change', () => {
    expect(coverAspectRatio({ width: 640, height: 600 }, AR_16_9)).toEqual({
      width: 1066.6666666666665,
      height: 600,
    })
  })

  // Pinned against the real thing rather than a remembered copy of it: `$change` runs every
  // rectangle through `getAdjustedSizes(..., 'cover')`, and a drift between the two would put the
  // clamp back to measuring a box cropper.js is about to replace.
  it('agrees with cropper.js getAdjustedSizes(cover) across a spread of boxes', () => {
    const ratios = [AR_16_9, 1, 0.75, 3, 0.4]
    const boxes = [
      { width: 640, height: 600 },
      { width: 800, height: 20 },
      { width: 100, height: 600 },
      { width: 1, height: 1 },
      { width: 1200, height: 40 },
      { width: 333.33, height: 187.5 },
    ]
    ratios.forEach((aspectRatio) => {
      boxes.forEach((box) => {
        const mine = coverAspectRatio(box, aspectRatio)
        const theirs = getAdjustedSizes({ ...box, aspectRatio }, 'cover')
        expect(mine.width).toBeCloseTo(theirs.width, 9)
        expect(mine.height).toBeCloseTo(theirs.height, 9)
      })
    })
  })
})

describe('initialSelectionRect', () => {
  it('matches what cropper.js v1 produced for a 16:9 crop of an 800x600 image', () => {
    expect(initialSelectionRect({ width: 800, height: 600 }, AR_16_9, 0.8)).toEqual({
      x: 80,
      y: 120,
      width: 640,
      height: 360,
    })
  })

  it('matches what cropper.js v1 produced for a square crop of an 800x600 image', () => {
    expect(initialSelectionRect({ width: 800, height: 600 }, 1, 0.8)).toEqual({
      x: 160,
      y: 60,
      width: 480,
      height: 480,
    })
  })

  it('matches what cropper.js v1 produced for a square crop of a 1200x400 image', () => {
    expect(initialSelectionRect({ width: 1200, height: 400 }, 1, 0.8)).toEqual({
      x: 440,
      y: 40,
      width: 320,
      height: 320,
    })
  })

  it('covers the coverage share of the whole box when the crop is free-form', () => {
    expect(initialSelectionRect({ width: 800, height: 600 }, NaN, 0.8)).toEqual({
      x: 80,
      y: 60,
      width: 640,
      height: 480,
    })
  })

  it('is always centred', () => {
    const rect = initialSelectionRect({ width: 500, height: 300 }, 2, 0.6)
    expect(rect.x + rect.width / 2).toBeCloseTo(250, 6)
    expect(rect.y + rect.height / 2).toBeCloseTo(150, 6)
  })

  it('fills the box exactly at full coverage', () => {
    expect(initialSelectionRect({ width: 400, height: 200 }, 2, 1)).toEqual({
      x: 0,
      y: 0,
      width: 400,
      height: 200,
    })
  })
})

describe('clampRectInside without an anchor', () => {
  it('leaves a rectangle that already fits alone', () => {
    const rect = { x: 100, y: 100, width: 320, height: 180 }
    expect(clampRectInside(rect, IMAGE, AR_16_9)).toEqual(rect)
  })

  it('slides a rectangle hanging off the left edge back on', () => {
    const result = clampRectInside({ x: -50, y: 100, width: 320, height: 180 }, IMAGE, AR_16_9)
    expect(result).toEqual({ x: 0, y: 100, width: 320, height: 180 })
  })

  it('slides a rectangle hanging off the bottom-right back on', () => {
    const result = clampRectInside({ x: 700, y: 500, width: 320, height: 180 }, IMAGE, AR_16_9)
    expect(result).toEqual({ x: 480, y: 420, width: 320, height: 180 })
  })

  it('shrinks an oversized rectangle on both axes at once, keeping the ratio', () => {
    const result = clampRectInside({ x: 0, y: 0, width: 1600, height: 900 }, IMAGE, AR_16_9)
    expect(result.width).toBeCloseTo(800, 6)
    expect(result.height).toBeCloseTo(450, 6)
    expect(result.width / result.height).toBeCloseTo(AR_16_9, 6)
  })

  it('is limited by the tighter axis when shrinking', () => {
    const result = clampRectInside({ x: 0, y: 0, width: 900, height: 900 }, IMAGE, 1)
    expect(result.width).toBeCloseTo(600, 6)
    expect(result.height).toBeCloseTo(600, 6)
  })

  it('clips each axis independently when the crop is free-form', () => {
    const result = clampRectInside({ x: 0, y: 0, width: 1600, height: 700 }, IMAGE, NaN)
    expect(result).toEqual({ x: 0, y: 0, width: 800, height: 600 })
  })

  it('keeps the result inside the bounds for a non-zero bounds origin', () => {
    const bounds = { x: 40, y: 20, width: 200, height: 100 }
    const result = clampRectInside({ x: 0, y: 0, width: 80, height: 45 }, bounds, AR_16_9)
    expect(result.x).toBe(40)
    expect(result.y).toBe(20)
  })
})

describe('clampRectInside while resizing', () => {
  it('holds the top-left corner when the bottom-right grip runs past the edge', () => {
    const result = clampRectInside(
      { x: 600, y: 400, width: 400, height: 225 },
      IMAGE,
      AR_16_9,
      RESIZE_ANCHORS['se-resize']
    )
    expect(result.x).toBe(600)
    expect(result.y).toBe(400)
    expect(result.x + result.width).toBeLessThanOrEqual(800)
    expect(result.y + result.height).toBeLessThanOrEqual(600)
    expect(result.width / result.height).toBeCloseTo(AR_16_9, 6)
  })

  it('holds the bottom-right corner when the top-left grip runs past the edge', () => {
    const result = clampRectInside(
      { x: -100, y: -60, width: 400, height: 225 },
      IMAGE,
      AR_16_9,
      RESIZE_ANCHORS['nw-resize']
    )
    expect(result.x + result.width).toBeCloseTo(300, 6)
    expect(result.y + result.height).toBeCloseTo(165, 6)
    expect(result.x).toBeGreaterThanOrEqual(0)
    expect(result.y).toBeGreaterThanOrEqual(0)
  })

  it('holds the east edge when the west grip is dragged past the left border', () => {
    const result = clampRectInside(
      { x: -100, y: 200, width: 500, height: 281.25 },
      IMAGE,
      AR_16_9,
      RESIZE_ANCHORS['w-resize']
    )
    expect(result.x + result.width).toBeCloseTo(400, 6)
    expect(result.x).toBeCloseTo(0, 6)
  })

  it('holds the south edge when the north grip is dragged past the top border', () => {
    const result = clampRectInside(
      { x: 200, y: -80, width: 400, height: 225 },
      IMAGE,
      AR_16_9,
      RESIZE_ANCHORS['n-resize']
    )
    expect(result.y + result.height).toBeCloseTo(145, 6)
    expect(result.y).toBeCloseTo(0, 6)
  })

  it('lets a side resize use the whole perpendicular span, sliding if it has to', () => {
    // An off-centre box resized from the top may become as wide as the image and shifts to fit,
    // exactly as cropper.js v1's limitCropBox did.
    const result = clampRectInside(
      { x: 500, y: 100, width: 800, height: 450 },
      IMAGE,
      AR_16_9,
      RESIZE_ANCHORS['n-resize']
    )
    expect(result.width).toBeCloseTo(800, 6)
    expect(result.x).toBeCloseTo(0, 6)
  })

  it('grows a brand new selection away from the point it started at', () => {
    const result = clampRectInside({ x: 700, y: 500, width: 400, height: 225 }, IMAGE, AR_16_9, RESIZE_ANCHORS.select)
    expect(result.x).toBe(700)
    expect(result.y).toBe(500)
    expect(result.width).toBeLessThanOrEqual(100)
    expect(result.height).toBeLessThanOrEqual(100)
  })

  it('never returns a rectangle that leaves the bounds, whatever the anchor', () => {
    const anchors = Object.keys(RESIZE_ANCHORS)
    const candidates: Rect[] = [
      // Already in proportion — what a drag produces.
      { x: -500, y: -500, width: 2000, height: 1125 },
      { x: 790, y: 590, width: 400, height: 225 },
      { x: -10, y: 300, width: 100, height: 56.25 },
      { x: 400, y: -300, width: 900, height: 506.25 },
      // Out of proportion — what a partial `setData` produces, and what cropper.js would grow.
      { x: 0, y: 0, width: 640, height: 600 },
      { x: 0, y: 0, width: 800, height: 20 },
      { x: 400, y: 300, width: 100, height: 600 },
      { x: -200, y: 500, width: 1200, height: 40 },
      { x: 700, y: 10, width: 50, height: 590 },
    ]
    anchors.forEach((anchor) => {
      candidates.forEach((candidate) => {
        const result = clampRectInside(candidate, IMAGE, AR_16_9, RESIZE_ANCHORS[anchor])
        expect(result.x).toBeGreaterThanOrEqual(-0.0001)
        expect(result.y).toBeGreaterThanOrEqual(-0.0001)
        expect(result.x + result.width).toBeLessThanOrEqual(800.0001)
        expect(result.y + result.height).toBeLessThanOrEqual(600.0001)
        expect(result.width / result.height).toBeCloseTo(AR_16_9, 4)
      })
    })
  })

  it('is idempotent — clamping an already clamped rectangle changes nothing', () => {
    const once = clampRectInside({ x: -100, y: 700, width: 1000, height: 562.5 }, IMAGE, AR_16_9)
    const twice = clampRectInside(once, IMAGE, AR_16_9)
    expect(rectsAreClose(once, twice)).toBe(true)
  })
})

describe('clampRectInside with a rectangle that is not yet in proportion', () => {
  // A `setData` naming one dimension arrives with the other still at its old value. Clamping that
  // rectangle as given would pass, and cropper.js would then widen it past the image to suit the
  // ratio — so the growth has to happen first and be clamped along with everything else.
  it('grows the rectangle to the ratio before measuring it against the image', () => {
    const result = clampRectInside({ x: 0, y: 0, width: 640, height: 600 }, IMAGE, AR_16_9)
    expect(result.width).toBeLessThanOrEqual(800)
    expect(result.height).toBeLessThanOrEqual(600)
    expect(result.width / result.height).toBeCloseTo(AR_16_9, 6)
    expect(result.width).toBeCloseTo(800, 6)
  })

  it('does the same for a width-only change', () => {
    const result = clampRectInside({ x: 0, y: 0, width: 800, height: 100 }, IMAGE, AR_16_9)
    expect(result.width).toBeCloseTo(800, 6)
    expect(result.height).toBeCloseTo(450, 6)
  })

  it('returns a rectangle cropper.js will not change again', () => {
    const result = clampRectInside({ x: 100, y: 50, width: 400, height: 90 }, IMAGE, AR_16_9)
    const asCropperWouldHaveIt = coverAspectRatio(result, AR_16_9)
    expect(asCropperWouldHaveIt.width).toBeCloseTo(result.width, 6)
    expect(asCropperWouldHaveIt.height).toBeCloseTo(result.height, 6)
  })
})

describe('canvasSizeFor', () => {
  // The canvas is the frame the image is centred in, not the image itself — cropper.js v1 let its
  // container fill the width it was given and shaded whatever the picture did not cover.
  it('takes the full width available and the image height for a source wider than the container', () => {
    expect(canvasSizeFor({ width: 800, height: 600 }, 640, 200, 100)).toEqual({ width: 640, height: 480 })
  })

  it('still takes the full width for a source narrower than the container', () => {
    expect(canvasSizeFor({ width: 240, height: 180 }, 640, 200, 100)).toEqual({ width: 640, height: 180 })
  })

  it('never enlarges a small source to fill the height', () => {
    // 240x180 in a 640 wide frame keeps its own 180px height rather than growing to 480.
    expect(canvasSizeFor({ width: 240, height: 180 }, 640, 200, 100).height).toBe(180)
  })

  it('matches the image box exactly once the source is wider than the container', () => {
    const size = canvasSizeFor({ width: 1200, height: 400 }, 300, 200, 100)
    expect(size).toEqual({ width: 300, height: 100 })
  })

  it('respects the minimum container width', () => {
    expect(canvasSizeFor({ width: 240, height: 180 }, 150, 200, 100).width).toBe(200)
  })

  it('respects the minimum container height', () => {
    expect(canvasSizeFor({ width: 1200, height: 400 }, 120, 200, 100).height).toBe(100)
  })

  it('degrades gracefully when the natural size is not known yet', () => {
    expect(canvasSizeFor({ width: 0, height: 0 }, 640, 200, 100)).toEqual({ width: 640, height: 100 })
  })
})

describe('rectsAreClose', () => {
  it('treats sub-pixel drift as equal', () => {
    expect(
      rectsAreClose({ x: 1, y: 2, width: 3, height: 4 }, { x: 1.001, y: 2.001, width: 3.001, height: 4.001 })
    ).toBe(true)
  })

  it('spots a real difference', () => {
    expect(rectsAreClose({ x: 1, y: 2, width: 3, height: 4 }, { x: 1.5, y: 2, width: 3, height: 4 })).toBe(false)
  })
})
