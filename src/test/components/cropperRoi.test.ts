import { describe, expect, it } from 'vitest'
import { cropToRegion, regionToCrop } from '@/components/damImage/uploadQueue/composables/cropperJsService'
import type { CropRect } from '@/components/damImage/uploadQueue/cropper/cropperTypes'
import type { RegionOfInterest } from '@/types/coreDam/Roi'

/**
 * The region-of-interest conversion, on its own.
 *
 * It used to need a mounted cropper: the region went through the displayed picture's natural size on
 * its way to a crop and back. That size cancelled out of every sum it appeared in — a detail
 * rendition is a scaled copy of the original — so the conversion is now plain arithmetic over the
 * source dimensions, and can be tested as such.
 */

const roi = (over: Partial<RegionOfInterest> = {}): RegionOfInterest =>
  ({
    id: 'roi-1',
    title: 'default',
    position: 0,
    image: 'image-1',
    pointX: 0,
    pointY: 0,
    percentageWidth: 0.5,
    percentageHeight: 0.5,
    links: { image_roi_example: [] },
    ...over,
  }) as unknown as RegionOfInterest

const WIDTH = 800
const HEIGHT = 600

describe('regionToCrop', () => {
  it('turns the anchor into a fraction of the source', () => {
    expect(regionToCrop(roi({ pointX: 120, pointY: 90 }), WIDTH, HEIGHT)).toMatchObject({
      x: 0.15,
      y: 0.15,
    })
  })

  it('passes the stored size through untouched', () => {
    expect(regionToCrop(roi({ percentageWidth: 0.4, percentageHeight: 0.3 }), WIDTH, HEIGHT)).toMatchObject({
      width: 0.4,
      height: 0.3,
    })
  })

  it('covers the whole picture for a region that does', () => {
    const crop = regionToCrop(roi({ pointX: 0, pointY: 0, percentageWidth: 1, percentageHeight: 1 }), WIDTH, HEIGHT)
    expect(crop).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  it('keeps a nonsense region inside the picture', () => {
    const crop = regionToCrop(
      roi({ pointX: -50, pointY: 5000, percentageWidth: 3, percentageHeight: -1 }),
      WIDTH,
      HEIGHT
    )
    expect(crop.x).toBe(0)
    expect(crop.y).toBe(1)
    expect(crop.width).toBe(1)
    expect(crop.height).toBe(0)
  })

  it('answers something usable before the source dimensions are known', () => {
    expect(regionToCrop(roi(), 0, 0)).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })
})

describe('cropToRegion', () => {
  const crop = (over: Partial<CropRect> = {}): CropRect => ({
    x: 0.15,
    y: 0.15,
    width: 0.4,
    height: 0.3,
    ...over,
  })

  it('turns the fraction back into whole source pixels', () => {
    const region = cropToRegion(crop(), roi(), WIDTH, HEIGHT)
    expect(region.pointX).toBe(120)
    expect(region.pointY).toBe(90)
  })

  it('stores the size to three decimals', () => {
    const region = cropToRegion(crop({ width: 0.123456, height: 0.4 }), roi(), WIDTH, HEIGHT)
    expect(region.percentageWidth).toBe(0.123)
    expect(region.percentageHeight).toBe(0.4)
  })

  it('never stores a negative anchor', () => {
    const region = cropToRegion(crop({ x: -0.2, y: -0.2 }), roi(), WIDTH, HEIGHT)
    expect(region.pointX).toBe(0)
    expect(region.pointY).toBe(0)
  })

  // The conversion this replaced tried to correct a crop that overran the edge, and subtracted a
  // pixel count times a hundred from a fraction: a 0.6px rounding overshoot on a 600px image turned
  // a stored 0.401 into 0.301. Nothing overruns here, so there is nothing to correct.
  it('does not mangle a region that sits flush against the far edge', () => {
    const region = cropToRegion(crop({ x: 0.6, y: 0.6, width: 0.4, height: 0.4 }), roi(), WIDTH, HEIGHT)
    expect(region.pointX).toBe(480)
    expect(region.pointY).toBe(360)
    expect(region.percentageWidth).toBe(0.4)
    expect(region.percentageHeight).toBe(0.4)
    expect(region.pointX + region.percentageWidth * WIDTH).toBe(WIDTH)
    expect(region.pointY + region.percentageHeight * HEIGHT).toBe(HEIGHT)
  })

  it('writes onto the region it was given, as the DAM expects', () => {
    const target = roi({ title: 'keep me' })
    const region = cropToRegion(crop(), target, WIDTH, HEIGHT)
    expect(region).toBe(target)
    expect(region.title).toBe('keep me')
  })
})

describe('the round trip', () => {
  const cases = [
    ['top-left corner', { pointX: 0, pointY: 0, percentageWidth: 0.5, percentageHeight: 0.375 }],
    ['centred', { pointX: 200, pointY: 150, percentageWidth: 0.5, percentageHeight: 0.5 }],
    ['flush bottom-right', { pointX: 480, pointY: 360, percentageWidth: 0.4, percentageHeight: 0.4 }],
    ['a thin strip', { pointX: 10, pointY: 20, percentageWidth: 0.05, percentageHeight: 0.9 }],
  ] as const

  cases.forEach(([label, stored]) => {
    it(`survives a region ${label}`, () => {
      const result = cropToRegion(regionToCrop(roi(stored), WIDTH, HEIGHT), roi(), WIDTH, HEIGHT)
      expect(result.pointX).toBe(stored.pointX)
      expect(result.pointY).toBe(stored.pointY)
      expect(result.percentageWidth).toBeCloseTo(stored.percentageWidth, 3)
      expect(result.percentageHeight).toBeCloseTo(stored.percentageHeight, 3)
    })
  })

  it('is the same whatever size the picture on screen happens to be', () => {
    // The old conversion read the displayed picture's natural size; this one cannot, so there is
    // nothing left for a different rendition to change.
    const stored = roi({ pointX: 160, pointY: 120, percentageWidth: 0.35, percentageHeight: 0.2625 })
    const crop = regionToCrop(stored, WIDTH, HEIGHT)
    expect(cropToRegion(crop, roi(), WIDTH, HEIGHT)).toMatchObject(cropToRegion(crop, roi(), WIDTH, HEIGHT))
    expect(crop).toEqual({ x: 0.2, y: 0.2, width: 0.35, height: 0.2625 })
  })
})
