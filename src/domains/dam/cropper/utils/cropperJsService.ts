import type { RegionOfInterest } from '@/domains/dam/types/Roi'
import type { CropRect } from '@/domains/dam/cropper/utils/cropperTypes'

const PRECISION = 3

const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}

const clampFraction = (value: number) => Math.min(Math.max(value, 0), 1)

/**
 * The DAM rejects a region ending past the image (`size * fraction + point > size`). The anchor is rounded
 * to whole pixels and the size to three decimals, so a region flush with the far edge can overrun by a
 * fraction of a pixel. The anchor is pulled back by the DAM's own sum, which keeps the region's size and ratio.
 */
const fitPoint = (point: number, fraction: number, size: number) => {
  let fitted = Math.min(Math.max(point, 0), size)
  while (fitted > 0 && size * fraction + fitted > size) fitted--
  return fitted
}

/**
 * Converts a stored region of interest to a crop rectangle and back.
 * Pure arithmetic on the source image dimensions. The region stores its size as fractions
 * and its anchor is effectively a fraction too, so the displayed image size is not needed.
 */
export const regionToCrop = (
  regionOfInterest: RegionOfInterest,
  originalImageWidth: number,
  originalImageHeight: number
): CropRect => {
  if (!(originalImageWidth > 0) || !(originalImageHeight > 0)) {
    return { x: 0, y: 0, width: 1, height: 1 }
  }
  return {
    x: clampFraction(regionOfInterest.pointX / originalImageWidth),
    y: clampFraction(regionOfInterest.pointY / originalImageHeight),
    width: clampFraction(regionOfInterest.percentageWidth),
    height: clampFraction(regionOfInterest.percentageHeight),
  }
}

export const cropToRegion = (
  crop: CropRect,
  regionOfInterest: RegionOfInterest,
  originalImageWidth: number,
  originalImageHeight: number
): RegionOfInterest => {
  const percentageWidth = roundTo(clampFraction(crop.width), PRECISION)
  const percentageHeight = roundTo(clampFraction(crop.height), PRECISION)
  regionOfInterest.pointX = fitPoint(Math.round(crop.x * originalImageWidth), percentageWidth, originalImageWidth)
  regionOfInterest.pointY = fitPoint(Math.round(crop.y * originalImageHeight), percentageHeight, originalImageHeight)
  regionOfInterest.percentageWidth = percentageWidth
  regionOfInterest.percentageHeight = percentageHeight

  return regionOfInterest
}
